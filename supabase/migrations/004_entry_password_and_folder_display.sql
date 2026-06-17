-- ============================================================
--  004: 게시글 입장 비밀번호 관리 + 폴더 표시(루트 기준)
--  - set_entry_password: 입장 비번 추가/변경/삭제(빈 값=삭제=전체공개). 편집비번 또는 사이트관리자만.
--  - list_visible_folders: 반환에 root_visibility 추가 → 공유 폴더의 하위 폴더도 '공유'로 표시.
--  (함수만 바뀌므로 패턴 B. list_visible_folders는 반환 컬럼이 늘어 drop 후 재생성)
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

-- 입장 비밀번호 추가/변경/삭제 (빈 값이면 삭제 = 전체 공개)
create or replace function public.set_entry_password(p_token text, p_board_id uuid, p_admin_pw text, p_new_entry text)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare v_admin boolean;
begin
  select coalesce(u.is_site_admin, false) into v_admin
  from public.sessions s join public.users u on u.id = s.user_id
  where s.token::text = p_token and s.created_at > now() - interval '30 days';
  -- 사이트 관리자거나, 그 게시글의 편집(관리자) 비밀번호를 아는 사람만
  if not coalesce(v_admin, false) and not public._check_admin(p_board_id, p_admin_pw) then
    raise exception '권한이 없습니다. (편집 비밀번호 확인)';
  end if;
  if btrim(coalesce(p_new_entry, '')) = '' then
    update public.board_secrets set entry_hash = null where board_id = p_board_id;
    update public.boards set has_entry_password = false where id = p_board_id;
  else
    update public.board_secrets set entry_hash = crypt(p_new_entry, gen_salt('bf')) where board_id = p_board_id;
    update public.boards set has_entry_password = true where id = p_board_id;
  end if;
end; $fn$;
grant execute on function public.set_entry_password(text, uuid, text, text) to anon, authenticated;

-- 보이는 폴더 + root_visibility(최상위 조상의 종류). 공유 폴더의 하위 폴더도 '공유'로 보이게.
drop function if exists public.list_visible_folders(text);
create or replace function public.list_visible_folders(p_token text)
returns table(id uuid, name text, visibility text, root_visibility text, owner text,
              parent_id uuid, sort_order int, my_role text)
language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  return query
  with recursive tree as (
    select f.id, f.parent_id, f.id as root_id from public.folders f where f.parent_id is null
    union all
    select f.id, f.parent_id, t.root_id from public.folders f join tree t on f.parent_id = t.id
  ),
  roots as (select rf.id, rf.visibility, rf.owner from public.folders rf where rf.parent_id is null)
  select f.id, f.name, f.visibility, r.visibility as root_visibility, f.owner, f.parent_id, f.sort_order,
         (select m.role from public.folder_members m where m.folder_id = f.id and m.user_id = v_uid) as my_role
  from public.folders f
  join tree  t on t.id = f.id
  join roots r on r.id = t.root_id
  where r.visibility = 'public'
     or (r.visibility = 'private' and r.owner = coalesce(v_name, ''))
     or (r.visibility = 'shared'  and exists (
           select 1 from public.folder_members m where m.folder_id = t.root_id and m.user_id = v_uid))
  order by f.sort_order;
end; $fn$;
grant execute on function public.list_visible_folders(text) to anon, authenticated;

insert into public.schema_migrations (version) values ('004_entry_password_and_folder_display')
on conflict (version) do nothing;
