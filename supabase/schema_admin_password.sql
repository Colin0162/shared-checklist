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

-- 형식에 '할 일 리스트'(todo), '일정표/표'(table) 추가 허용
alter table public.boards drop constraint if exists boards_mode_check;
alter table public.boards add  constraint boards_mode_check check (mode in ('check','rate','todo','table'));

-- 표(일정표) 데이터: { columns: [열이름...], rows: [[셀,셀...], ...] }
alter table public.boards add column if not exists table_data jsonb not null default '{"columns":[],"rows":[]}'::jsonb;

-- 사이트 관리자: 예약된 계정(anrhks456)이 로그인하면 자동 사이트 관리자
alter table public.users add column if not exists is_site_admin boolean not null default false;
update public.users set is_site_admin = true where name = 'anrhks456';

-- 세션(로그인 토큰)
create table if not exists public.sessions (
  token      uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;  -- anon 차단

-- 세션 정리(#4): 30일 지난 토큰 삭제. 계정(users)은 그대로 → 30일 뒤에도 재로그인하면 새 토큰.
-- (위 인증 함수들이 모두 'created_at > now() - 30일' 조건이라 30일 지난 토큰은 자동 무효)
create or replace function public.cleanup_sessions()
returns void language sql security definer set search_path = public as $$
  delete from public.sessions where created_at < now() - interval '30 days';
$$;

-- 가입 승인제: status(pending/approved).
-- ※ 주의: 예전엔 여기서 'delete from users'로 전체 삭제했었는데, 재RUN마다 계정이
--   지워지는 문제가 있어 제거함. 계정 정리는 앱의 '계정 관리' 화면에서 한다.
alter table public.users add column if not exists status text not null default 'pending';

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
  perform public.cleanup_sessions();  -- 로그인 때마다 만료(30일) 토큰 정리
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
  insert into public.boards (title, mode, categories, created_by, has_entry_password, folder_id, event_date, table_data, sort_order)
  values (coalesce(p_board->>'title',''), coalesce(p_board->>'mode','check'),
          coalesce(p_board->'categories','[]'::jsonb), coalesce(p_author,''),
          (btrim(coalesce(p_entry_pw,'')) <> ''),
          nullif(p_board->>'folder_id','')::uuid, nullif(p_board->>'event_date','')::date,
          coalesce(p_board->'table_data', '{"columns":[],"rows":[]}'::jsonb),
          coalesce((p_board->>'sort_order')::int, 0))
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
    categories = coalesce(p_board->'categories', '[]'::jsonb),
    event_date = nullif(p_board->>'event_date', '')::date,
    table_data = coalesce(p_board->'table_data', table_data)
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
  where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if not coalesce(v_admin, false) then raise exception '사이트 관리자만 가능합니다.'; end if;
  delete from public.boards where id = p_board_id;
end; $$;

grant execute on function public.site_delete_board(text,uuid) to anon, authenticated;

-- ── 가입 승인 (사이트 관리자) ──
create or replace function public._is_site_admin(p_token text)
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select u.is_site_admin from public.sessions s
    join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days'), false);
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

-- ── 계정 관리 (사이트 관리자): 전체 목록 / 삭제 / 비번 재설정 ──
create or replace function public.list_all_users(p_token text)
returns table(id uuid, name text, status text, is_site_admin boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not _is_site_admin(p_token) then raise exception '사이트 관리자만 가능합니다.'; end if;
  return query select u.id, u.name, u.status, u.is_site_admin from public.users u order by u.created_at;
end; $$;

create or replace function public.delete_user(p_token text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _is_site_admin(p_token) then raise exception '사이트 관리자만 가능합니다.'; end if;
  if exists (select 1 from public.users where id = p_user_id and is_site_admin) then
    raise exception '관리자 계정은 삭제할 수 없습니다.';
  end if;
  delete from public.users where id = p_user_id;
end; $$;

create or replace function public.admin_reset_password(p_token text, p_user_id uuid, p_new_pw text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _is_site_admin(p_token) then raise exception '사이트 관리자만 가능합니다.'; end if;
  if btrim(coalesce(p_new_pw,'')) = '' then raise exception '새 비밀번호를 입력하세요.'; end if;
  update public.users set pin_hash = crypt(p_new_pw, gen_salt('bf')) where id = p_user_id;
end; $$;

grant execute on function public.list_all_users(text)              to anon, authenticated;
grant execute on function public.delete_user(text,uuid)            to anon, authenticated;
grant execute on function public.admin_reset_password(text,uuid,text) to anon, authenticated;

-- 본인 비밀번호 변경 (현재 비밀번호 확인 후 변경)
create or replace function public.change_my_password(p_token text, p_old_pw text, p_new_pw text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v_user public.users;
begin
  select u.* into v_user from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_user.id is null then return json_build_object('ok', false, 'error', '로그인이 필요합니다.'); end if;
  if v_user.pin_hash <> crypt(p_old_pw, v_user.pin_hash) then
    return json_build_object('ok', false, 'error', '현재 비밀번호가 올바르지 않습니다.');
  end if;
  if btrim(coalesce(p_new_pw, '')) = '' then
    return json_build_object('ok', false, 'error', '새 비밀번호를 입력하세요.');
  end if;
  update public.users set pin_hash = crypt(p_new_pw, gen_salt('bf')) where id = v_user.id;
  return json_build_object('ok', true);
end; $$;
grant execute on function public.change_my_password(text,text,text) to anon, authenticated;

-- ── 쓰기 잠금: 항목 체크/비고는 '로그인한 사람'만 (직접 쓰기 차단) ──
-- 읽기(items_select_anon)는 그대로 열어둠 → 실시간 동기화 유지.

-- 활동 로그(#3, 가벼운 버전): 누가·언제·무엇을 체크/비고 했는지 기록 (사고 추적·책임)
create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  board_id   uuid references public.boards(id) on delete cascade,
  item_id    uuid,
  user_name  text not null default '',
  action     text not null default '',   -- '체크' | '해제' | '상/중/하' | '비고'
  detail     text not null default '',   -- 항목 이름 등
  created_at timestamptz not null default now()
);
alter table public.activity_log enable row level security;  -- anon 직접 접근 차단(조회는 RPC로만)
create index if not exists activity_log_board_idx on public.activity_log (board_id, created_at desc);

create or replace function public.check_item(p_token text, p_item_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_label text; v_board uuid;
begin
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  update public.items
    set status = p_status,
        checked_by = case when p_status <> '' then v_name else '' end,
        updated_at = now()
  where id = p_item_id;
  -- 활동 기록 (항목 이름·소속 게시글 함께)
  select label, board_id into v_label, v_board from public.items where id = p_item_id;
  insert into public.activity_log (board_id, item_id, user_name, action, detail)
  values (v_board, p_item_id, v_name,
          case when p_status = '' then '해제' when p_status = 'done' then '체크' else p_status end,
          coalesce(v_label, ''));
end; $$;

create or replace function public.set_note(p_token text, p_item_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_label text; v_board uuid;
begin
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  update public.items set note = p_note, updated_at = now() where id = p_item_id;
  -- 활동 기록
  select label, board_id into v_label, v_board from public.items where id = p_item_id;
  insert into public.activity_log (board_id, item_id, user_name, action, detail)
  values (v_board, p_item_id, v_name, '비고', coalesce(v_label, ''));
end; $$;

grant execute on function public.check_item(text,uuid,text) to anon, authenticated;
grant execute on function public.set_note(text,uuid,text)   to anon, authenticated;

-- 최근 활동 조회(로그인 사용자) — 게시글별 최근 기록 (기본 50, 최대 200)
create or replace function public.list_board_activity(p_token text, p_board_id uuid, p_limit int)
returns table(user_name text, action text, detail text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  return query select a.user_name, a.action, a.detail, a.created_at
    from public.activity_log a where a.board_id = p_board_id
    order by a.created_at desc limit least(coalesce(p_limit, 50), 200);
end; $$;
grant execute on function public.list_board_activity(text,uuid,int) to anon, authenticated;

-- 항목 직접 쓰기(비로그인 포함) 차단. 관리자 편집·체크/비고는 위 RPC가 서버권한으로 처리.
-- ※ 만약 체크가 안 되면(긴급 롤백) 아래 한 줄을 실행:
--    create policy items_update_anon on public.items for update using (true) with check (true);
drop policy if exists items_insert_anon on public.items;
drop policy if exists items_update_anon on public.items;
drop policy if exists items_delete_anon on public.items;

-- ── 폴더 (#4) ──
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner      text not null default '',     -- 비공개 폴더 소유자 이름(공개면 '')
  is_private boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.folders enable row level security;
drop policy if exists folders_select_anon on public.folders;
create policy folders_select_anon on public.folders for select using (true);

-- 폴더 안의 폴더(하위 폴더). null이면 최상위
alter table public.folders add column if not exists parent_id uuid references public.folders(id) on delete cascade;

-- 게시글이 어느 폴더에 속하는지
alter table public.boards add column if not exists folder_id uuid references public.folders(id) on delete set null;

-- 기본 공개 폴더 + 기존 게시글을 그 폴더로
insert into public.folders (name, is_private, sort_order)
select '기본', false, 0 where not exists (select 1 from public.folders where name = '기본' and is_private = false);
update public.boards set folder_id = (select id from public.folders where name = '기본' and is_private = false limit 1)
where folder_id is null;

-- 폴더 생성 (로그인 사용자). 비공개면 소유자=본인
drop function if exists public.create_folder(text,text,boolean);
create or replace function public.create_folder(p_token text, p_name text, p_is_private boolean, p_parent_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_name text; v_id uuid;
begin
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  if btrim(coalesce(p_name,'')) = '' then raise exception '폴더 이름을 입력하세요.'; end if;
  insert into public.folders (name, owner, is_private, parent_id)
  values (btrim(p_name), v_name, coalesce(p_is_private, false), p_parent_id)
  returning id into v_id;
  return v_id;
end; $$;

-- 폴더 삭제 (비공개=소유자만, 공개=사이트관리자만, 게시글 없을 때만)
create or replace function public.delete_folder(p_token text, p_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_admin boolean; v_owner text; v_priv boolean;
begin
  select u.name, u.is_site_admin into v_name, v_admin
  from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  -- 비어 있을 때만 삭제 (안의 게시글·하위폴더 먼저 정리)
  if exists (select 1 from public.boards where folder_id = p_folder_id) then
    raise exception '폴더 안 게시글을 먼저 옮기거나 삭제하세요.';
  end if;
  if exists (select 1 from public.folders where parent_id = p_folder_id) then
    raise exception '하위 폴더를 먼저 정리하세요.';
  end if;
  -- 만든 사람 또는 사이트 관리자만 삭제
  select owner into v_owner from public.folders where id = p_folder_id;
  if v_owner <> v_name and not coalesce(v_admin, false) then
    raise exception '본인이 만든 폴더만 삭제할 수 있습니다.';
  end if;
  delete from public.folders where id = p_folder_id;
end; $$;

grant execute on function public.create_folder(text,text,boolean,uuid) to anon, authenticated;
grant execute on function public.delete_folder(text,uuid)              to anon, authenticated;

-- ── 템플릿 (#1): 체크리스트 구성을 저장해두고 새 게시글에 불러오기 ──
create table if not exists public.templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  mode       text not null default 'check',
  categories jsonb not null default '[]'::jsonb,
  items      jsonb not null default '[]'::jsonb,   -- [{group_name,label,quantity,show_note,assignee}]
  owner      text not null default '',
  created_at timestamptz not null default now()
);
alter table public.templates enable row level security;
alter table public.templates add column if not exists table_data jsonb not null default '{"columns":[],"rows":[]}'::jsonb;
-- 템플릿은 '본인 것만'(개인용). anon 직접 SELECT 차단 → list_templates RPC로만 조회.
drop policy if exists templates_select_anon on public.templates;

drop function if exists public.save_template(text,text,text,jsonb,jsonb);
create or replace function public.save_template(p_token text, p_name text, p_mode text, p_categories jsonb, p_items jsonb, p_table_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_name text; v_id uuid;
begin
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  if btrim(coalesce(p_name,'')) = '' then raise exception '템플릿 이름을 입력하세요.'; end if;
  insert into public.templates (name, mode, categories, items, table_data, owner)
  values (btrim(p_name), coalesce(p_mode,'check'), coalesce(p_categories,'[]'::jsonb),
          coalesce(p_items,'[]'::jsonb), coalesce(p_table_data,'{"columns":[],"rows":[]}'::jsonb), v_name)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.delete_template(p_token text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_admin boolean; v_owner text;
begin
  select u.name, u.is_site_admin into v_name, v_admin
  from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  select owner into v_owner from public.templates where id = p_id;
  if v_owner <> v_name and not coalesce(v_admin, false) then
    raise exception '본인 템플릿만 삭제할 수 있습니다.';
  end if;
  delete from public.templates where id = p_id;
end; $$;

-- 본인 템플릿만 반환
drop function if exists public.list_templates(text);
create or replace function public.list_templates(p_token text)
returns table(id uuid, name text, mode text, categories jsonb, items jsonb, table_data jsonb)
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then return; end if;
  return query select t.id, t.name, t.mode, t.categories, t.items, t.table_data
    from public.templates t where t.owner = v_name order by t.created_at;
end; $$;

grant execute on function public.save_template(text,text,text,jsonb,jsonb,jsonb) to anon, authenticated;
grant execute on function public.delete_template(text,uuid)                to anon, authenticated;
grant execute on function public.list_templates(text)                      to anon, authenticated;

-- ── 에러 로깅(가벼운 버전): 사용자가 본 오류를 운영자(사이트 관리자)가 볼 수 있게 ──
create table if not exists public.client_error (
  id         bigint generated always as identity primary key,
  user_name  text not null default '',   -- 토큰이 유효하면 그 사람 이름(아니면 '')
  message    text not null default '',    -- 에러 메시지
  context    text not null default '',    -- 발생 위치(URL) + 브라우저 등
  created_at timestamptz not null default now()
);
alter table public.client_error enable row level security;  -- anon 직접 접근 차단(기록/조회는 RPC로만)
create index if not exists client_error_created_idx on public.client_error (created_at desc);

-- 에러 기록: 로그인 안 됐거나 토큰 만료여도 기록은 됨(이름만 비게). 빈 메시지는 무시.
create or replace function public.log_client_error(p_token text, p_message text, p_context text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := '';
begin
  if coalesce(btrim(p_message), '') = '' then return; end if;
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id
    where s.token::text = p_token and s.created_at > now() - interval '30 days';
  insert into public.client_error (user_name, message, context)
  values (coalesce(v_name, ''), left(p_message, 500), left(coalesce(p_context, ''), 300));
end; $$;
grant execute on function public.log_client_error(text,text,text) to anon, authenticated;

-- 최근 오류 조회(사이트 관리자만) — 기본 50, 최대 200
create or replace function public.list_client_errors(p_token text, p_limit int)
returns table(user_name text, message text, context text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not _is_site_admin(p_token) then raise exception '사이트 관리자만 가능합니다.'; end if;
  return query select e.user_name, e.message, e.context, e.created_at
    from public.client_error e order by e.created_at desc limit least(coalesce(p_limit, 50), 200);
end; $$;
grant execute on function public.list_client_errors(text,int) to anon, authenticated;

-- ── 마이그레이션 추적(#2) ──
-- 이 파일(schema_admin_password.sql) 전체 = '001_baseline'(지금까지의 모든 스키마).
-- 앞으로의 변경은 supabase/migrations/002_*.sql 처럼 번호별 파일 한 번씩. (migrations/README.md)
create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;  -- anon 차단(메타데이터)
insert into public.schema_migrations (version) values ('001_baseline')
on conflict (version) do nothing;
