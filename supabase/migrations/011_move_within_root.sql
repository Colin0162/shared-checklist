-- ============================================================
--  011: 이동은 '같은 최상위 폴더 안'에서만
--  - 청년회/보나회/중고등부/기본 등 다른 최상위 폴더로 빼돌리는 것 방지.
--  - _folder_root: 그 폴더의 최상위 조상 id.
--  - move_board / move_folder: 현재 위치와 대상의 최상위 조상이 같아야 허용(홈으로도 불가).
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

create or replace function public._folder_root(p_folder_id uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_cur uuid; v_parent uuid; v_n int := 0;
begin
  if p_folder_id is null then return null; end if;
  v_cur := p_folder_id;
  loop
    select parent_id into v_parent from public.folders where id = v_cur;
    exit when v_parent is null;
    v_cur := v_parent;
    v_n := v_n + 1;
    exit when v_n > 50;
  end loop;
  return v_cur;
end; $fn$;
revoke all on function public._folder_root(uuid) from public;

-- 게시글 이동: 현재 폴더와 대상 폴더의 최상위 조상이 같아야
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
  if public._folder_root(v_cur) is distinct from public._folder_root(p_target_folder_id) then
    raise exception '같은 폴더 안에서만 옮길 수 있습니다(다른 최상위 폴더로는 불가).';
  end if;
  update public.boards set folder_id = p_target_folder_id where id = p_board_id;
end; $fn$;

-- 폴더 이동: 개인 폴더만 + 같은 최상위 안 + 자기/후손 금지 + 홈(최상위)로 불가
create or replace function public.move_folder(p_token text, p_folder_id uuid, p_target_parent_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text; v_vis text; v_cur uuid; v_parent uuid; v_n int := 0;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select visibility into v_vis from public.folders where id = p_folder_id;
  if v_vis is null then raise exception '폴더를 찾을 수 없습니다.'; end if;
  if v_vis <> 'private' then raise exception '개인 폴더만 옮길 수 있습니다. (공유·공개 폴더는 고정)'; end if;
  if p_target_parent_id is null then raise exception '최상위로는 옮길 수 없습니다(같은 폴더 안에서만).'; end if;
  if not public._can_see_folder(v_uid, v_name, p_folder_id) then raise exception '권한이 없습니다.'; end if;
  if not public._can_see_folder(v_uid, v_name, p_target_parent_id) then
    raise exception '그 위치로는 옮길 수 없습니다.';
  end if;
  if p_target_parent_id = p_folder_id then raise exception '자기 자신으로는 옮길 수 없습니다.'; end if;
  if public._folder_root(p_folder_id) is distinct from public._folder_root(p_target_parent_id) then
    raise exception '같은 폴더 안에서만 옮길 수 있습니다(다른 최상위 폴더로는 불가).';
  end if;
  -- 대상이 이 폴더의 후손이면 순환 → 금지
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

insert into public.schema_migrations (version) values ('011_move_within_root')
on conflict (version) do nothing;
