-- RepArc v7: authenticated self-service account deletion.
-- Run after v6-account-security.sql. Existing tables and RLS policies are preserved.

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- These rows also have ON DELETE CASCADE foreign keys. Explicit deletion keeps
  -- the lifecycle guarantee clear if a future migration changes a constraint.
  delete from public.diagnostic_events where user_id = current_user_id;
  delete from public.beta_feedback where user_id = current_user_id;
  delete from public.training_profiles where user_id = current_user_id;
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;
