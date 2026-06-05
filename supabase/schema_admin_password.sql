-- ============================================================
--  게시글별 비밀번호 모델 (재실행 안전)
--  - 사용자별 관리자 없음. 로그인은 신원/작성자용(토큰X).
--  - 게시글마다: 편집 비밀번호(admin) + 입장 비밀번호(entry, 선택)
--  - 비번 해시는 board_secrets(anon 차단)에. boards 쓰기는 RPC 전용.
--  Supabase SQL Editor에 붙여넣고 RUN.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- 게시글 컬럼: 작성자 / 입장보호여부 / 공유메모
alter table public.boards add column if not exists created_by         text    not null default '';
alter table public.boards add column if not exists has_entry_password boolean not null default false;
alter table public.boards add column if not exists memo               text    not null default '';
-- 항목 담당자(#4)
alter table public.items  add column if not exists assignee text not null default '';

-- 형식에 '할 일 리스트'(todo) 추가 허용
alter table public.boards drop constraint if exists boards_mode_check;
alter table public.boards add  constraint boards_mode_check check (mode in ('check','rate','todo'));

-- 사이트 관리자: 예약된 계정(anrhks456)이 로그인하면 자동 사이트 관리자
alter table public.users add column if not exists is_site_admin boolean not null default false;
update public.users set is_site_admin = true where name = 'anrhks456';

-- 세션(사이트 관리자 작업 인증용 토큰)
create table if not exists public.sessions (
  token      uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;  -- anon 차단

-- 가입 승인제: status(pending/approved). 기존 가입정보 전부 삭제(요청).
alter table public.users add column if not exists status text not null default 'pending';
delete from public.users;  -- 모든 사용자 삭제(sessions cascade). anrhks456 재가입 시 자동 관리자+승인.

-- 비밀번호 해시 보관 (anon 직접 접근 불가)
create table if not exists public.board_secrets (
  board_id   uuid primary key references public.boards(id) on delete cascade,
  entry_hash text,            -- null = 입장 비번 없음(전체공개)
  admin_hash text not null
);
alter table public.board_secrets enable row level security;  -- 정책 없음 = anon 차단

-- 기존 게시글(비번 없던 것)에 기본 편집 비밀번호 '1234' 부여.
-- (이전에 만든 샘플들. 들어가서 삭제하거나 새로 만들면 됨)
insert into public.board_secrets (board_id, admin_hash)
select b.id, extensions.crypt('1234', extensions.gen_salt('bf'))
from public.boards b
where not exists (select 1 from public.board_secrets s where s.board_id = b.id);

-- ── 로그인/가입 (토큰/관리자 없음) ──
create or replace function public.register(p_name text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_name text := btrim(p_name); v_admin boolean; v_id uuid; v_token uuid;
begin
  if v_name = '' or btrim(p_pin) = '' then return json_build_object('ok', false, 'error', '이름과 비밀번호를 입력하세요.'); end if;
  if exists (select 1 from public.users where name = v_name) then return json_build_object('ok', false, 'error', '이미 있는 이름입니다.'); end if;
  v_admin := (v_name = 'anrhks456');
  insert into public.users (name, pin_hash, is_site_admin, status)
  values (v_name, crypt(p_pin, gen_salt('bf')), v_admin,
          case when v_admin then 'approved' else 'pending' end)
  returning id into v_id;
  if v_admin then
    insert into public.sessions (user_id) values (v_id) returning token into v_token;
    return json_build_object('ok', true, 'name', v_name, 'is_site_admin', true, 'token', v_token);
  end if;
  return json_build_object('ok', true, 'pending', true);  -- 일반 가입은 승인 대기
end; $$;

create or replace function public.login(p_name text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_user public.users; v_token uuid;
begin
  select * into v_user from public.users where name = btrim(p_name);
  if v_user.id is null or v_user.pin_hash <> crypt(p_pin, v_user.pin_hash) then
    return json_build_object('ok', false, 'error', '이름 또는 비밀번호가 올바르지 않습니다.');
  end if;
  if v_user.status <> 'approved' then
    return json_build_object('ok', false, 'error', '가입 승인 대기 중입니다. 강무관(필립보)에게 연락하세요.');
  end if;
  insert into public.sessions (user_id) values (v_user.id) returning token into v_token;
  return json_build_object('ok', true, 'name', v_user.name, 'is_site_admin', v_user.is_site_admin, 'token', v_token);
end; $$;

-- ── 편집 비번 확인 헬퍼 (내부 전용) ──
create or replace function public._check_admin(p_board_id uuid, p_pw text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.board_secrets s
    where s.board_id = p_board_id and s.admin_hash = crypt(p_pw, s.admin_hash)
  );
$$;
revoke all on function public._check_admin(uuid, text) from public;

-- 항목 배열을 보드에 삽입 (내부 공용)
create or replace function public._insert_items(p_board_id uuid, p_items jsonb)
returns void language plpgsql set search_path = public as $$
declare r record;
begin
  for r in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.items (board_id, group_name, label, quantity, show_note, assignee, sort_order)
    values (p_board_id, coalesce(r.value->>'group_name',''), coalesce(r.value->>'label',''),
            coalesce(r.value->>'quantity',''), coalesce((r.value->>'show_note')::boolean,false),
            coalesce(r.value->>'assignee',''), coalesce((r.value->>'sort_order')::int,0));
  end loop;
end; $$;

-- ── 게시글 생성 (로그인 사용자 누구나) ──
create or replace function public.create_board(
  p_author text, p_board jsonb, p_items jsonb, p_admin_pw text, p_entry_pw text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if btrim(coalesce(p_admin_pw,'')) = '' then raise exception '관리자 비밀번호를 설정하세요.'; end if;
  insert into public.boards (title, mode, categories, created_by, has_entry_password, sort_order)
  values (coalesce(p_board->>'title',''), coalesce(p_board->>'mode','check'),
          coalesce(p_board->'categories','[]'::jsonb), coalesce(p_author,''),
          (btrim(coalesce(p_entry_pw,'')) <> ''), coalesce((p_board->>'sort_order')::int, 0))
  returning id into v_id;
  insert into public.board_secrets (board_id, entry_hash, admin_hash)
  values (v_id,
          case when btrim(coalesce(p_entry_pw,'')) = '' then null else crypt(p_entry_pw, gen_salt('bf')) end,
          crypt(p_admin_pw, gen_salt('bf')));
  perform public._insert_items(v_id, p_items);
  return v_id;
end; $$;

-- ── 게시글 수정 (편집 비번 필요) ──
create or replace function public.update_board(
  p_board_id uuid, p_pw text, p_board jsonb, p_items jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_keep uuid[]; r record;
begin
  if not _check_admin(p_board_id, p_pw) then raise exception '관리자 비밀번호가 올바르지 않습니다.'; end if;
  update public.boards set
    title = coalesce(p_board->>'title', title),
    mode = coalesce(p_board->>'mode', mode),
    categories = coalesce(p_board->'categories', '[]'::jsonb)
  where id = p_board_id;

  v_keep := coalesce((select array_agg((e->>'id')::uuid)
                      from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) e
                      where coalesce(e->>'id','') <> ''), '{}');
  delete from public.items where board_id = p_board_id and not (id = any(v_keep));

  for r in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce(r.value->>'id','') <> '' then
      update public.items set
        group_name = coalesce(r.value->>'group_name',''), label = coalesce(r.value->>'label',''),
        quantity = coalesce(r.value->>'quantity',''), show_note = coalesce((r.value->>'show_note')::boolean,false),
        assignee = coalesce(r.value->>'assignee',''), sort_order = coalesce((r.value->>'sort_order')::int,0)
      where id = (r.value->>'id')::uuid and board_id = p_board_id;
    else
      insert into public.items (board_id, group_name, label, quantity, show_note, assignee, sort_order)
      values (p_board_id, coalesce(r.value->>'group_name',''), coalesce(r.value->>'label',''),
              coalesce(r.value->>'quantity',''), coalesce((r.value->>'show_note')::boolean,false),
              coalesce(r.value->>'assignee',''), coalesce((r.value->>'sort_order')::int,0));
    end if;
  end loop;
end; $$;

create or replace function public.delete_board(p_board_id uuid, p_pw text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _check_admin(p_board_id, p_pw) then raise exception '관리자 비밀번호가 올바르지 않습니다.'; end if;
  delete from public.boards where id = p_board_id;  -- items/secrets cascade
end; $$;

create or replace function public.reset_board(p_board_id uuid, p_pw text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _check_admin(p_board_id, p_pw) then raise exception '관리자 비밀번호가 올바르지 않습니다.'; end if;
  update public.items set status = '', checked_by = '', updated_at = now() where board_id = p_board_id;
end; $$;

-- 관리자 모드 진입 확인
create or replace function public.verify_board_admin(p_board_id uuid, p_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $$
begin
  if _check_admin(p_board_id, p_pw) then return json_build_object('ok', true);
  else return json_build_object('ok', false, 'error', '비밀번호가 올바르지 않습니다.'); end if;
end; $$;

-- 입장 비번 확인
create or replace function public.verify_board_entry(p_board_id uuid, p_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  select entry_hash into v_hash from public.board_secrets where board_id = p_board_id;
  if v_hash is null then return json_build_object('ok', true); end if;
  if v_hash = crypt(p_pw, v_hash) then return json_build_object('ok', true);
  else return json_build_object('ok', false, 'error', '비밀번호가 올바르지 않습니다.'); end if;
end; $$;

-- 공유 메모 (로그인 사용자 누구나)
create or replace function public.set_memo(p_board_id uuid, p_memo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.boards set memo = p_memo where id = p_board_id;
end; $$;

-- boards 직접 쓰기 차단 (생성/수정/삭제는 위 RPC로만). items 쓰기는 열어둠(체크/비고).
drop policy if exists boards_insert_anon on public.boards;
drop policy if exists boards_update_anon on public.boards;
drop policy if exists boards_delete_anon on public.boards;

grant execute on function public.register(text,text)                         to anon, authenticated;
grant execute on function public.login(text,text)                            to anon, authenticated;
grant execute on function public.create_board(text,jsonb,jsonb,text,text)    to anon, authenticated;
grant execute on function public.update_board(uuid,text,jsonb,jsonb)         to anon, authenticated;
grant execute on function public.delete_board(uuid,text)                     to anon, authenticated;
grant execute on function public.reset_board(uuid,text)                      to anon, authenticated;
grant execute on function public.verify_board_admin(uuid,text)              to anon, authenticated;
grant execute on function public.verify_board_entry(uuid,text)              to anon, authenticated;
grant execute on function public.set_memo(uuid,text)                         to anon, authenticated;

-- ── 사이트 관리자 (예약 계정 anrhks456) ──
drop function if exists public.verify_site_admin(text);
drop function if exists public.site_delete_board(text, uuid);
drop table if exists public.app_admin;

-- 사이트 관리자(세션 토큰의 주인이 is_site_admin)면 아무 게시글이나 삭제
create or replace function public.site_delete_board(p_token text, p_board_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  select u.is_site_admin into v_admin
  from public.sessions s join public.users u on u.id = s.user_id
  where s.token::text = p_token;
  if not coalesce(v_admin, false) then raise exception '사이트 관리자만 가능합니다.'; end if;
  delete from public.boards where id = p_board_id;
end; $$;

grant execute on function public.site_delete_board(text,uuid) to anon, authenticated;

-- ── 가입 승인 (사이트 관리자) ──
create or replace function public._is_site_admin(p_token text)
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select u.is_site_admin from public.sessions s
    join public.users u on u.id = s.user_id where s.token::text = p_token), false);
$$;
revoke all on function public._is_site_admin(text) from public;

create or replace function public.list_pending_users(p_token text)
returns table(id uuid, name text) language plpgsql security definer set search_path = public as $$
begin
  if not _is_site_admin(p_token) then raise exception '사이트 관리자만 가능합니다.'; end if;
  return query select u.id, u.name from public.users u where u.status = 'pending' order by u.created_at;
end; $$;

create or replace function public.approve_user(p_token text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_site_admin(p_token) then raise exception '사이트 관리자만 가능합니다.'; end if;
  update public.users set status = 'approved' where id = p_user_id;
end; $$;

create or replace function public.reject_user(p_token text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_site_admin(p_token) then raise exception '사이트 관리자만 가능합니다.'; end if;
  delete from public.users where id = p_user_id and status = 'pending';
end; $$;

grant execute on function public.list_pending_users(text)      to anon, authenticated;
grant execute on function public.approve_user(text,uuid)       to anon, authenticated;
grant execute on function public.reject_user(text,uuid)        to anon, authenticated;
