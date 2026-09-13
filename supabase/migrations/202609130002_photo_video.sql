-- Apply after 202609130001. Uses existing fal/Supabase credentials and credit balance.
create table public.video_prices (
  preset text primary key check(preset in ('cinematic','memory','breeze','motion')),
  credits integer not null check(credits>0),
  cost_ceiling_cents integer not null check(cost_ceiling_cents>0),
  enabled boolean not null default true
);
insert into public.video_prices values ('cinematic',60,50,true),('memory',60,50,true),('breeze',60,50,true),('motion',90,80,true);
create table public.video_jobs (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete restrict,
  fingerprint text not null, preset text not null references public.video_prices(preset),
  status text not null default 'reserved' check(status in ('reserved','submitting','queued','processing','succeeded','failed','uncertain','expired')),
  provider_model text not null, provider_request_id text unique,
  credits_charged integer not null check(credits_charged>0), cost_ceiling_cents integer not null check(cost_ceiling_cents>0),
  error_code text, lease_id uuid, lease_until timestamptz, next_check_at timestamptz not null default now(),
  provider_cleaned boolean not null default false, files_deleted boolean not null default false,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours'
);
create index video_jobs_owner on public.video_jobs(user_id,created_at desc);
create index video_jobs_cleanup on public.video_jobs(expires_at) where not files_deleted;
create table public.video_credit_allocations (
  job_id uuid not null references public.video_jobs(id) on delete restrict,
  grant_id text not null references public.credit_grants(id) on delete restrict,
  credits integer not null check(credits>0), refunded boolean not null default false,
  primary key(job_id,grant_id)
);
do $$ declare t text; begin
  foreach t in array array['video_prices','video_jobs','video_credit_allocations'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('videos','videos',false,50000000,array['image/jpeg','video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Video files server only" on storage.objects as restrictive for all to anon,authenticated
using(bucket_id<>'videos') with check(bucket_id<>'videos');

-- Both image and video paths must share the same budget and lock, including mixed requests.
create function public.check_media_budget(p_user uuid,p_cost integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare limits generation_limits; day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_advisory_xact_lock(1980,1);
  select * into limits from generation_limits where id=true;
  if not found then raise exception 'FEATURE_DISABLED'; end if;
  if (select count(*) from portrait_jobs where user_id=p_user and created_at>=day_start)+(select count(*) from video_jobs where user_id=p_user and created_at>=day_start)>=limits.user_daily_attempts
    or (select count(*) from portrait_jobs where created_at>=day_start)+(select count(*) from video_jobs where created_at>=day_start)>=limits.site_daily_attempts
    or (select coalesce(sum(cost_ceiling_cents),0) from portrait_jobs where created_at>=day_start)+(select coalesce(sum(cost_ceiling_cents),0) from video_jobs where created_at>=day_start)+p_cost>limits.daily_budget_cents then raise exception 'RATE_LIMIT'; end if;
  if exists(select 1 from video_jobs where user_id=p_user and status in ('reserved','submitting','queued','processing') and created_at>now()-interval '1 hour') then raise exception 'BUSY'; end if;
end $$;
create function public.image_media_budget_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin perform check_media_budget(new.user_id,new.cost_ceiling_cents); return new; end $$;
create trigger image_shared_budget before insert on public.portrait_jobs for each row execute function public.image_media_budget_trigger();

create function public.reserve_video_job(p_id uuid,p_user uuid,p_fingerprint text,p_preset text,p_expected_credits integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare existing video_jobs; price video_prices; grant_row credit_grants; needed integer; taken integer;
begin
  perform pg_advisory_xact_lock(1980,1); perform ensure_account(p_user);
  select * into existing from video_jobs where id=p_id;
  if found then
    if existing.user_id<>p_user or existing.fingerprint<>p_fingerprint then raise exception 'CONFLICT'; end if;
    return jsonb_build_object('fresh',false,'job',to_jsonb(existing));
  end if;
  select * into existing from video_jobs where user_id=p_user and fingerprint=p_fingerprint and status in ('reserved','submitting','queued','processing','uncertain') and expires_at>now() order by created_at desc limit 1;
  if found then return jsonb_build_object('fresh',false,'job',to_jsonb(existing)); end if;
  select * into price from video_prices where preset=p_preset and enabled and credits=p_expected_credits;
  if not found then raise exception 'FEATURE_DISABLED'; end if;
  if (select billing_hold from account_profiles where user_id=p_user) then raise exception 'BILLING_HOLD'; end if;
  perform check_media_budget(p_user,price.cost_ceiling_cents);
  if exists(select 1 from portrait_jobs where user_id=p_user and status in ('reserved','processing') and created_at>now()-interval '6 minutes') then raise exception 'BUSY'; end if;
  if (select coalesce(sum(remaining),0) from credit_grants where user_id=p_user and expires_at>now() and not revoked)<price.credits then raise exception 'CREDITS'; end if;
  insert into video_jobs(id,user_id,fingerprint,preset,provider_model,credits_charged,cost_ceiling_cents)
    values(p_id,p_user,p_fingerprint,p_preset,case when p_preset='motion' then 'fal-ai/kling-video/v3/standard/motion-control' else 'fal-ai/kling-video/v3/standard/image-to-video' end,price.credits,price.cost_ceiling_cents) returning * into existing;
  needed:=price.credits;
  for grant_row in select * from credit_grants where user_id=p_user and expires_at>now() and remaining>0 and not revoked order by expires_at,id for update loop
    taken:=least(needed,grant_row.remaining);
    update credit_grants set remaining=remaining-taken where id=grant_row.id;
    insert into video_credit_allocations values(p_id,grant_row.id,taken,false);
    needed:=needed-taken; exit when needed=0;
  end loop;
  insert into credit_ledger(id,user_id,delta,kind,job_id) values('video:'||p_id,p_user,-price.credits,'generation',p_id);
  return jsonb_build_object('fresh',true,'job',to_jsonb(existing));
end $$;

-- A renewable database lease serializes webhook, recovery and deletion workers.
create function public.claim_video_job(p_id uuid,p_lease uuid,p_delete boolean default false) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job video_jobs;
begin
  select * into job from video_jobs where id=p_id for update;
  if not found then return null; end if;
  if job.lease_until>now() then return null; end if;
  if not p_delete and (job.next_check_at>now() or job.status in ('failed','expired') or (job.status='succeeded' and job.provider_cleaned)) then return null; end if;
  if p_delete and job.status in ('reserved','submitting','queued','processing','uncertain') and job.created_at>now()-interval '1 hour' and job.expires_at>now() then raise exception 'BUSY'; end if;
  update video_jobs set lease_id=p_lease,lease_until=now()+interval '3 minutes',next_check_at=now()+interval '10 seconds' where id=p_id returning * into job;
  return to_jsonb(job);
end $$;
create function public.settle_video_failure(p_id uuid,p_uncertain boolean,p_error text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job video_jobs; allocation video_credit_allocations;
begin
  perform pg_advisory_xact_lock(1980,1); perform pg_advisory_xact_lock(1980,3);
  select * into job from video_jobs where id=p_id for update;
  if not found or job.status in ('succeeded','expired','failed') then return; end if;
  update video_jobs set status=case when p_uncertain then 'uncertain' else 'failed' end,error_code=p_error where id=p_id;
  if not p_uncertain then
    for allocation in select * from video_credit_allocations where job_id=p_id and not refunded for update loop
      update credit_grants set remaining=least(total,remaining+allocation.credits) where id=allocation.grant_id;
      update video_credit_allocations set refunded=true where job_id=p_id and grant_id=allocation.grant_id;
    end loop;
    insert into credit_ledger(id,user_id,delta,kind,job_id) values('video-refund:'||p_id,job.user_id,job.credits_charged,'refund',p_id) on conflict do nothing;
  end if;
end $$;
revoke all on function public.check_media_budget(uuid,integer),public.image_media_budget_trigger(),public.reserve_video_job(uuid,uuid,text,text,integer),public.claim_video_job(uuid,uuid,boolean),public.settle_video_failure(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.check_media_budget(uuid,integer),public.image_media_budget_trigger(),public.reserve_video_job(uuid,uuid,text,text,integer),public.claim_video_job(uuid,uuid,boolean),public.settle_video_failure(uuid,boolean,text) to service_role;
