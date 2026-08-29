-- RepArc v8: fixed support-data retention with daily automatic cleanup.
-- Run once in Supabase Dashboard -> SQL Editor after v7-account-lifecycle.sql.

create extension if not exists pg_cron;

create or replace function public.purge_expired_support_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  feedback_deleted bigint;
  diagnostics_deleted bigint;
begin
  delete from public.beta_feedback
  where created_at < now() - interval '180 days';
  get diagnostics feedback_deleted = row_count;

  delete from public.diagnostic_events
  where created_at < now() - interval '30 days';
  get diagnostics diagnostics_deleted = row_count;

  return jsonb_build_object(
    'feedback_deleted', feedback_deleted,
    'diagnostics_deleted', diagnostics_deleted,
    'completed_at', now()
  );
end;
$$;

revoke all on function public.purge_expired_support_data() from public, anon, authenticated;

select cron.schedule(
  'reparc-support-data-retention',
  '17 3 * * *',
  $$select public.purge_expired_support_data();$$
);
