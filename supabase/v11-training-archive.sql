-- Additive durable history storage. No sessions are deleted or truncated.
begin;
create table if not exists public.training_archive_chunks (
  user_id uuid not null references auth.users(id) on delete cascade,
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  content text not null check (octet_length(content) <= 512000),
  created_at timestamptz not null default now(),
  primary key(user_id,digest)
);
alter table public.training_archive_chunks enable row level security;
revoke all on public.training_archive_chunks from public, anon, authenticated;
grant select on public.training_archive_chunks to authenticated;
drop policy if exists training_archive_owner on public.training_archive_chunks;
create policy training_archive_owner on public.training_archive_chunks for select to authenticated using(auth.uid() = user_id);

create or replace function public.stage_training_chunk(chunk_digest text, chunk_content text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if chunk_content is null or chunk_digest is null or octet_length(chunk_content) > 512000 or encode(sha256(convert_to(chunk_content,'UTF8')),'hex') <> chunk_digest then raise exception 'Invalid chunk' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':archive',0));
  if exists(select 1 from public.training_archive_chunks where user_id = auth.uid() and digest = chunk_digest) then return; end if;
  if (select count(*) from public.training_archive_chunks where user_id = auth.uid()) >= 768 then raise exception 'Archive staging capacity reached. Retry after cleanup.'; end if;
  insert into public.training_archive_chunks(user_id,digest,content) values(auth.uid(),chunk_digest,chunk_content);
end; $$;

create or replace function public.commit_training_archive(expected_revision bigint, profile_metadata jsonb, archive_manifest jsonb)
returns table(value jsonb, updated_at timestamptz, revision bigint, conflict boolean)
language plpgsql security definer set search_path = '' as $$
declare current_row public.training_profiles%rowtype; assembled text; parsed jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':archive',0));
  if expected_revision is null or expected_revision < 0 or archive_manifest->>'format' is distinct from 'reparc-chunks-v1' or jsonb_typeof(archive_manifest->'chunks') is distinct from 'array'
    or jsonb_typeof(archive_manifest->'bytes') is distinct from 'number' then raise exception 'Invalid archive' using errcode = '22023'; end if;
  if jsonb_array_length(archive_manifest->'chunks') not between 1 and 256 or (archive_manifest->>'bytes')::bigint not between 1 and 32000000 then raise exception 'Invalid archive size'; end if;
  if exists(select 1 from jsonb_array_elements_text(archive_manifest->'chunks') ids(id) where not exists(select 1 from public.training_archive_chunks c where c.user_id = auth.uid() and c.digest = ids.id)) then raise exception 'Incomplete archive' using errcode = '22023'; end if;
  select string_agg(c.content,'' order by ids.position) into assembled from jsonb_array_elements_text(archive_manifest->'chunks') with ordinality ids(id,position)
    join public.training_archive_chunks c on c.user_id = auth.uid() and c.digest = ids.id;
  if octet_length(assembled) > 32000000 or octet_length(assembled) <> (archive_manifest->>'bytes')::integer then raise exception 'Invalid archive size' using errcode = '22023'; end if;
  parsed := assembled::jsonb;
  if jsonb_typeof(parsed->'sessions') is distinct from 'array' or jsonb_typeof(parsed->'program') is distinct from 'object' then raise exception 'Invalid training data' using errcode = '22023'; end if;
  -- Metadata is taken from the verified archive; a caller cannot pair unrelated settings.
  profile_metadata := parsed - array['sessions','sessionRevisions','weighIns','planHistory','absences','exerciseRecovery'];
  profile_metadata := profile_metadata || jsonb_build_object('sessions','[]'::jsonb,'sessionRevisions','[]'::jsonb,'weighIns','[]'::jsonb,'planHistory','[]'::jsonb,'absences','[]'::jsonb,'exerciseRecovery','[]'::jsonb,'archiveManifest',archive_manifest,'updatedAt',now());
  if octet_length(profile_metadata::text) > 900000 then raise exception 'Profile metadata too large'; end if;
  select * into current_row from public.training_profiles where user_id = auth.uid() for update;
  if found then
    if current_row.revision <> expected_revision then return query select current_row.value,current_row.updated_at,current_row.revision,true; return; end if;
    update public.training_profiles set value = profile_metadata, updated_at = now(), revision = current_row.revision + 1 where user_id = auth.uid();
  else
    if expected_revision <> 0 then raise exception 'Revision conflict' using errcode = '40001'; end if;
    insert into public.training_profiles(user_id,value,updated_at,revision) values(auth.uid(),profile_metadata,now(),1);
  end if;
  return query select p.value,p.updated_at,p.revision,false from public.training_profiles p where p.user_id = auth.uid();
end; $$;
revoke all on function public.stage_training_chunk(text,text), public.commit_training_archive(bigint,jsonb,jsonb) from public, anon;
grant execute on function public.stage_training_chunk(text,text), public.commit_training_archive(bigint,jsonb,jsonb) to authenticated;
select cron.schedule('reparc-archive-staging-cleanup','41 3 * * *', $job$
  delete from public.training_archive_chunks c where c.created_at < now() - interval '2 days'
    and not exists(select 1 from public.training_profiles p where p.user_id = c.user_id and p.value->'archiveManifest'->'chunks' ? c.digest);
$job$);
commit;
