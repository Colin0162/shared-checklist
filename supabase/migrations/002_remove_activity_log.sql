-- ============================================================
--  002: 활동 로그(📋 기록) 제거
--  - check_item / set_note 에서 기록(insert) 빼기
--  - list_board_activity 함수, activity_log 테이블 삭제
--  (함수 정의가 있어 패턴 B: do 블록 밖에서 정의 + 끝에 기록)
--  Supabase SQL Editor에 붙여넣고 RUN. (재실행 안전)
-- ============================================================

-- 체크: 기록 없이 (로그인 검증 + 30일 만료 유지)
create or replace function public.check_item(p_token text, p_item_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id
    where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  update public.items
    set status = p_status,
        checked_by = case when p_status <> '' then v_name else '' end,
        updated_at = now()
  where id = p_item_id;
end; $$;

-- 비고: 기록 없이
create or replace function public.set_note(p_token text, p_item_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select u.name into v_name from public.sessions s join public.users u on u.id = s.user_id
    where s.token::text = p_token and s.created_at > now() - interval '30 days';
  if v_name is null then raise exception '로그인이 필요합니다.'; end if;
  update public.items set note = p_note, updated_at = now() where id = p_item_id;
end; $$;

-- 조회 함수·테이블 삭제
drop function if exists public.list_board_activity(text, uuid, int);
drop table if exists public.activity_log;

-- 기록(추적 테이블이 있을 때만 — 베이스라인을 아직 안 돌렸어도 에러 안 나게)
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    insert into public.schema_migrations (version) values ('002_remove_activity_log')
    on conflict (version) do nothing;
  end if;
end $$;
