-- ============================================================
--  013: 옛 'join_folder'(즉시 입장)도 참여 요청으로 바꿈
--  - 캐시된 옛 프론트가 join_folder를 부르면 그대로 즉시 입장되던 것 차단.
--  - 이제 join_folder도 request_join처럼 '참여 요청'만 등록(관리자 수락 필요).
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

create or replace function public.join_folder(p_token text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $fn$
declare v_uid uuid; v_name text; r record; v_new int := 0; v_already int := 0;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then return json_build_object('ok', false, 'error', '로그인이 필요합니다.'); end if;
  if btrim(coalesce(p_password, '')) = '' then
    return json_build_object('ok', false, 'error', '암호(키워드)를 입력하세요.');
  end if;
  for r in
    select f.id from public.folder_secrets s
    join public.folders f on f.id = s.folder_id
    where f.visibility = 'shared' and s.pass_hash = crypt(p_password, s.pass_hash)
  loop
    if exists (select 1 from public.folder_members m where m.folder_id = r.id and m.user_id = v_uid) then
      v_already := v_already + 1;
      continue;
    end if;
    insert into public.folder_join_requests (folder_id, user_id, user_name)
    values (r.id, v_uid, v_name)
    on conflict (folder_id, user_id) do nothing;
    v_new := v_new + 1;
  end loop;
  if v_new = 0 and v_already > 0 then
    return json_build_object('ok', false, 'error', '이미 참여 중인 폴더입니다.');
  end if;
  if v_new = 0 then
    return json_build_object('ok', false, 'error', '암호가 맞는 공유 폴더가 없습니다.');
  end if;
  -- 즉시 입장이 아니라 요청만 등록 (옛 프론트가 기대하는 joined는 빈 값으로)
  return json_build_object('ok', true, 'joined', '');
end; $fn$;

insert into public.schema_migrations (version) values ('013_join_folder_also_requests')
on conflict (version) do nothing;
