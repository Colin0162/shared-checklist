-- ============================================================
--  014: 로그인 없애기 — 이름만 쓰는 단순 구조로 전환
--  - 계정/세션/공유폴더/참여자/채팅 전부 제거 (되돌릴 수 없음)
--  - 폴더는 모두 공개, 게시글은 링크만 있으면 입장(입장 비번 폐지)
--  - 게시글 '관리자 비밀번호'만 유지 → 편집/삭제/초기화 때만 확인
--  - 체크/비고는 토큰 대신 '이름'을 받아 기록
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

-- ── 1) 안 쓰는 함수 정리 (계정·공유·채팅) ──
drop function if exists public.register(text, text);
drop function if exists public.login(text, text);
drop function if exists public.change_my_password(text, text, text);
drop function if exists public.cleanup_sessions();
drop function if exists public.list_pending_users(text);
drop function if exists public.approve_user(text, uuid);
drop function if exists public.reject_user(text, uuid);
drop function if exists public.list_all_users(text);
drop function if exists public.delete_user(text, uuid);
drop function if exists public.admin_reset_password(text, uuid, text);
drop function if exists public.site_delete_board(text, uuid);
drop function if exists public.list_client_errors(text, int);
drop function if exists public._is_site_admin(text);
drop function if exists public.whoami(text);

drop function if exists public.list_visible_folders(text);
drop function if exists public.list_visible_boards(text);
drop function if exists public.share_folder(text, uuid, text);
drop function if exists public.unshare_folder(text, uuid);
drop function if exists public.join_folder(text, text);
drop function if exists public.request_join(text, text);
drop function if exists public.list_join_requests(text, uuid);
drop function if exists public.approve_join(text, uuid, uuid);
drop function if exists public.reject_join(text, uuid, uuid);
drop function if exists public.leave_folder(text, uuid);
drop function if exists public.list_folder_members(text, uuid);
drop function if exists public.kick_member(text, uuid, uuid);
drop function if exists public.transfer_folder_admin(text, uuid, uuid);
drop function if exists public.send_message(text, uuid, text, boolean);
drop function if exists public.send_message(text, uuid, text);
drop function if exists public.list_messages(text, uuid, int);
drop function if exists public.delete_message(text, bigint);
drop function if exists public.verify_board_entry(uuid, text);
drop function if exists public.set_entry_password(text, uuid, text, text);
drop function if exists public._can_see_folder(uuid, text, uuid);

-- 토큰을 받던 옛 버전들(아래에서 새 시그니처로 다시 만듦)
drop function if exists public.check_item(text, uuid, text);
drop function if exists public.set_note(text, uuid, text);
drop function if exists public.create_board(text, jsonb, jsonb, text, text);
drop function if exists public.create_folder(text, text, uuid);
drop function if exists public.delete_folder(text, uuid);
drop function if exists public.move_board(text, uuid, uuid);
drop function if exists public.move_folder(text, uuid, uuid);
drop function if exists public.log_client_error(text, text, text);
drop function if exists public.list_templates(text);
drop function if exists public.save_template(text, text, text, jsonb, jsonb, jsonb);
drop function if exists public.delete_template(text, uuid);
drop function if exists public._whoami(text);

-- ── 2) 안 쓰는 테이블 정리 ──
drop table if exists public.folder_join_requests;
drop table if exists public.folder_messages;
drop table if exists public.folder_members;
drop table if exists public.folder_secrets;
drop table if exists public.sessions;
drop table if exists public.users;

-- ── 3) 데이터 정리: 폴더는 전부 공개, 게시글 입장 비번 해제 ──
update public.folders set visibility = 'public', is_private = false, owner = '';
update public.boards  set has_entry_password = false;
update public.board_secrets set entry_hash = null;

-- ── 4) 읽기 열기 (폴더/게시글/항목은 누구나 조회) ──
drop policy if exists folders_select_anon on public.folders;
create policy folders_select_anon on public.folders for select using (true);
drop policy if exists boards_select_anon on public.boards;
create policy boards_select_anon on public.boards for select using (true);
drop policy if exists items_select_anon on public.items;
create policy items_select_anon on public.items for select using (true);

-- ============================================================
--  새 RPC (토큰 없음 — 이름만 받거나, 게시글 비번으로 확인)
-- ============================================================

-- 체크: 누가 체크했는지는 화면에서 보내온 이름으로 기록
create or replace function public.check_item(p_name text, p_item_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.items
    set status = p_status,
        checked_by = case when p_status <> '' then coalesce(btrim(p_name), '') else '' end,
        updated_at = now()
  where id = p_item_id;
end; $fn$;

create or replace function public.set_note(p_name text, p_item_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.items set note = p_note, updated_at = now() where id = p_item_id;
end; $fn$;

-- 게시글 생성 (입장 비번 없음, 관리자 비번만)
create or replace function public.create_board(
  p_author text, p_board jsonb, p_items jsonb, p_admin_pw text)
returns uuid language plpgsql security definer set search_path = public, extensions as $fn$
declare v_id uuid;
begin
  if btrim(coalesce(p_admin_pw, '')) = '' then raise exception '관리자 비밀번호를 설정하세요.'; end if;
  insert into public.boards (title, mode, categories, created_by, has_entry_password, folder_id,
                             event_date, table_data, sort_order)
  values (coalesce(p_board->>'title', ''), coalesce(p_board->>'mode', 'check'),
          coalesce(p_board->'categories', '[]'::jsonb), coalesce(p_author, ''), false,
          nullif(p_board->>'folder_id', '')::uuid, nullif(p_board->>'event_date', '')::date,
          coalesce(p_board->'table_data', '{"columns":[],"rows":[]}'::jsonb),
          coalesce((p_board->>'sort_order')::int, 0))
  returning id into v_id;
  insert into public.board_secrets (board_id, entry_hash, admin_hash)
  values (v_id, null, crypt(p_admin_pw, gen_salt('bf')));
  perform public._insert_items(v_id, p_items);
  return v_id;
end; $fn$;

-- 폴더: 누구나 만들고, 비어 있으면 누구나 정리
create or replace function public.create_folder(p_name text, p_parent_id uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  if btrim(coalesce(p_name, '')) = '' then raise exception '폴더 이름을 입력하세요.'; end if;
  insert into public.folders (name, owner, visibility, is_private, parent_id)
  values (btrim(p_name), '', 'public', false, p_parent_id)
  returning id into v_id;
  return v_id;
end; $fn$;

create or replace function public.delete_folder(p_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if exists (select 1 from public.boards where folder_id = p_folder_id) then
    raise exception '폴더 안 게시글을 먼저 옮기거나 삭제하세요.';
  end if;
  if exists (select 1 from public.folders where parent_id = p_folder_id) then
    raise exception '하위 폴더를 먼저 정리하세요.';
  end if;
  delete from public.folders where id = p_folder_id;
end; $fn$;

-- 이동: 같은 최상위 폴더 안에서만 (다른 최상위로 빼돌리기 방지)
create or replace function public.move_board(p_board_id uuid, p_target_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_cur uuid;
begin
  if p_target_folder_id is null then raise exception '게시글은 폴더 안에만 둘 수 있습니다.'; end if;
  select folder_id into v_cur from public.boards where id = p_board_id;
  if public._folder_root(v_cur) is distinct from public._folder_root(p_target_folder_id) then
    raise exception '같은 폴더 안에서만 옮길 수 있습니다.';
  end if;
  update public.boards set folder_id = p_target_folder_id where id = p_board_id;
end; $fn$;

create or replace function public.move_folder(p_folder_id uuid, p_target_parent_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_cur uuid; v_parent uuid; v_n int := 0;
begin
  if p_target_parent_id is null then raise exception '최상위로는 옮길 수 없습니다.'; end if;
  if p_target_parent_id = p_folder_id then raise exception '자기 자신으로는 옮길 수 없습니다.'; end if;
  if public._folder_root(p_folder_id) is distinct from public._folder_root(p_target_parent_id) then
    raise exception '같은 폴더 안에서만 옮길 수 있습니다.';
  end if;
  v_cur := p_target_parent_id;
  loop
    if v_cur = p_folder_id then raise exception '하위 폴더로는 옮길 수 없습니다.'; end if;
    select parent_id into v_parent from public.folders where id = v_cur;
    exit when v_parent is null;
    v_cur := v_parent;
    v_n := v_n + 1;
    exit when v_n > 50;
  end loop;
  update public.folders set parent_id = p_target_parent_id where id = p_folder_id;
end; $fn$;

-- 오류 기록 (이름은 화면에서 보내온 값)
create or replace function public.log_client_error(p_name text, p_message text, p_context text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if coalesce(btrim(p_message), '') = '' then return; end if;
  insert into public.client_error (user_name, message, context)
  values (coalesce(btrim(p_name), ''), left(p_message, 500), left(coalesce(p_context, ''), 300));
end; $fn$;

-- 템플릿: 로그인이 없으니 모두가 함께 쓰는 공용 목록
create or replace function public.list_templates()
returns table(id uuid, name text, mode text, categories jsonb, items jsonb, table_data jsonb)
language sql security definer set search_path = public as $fn$
  select t.id, t.name, t.mode, t.categories, t.items, t.table_data
  from public.templates t order by t.created_at;
$fn$;

create or replace function public.save_template(
  p_owner text, p_name text, p_mode text, p_categories jsonb, p_items jsonb, p_table_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  if btrim(coalesce(p_name, '')) = '' then raise exception '템플릿 이름을 입력하세요.'; end if;
  insert into public.templates (name, mode, categories, items, table_data, owner)
  values (btrim(p_name), coalesce(p_mode, 'check'), coalesce(p_categories, '[]'::jsonb),
          coalesce(p_items, '[]'::jsonb),
          coalesce(p_table_data, '{"columns":[],"rows":[]}'::jsonb), coalesce(p_owner, ''))
  returning id into v_id;
  return v_id;
end; $fn$;

create or replace function public.delete_template(p_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  delete from public.templates where id = p_id;
end; $fn$;

grant execute on function public.check_item(text, uuid, text)                       to anon, authenticated;
grant execute on function public.set_note(text, uuid, text)                         to anon, authenticated;
grant execute on function public.create_board(text, jsonb, jsonb, text)             to anon, authenticated;
grant execute on function public.create_folder(text, uuid)                          to anon, authenticated;
grant execute on function public.delete_folder(uuid)                                to anon, authenticated;
grant execute on function public.move_board(uuid, uuid)                             to anon, authenticated;
grant execute on function public.move_folder(uuid, uuid)                            to anon, authenticated;
grant execute on function public.log_client_error(text, text, text)                 to anon, authenticated;
grant execute on function public.list_templates()                                   to anon, authenticated;
grant execute on function public.save_template(text, text, text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.delete_template(uuid)                              to anon, authenticated;

insert into public.schema_migrations (version) values ('014_no_login')
on conflict (version) do nothing;
