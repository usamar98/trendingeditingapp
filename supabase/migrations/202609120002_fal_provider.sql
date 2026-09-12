-- Preserve provenance for existing direct-OpenAI jobs; new jobs route through fal.
alter table public.portrait_jobs
  add column provider text not null default 'openai' check (provider in ('openai','fal')),
  add column provider_model text not null default 'gpt-image-2.5-sunburst-2026-09-08',
  add column feature_id text not null default 'retro-portrait';

alter table public.portrait_jobs
  alter column provider set default 'fal',
  alter column provider_model set default 'openai/gpt-image-2.5/sunburst/edit';

-- The existing atomic reservation RPC uses table defaults and returns these fields.
-- Existing private storage, RLS, quotas and dispatch permissions are unchanged.
