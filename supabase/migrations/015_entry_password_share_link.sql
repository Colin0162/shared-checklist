-- ============================================================
--  015: 게시글 '입장 비밀번호' 되살리기 + 공유 링크로 통과
--  - 목록에서 잠긴 게시글(🔒)을 누르면 입장 비밀번호를 묻는다.
--  - '링크 복사'로 만든 공유 링크(/board/<id>?k=<열쇠>)로 오면 비번 없이 통과.
--    → 열쇠는 board_secrets(anon 차단)에만 있고, 비번/열쇠 확인은 RPC로만.
--  - 주소창 주소를 그냥 복사해 준 것으로는 통과 안 됨(열쇠가 없으므로).
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

-- 게시글마다 공유 열쇠 하나 (비밀 — anon이 직접 못 읽음)
alter table public.board_secrets
  add column if not exists share_key uuid not null default gen_random_uuid();

-- 입장 확인: 비밀번호 또는 공유 열쇠 둘 중 하나면 통과.
--   통과하면 공유 열쇠를 함께 돌려줌 → 화면의 '링크 복사'에 사용.
create or replace function public.verify_board_entry(p_board_id uuid, p_pw text, p_key text)
returns json language plpgsql security definer set search_path = public, extensions as $fn$
declare v_hash text; v_key uuid;
begin
  select entry_hash, share_key into v_hash, v_key
  from public.board_secrets where board_id = p_board_id;
  if not found then return json_build_object('ok', false, 'error', '게시글을 찾을 수 없습니다.'); end if;

  -- 입장 비번이 없는 게시글은 누구나
  if v_hash is null then
    return json_build_object('ok', true, 'key', v_key);
  end if;
  -- 공유 링크의 열쇠가 맞으면 통과
  if coalesce(btrim(p_key), '') <> '' and btrim(p_key) = v_key::text then
    return json_build_object('ok', true, 'key', v_key);
  end if;
  -- 입장 비밀번호가 맞으면 통과
  if coalesce(p_pw, '') <> '' and v_hash = crypt(p_pw, v_hash) then
    return json_build_object('ok', true, 'key', v_key);
  end if;
  return json_build_object('ok', false, 'error', '비밀번호가 올바르지 않습니다.');
end; $fn$;

-- 관리자 확인도 공유 열쇠를 같이 돌려줌(관리자는 항상 링크를 만들 수 있게)
create or replace function public.verify_board_admin(p_board_id uuid, p_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $fn$
declare v_key uuid;
begin
  if not public._check_admin(p_board_id, p_pw) then
    return json_build_object('ok', false, 'error', '비밀번호가 올바르지 않습니다.');
  end if;
  select share_key into v_key from public.board_secrets where board_id = p_board_id;
  return json_build_object('ok', true, 'key', v_key);
end; $fn$;

-- 게시글 생성: 입장 비밀번호(선택) 다시 받음
drop function if exists public.create_board(text, jsonb, jsonb, text);
create or replace function public.create_board(
  p_author text, p_board jsonb, p_items jsonb, p_admin_pw text, p_entry_pw text)
returns uuid language plpgsql security definer set search_path = public, extensions as $fn$
declare v_id uuid; v_entry text := btrim(coalesce(p_entry_pw, ''));
begin
  if btrim(coalesce(p_admin_pw, '')) = '' then raise exception '관리자 비밀번호를 설정하세요.'; end if;
  insert into public.boards (title, mode, categories, created_by, has_entry_password, folder_id,
                             event_date, table_data, sort_order)
  values (coalesce(p_board->>'title', ''), coalesce(p_board->>'mode', 'check'),
          coalesce(p_board->'categories', '[]'::jsonb), coalesce(p_author, ''), (v_entry <> ''),
          nullif(p_board->>'folder_id', '')::uuid, nullif(p_board->>'event_date', '')::date,
          coalesce(p_board->'table_data', '{"columns":[],"rows":[]}'::jsonb),
          coalesce((p_board->>'sort_order')::int, 0))
  returning id into v_id;
  insert into public.board_secrets (board_id, entry_hash, admin_hash)
  values (v_id,
          case when v_entry = '' then null else crypt(v_entry, gen_salt('bf')) end,
          crypt(p_admin_pw, gen_salt('bf')));
  perform public._insert_items(v_id, p_items);
  return v_id;
end; $fn$;

-- 입장 비밀번호 추가/변경/삭제 (관리자 비밀번호로 확인). 빈 값이면 삭제 = 누구나 입장
create or replace function public.set_entry_password(p_board_id uuid, p_admin_pw text, p_new_entry text)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare v_entry text := btrim(coalesce(p_new_entry, ''));
begin
  if not public._check_admin(p_board_id, p_admin_pw) then
    raise exception '관리자 비밀번호가 올바르지 않습니다.';
  end if;
  if v_entry = '' then
    update public.board_secrets set entry_hash = null where board_id = p_board_id;
    update public.boards set has_entry_password = false where id = p_board_id;
  else
    update public.board_secrets set entry_hash = crypt(v_entry, gen_salt('bf')) where board_id = p_board_id;
    update public.boards set has_entry_password = true where id = p_board_id;
  end if;
end; $fn$;

grant execute on function public.verify_board_entry(uuid, text, text)        to anon, authenticated;
grant execute on function public.verify_board_admin(uuid, text)              to anon, authenticated;
grant execute on function public.create_board(text, jsonb, jsonb, text, text) to anon, authenticated;
grant execute on function public.set_entry_password(uuid, text, text)        to anon, authenticated;

insert into public.schema_migrations (version) values ('015_entry_password_share_link')
on conflict (version) do nothing;
