-- ============================================================
--  007: 공유 폴더 암호 전역 유일 강제
--  - 같은 암호가 여러 폴더에 쓰이면 참여 시 의도치 않은 폴더까지 가입됨 → 방지.
--  - share_folder에서 '다른 공유 폴더가 같은 암호를 쓰면' 거부.
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

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
  -- 다른 공유 폴더가 같은 암호를 쓰면 거부(참여 시 한 폴더만 매칭되도록)
  if exists (
    select 1 from public.folder_secrets s
    where s.folder_id <> p_folder_id and s.pass_hash = crypt(p_password, s.pass_hash)
  ) then
    raise exception '이미 사용 중인 공유 암호입니다. 다른 암호(키워드)로 정해주세요.';
  end if;
  update public.folders set visibility = 'shared' where id = p_folder_id;
  insert into public.folder_secrets (folder_id, pass_hash)
  values (p_folder_id, crypt(p_password, gen_salt('bf')))
  on conflict (folder_id) do update set pass_hash = excluded.pass_hash;
  insert into public.folder_members (folder_id, user_id, role)
  values (p_folder_id, v_uid, 'admin')
  on conflict (folder_id, user_id) do update set role = 'admin';
end; $fn$;

insert into public.schema_migrations (version) values ('007_unique_share_password')
on conflict (version) do nothing;
