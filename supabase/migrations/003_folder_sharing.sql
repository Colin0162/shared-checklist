-- ============================================================
--  003: 폴더 공유 모델 (개인 / 공유 / 공개)
--  - 폴더 종류: visibility = 'public'(기본 폴더) | 'private'(개인) | 'shared'(공유)
--  - 새 폴더는 무조건 'private'(만든 사람만). 공유는 만든 뒤 '공유' 버튼으로 전환(최상위만).
--  - 공유 폴더 = 암호(folder_secrets) + 참여자(folder_members, admin/member).
--  - 폴더/게시글 조회를 토큰 기반 RPC로 → 안 보이는 폴더는 서버가 안 내려줌.
--  - 기존 데이터 변환: 기본→public, 나만보기→private, 청년회/보나회/중고등부→shared(암호=이름, 서버관리자가 폴더관리자).
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

-- ── 공유 폴더 암호 (anon 직접 접근 불가; 확인은 RPC로만) ──
create table if not exists public.folder_secrets (
  folder_id uuid primary key references public.folders(id) on delete cascade,
  pass_hash text not null
);
alter table public.folder_secrets enable row level security;  -- 정책 없음 = anon 차단

-- ── 공유 폴더 참여자 (admin/member) ──
create table if not exists public.folder_members (
  folder_id uuid not null references public.folders(id) on delete cascade,
  user_id   uuid not null references public.users(id)   on delete cascade,
  role      text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);
alter table public.folder_members enable row level security;  -- 정책 없음 = anon 차단(조회/변경은 RPC로만)

-- ── 폴더 종류 컬럼 ──
alter table public.folders add column if not exists visibility text not null default 'private';
alter table public.folders drop constraint if exists folders_visibility_check;
alter table public.folders add  constraint folders_visibility_check check (visibility in ('public','private','shared'));

-- ── 기존 데이터 1회 변환 (재실행 안전: schema_migrations로 가드) ──
do $$
declare v_admin uuid; v_fid uuid; v_pw text; r record;
begin
  if exists (select 1 from public.schema_migrations where version = '003_folder_sharing') then
    raise notice '003_folder_sharing 이미 적용됨 — 데이터 변환 건너뜀';
    return;
  end if;

  -- 기본 폴더(최상위 '기본')는 공개
  update public.folders set visibility = 'public'  where name = '기본' and parent_id is null;
  -- 예전 '나만 보기' 폴더는 개인
  update public.folders set visibility = 'private' where is_private = true;

  -- 서버 관리자(폴더 관리자로 시드)
  select id into v_admin from public.users where name = 'anrhks456' limit 1;

  -- 청년회/보나회/중고등부 → 공유 폴더(암호 = 폴더 이름), 서버 관리자를 폴더 관리자로
  for r in select * from (values ('청년회'), ('보나회'), ('중고등부')) as t(nm) loop
    select id into v_fid from public.folders where name = r.nm and parent_id is null limit 1;
    if v_fid is not null then
      update public.folders set visibility = 'shared' where id = v_fid;
      insert into public.folder_secrets (folder_id, pass_hash)
      values (v_fid, extensions.crypt(r.nm, extensions.gen_salt('bf')))
      on conflict (folder_id) do nothing;
      if v_admin is not null then
        insert into public.folder_members (folder_id, user_id, role)
        values (v_fid, v_admin, 'admin')
        on conflict (folder_id, user_id) do update set role = 'admin';
      end if;
    end if;
  end loop;

  insert into public.schema_migrations (version) values ('003_folder_sharing');
end $$;

-- ============================================================
--  RPC (함수는 do 블록 '밖'에서 정의 — $fn$ 태그)
-- ============================================================

-- 토큰 → (user_id, name). 만료/무효면 둘 다 null
create or replace function public._whoami(p_token text)
returns table(uid uuid, uname text) language sql security definer set search_path = public as $fn$
  select u.id, u.name from public.sessions s join public.users u on u.id = s.user_id
  where s.token::text = p_token and s.created_at > now() - interval '30 days';
$fn$;
revoke all on function public._whoami(text) from public;

-- 보이는 폴더: 공개 전체 + 내 개인 + 내가 참여한 공유. (가시성은 '최상위 조상' 기준)
create or replace function public.list_visible_folders(p_token text)
returns table(id uuid, name text, visibility text, owner text, parent_id uuid, sort_order int, my_role text)
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
  select f.id, f.name, f.visibility, f.owner, f.parent_id, f.sort_order,
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

-- 보이는 게시글: 보이는 폴더 안의 것만(+ 옛 루트 게시글 folder_id is null)
create or replace function public.list_visible_boards(p_token text)
returns table(id uuid, title text, description text, mode text, categories jsonb,
              created_by text, has_entry_password boolean, memo text, folder_id uuid,
              event_date date, table_data jsonb, sort_order int)
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
  roots as (select rf.id, rf.visibility, rf.owner from public.folders rf where rf.parent_id is null),
  visible as (
    select f.id from public.folders f
    join tree  t on t.id = f.id
    join roots r on r.id = t.root_id
    where r.visibility = 'public'
       or (r.visibility = 'private' and r.owner = coalesce(v_name, ''))
       or (r.visibility = 'shared'  and exists (
             select 1 from public.folder_members m where m.folder_id = t.root_id and m.user_id = v_uid))
  )
  select b.id, b.title, b.description, b.mode, b.categories, b.created_by, b.has_entry_password,
         b.memo, b.folder_id, b.event_date, b.table_data, b.sort_order
  from public.boards b
  where b.folder_id is null or b.folder_id in (select v.id from visible v)
  order by b.sort_order;
end; $fn$;

-- 폴더 생성: 무조건 개인(private), 소유자 = 본인
drop function if exists public.create_folder(text, text, boolean, uuid);
create or replace function public.create_folder(p_token text, p_name text, p_parent_id uuid)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text; v_id uuid;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception '폴더 이름을 입력하세요.'; end if;
  insert into public.folders (name, owner, visibility, is_private, parent_id)
  values (btrim(p_name), v_name, 'private', true, p_parent_id)
  returning id into v_id;
  return v_id;
end; $fn$;

-- 폴더 공유로 전환 / 암호 변경 (최상위 폴더만). 본인(private 소유자) 또는 현 관리자(shared)만.
create or replace function public.share_folder(p_token text, p_folder_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare v_uid uuid; v_name text; v_owner text; v_parent uuid; v_vis text; v_role text;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if btrim(coalesce(p_password, '')) = '' then raise exception '공유 암호(키워드)를 입력하세요.'; end if;
  select owner, parent_id, visibility into v_owner, v_parent, v_vis
  from public.folders where id = p_folder_id;
  if v_vis is null then raise exception '폴더를 찾을 수 없습니다.'; end if;
  if v_parent is not null then raise exception '최상위 폴더만 공유할 수 있습니다.'; end if;
  if v_vis = 'public' then raise exception '공개(기본) 폴더는 공유 설정할 수 없습니다.'; end if;
  if v_vis = 'private' then
    if v_owner <> v_name then raise exception '본인이 만든 폴더만 공유할 수 있습니다.'; end if;
  elsif v_vis = 'shared' then
    select role into v_role from public.folder_members where folder_id = p_folder_id and user_id = v_uid;
    if coalesce(v_role, '') <> 'admin' then raise exception '폴더 관리자만 암호를 변경할 수 있습니다.'; end if;
  end if;
  update public.folders set visibility = 'shared' where id = p_folder_id;
  insert into public.folder_secrets (folder_id, pass_hash)
  values (p_folder_id, crypt(p_password, gen_salt('bf')))
  on conflict (folder_id) do update set pass_hash = excluded.pass_hash;
  insert into public.folder_members (folder_id, user_id, role)
  values (p_folder_id, v_uid, 'admin')
  on conflict (folder_id, user_id) do update set role = 'admin';
end; $fn$;

-- 공유 해제 → 개인으로 (관리자만, 게시글/하위폴더 없을 때만 안전)
create or replace function public.unshare_folder(p_token text, p_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text; v_role text;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select role into v_role from public.folder_members where folder_id = p_folder_id and user_id = v_uid;
  if coalesce(v_role, '') <> 'admin' then raise exception '폴더 관리자만 공유를 해제할 수 있습니다.'; end if;
  update public.folders set visibility = 'private', owner = v_name where id = p_folder_id;
  delete from public.folder_secrets where folder_id = p_folder_id;
  delete from public.folder_members where folder_id = p_folder_id;
end; $fn$;

-- 공유 폴더 참여: 암호(키워드)가 맞는 공유 폴더에 멤버로 등록 → 그때부터 목록에 나타남
create or replace function public.join_folder(p_token text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $fn$
declare v_uid uuid; v_name text; r record; v_joined text := '';
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then return json_build_object('ok', false, 'error', '로그인이 필요합니다.'); end if;
  if btrim(coalesce(p_password, '')) = '' then return json_build_object('ok', false, 'error', '암호(키워드)를 입력하세요.'); end if;
  for r in
    select f.id, f.name from public.folder_secrets s
    join public.folders f on f.id = s.folder_id
    where f.visibility = 'shared' and s.pass_hash = crypt(p_password, s.pass_hash)
  loop
    insert into public.folder_members (folder_id, user_id, role)
    values (r.id, v_uid, 'member')
    on conflict (folder_id, user_id) do nothing;
    v_joined := v_joined || case when v_joined = '' then '' else ', ' end || r.name;
  end loop;
  if v_joined = '' then return json_build_object('ok', false, 'error', '암호가 맞는 공유 폴더가 없습니다.'); end if;
  return json_build_object('ok', true, 'joined', v_joined);
end; $fn$;

-- 공유 폴더에서 스스로 나가기 (관리자는 먼저 넘긴 뒤 가능)
create or replace function public.leave_folder(p_token text, p_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_role text;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select role into v_role from public.folder_members where folder_id = p_folder_id and user_id = v_uid;
  if v_role is null then raise exception '참여 중인 폴더가 아닙니다.'; end if;
  if v_role = 'admin' then raise exception '관리자는 다른 참여자에게 관리자를 넘긴 뒤 나갈 수 있습니다.'; end if;
  delete from public.folder_members where folder_id = p_folder_id and user_id = v_uid;
end; $fn$;

-- 참여자 목록 (그 폴더 참여자 또는 사이트 관리자만 조회)
create or replace function public.list_folder_members(p_token text, p_folder_id uuid)
returns table(user_id uuid, name text, role text)
language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_admin boolean;
begin
  select s.user_id, u.is_site_admin into v_uid, v_admin
  from public.sessions s join public.users u on u.id = s.user_id
  where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not coalesce(v_admin, false)
     and not exists (select 1 from public.folder_members m where m.folder_id = p_folder_id and m.user_id = v_uid) then
    raise exception '참여자만 볼 수 있습니다.';
  end if;
  return query
  select m.user_id, u.name, m.role from public.folder_members m
  join public.users u on u.id = m.user_id
  where m.folder_id = p_folder_id
  order by (m.role = 'admin') desc, u.name;
end; $fn$;

-- 참여자 내보내기 (관리자만; 관리자/본인은 내보낼 수 없음)
create or replace function public.kick_member(p_token text, p_folder_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_role text;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select role into v_role from public.folder_members where folder_id = p_folder_id and user_id = v_uid;
  if coalesce(v_role, '') <> 'admin' then raise exception '폴더 관리자만 내보낼 수 있습니다.'; end if;
  if p_user_id = v_uid then raise exception '본인은 내보낼 수 없습니다.'; end if;
  delete from public.folder_members
  where folder_id = p_folder_id and user_id = p_user_id and role <> 'admin';
end; $fn$;

-- 관리자 넘기기 (현 관리자만; 대상은 이미 참여자여야)
create or replace function public.transfer_folder_admin(p_token text, p_folder_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_role text;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select role into v_role from public.folder_members where folder_id = p_folder_id and user_id = v_uid;
  if coalesce(v_role, '') <> 'admin' then raise exception '폴더 관리자만 넘길 수 있습니다.'; end if;
  if not exists (select 1 from public.folder_members where folder_id = p_folder_id and user_id = p_user_id) then
    raise exception '참여 중인 사람에게만 넘길 수 있습니다.';
  end if;
  update public.folder_members set role = 'member' where folder_id = p_folder_id and user_id = v_uid;
  update public.folder_members set role = 'admin'  where folder_id = p_folder_id and user_id = p_user_id;
end; $fn$;

-- 폴더 삭제(빈 폴더만): private=소유자, shared=폴더관리자, public=사이트관리자
create or replace function public.delete_folder(p_token text, p_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text; v_admin boolean; v_owner text; v_vis text; v_role text;
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
  select owner, visibility into v_owner, v_vis from public.folders where id = p_folder_id;
  if v_vis = 'public' then
    if not coalesce(v_admin, false) then raise exception '공개 폴더는 사이트 관리자만 삭제할 수 있습니다.'; end if;
  elsif v_vis = 'shared' then
    select role into v_role from public.folder_members where folder_id = p_folder_id and user_id = v_uid;
    if coalesce(v_role, '') <> 'admin' and not coalesce(v_admin, false) then
      raise exception '폴더 관리자만 삭제할 수 있습니다.';
    end if;
  else  -- private
    if v_owner <> v_name and not coalesce(v_admin, false) then
      raise exception '본인이 만든 폴더만 삭제할 수 있습니다.';
    end if;
  end if;
  delete from public.folders where id = p_folder_id;
end; $fn$;

-- 권한 부여
grant execute on function public.list_visible_folders(text)               to anon, authenticated;
grant execute on function public.list_visible_boards(text)                 to anon, authenticated;
grant execute on function public.create_folder(text, text, uuid)           to anon, authenticated;
grant execute on function public.share_folder(text, uuid, text)            to anon, authenticated;
grant execute on function public.unshare_folder(text, uuid)                to anon, authenticated;
grant execute on function public.join_folder(text, text)                   to anon, authenticated;
grant execute on function public.leave_folder(text, uuid)                  to anon, authenticated;
grant execute on function public.list_folder_members(text, uuid)           to anon, authenticated;
grant execute on function public.kick_member(text, uuid, uuid)             to anon, authenticated;
grant execute on function public.transfer_folder_admin(text, uuid, uuid)   to anon, authenticated;
grant execute on function public.delete_folder(text, uuid)                 to anon, authenticated;

-- folders 직접 SELECT 차단(목록은 list_visible_folders RPC로만 → 안 보이는 폴더는 서버가 숨김)
drop policy if exists folders_select_anon on public.folders;

-- 끝에 버전 기록은 위 do 블록에서 처리함(데이터 변환과 함께 1회).
