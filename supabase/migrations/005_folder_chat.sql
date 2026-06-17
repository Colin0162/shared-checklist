-- ============================================================
--  005: 공유 폴더 채팅 (기록 남음)
--  - folder_messages: 공유 폴더별 채팅. 참여자만 읽기/쓰기(쓰기는 RPC로만).
--  - 실시간을 위해 SELECT는 열어둠(폴더/게시글과 동일 수준) → 민감정보 금지 권장.
--  - send_message / list_messages / delete_message(본인 또는 폴더 관리자)
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

create table if not exists public.folder_messages (
  id         bigint generated always as identity primary key,
  folder_id  uuid not null references public.folders(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  user_name  text not null default '',
  content    text not null,
  created_at timestamptz not null default now()
);
alter table public.folder_messages enable row level security;
create index if not exists folder_messages_idx on public.folder_messages (folder_id, created_at);

-- 읽기 열기(실시간 동기화용). 쓰기/삭제 정책은 없음 = 직접 INSERT/DELETE 차단(RPC로만).
drop policy if exists folder_messages_select on public.folder_messages;
create policy folder_messages_select on public.folder_messages for select using (true);

-- 메시지 보내기 (그 폴더 참여자만)
create or replace function public.send_message(p_token text, p_folder_id uuid, p_content text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_name text;
begin
  select uid, uname into v_uid, v_name from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if btrim(coalesce(p_content, '')) = '' then return; end if;
  if not exists (select 1 from public.folder_members where folder_id = p_folder_id and user_id = v_uid) then
    raise exception '이 폴더 참여자만 채팅할 수 있습니다.';
  end if;
  insert into public.folder_messages (folder_id, user_id, user_name, content)
  values (p_folder_id, v_uid, v_name, left(p_content, 2000));
end; $fn$;

-- 메시지 목록 (참여자만, 오래된→최신 순, 기본 200 / 최대 500)
create or replace function public.list_messages(p_token text, p_folder_id uuid, p_limit int)
returns table(id bigint, user_id uuid, user_name text, content text, created_at timestamptz)
language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists (select 1 from public.folder_members where folder_id = p_folder_id and user_id = v_uid) then
    raise exception '이 폴더 참여자만 볼 수 있습니다.';
  end if;
  return query
  select s.id, s.user_id, s.user_name, s.content, s.created_at from (
    select m.id, m.user_id, m.user_name, m.content, m.created_at
    from public.folder_messages m
    where m.folder_id = p_folder_id
    order by m.created_at desc
    limit least(coalesce(p_limit, 200), 500)
  ) s
  order by s.created_at;
end; $fn$;

-- 메시지 삭제 (본인 또는 폴더 관리자)
create or replace function public.delete_message(p_token text, p_message_id bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid; v_owner uuid; v_folder uuid; v_role text;
begin
  select uid into v_uid from public._whoami(p_token);
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select user_id, folder_id into v_owner, v_folder from public.folder_messages where id = p_message_id;
  if v_owner is null then return; end if;
  if v_owner <> v_uid then
    select role into v_role from public.folder_members where folder_id = v_folder and user_id = v_uid;
    if coalesce(v_role, '') <> 'admin' then
      raise exception '본인 메시지 또는 폴더 관리자만 삭제할 수 있습니다.';
    end if;
  end if;
  delete from public.folder_messages where id = p_message_id;
end; $fn$;

grant execute on function public.send_message(text, uuid, text)   to anon, authenticated;
grant execute on function public.list_messages(text, uuid, int)   to anon, authenticated;
grant execute on function public.delete_message(text, bigint)     to anon, authenticated;

-- 실시간(postgres_changes)으로 새 메시지를 받으려면 publication에 테이블 추가
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'folder_messages'
  ) then
    alter publication supabase_realtime add table public.folder_messages;
  end if;
end $$;

insert into public.schema_migrations (version) values ('005_folder_chat')
on conflict (version) do nothing;
