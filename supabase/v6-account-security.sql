-- My Progress Tracker v6: account-owned data, feedback, and opt-in diagnostics.
-- Run once in Supabase Dashboard -> SQL Editor before deploying v6.

create table if not exists public.training_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  category text not null check (category in ('bug', 'confusing', 'idea', 'other')),
  message text not null check (char_length(message) between 3 and 2000),
  include_context boolean not null default false,
  app_context jsonb not null default '{}'::jsonb
);

create table if not exists public.diagnostic_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  release text not null check (char_length(release) <= 32),
  kind text not null check (kind in ('render', 'runtime', 'promise', 'sync', 'pwa')),
  message text not null check (char_length(message) between 1 and 400),
  app_context jsonb not null default '{}'::jsonb
);

alter table public.training_profiles enable row level security;
alter table public.beta_feedback enable row level security;
alter table public.diagnostic_events enable row level security;

revoke all on table public.training_profiles, public.beta_feedback, public.diagnostic_events from anon;
revoke all on table public.training_profiles, public.beta_feedback, public.diagnostic_events from authenticated;
grant select, insert, update, delete on table public.training_profiles to authenticated;
grant insert on table public.beta_feedback, public.diagnostic_events to authenticated;

drop policy if exists "account owns training profile" on public.training_profiles;
create policy "account owns training profile"
on public.training_profiles for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "account submits own feedback" on public.beta_feedback;
create policy "account submits own feedback"
on public.beta_feedback for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "account submits own diagnostics" on public.diagnostic_events;
create policy "account submits own diagnostics"
on public.diagnostic_events for insert to authenticated
with check ((select auth.uid()) = user_id);

create index if not exists beta_feedback_created_at_idx on public.beta_feedback (created_at desc);
create index if not exists diagnostic_events_created_at_idx on public.diagnostic_events (created_at desc);
