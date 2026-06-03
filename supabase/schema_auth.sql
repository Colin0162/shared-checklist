-- ============================================================
--  5a 인증: 이름 + PIN 로그인 (PIN은 해시 저장, RPC로만 검증)
--  Supabase SQL Editor에 붙여넣고 RUN (재실행 안전)
-- ============================================================

-- 해시 함수(crypt/gen_salt)용 확장
create extension if not exists pgcrypto with schema extensions;

-- 사용자: 이름 고유, PIN은 해시로만 저장
create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  pin_hash   text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS 켜고 정책 없음 = anon은 users 직접 접근 불가 (pin_hash 절대 노출 안 됨).
-- 가입/로그인은 아래 SECURITY DEFINER 함수로만 한다.
alter table public.users enable row level security;

-- 회원가입: 이름 중복이면 실패. 첫 사용자는 자동 관리자.
create or replace function public.register(p_name text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_is_admin boolean;
  v_name text := btrim(p_name);
begin
  if v_name = '' or btrim(p_pin) = '' then
    return json_build_object('ok', false, 'error', '이름과 PIN을 입력하세요.');
  end if;
  if exists (select 1 from public.users where name = v_name) then
    return json_build_object('ok', false, 'error', '이미 있는 이름입니다.');
  end if;
  select count(*) = 0 into v_is_admin from public.users;  -- 첫 사용자 = 관리자
  insert into public.users (name, pin_hash, is_admin)
  values (v_name, crypt(p_pin, gen_salt('bf')), v_is_admin);
  return json_build_object('ok', true, 'name', v_name, 'is_admin', v_is_admin);
end;
$$;

-- 로그인: 이름+PIN 검증, 성공 시 이름/관리자여부 반환
create or replace function public.login(p_name text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user public.users;
begin
  select * into v_user from public.users where name = btrim(p_name);
  if v_user.id is null or v_user.pin_hash <> crypt(p_pin, v_user.pin_hash) then
    return json_build_object('ok', false, 'error', '이름 또는 PIN이 올바르지 않습니다.');
  end if;
  return json_build_object('ok', true, 'name', v_user.name, 'is_admin', v_user.is_admin);
end;
$$;

grant execute on function public.register(text, text) to anon, authenticated;
grant execute on function public.login(text, text)    to anon, authenticated;
