-- ============================================================
--  008: 채팅 - 삭제는 본인만 + 폴더 관리자 공지
--  - delete_message: 본인 메시지만 삭제(관리자도 남의 것은 못 지움)
--  - folder_messages.is_notice + send_message(공지는 관리자만) + list_messages 반환에 포함
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

alter table public.folder_messages add column if not exists is_notice boolean not null default false;

-- 보내기: 공지(is_notice)는 폴더 관리자만
drop function if exists public.send_message(text, uuid, text);
create or replace function public.send_message(p_token text, p_folder_id uuid, p_content text, p_is_notice boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text; v_role text; v_notice boolean := coalesce(p_is_notice, false);
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if btrim(coalesce(p_content, '')) = '' then return; end if;
  select role into v_role from public.folder_members where folder_id = p_folder_id and user_id = v_uid;
  if v_role is null then raise exception '이 폴더 참여자만 채팅할 수 있습니다.'; end if;
  if v_notice and v_role <> 'admin' then raise exception '공지는 폴더 관리자만 남길 수 있습니다.'; end if;
  insert into public.folder_messages (folder_id, user_id, user_name, content, is_notice)
  values (p_folder_id, v_uid, v_name, left(p_content, 2000), v_notice);
end; $fn$;
grant execute on function public.send_message(text, uuid, text, boolean) to anon, authenticated;

-- 목록: is_notice 포함
drop function if exists public.list_messages(text, uuid, int);
create or replace function public.list_messages(p_token text, p_folder_id uuid, p_limit int)
returns table(id bigint, user_id uuid, user_name text, content text, is_notice boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (select 1 from public.folder_members where folder_id = p_folder_id and user_id = v_uid) then
    raise exception '이 폴더 참여자만 볼 수 있습니다.';
  end if;
  return query
  select s.id, s.user_id, s.user_name, s.content, s.is_notice, s.created_at from (
    select m.id, m.user_id, m.user_name, m.content, m.is_notice, m.created_at
    from public.folder_messages m
    where m.folder_id = p_folder_id
    order by m.created_at desc
    limit least(coalesce(p_limit, 200), 500)
  ) s
  order by s.created_at;
end; $fn$;
grant execute on function public.list_messages(text, uuid, int) to anon, authenticated;

-- 삭제: 본인 메시지만 (관리자도 남의 메시지는 못 지움)
create or replace function public.delete_message(p_token text, p_message_id bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_owner uuid;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select user_id into v_owner from public.folder_messages where id = p_message_id;
  if v_owner is null then return; end if;
  if v_owner <> v_uid then raise exception '본인 메시지만 삭제할 수 있습니다.'; end if;
  delete from public.folder_messages where id = p_message_id;
end; $fn$;

insert into public.schema_migrations (version) values ('008_chat_notice_and_delete')
on conflict (version) do nothing;
