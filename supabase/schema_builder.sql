-- ============================================================
--  관리자 빌더용 스키마 (idempotent — 여러 번 RUN 해도 안전)
--  Supabase 대시보드 → SQL Editor → 붙여넣고 RUN
--  (이전에 한 번 돌렸어도, 새 컬럼이 추가됐으니 다시 RUN 하세요)
-- ============================================================

-- 1) 게시글/항목 옵션 컬럼
alter table public.boards add column if not exists categories jsonb not null default '[]'::jsonb; -- 대항목(카테고리) 순서 배열
alter table public.items  add column if not exists show_note  boolean not null default false;     -- 항목별 비고 사용 여부

-- (구버전 보드레벨 옵션 — 지금은 미사용이지만 호환 위해 남겨둠)
alter table public.boards add column if not exists show_quantity boolean not null default false;
alter table public.boards add column if not exists show_note     boolean not null default true;

-- 2) 게시글 만들기/고치기/지우기 정책 (임시 개방 — 인증 단계에서 관리자만으로 잠금)
drop policy if exists boards_insert_anon on public.boards;
create policy boards_insert_anon on public.boards for insert with check (true);
drop policy if exists boards_update_anon on public.boards;
create policy boards_update_anon on public.boards for update using (true) with check (true);
drop policy if exists boards_delete_anon on public.boards;
create policy boards_delete_anon on public.boards for delete using (true);

-- 3) 항목 추가/삭제 정책 (수정 정책 items_update_anon 은 3단계에서 이미 생성)
drop policy if exists items_insert_anon on public.items;
create policy items_insert_anon on public.items for insert with check (true);
drop policy if exists items_delete_anon on public.items;
create policy items_delete_anon on public.items for delete using (true);
