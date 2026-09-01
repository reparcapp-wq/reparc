-- RepArc v9: durable per-account write throttling and database invariants.
-- Run once in Supabase Dashboard -> SQL Editor after v8-production-hardening.sql.

create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in (
    'training_write', 'feedback_write', 'diagnostics_write', 'account_delete'
  )),
  window_started timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  last_seen_at timestamptz not null default now(),
  last_blocked_at timestamptz,
  primary key (user_id, action)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(request_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_limit integer;
  window_seconds integer := 3600;
  current_count integer;
  current_window timestamptz;
  allowed_request boolean;
  retry_after integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  request_limit := case request_action
    when 'training_write' then 240
    when 'feedback_write' then 10
    when 'diagnostics_write' then 60
    when 'account_delete' then 3
    else null
  end;

  if request_limit is null then
    raise exception 'Unknown rate-limit action' using errcode = '22023';
  end if;

  insert into public.api_rate_limits as limits (
    user_id, action, window_started, request_count, last_seen_at
  ) values (
    current_user_id, request_action, now(), 1, now()
  )
  on conflict (user_id, action) do update set
    window_started = case
      when limits.window_started <= now() - make_interval(secs => window_seconds) then now()
      else limits.window_started
    end,
    request_count = case
      when limits.window_started <= now() - make_interval(secs => window_seconds) then 1
      else limits.request_count + 1
    end,
    last_seen_at = now()
  returning request_count, window_started
  into current_count, current_window;

  allowed_request := current_count <= request_limit;
  retry_after := greatest(
    1,
    ceil(extract(epoch from current_window + make_interval(secs => window_seconds) - now()))::integer
  );

  if not allowed_request then
    update public.api_rate_limits
    set blocked_count = blocked_count + 1,
        last_blocked_at = now()
    where user_id = current_user_id and action = request_action;
  end if;

  return jsonb_build_object(
    'allowed', allowed_request,
    'remaining', greatest(0, request_limit - current_count),
    'retry_after_seconds', case when allowed_request then 0 else retry_after end
  );
end;
$$;

revoke all on function public.consume_api_rate_limit(text) from public, anon;
grant execute on function public.consume_api_rate_limit(text) to authenticated;

create or replace function public.enforce_api_rate_limit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  -- Administrative maintenance has no end-user JWT and must remain possible.
  if auth.uid() is null then
    return new;
  end if;

  result := public.consume_api_rate_limit(tg_argv[0]);
  if coalesce((result ->> 'allowed')::boolean, false) is not true then
    raise exception 'rate_limit_exceeded'
      using errcode = 'P0001',
            hint = 'retry_after_seconds=' || coalesce(result ->> 'retry_after_seconds', '60');
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_api_rate_limit_trigger() from public, anon, authenticated;

drop trigger if exists training_profiles_rate_limit on public.training_profiles;
create trigger training_profiles_rate_limit
before insert or update on public.training_profiles
for each row execute function public.enforce_api_rate_limit_trigger('training_write');

drop trigger if exists beta_feedback_rate_limit on public.beta_feedback;
create trigger beta_feedback_rate_limit
before insert on public.beta_feedback
for each row execute function public.enforce_api_rate_limit_trigger('feedback_write');

drop trigger if exists diagnostic_events_rate_limit on public.diagnostic_events;
create trigger diagnostic_events_rate_limit
before insert on public.diagnostic_events
for each row execute function public.enforce_api_rate_limit_trigger('diagnostics_write');

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  rate_result jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  rate_result := public.consume_api_rate_limit('account_delete');
  if coalesce((rate_result ->> 'allowed')::boolean, false) is not true then
    raise exception 'rate_limit_exceeded'
      using errcode = 'P0001',
            hint = 'retry_after_seconds=' || coalesce(rate_result ->> 'retry_after_seconds', '60');
  end if;

  delete from public.diagnostic_events where user_id = current_user_id;
  delete from public.beta_feedback where user_id = current_user_id;
  delete from public.training_profiles where user_id = current_user_id;
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'training_profiles_value_object') then
    alter table public.training_profiles
      add constraint training_profiles_value_object
      check (jsonb_typeof(value) = 'object') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'training_profiles_value_size') then
    alter table public.training_profiles
      add constraint training_profiles_value_size
      check (octet_length(value::text) <= 1000000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'beta_feedback_context_object') then
    alter table public.beta_feedback
      add constraint beta_feedback_context_object
      check (jsonb_typeof(app_context) = 'object' and octet_length(app_context::text) <= 4096) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'diagnostic_events_context_object') then
    alter table public.diagnostic_events
      add constraint diagnostic_events_context_object
      check (jsonb_typeof(app_context) = 'object' and octet_length(app_context::text) <= 4096) not valid;
  end if;
end;
$$;

alter table public.training_profiles validate constraint training_profiles_value_object;
alter table public.training_profiles validate constraint training_profiles_value_size;
alter table public.beta_feedback validate constraint beta_feedback_context_object;
alter table public.diagnostic_events validate constraint diagnostic_events_context_object;

create or replace function public.purge_expired_support_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  feedback_deleted bigint;
  diagnostics_deleted bigint;
  rate_limits_deleted bigint;
begin
  delete from public.beta_feedback
  where created_at < now() - interval '180 days';
  get diagnostics feedback_deleted = row_count;

  delete from public.diagnostic_events
  where created_at < now() - interval '30 days';
  get diagnostics diagnostics_deleted = row_count;

  delete from public.api_rate_limits
  where last_seen_at < now() - interval '2 days';
  get diagnostics rate_limits_deleted = row_count;

  return jsonb_build_object(
    'feedback_deleted', feedback_deleted,
    'diagnostics_deleted', diagnostics_deleted,
    'rate_limits_deleted', rate_limits_deleted,
    'completed_at', now()
  );
end;
$$;

revoke all on function public.purge_expired_support_data() from public, anon, authenticated;
