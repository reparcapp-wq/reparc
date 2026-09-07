-- Live database policy verification, not a browser/JWT sign-in test.
-- All synthetic users and their rows are rolled back. Run as database administrator.
begin;
select set_config('reparc.test.a',gen_random_uuid()::text,true),
       set_config('reparc.test.b',gen_random_uuid()::text,true);
insert into auth.users(id,email,aud,role,created_at,updated_at)
select id, 'reparc-rls-' || id::text || '@example.invalid','authenticated','authenticated',now(),now()
from (values(current_setting('reparc.test.a')::uuid),(current_setting('reparc.test.b')::uuid)) fixture(id);
select set_config('request.jwt.claim.sub',current_setting('reparc.test.a'),true),
       set_config('request.jwt.claim.role','authenticated',true),
       set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('reparc.test.a'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare r record; content text; digest text; manifest jsonb; consent public.improvement_consent;
begin
  if auth.uid() <> current_setting('reparc.test.a')::uuid then raise exception 'Owner identity failed'; end if;
  select * into r from public.write_training_profile(0,'{"version":9,"consent":{"termsVersion":"2026-09-07"},"program":{},"sessions":[]}'::jsonb);
  if r.conflict or r.revision <> 1 then raise exception 'Owner write failed'; end if;
  select * into consent from public.set_improvement_consent(true,'2026-09-07');
  if not public.record_improvement_sample('fixture','{"recommendationVersion":"11.0.0-policy1","unit":"kg","exercises":[]}',now()) then raise exception 'Owner sample failed'; end if;
  content := '{"version":9,"consent":{"termsVersion":"2026-09-07"},"program":{},"sessions":[]}';
  digest := encode(sha256(convert_to(content,'UTF8')),'hex');
  perform public.stage_training_chunk(digest,content);
  manifest := jsonb_build_object('format','reparc-chunks-v1','chunks',jsonb_build_array(digest),'bytes',octet_length(content));
  perform set_config('reparc.test.manifest',manifest::text,true);
  select * into r from public.commit_training_archive(1,'{}',manifest);
  if r.conflict or r.revision <> 2 then raise exception 'Archive commit failed'; end if;
  select * into r from public.commit_training_archive(1,'{}',manifest);
  if not r.conflict then raise exception 'Stale revision was accepted'; end if;
  if (select count(*) from public.improvement_records) <> 1 then raise exception 'Owner read failed'; end if;
end; $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('reparc.test.b'),true),
       set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('reparc.test.b'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare table_name text; amount bigint; rejected boolean := false;
begin
  foreach table_name in array array['training_profiles','training_archive_chunks','improvement_consent','improvement_records','improvement_audit'] loop
    execute format('select count(*) from public.%I where user_id = $1',table_name) into amount using current_setting('reparc.test.a')::uuid;
    if amount <> 0 then raise exception 'Cross-account read in %', table_name; end if;
  end loop;
  begin
    perform public.commit_training_archive(0,'{}',current_setting('reparc.test.manifest')::jsonb);
  exception when sqlstate '22023' then rejected := true;
  end;
  if not rejected then raise exception 'Cross-account archive accepted'; end if;
  if has_function_privilege('authenticated','public.review_improvement_records(text,integer)','execute') then raise exception 'User reviewer access exposed'; end if;
  foreach table_name in array array['training_archive_chunks','improvement_consent','improvement_records','improvement_audit'] loop
    if has_table_privilege('authenticated','public.'||table_name,'INSERT') or has_table_privilege('authenticated','public.'||table_name,'UPDATE') or has_table_privilege('authenticated','public.'||table_name,'DELETE') then raise exception 'Direct write grant in %',table_name; end if;
    if has_table_privilege('anon','public.'||table_name,'SELECT') then raise exception 'Anonymous read grant in %',table_name; end if;
  end loop;
end; $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('reparc.test.a'),true),
       set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('reparc.test.a'),'role','authenticated')::text,true);
set local role authenticated;
do $$
begin
  perform public.set_improvement_consent(false,'2026-09-07');
  if exists(select 1 from public.improvement_records) then raise exception 'Withdrawal left evaluation records'; end if;
  if (select count(*) from public.training_archive_chunks) <> 1 then raise exception 'Withdrawal changed personal archive'; end if;
  if public.record_improvement_sample('after-withdrawal','{"exercises":[]}',now()) then raise exception 'Collection continued after withdrawal'; end if;
end; $$;
reset role;
rollback;
select 'PASS: live owner isolation, archive CAS, grants and withdrawal; synthetic changes rolled back' as result;
