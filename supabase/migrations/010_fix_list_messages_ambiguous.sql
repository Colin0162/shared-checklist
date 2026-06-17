-- ============================================================
--  010: list_messages 의 'user_id is ambiguous' 오류 수정
--  - 반환 컬럼(user_id)과 folder_members.user_id 가 구분이 안 돼 함수가 실패하던 것.
--  - folder_members 에 별칭(fm) 붙여 명확히 → 불러오기 정상화(새로고침/재진입해도 유지).
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

create or replace function public.list_messages(p_token text, p_folder_id uuid, p_limit int)
returns table(id bigint, user_id uuid, user_name text, content text, is_notice boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.folder_members fm
    where fm.folder_id = p_folder_id and fm.user_id = v_uid
  ) then
    raise exception '이 폴더 참여자만 볼 수 있습니다.';
  end if;
  return query
  select s.id, s.user_id, s.user_name, s.content, s.is_notice, s.created_at from (
    select m.id, m.user_id, m.user_name, m.content, m.is_notice, m.created_at
    from public.folder_messages m
    where m.folder_id = p_folder_id
      and (m.is_notice or m.created_at > now() - interval '24 hours')  -- 공지=항상, 일반=24시간
    order by m.created_at desc
    limit least(coalesce(p_limit, 200), 500)
  ) s
  order by s.created_at;
end; $fn$;
grant execute on function public.list_messages(text, uuid, int) to anon, authenticated;

insert into public.schema_migrations (version) values ('010_fix_list_messages_ambiguous')
on conflict (version) do nothing;
