-- ============================================================
--  006: 게시글/폴더 이동 + 권한 완화(접근 가능한 사람이면 이동·삭제)
--  - _can_see_folder: 그 폴더를 볼 수 있는지(공개=누구나 / 개인=본인 / 공유=참여자)
--  - move_board / move_folder: 접근 가능한 위치로 이동(폴더는 개인 폴더만, 순환 금지)
--  - delete_folder: 빈 폴더 + 접근 가능자 누구나(공개 폴더만 사이트관리자)
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

-- 그 폴더가 내게 보이는지(최상위 조상 기준). 홈(null)은 누구나 true.
create or replace function public._can_see_folder(p_uid uuid, p_name text, p_folder_id uuid)
returns boolean language plpgsql security definer set search_path = public as $fn$
declare v_cur uuid; v_parent uuid; v_n int := 0; v_vis text; v_owner text;
begin
  if p_folder_id is null then return true; end if;
  v_cur := p_folder_id;
  loop
    select parent_id into v_parent from public.folders where id = v_cur;
    exit when v_parent is null;
    v_cur := v_parent;
    v_n := v_n + 1;
    exit when v_n > 50;  -- 순환 안전장치
  end loop;
  select visibility, owner into v_vis, v_owner from public.folders where id = v_cur;
  if v_vis = 'public' then return true; end if;
  if v_vis = 'private' then return v_owner = coalesce(p_name, ''); end if;
  if v_vis = 'shared' then
    return exists (select 1 from public.folder_members where folder_id = v_cur and user_id = p_uid);
  end if;
  return false;
end; $fn$;
revoke all on function public._can_see_folder(uuid, text, uuid) from public;

-- 게시글 이동: 현재 폴더와 대상 폴더 둘 다 볼 수 있어야. 게시글은 폴더 안에만.
create or replace function public.move_board(p_token text, p_board_id uuid, p_target_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text; v_cur uuid;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_target_folder_id is null then raise exception '게시글은 폴더 안에만 둘 수 있습니다.'; end if;
  select folder_id into v_cur from public.boards where id = p_board_id;
  if not public._can_see_folder(v_uid, v_name, v_cur) then raise exception '권한이 없습니다.'; end if;
  if not public._can_see_folder(v_uid, v_name, p_target_folder_id) then
    raise exception '그 폴더로는 옮길 수 없습니다.';
  end if;
  update public.boards set folder_id = p_target_folder_id where id = p_board_id;
end; $fn$;

-- 폴더 이동: 개인 폴더만(공유·공개는 최상위 고정). 자기 자신/후손으로는 금지.
create or replace function public.move_folder(p_token text, p_folder_id uuid, p_target_parent_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text; v_vis text; v_cur uuid; v_parent uuid; v_n int := 0;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select visibility into v_vis from public.folders where id = p_folder_id;
  if v_vis is null then raise exception '폴더를 찾을 수 없습니다.'; end if;
  if v_vis <> 'private' then raise exception '개인 폴더만 옮길 수 있습니다. (공유·공개 폴더는 고정)'; end if;
  if not public._can_see_folder(v_uid, v_name, p_folder_id) then raise exception '권한이 없습니다.'; end if;
  if not public._can_see_folder(v_uid, v_name, p_target_parent_id) then
    raise exception '그 위치로는 옮길 수 없습니다.';
  end if;
  if p_target_parent_id = p_folder_id then raise exception '자기 자신으로는 옮길 수 없습니다.'; end if;
  -- 대상이 이 폴더의 후손이면 순환 → 금지
  if p_target_parent_id is not null then
    v_cur := p_target_parent_id;
    loop
      if v_cur = p_folder_id then raise exception '하위 폴더로는 옮길 수 없습니다.'; end if;
      select parent_id into v_parent from public.folders where id = v_cur;
      exit when v_parent is null;
      v_cur := v_parent;
      v_n := v_n + 1;
      exit when v_n > 50;
    end loop;
  end if;
  update public.folders set parent_id = p_target_parent_id where id = p_folder_id;
end; $fn$;

-- 폴더 삭제(빈 폴더만): 공개=사이트관리자, 개인/공유=볼 수 있는 사람 누구나
create or replace function public.delete_folder(p_token text, p_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text; v_admin boolean; v_vis text;
begin
  select s.user_id, u.name, u.is_site_admin into v_uid, v_name, v_admin
  from public.sessions s join public.users u on u.id = s.user_id
  where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if exists (select 1 from public.boards  where folder_id = p_folder_id) then
    raise exception '폴더 안 게시글을 먼저 옮기거나 삭제하세요.';
  end if;
  if exists (select 1 from public.folders where parent_id = p_folder_id) then
    raise exception '하위 폴더를 먼저 정리하세요.';
  end if;
  select visibility into v_vis from public.folders where id = p_folder_id;
  if v_vis = 'public' then
    if not coalesce(v_admin, false) then raise exception '공개 폴더는 사이트 관리자만 삭제할 수 있습니다.'; end if;
  else
    if not public._can_see_folder(v_uid, v_name, p_folder_id) then raise exception '권한이 없습니다.'; end if;
  end if;
  delete from public.folders where id = p_folder_id;
end; $fn$;

grant execute on function public.move_board(text, uuid, uuid)   to anon, authenticated;
grant execute on function public.move_folder(text, uuid, uuid)  to anon, authenticated;
grant execute on function public.delete_folder(text, uuid)      to anon, authenticated;

insert into public.schema_migrations (version) values ('006_move_and_open_permissions')
on conflict (version) do nothing;
