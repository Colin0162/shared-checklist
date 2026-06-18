-- ============================================================
--  012: 공유 폴더 참여 '승인제'
--  - 암호가 맞아도 바로 가입이 아니라 '참여 요청' → 폴더 관리자가 수락/거부.
--  - 암호가 새어도 승인 없이는 못 들어옴 → 암호 중복 거부(007)를 없애도 안전.
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

-- 참여 요청 보관함 (RPC로만 접근)
create table if not exists public.folder_join_requests (
  folder_id  uuid not null references public.folders(id) on delete cascade,
  user_id    uuid not null references public.users(id)   on delete cascade,
  user_name  text not null default '',
  created_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);
alter table public.folder_join_requests enable row level security;  -- 정책 없음 = anon 차단

-- 암호로 찾아 '참여 요청'을 넣음(즉시 가입 아님). 폴더 이름은 알려주지 않음.
create or replace function public.request_join(p_token text, p_password text)
returns json language plpgsql security definer set search_path = public, extensions as $fn$
declare v_uid uuid; v_name text; r record; v_new int := 0; v_already int := 0;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then return json_build_object('ok', false, 'error', '로그인이 필요합니다.'); end if;
  if btrim(coalesce(p_password, '')) = '' then
    return json_build_object('ok', false, 'error', '암호(키워드)를 입력하세요.');
  end if;
  for r in
    select f.id from public.folder_secrets s
    join public.folders f on f.id = s.folder_id
    where f.visibility = 'shared' and s.pass_hash = crypt(p_password, s.pass_hash)
  loop
    if exists (select 1 from public.folder_members m where m.folder_id = r.id and m.user_id = v_uid) then
      v_already := v_already + 1;
      continue;  -- 이미 참여 중
    end if;
    insert into public.folder_join_requests (folder_id, user_id, user_name)
    values (r.id, v_uid, v_name)
    on conflict (folder_id, user_id) do nothing;
    v_new := v_new + 1;
  end loop;
  if v_new = 0 and v_already > 0 then
    return json_build_object('ok', false, 'error', '이미 참여 중인 폴더입니다.');
  end if;
  if v_new = 0 then
    return json_build_object('ok', false, 'error', '암호가 맞는 공유 폴더가 없습니다.');
  end if;
  return json_build_object('ok', true);
end; $fn$;

-- 참여 요청 목록 (폴더 관리자만)
create or replace function public.list_join_requests(p_token text, p_folder_id uuid)
returns table(user_id uuid, name text, created_at timestamptz)
language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.folder_members fm
    where fm.folder_id = p_folder_id and fm.user_id = v_uid and fm.role = 'admin'
  ) then
    raise exception '폴더 관리자만 볼 수 있습니다.';
  end if;
  return query
  select rq.user_id, rq.user_name, rq.created_at
  from public.folder_join_requests rq
  where rq.folder_id = p_folder_id
  order by rq.created_at;
end; $fn$;

-- 수락 (관리자): 멤버로 추가 + 요청 삭제
create or replace function public.approve_join(p_token text, p_folder_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.folder_members fm
    where fm.folder_id = p_folder_id and fm.user_id = v_uid and fm.role = 'admin'
  ) then
    raise exception '폴더 관리자만 수락할 수 있습니다.';
  end if;
  insert into public.folder_members (folder_id, user_id, role)
  values (p_folder_id, p_user_id, 'member')
  on conflict (folder_id, user_id) do nothing;
  delete from public.folder_join_requests where folder_id = p_folder_id and user_id = p_user_id;
end; $fn$;

-- 거부 (관리자): 요청 삭제
create or replace function public.reject_join(p_token text, p_folder_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (
    select 1 from public.folder_members fm
    where fm.folder_id = p_folder_id and fm.user_id = v_uid and fm.role = 'admin'
  ) then
    raise exception '폴더 관리자만 거부할 수 있습니다.';
  end if;
  delete from public.folder_join_requests where folder_id = p_folder_id and user_id = p_user_id;
end; $fn$;

-- 암호 중복 거부(007) 제거 — 승인제라 겹쳐도 안전. (003 버전으로 되돌림)
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

grant execute on function public.request_join(text, text)              to anon, authenticated;
grant execute on function public.list_join_requests(text, uuid)        to anon, authenticated;
grant execute on function public.approve_join(text, uuid, uuid)        to anon, authenticated;
grant execute on function public.reject_join(text, uuid, uuid)         to anon, authenticated;

insert into public.schema_migrations (version) values ('012_join_requests')
on conflict (version) do nothing;
