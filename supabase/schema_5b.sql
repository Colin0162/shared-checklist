-- ============================================================
--  5b: 세션 토큰 + 쓰기/관리 RPC (재실행 안전)
--  Supabase SQL Editor에 붙여넣고 RUN.
--  ※ 이걸 먼저 RUN → 앱에서 재로그인 → 쓰기 정상 확인 →
--     그 다음 schema_5b_lockdown.sql 로 직접쓰기 차단.
-- ============================================================

-- 세션: 로그인 시 토큰 발급, 토큰→사용자 매핑
create table if not exists public.sessions (
  token      uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;  -- 정책 없음 = anon 직접접근 불가

-- 항목별 담당자(#4)
alter table public.items add column if not exists assignee text not null default '';

-- 토큰 → 사용자 (내부 전용: public 호출 금지)
create or replace function public._user_from_token(p_token text)
returns public.users
language sql
security definer
set search_path = public
as $$
  select u.* from public.sessions s
  join public.users u on u.id = s.user_id
  where s.token::text = p_token
  limit 1;
$$;
revoke all on function public._user_from_token(text) from public;

-- 회원가입 (토큰까지 발급). 첫 사용자=관리자.
create or replace function public.register(p_name text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_is_admin boolean; v_name text := btrim(p_name); v_id uuid; v_token uuid;
begin
  if v_name = '' or btrim(p_pin) = '' then
    return json_build_object('ok', false, 'error', '이름과 PIN을 입력하세요.');
  end if;
  if exists (select 1 from public.users where name = v_name) then
    return json_build_object('ok', false, 'error', '이미 있는 이름입니다.');
  end if;
  select count(*) = 0 into v_is_admin from public.users;
  insert into public.users (name, pin_hash, is_admin)
  values (v_name, crypt(p_pin, gen_salt('bf')), v_is_admin) returning id into v_id;
  insert into public.sessions (user_id) values (v_id) returning token into v_token;
  return json_build_object('ok', true, 'name', v_name, 'is_admin', v_is_admin, 'token', v_token);
end; $$;

-- 로그인 (토큰 발급)
create or replace function public.login(p_name text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_user public.users; v_token uuid;
begin
  select * into v_user from public.users where name = btrim(p_name);
  if v_user.id is null or v_user.pin_hash <> crypt(p_pin, v_user.pin_hash) then
    return json_build_object('ok', false, 'error', '이름 또는 PIN이 올바르지 않습니다.');
  end if;
  insert into public.sessions (user_id) values (v_user.id) returning token into v_token;
  return json_build_object('ok', true, 'name', v_user.name, 'is_admin', v_user.is_admin, 'token', v_token);
end; $$;

-- 체크 (로그인 사용자면 누구나). 체크하면 이름 기록, 풀면 비움.
create or replace function public.check_item(p_token text, p_item_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user public.users;
begin
  v_user := _user_from_token(p_token);
  if v_user.id is null then raise exception '로그인이 필요합니다.'; end if;
  update public.items
    set status = p_status,
        checked_by = case when p_status <> '' then v_user.name else '' end,
        updated_at = now()
  where id = p_item_id;
end; $$;

-- 비고 (로그인 사용자면 누구나)
create or replace function public.set_note(p_token text, p_item_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user public.users;
begin
  v_user := _user_from_token(p_token);
  if v_user.id is null then raise exception '로그인이 필요합니다.'; end if;
  update public.items set note = p_note, updated_at = now() where id = p_item_id;
end; $$;

-- 전체 초기화 (관리자만)
create or replace function public.reset_board(p_token text, p_board_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user public.users;
begin
  v_user := _user_from_token(p_token);
  if v_user.id is null or not v_user.is_admin then raise exception '관리자만 가능합니다.'; end if;
  update public.items set status = '', checked_by = '', updated_at = now() where board_id = p_board_id;
end; $$;

-- 게시글 저장 (관리자만): 보드 생성/수정 + 항목 diff(상태/비고 보존)
create or replace function public.admin_save_board(p_token text, p_board jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user public.users; v_board_id uuid; v_keep uuid[]; r record;
begin
  v_user := _user_from_token(p_token);
  if v_user.id is null or not v_user.is_admin then raise exception '관리자만 가능합니다.'; end if;

  if coalesce(p_board->>'id', '') <> '' then
    v_board_id := (p_board->>'id')::uuid;
    update public.boards set
      title = coalesce(p_board->>'title', title),
      mode = coalesce(p_board->>'mode', mode),
      categories = coalesce(p_board->'categories', '[]'::jsonb)
    where id = v_board_id;
  else
    insert into public.boards (title, mode, categories, sort_order)
    values (coalesce(p_board->>'title',''), coalesce(p_board->>'mode','check'),
            coalesce(p_board->'categories','[]'::jsonb), coalesce((p_board->>'sort_order')::int, 0))
    returning id into v_board_id;
  end if;

  -- 남길 항목 id 목록 (없으면 빈 배열 → 기존 전부 삭제)
  v_keep := coalesce(
    (select array_agg((e->>'id')::uuid) from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e
      where coalesce(e->>'id','') <> ''), '{}');
  delete from public.items where board_id = v_board_id and not (id = any(v_keep));

  for r in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce(r.value->>'id','') <> '' then
      update public.items set
        group_name = coalesce(r.value->>'group_name',''),
        label = coalesce(r.value->>'label',''),
        quantity = coalesce(r.value->>'quantity',''),
        show_note = coalesce((r.value->>'show_note')::boolean, false),
        assignee = coalesce(r.value->>'assignee',''),
        sort_order = coalesce((r.value->>'sort_order')::int, 0)
      where id = (r.value->>'id')::uuid and board_id = v_board_id;
    else
      insert into public.items (board_id, group_name, label, quantity, show_note, assignee, sort_order)
      values (v_board_id, coalesce(r.value->>'group_name',''), coalesce(r.value->>'label',''),
              coalesce(r.value->>'quantity',''), coalesce((r.value->>'show_note')::boolean,false),
              coalesce(r.value->>'assignee',''), coalesce((r.value->>'sort_order')::int,0));
    end if;
  end loop;

  return v_board_id;
end; $$;

-- 게시글 삭제 (관리자만)
create or replace function public.admin_delete_board(p_token text, p_board_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user public.users;
begin
  v_user := _user_from_token(p_token);
  if v_user.id is null or not v_user.is_admin then raise exception '관리자만 가능합니다.'; end if;
  delete from public.boards where id = p_board_id;  -- items 는 cascade
end; $$;

-- 사용자 목록 (관리자만)
create or replace function public.admin_list_users(p_token text)
returns table(id uuid, name text, is_admin boolean)
language plpgsql security definer set search_path = public as $$
declare v_user public.users;
begin
  v_user := _user_from_token(p_token);
  if v_user.id is null or not v_user.is_admin then raise exception '관리자만 가능합니다.'; end if;
  return query select u.id, u.name, u.is_admin from public.users u order by u.created_at;
end; $$;

-- 관리자 지정/해제 (관리자만, 마지막 관리자는 해제 불가)
create or replace function public.admin_set_admin(p_token text, p_user_id uuid, p_is_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_user public.users; v_admins int;
begin
  v_user := _user_from_token(p_token);
  if v_user.id is null or not v_user.is_admin then raise exception '관리자만 가능합니다.'; end if;
  if p_is_admin = false then
    select count(*) into v_admins from public.users where is_admin = true;
    if v_admins <= 1 then raise exception '마지막 관리자는 해제할 수 없습니다.'; end if;
  end if;
  update public.users set is_admin = p_is_admin where id = p_user_id;
end; $$;

grant execute on function public.register(text,text)            to anon, authenticated;
grant execute on function public.login(text,text)               to anon, authenticated;
grant execute on function public.check_item(text,uuid,text)     to anon, authenticated;
grant execute on function public.set_note(text,uuid,text)       to anon, authenticated;
grant execute on function public.reset_board(text,uuid)         to anon, authenticated;
grant execute on function public.admin_save_board(text,jsonb,jsonb) to anon, authenticated;
grant execute on function public.admin_delete_board(text,uuid)  to anon, authenticated;
grant execute on function public.admin_list_users(text)         to anon, authenticated;
grant execute on function public.admin_set_admin(text,uuid,boolean) to anon, authenticated;
