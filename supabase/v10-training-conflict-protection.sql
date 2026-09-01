-- RepArc v10: atomic training-profile revisions for multi-device conflict protection.
-- Run once in Supabase Dashboard -> SQL Editor after v9-api-security.sql.

alter table public.training_profiles
  add column if not exists revision bigint not null default 1;

create or replace function public.write_training_profile(expected_revision bigint, incoming_value jsonb)
returns table(value jsonb, updated_at timestamptz, revision bigint, conflict boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_row public.training_profiles%rowtype;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(incoming_value) <> 'object' or octet_length(incoming_value::text) > 1000000 then
    raise exception 'Invalid training profile' using errcode = '22023';
  end if;

  select * into current_row from public.training_profiles where user_id = current_user_id for update;
  if found then
    if coalesce(expected_revision, 0) <> current_row.revision then
      return query select current_row.value, current_row.updated_at, current_row.revision, true;
      return;
    end if;
    update public.training_profiles
    set value = incoming_value, updated_at = now(), revision = current_row.revision + 1
    where user_id = current_user_id
    returning training_profiles.value, training_profiles.updated_at, training_profiles.revision, false
    into value, updated_at, revision, conflict;
    return next;
    return;
  end if;

  if coalesce(expected_revision, 0) <> 0 then
    return query select incoming_value, now(), 0::bigint, true;
    return;
  end if;
  insert into public.training_profiles (user_id, value, updated_at, revision)
  values (current_user_id, incoming_value, now(), 1)
  returning training_profiles.value, training_profiles.updated_at, training_profiles.revision, false
  into value, updated_at, revision, conflict;
  return next;
end;
$$;

revoke all on function public.write_training_profile(bigint, jsonb) from public, anon;
grant execute on function public.write_training_profile(bigint, jsonb) to authenticated;
