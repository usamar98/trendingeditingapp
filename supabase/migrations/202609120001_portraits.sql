-- Run in a Supabase project. Server service_role owns all mutations.
create table public.portrait_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  fingerprint text not null,
  preset text not null check (preset in ('studio','cinema','album')),
  quality text not null check (quality in ('medium','high')),
  status text not null default 'reserved' check (status in ('reserved','processing','succeeded','failed','uncertain','expired')),
  error_code text,
  consumes_allowance boolean not null default true,
  provider_request_id text,
  usage jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index portrait_jobs_user_day on public.portrait_jobs(user_id, created_at desc);
create index portrait_jobs_expiry on public.portrait_jobs(expires_at) where status <> 'expired';
alter table public.portrait_jobs enable row level security;
revoke all on public.portrait_jobs from anon, authenticated;
grant select on public.portrait_jobs to authenticated;
grant all on public.portrait_jobs to service_role;
create policy "Read own job metadata" on public.portrait_jobs for select to authenticated using (auth.uid() = user_id);

-- Global transaction lock serializes quota reservations across every server instance.
-- Existing IDs always return their original job and never grant dispatch permission again.
create function public.reserve_portrait(p_id uuid, p_user_id uuid, p_fingerprint text, p_preset text, p_quality text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  existing public.portrait_jobs;
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_advisory_xact_lock(1980, 1);
  select * into existing from public.portrait_jobs where id = p_id;
  if found then
    if existing.user_id <> p_user_id or existing.fingerprint <> p_fingerprint then
      raise exception 'CONFLICT';
    end if;
    return jsonb_build_object('fresh', false, 'job', to_jsonb(existing));
  end if;
  -- Duplicate payloads during an active request also reuse that request across tabs.
  select * into existing from public.portrait_jobs where user_id = p_user_id and fingerprint = p_fingerprint and status in ('reserved','processing','uncertain') and expires_at > now() order by created_at desc limit 1;
  if found then return jsonb_build_object('fresh', false, 'job', to_jsonb(existing)); end if;
  if exists(select 1 from public.portrait_jobs where user_id = p_user_id and status in ('reserved','processing') and created_at > now() - interval '6 minutes') then raise exception 'BUSY'; end if;
  -- 3 portrait credits, 10 total attempts per user/day, 50 total site attempts/day.
  -- Failed jobs release user credits but remain in attempt counts to bound abuse/cost.
  if (select count(*) from public.portrait_jobs where user_id=p_user_id and created_at >= day_start and consumes_allowance) >= 3
    or (select count(*) from public.portrait_jobs where user_id=p_user_id and created_at >= day_start) >= 10
    or (select count(*) from public.portrait_jobs where created_at >= day_start) >= 50 then raise exception 'LIMIT'; end if;
  insert into public.portrait_jobs(id,user_id,fingerprint,preset,quality) values (p_id,p_user_id,p_fingerprint,p_preset,p_quality) returning * into existing;
  return jsonb_build_object('fresh', true, 'job', to_jsonb(existing));
end;
$$;
revoke all on function public.reserve_portrait(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.reserve_portrait(uuid,uuid,text,text,text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portraits','portraits',false,24000000,array['image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
-- No client object policies: only the server may upload/read/delete objects.
-- Restrictive policies also prevent broad pre-existing storage policies leaking this bucket.
create policy "Portrait photos server only" on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'portraits') with check (bucket_id <> 'portraits');
-- Clean storage via the API before deleting an auth user; SQL row deletion does not delete bytes.

create table public.auth_attempts (email_hash text not null, created_at timestamptz not null default now());
create index auth_attempts_time on public.auth_attempts(created_at);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;
grant all on public.auth_attempts to service_role;
create function public.reserve_auth_email(p_email_hash text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(1980,2);
  delete from public.auth_attempts where created_at < now() - interval '1 day';
  if (select count(*) from public.auth_attempts where created_at > now() - interval '1 hour') >= 30
    or (select count(*) from public.auth_attempts where email_hash=p_email_hash and created_at > now() - interval '1 hour') >= 3 then raise exception 'LIMIT'; end if;
  insert into public.auth_attempts(email_hash) values(p_email_hash);
end;
$$;
revoke all on function public.reserve_auth_email(text) from public,anon,authenticated;
grant execute on function public.reserve_auth_email(text) to service_role;
