-- ============================================================
--  마이그레이션 템플릿 — 복사해서 002_<설명>.sql 로 만들어 쓰세요.
--  (자세한 설명은 이 폴더의 README.md)
--  규칙: 다음 번호 / 한 가지 변경 / idempotent / 끝에 버전 기록.
-- ============================================================

-- ── 패턴 A: 테이블·컬럼·데이터 변경 (이미 적용됐으면 통째로 건너뜀) ──
do $$
begin
  if exists (select 1 from public.schema_migrations where version = '00X_설명') then
    raise notice '00X_설명 이미 적용됨 — 건너뜀';
    return;
  end if;

  -- TODO: 여기에 변경 SQL. 예:
  -- alter table public.boards add column if not exists color text not null default '';

  insert into public.schema_migrations (version) values ('00X_설명');
end $$;


-- ── 패턴 B: 함수(RPC) 추가/수정이 필요하면, do 블록 '밖'에서 정의하고 아래로 기록만 ──
-- (함수는 $$를 쓰므로 위 do $$ … $$ 안에 넣으면 따옴표가 꼬임 → 반드시 밖에서, $fn$ 등 다른 태그 사용)
--
-- create or replace function public.예시(...) returns void language plpgsql
-- security definer set search_path = public as $fn$
-- begin
--   ...
-- end; $fn$;
-- grant execute on function public.예시(...) to anon, authenticated;
--
-- insert into public.schema_migrations (version) values ('00X_설명')
-- on conflict (version) do nothing;
