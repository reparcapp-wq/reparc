-- Additive migration. Run after v10. Existing training records are not modified.
begin;
create table if not exists public.improvement_consent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  notice_version text not null,
  granted_at timestamptz,
  expires_at timestamptz,
  changed_at timestamptz not null default now()
);
create table if not exists public.improvement_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null check (length(session_id) between 1 and 160),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 50000),
  collected_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days',
  primary key(user_id, session_id)
);
create table if not exists public.improvement_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('enabled','withdrawn','exported','reviewed')),
  notice_version text not null,
  created_at timestamptz not null default now()
);
alter table public.improvement_consent enable row level security;
alter table public.improvement_records enable row level security;
alter table public.improvement_audit enable row level security;
revoke all on public.improvement_consent, public.improvement_records, public.improvement_audit from public, anon, authenticated;
grant select on public.improvement_consent, public.improvement_records, public.improvement_audit to authenticated;
drop policy if exists improvement_consent_owner on public.improvement_consent;
drop policy if exists improvement_records_owner on public.improvement_records;
drop policy if exists improvement_audit_owner on public.improvement_audit;
create policy improvement_consent_owner on public.improvement_consent for select to authenticated using (auth.uid() = user_id);
create policy improvement_records_owner on public.improvement_records for select to authenticated using (auth.uid() = user_id and expires_at > now());
create policy improvement_audit_owner on public.improvement_audit for select to authenticated using (auth.uid() = user_id);

create or replace function public.set_improvement_consent(participate boolean, accepted_version text)
returns public.improvement_consent language plpgsql security definer set search_path = '' as $$
declare result public.improvement_consent; limiter jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if participate is null or accepted_version is distinct from '2026-09-07' then raise exception 'Review current notice' using errcode = '22023'; end if;
  -- Withdrawal is never rate limited. All writes/collection share the same per-user lock.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':improvement', 0));
  select * into result from public.improvement_consent where user_id = auth.uid();
  if found and result.enabled = participate and (not participate or (result.notice_version = accepted_version and result.expires_at > now())) then return result; end if;
  if participate then
    limiter := public.consume_api_rate_limit('feedback_write');
    if not (limiter->>'allowed')::boolean then raise exception 'rate_limit_exceeded'; end if;
    if not exists(select 1 from public.training_profiles where user_id = auth.uid() and value->'consent'->>'termsVersion' = accepted_version) then
      raise exception 'Accept current terms first' using errcode = '22023';
    end if;
  end if;
  insert into public.improvement_consent(user_id, enabled, notice_version, granted_at, expires_at)
  values(auth.uid(), participate, accepted_version, case when participate then now() end, case when participate then now() + interval '365 days' end)
  on conflict(user_id) do update set enabled = excluded.enabled, notice_version = excluded.notice_version,
    granted_at = case when improvement_consent.enabled and improvement_consent.expires_at > now() and participate then improvement_consent.granted_at else excluded.granted_at end,
    expires_at = case when improvement_consent.enabled and improvement_consent.expires_at > now() and participate then improvement_consent.expires_at else excluded.expires_at end,
    changed_at = now()
  returning * into result;
  if not participate then delete from public.improvement_records where user_id = auth.uid(); end if;
  insert into public.improvement_audit(user_id, action, notice_version) values(auth.uid(), case when participate then 'enabled' else 'withdrawn' end, accepted_version);
  return result;
end; $$;

-- Only the authenticated owner's samples can be written. Payload keys are constrained
-- here as well as by the server's allowlist; no cross-account evaluation API is exposed.
create or replace function public.record_improvement_sample(sample_session_id text, sample jsonb, session_started_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare permission public.improvement_consent; limiter jsonb; exercise jsonb; entry jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':improvement', 0));
  select * into permission from public.improvement_consent where user_id = auth.uid();
  if not found or not permission.enabled or permission.notice_version <> '2026-09-07' or permission.expires_at <= now() then return false; end if;
  if session_started_at is null or session_started_at < permission.granted_at or session_started_at > now() + interval '5 minutes' then return false; end if;
  if exists(select 1 from public.improvement_records where user_id = auth.uid() and session_id = sample_session_id and payload = sample) then return true; end if;
  if sample is null or jsonb_typeof(sample) is distinct from 'object' or octet_length(sample::text) > 50000
    or (sample - array['recommendationVersion','unit','experience','track','readiness','completion','exercises']) <> '{}'::jsonb
    or jsonb_typeof(sample->'exercises') is distinct from 'array' then
    raise exception 'Invalid sample' using errcode = '22023';
  end if;
  if jsonb_array_length(sample->'exercises') > 50 then raise exception 'Too many exercises'; end if;
  for exercise in select * from jsonb_array_elements(sample->'exercises') loop
    if jsonb_typeof(exercise) is distinct from 'object'
      or (exercise - array['identity','policyVersion','state','prescribedSets','suggestedLoad','targetRir','repLow','repHigh','sets','recovery']) <> '{}'::jsonb
      or jsonb_typeof(exercise->'sets') is distinct from 'array' or jsonb_typeof(exercise->'recovery') is distinct from 'array' then raise exception 'Invalid exercise sample'; end if;
    if jsonb_array_length(exercise->'sets') > 50 or jsonb_array_length(exercise->'recovery') > 50 then raise exception 'Sample array too large'; end if;
    for entry in select * from jsonb_array_elements(exercise->'sets') loop
      if jsonb_typeof(entry) is distinct from 'object' or (entry - array['load','reps','rir']) <> '{}'::jsonb then raise exception 'Invalid set sample'; end if;
    end loop;
    for entry in select * from jsonb_array_elements(exercise->'recovery') loop
      if jsonb_typeof(entry) is distinct from 'object' or (entry - array['status','hoursAfter']) <> '{}'::jsonb then raise exception 'Invalid recovery sample'; end if;
    end loop;
  end loop;
  limiter := public.consume_api_rate_limit('diagnostics_write');
  if not (limiter->>'allowed')::boolean then return false; end if;
  insert into public.improvement_records(user_id, session_id, payload) values(auth.uid(), sample_session_id, sample)
  on conflict(user_id,session_id) do update set payload = excluded.payload
  where improvement_records.expires_at > now();
  return true;
end; $$;

create or replace function public.export_improvement_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; limiter jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  limiter := public.consume_api_rate_limit('feedback_write');
  if not (limiter->>'allowed')::boolean then raise exception 'rate_limit_exceeded'; end if;
  insert into public.improvement_audit(user_id, action, notice_version) values(auth.uid(), 'exported', '2026-09-07');
  select jsonb_build_object('format','reparc-improvement-export','exportedAt',now(),
    'consent',(select to_jsonb(c) - 'user_id' from public.improvement_consent c where user_id = auth.uid()),
    'records',coalesce((select jsonb_agg(to_jsonb(r) - 'user_id') from public.improvement_records r where user_id = auth.uid() and expires_at > now()),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) - 'user_id') from public.improvement_audit a where user_id = auth.uid()),'[]'::jsonb)) into result;
  return result;
end; $$;
-- Routine maintainer access is restricted to the service role and leaves a
-- per-participant audit. Provider administrators remain a separate trust boundary.
create or replace function public.review_improvement_records(review_reference text, maximum_records integer default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Reviewer access required' using errcode = '42501'; end if;
  if review_reference is null or maximum_records is null or length(trim(review_reference)) not between 3 and 120 or maximum_records not between 1 and 500 then raise exception 'Invalid review reference or limit'; end if;
  with selected as (
    select r.* from public.improvement_records r join public.improvement_consent c using(user_id)
    where r.expires_at > now() and c.enabled and c.expires_at > now() and c.notice_version = '2026-09-07'
    order by r.collected_at desc limit maximum_records
  ), logged as (
    insert into public.improvement_audit(user_id,action,notice_version)
    select distinct user_id,'reviewed','2026-09-07' from selected returning id
  ) select jsonb_build_object('reviewReference',review_reference,'exportedAt',now(),'records',coalesce(jsonb_agg(jsonb_build_object('participant',s.user_id,'sample',s.payload)),'[]'::jsonb),'auditRows',(select count(*) from logged)) into result from selected s;
  return result;
end; $$;
revoke all on function public.review_improvement_records(text,integer) from public, anon, authenticated;
grant execute on function public.review_improvement_records(text,integer) to service_role;
revoke all on function public.set_improvement_consent(boolean,text), public.record_improvement_sample(text,jsonb,timestamptz), public.export_improvement_data() from public, anon;
grant execute on function public.set_improvement_consent(boolean,text), public.record_improvement_sample(text,jsonb,timestamptz), public.export_improvement_data() to authenticated;
create or replace function public.delete_improvement_samples(deleted_session_ids text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if coalesce(cardinality(deleted_session_ids),0) > 5000 then raise exception 'Too many session IDs'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':improvement',0));
  delete from public.improvement_records where user_id = auth.uid() and session_id = any(deleted_session_ids);
end; $$;
revoke all on function public.delete_improvement_samples(text[]) from public, anon;
grant execute on function public.delete_improvement_samples(text[]) to authenticated;
create index if not exists improvement_records_expiry on public.improvement_records(expires_at);
create index if not exists improvement_audit_expiry on public.improvement_audit(created_at);
select cron.schedule('reparc-improvement-retention','17 3 * * *', $job$
  delete from public.improvement_records where expires_at <= now();
  delete from public.improvement_audit where created_at <= now() - interval '365 days';
  delete from public.improvement_consent where (enabled and expires_at <= now()) or (not enabled and changed_at <= now() - interval '365 days');
$job$);
commit;
