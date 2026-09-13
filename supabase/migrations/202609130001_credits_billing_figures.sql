-- Apply after 202609120002. The legacy portrait RPC remains for a safe staged rollout.
-- Set CREDITS_ENABLED=true only after this migration succeeds.
create table public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 240),
  stripe_customer_id text unique,
  billing_hold boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.credit_grants (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  source text not null check (source in ('welcome','subscription','adjustment')),
  total integer not null check (total > 0 and total <= 100000),
  remaining integer not null check (remaining >= 0 and remaining <= total),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  invoice_id text unique,
  created_at timestamptz not null default now()
);
create index credit_grants_available on public.credit_grants(user_id,expires_at) where remaining > 0 and not revoked;
create table public.credit_ledger (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  delta integer not null,
  kind text not null check (kind in ('welcome','subscription','generation','refund','adjustment')),
  job_id uuid,
  created_at timestamptz not null default now()
);
create index credit_ledger_user on public.credit_ledger(user_id,created_at desc);
create table public.billing_subscriptions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_id text not null check (plan_id in ('starter','creator','studio')),
  interval text not null check (interval in ('month','year')),
  status text not null,
  period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  event_created bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index subscriptions_user on public.billing_subscriptions(user_id);
create table public.billing_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
create table public.billing_checkouts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  attempt_id uuid not null unique,
  plan_id text not null check (plan_id in ('starter','creator','studio')),
  interval text not null check (interval in ('month','year')),
  expires_at timestamptz not null,
  session_id text unique,
  url text,
  created_at timestamptz not null default now()
);

alter table public.portrait_jobs drop constraint portrait_jobs_preset_check;
alter table public.portrait_jobs add constraint portrait_jobs_preset_check check (preset in ('studio','cinema','album','figurine-desk','figurine-box'));
alter table public.portrait_jobs add column credits_charged integer not null default 0 check (credits_charged >= 0);
alter table public.portrait_jobs add column cost_ceiling_cents integer not null default 0 check (cost_ceiling_cents >= 0);
create table public.credit_allocations (
  job_id uuid not null references public.portrait_jobs(id) on delete cascade,
  grant_id text not null references public.credit_grants(id) on delete restrict,
  credits integer not null check (credits > 0),
  refunded boolean not null default false,
  primary key(job_id,grant_id)
);
create table public.generation_prices (
  feature_id text not null,
  quality text not null check (quality in ('medium','high')),
  credits integer not null check (credits > 0),
  cost_ceiling_cents integer not null check (cost_ceiling_cents > 0),
  enabled boolean not null default true,
  primary key(feature_id,quality)
);
insert into public.generation_prices(feature_id,quality,credits,cost_ceiling_cents) values
 ('retro-portrait','medium',3,3),('retro-portrait','high',8,8),
 ('ai-figurine','medium',3,3),('ai-figurine','high',8,8);
create table public.generation_limits (
  id boolean primary key default true check(id),
  user_daily_attempts integer not null default 100 check (user_daily_attempts > 0),
  site_daily_attempts integer not null default 500 check (site_daily_attempts > 0),
  daily_budget_cents integer not null default 2500 check (daily_budget_cents > 0)
);
insert into public.generation_limits(id) values(true);

-- Browser clients can only read their own account data; all mutations are server owned.
do $$ declare t text; begin
  foreach t in array array['account_profiles','credit_grants','credit_ledger','billing_subscriptions','billing_events','billing_checkouts','credit_allocations','generation_prices','generation_limits'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  foreach t in array array['account_profiles','credit_grants','credit_ledger','billing_subscriptions'] loop
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy "Read own account data" on public.%I for select to authenticated using (auth.uid()=user_id)',t);
  end loop;
end $$;

create function public.ensure_account(p_user_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(1980,3);
  insert into account_profiles(user_id) values(p_user_id) on conflict do nothing;
  insert into credit_grants(id,user_id,source,total,remaining,expires_at)
    values('welcome:'||p_user_id,p_user_id,'welcome',9,9,now()+interval '30 days') on conflict do nothing;
  if found then insert into credit_ledger(id,user_id,delta,kind) values('welcome:'||p_user_id,p_user_id,9,'welcome'); end if;
end $$;

create function public.reserve_image_job(p_id uuid,p_user_id uuid,p_fingerprint text,p_feature text,p_preset text,p_quality text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare existing portrait_jobs; price generation_prices; limits generation_limits; grant_row credit_grants; needed integer; taken integer;
  day_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  -- Lock order is shared by generation, settlement and account credit grants.
  perform pg_advisory_xact_lock(1980,1);
  perform ensure_account(p_user_id);
  select * into existing from portrait_jobs where id=p_id;
  if found then
    if existing.user_id<>p_user_id or existing.fingerprint<>p_fingerprint then raise exception 'CONFLICT'; end if;
    return jsonb_build_object('fresh',false,'job',to_jsonb(existing));
  end if;
  select * into existing from portrait_jobs where user_id=p_user_id and fingerprint=p_fingerprint and status in ('reserved','processing','uncertain') and expires_at>now() order by created_at desc limit 1;
  if found then return jsonb_build_object('fresh',false,'job',to_jsonb(existing)); end if;
  if not ((p_feature='retro-portrait' and p_preset in ('studio','cinema','album')) or (p_feature='ai-figurine' and p_preset in ('figurine-desk','figurine-box'))) then raise exception 'INVALID_FEATURE'; end if;
  select * into price from generation_prices where feature_id=p_feature and quality=p_quality and enabled;
  if not found then raise exception 'FEATURE_DISABLED'; end if;
  if (select billing_hold from account_profiles where user_id=p_user_id) then raise exception 'BILLING_HOLD'; end if;
  if exists(select 1 from portrait_jobs where user_id=p_user_id and status in ('reserved','processing') and created_at>now()-interval '6 minutes') then raise exception 'BUSY'; end if;
  select * into limits from generation_limits where id=true;
  if (select count(*) from portrait_jobs where user_id=p_user_id and created_at>=day_start)>=limits.user_daily_attempts
    or (select count(*) from portrait_jobs where created_at>=day_start)>=limits.site_daily_attempts
    or (select coalesce(sum(cost_ceiling_cents),0) from portrait_jobs where created_at>=day_start)+price.cost_ceiling_cents>limits.daily_budget_cents then raise exception 'RATE_LIMIT'; end if;
  if (select coalesce(sum(remaining),0) from credit_grants where user_id=p_user_id and expires_at>now() and not revoked)<price.credits then raise exception 'CREDITS'; end if;
  insert into portrait_jobs(id,user_id,fingerprint,feature_id,preset,quality,credits_charged,cost_ceiling_cents)
    values(p_id,p_user_id,p_fingerprint,p_feature,p_preset,p_quality,price.credits,price.cost_ceiling_cents) returning * into existing;
  needed := price.credits;
  for grant_row in select * from credit_grants where user_id=p_user_id and expires_at>now() and remaining>0 and not revoked order by expires_at,id for update loop
    taken := least(needed,grant_row.remaining);
    update credit_grants set remaining=remaining-taken where id=grant_row.id;
    insert into credit_allocations(job_id,grant_id,credits) values(p_id,grant_row.id,taken);
    needed := needed-taken;
    exit when needed=0;
  end loop;
  insert into credit_ledger(id,user_id,delta,kind,job_id) values('job:'||p_id,p_user_id,-price.credits,'generation',p_id);
  return jsonb_build_object('fresh',true,'job',to_jsonb(existing));
end $$;

create function public.settle_image_failure(p_id uuid,p_user_id uuid,p_uncertain boolean,p_error text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job portrait_jobs; allocation credit_allocations;
begin
  perform pg_advisory_xact_lock(1980,1);
  perform pg_advisory_xact_lock(1980,3);
  select * into job from portrait_jobs where id=p_id and user_id=p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if job.status in ('succeeded','expired','failed') then return; end if;
  update portrait_jobs set status=case when p_uncertain then 'uncertain' else 'failed' end,consumes_allowance=p_uncertain,error_code=p_error where id=p_id;
  if not p_uncertain then
    for allocation in select * from credit_allocations where job_id=p_id and not refunded for update loop
      update credit_grants set remaining=least(total,remaining+allocation.credits) where id=allocation.grant_id;
      update credit_allocations set refunded=true where job_id=p_id and grant_id=allocation.grant_id;
    end loop;
    if job.credits_charged>0 then insert into credit_ledger(id,user_id,delta,kind,job_id) values('refund:'||p_id,p_user_id,job.credits_charged,'refund',p_id) on conflict do nothing; end if;
  end if;
end $$;

create function public.apply_paid_invoice(p_event text,p_invoice text,p_user uuid,p_customer text,p_subscription text,p_plan text,p_interval text,p_credits integer,p_start timestamptz,p_end timestamptz)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare expected integer; inserted boolean;
begin
  perform pg_advisory_xact_lock(1980,3);
  expected := case p_plan when 'starter' then 600 when 'creator' then 1400 when 'studio' then 4000 else 0 end * case p_interval when 'month' then 1 when 'year' then 12 else 0 end;
  if expected=0 or p_credits<>expected or p_end<=p_start then raise exception 'INVALID_PLAN'; end if;
  if not exists(select 1 from account_profiles where user_id=p_user and stripe_customer_id=p_customer) then raise exception 'CUSTOMER_MISMATCH'; end if;
  insert into billing_events(id,type) values(p_event,'invoice.paid') on conflict do nothing;
  if not found then return false; end if;
  insert into credit_grants(id,user_id,source,total,remaining,expires_at,invoice_id)
    values('invoice:'||p_invoice,p_user,'subscription',p_credits,p_credits,p_end,p_invoice) on conflict do nothing;
  inserted := found;
  if inserted then insert into credit_ledger(id,user_id,delta,kind) values('invoice:'||p_invoice,p_user,p_credits,'subscription'); end if;
  return inserted;
end $$;

create function public.reserve_billing_checkout(p_user uuid,p_plan text,p_interval text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare attempt billing_checkouts;
begin
  perform pg_advisory_xact_lock(1980,4);
  if (select billing_hold from account_profiles where user_id=p_user) then raise exception 'BILLING_HOLD'; end if;
  if exists(select 1 from billing_subscriptions where user_id=p_user and status not in ('canceled','incomplete_expired')) then raise exception 'SUBSCRIBED'; end if;
  select * into attempt from billing_checkouts where user_id=p_user and expires_at>now();
  if found then
    if attempt.plan_id<>p_plan or attempt.interval<>p_interval then raise exception 'CHECKOUT_PENDING'; end if;
    return to_jsonb(attempt);
  end if;
  insert into billing_checkouts(user_id,attempt_id,plan_id,interval,expires_at)
    values(p_user,gen_random_uuid(),p_plan,p_interval,now()+interval '1 hour')
    on conflict(user_id) do update set attempt_id=excluded.attempt_id,plan_id=excluded.plan_id,interval=excluded.interval,expires_at=excluded.expires_at,session_id=null,url=null,created_at=now()
    returning * into attempt;
  return to_jsonb(attempt);
end $$;

-- Every function has explicit server-only execution permissions, including helpers.
create function public.sync_billing_subscription(p_id text,p_user uuid,p_plan text,p_interval text,p_status text,p_end timestamptz,p_cancel boolean,p_event_created bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into billing_subscriptions(id,user_id,plan_id,interval,status,period_end,cancel_at_period_end,event_created)
    values(p_id,p_user,p_plan,p_interval,p_status,p_end,p_cancel,p_event_created)
    on conflict(id) do update set plan_id=excluded.plan_id,interval=excluded.interval,status=excluded.status,period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,event_created=excluded.event_created,updated_at=now()
    where billing_subscriptions.user_id=excluded.user_id and billing_subscriptions.event_created<=excluded.event_created;
end $$;
create function public.hold_billing_account(p_event text,p_customer text,p_type text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(1980,3);
  insert into billing_events(id,type) values(p_event,p_type) on conflict do nothing;
  if found then update account_profiles set billing_hold=true,updated_at=now() where stripe_customer_id=p_customer; end if;
end $$;
revoke all on function public.sync_billing_subscription(text,uuid,text,text,text,timestamptz,boolean,bigint) from public,anon,authenticated;
revoke all on function public.hold_billing_account(text,text,text) from public,anon,authenticated;
grant execute on function public.sync_billing_subscription(text,uuid,text,text,text,timestamptz,boolean,bigint) to service_role;
grant execute on function public.hold_billing_account(text,text,text) to service_role;
revoke all on function public.ensure_account(uuid) from public,anon,authenticated;
revoke all on function public.reserve_image_job(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.settle_image_failure(uuid,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.apply_paid_invoice(text,text,uuid,text,text,text,text,integer,timestamptz,timestamptz) from public,anon,authenticated;
revoke all on function public.reserve_billing_checkout(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ensure_account(uuid) to service_role;
grant execute on function public.reserve_image_job(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.settle_image_failure(uuid,uuid,boolean,text) to service_role;
grant execute on function public.apply_paid_invoice(text,text,uuid,text,text,text,text,integer,timestamptz,timestamptz) to service_role;
grant execute on function public.reserve_billing_checkout(uuid,text,text) to service_role;
