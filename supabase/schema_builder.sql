-- ============================================================
--  관리자 빌더용 추가 스키마 (한 번만 RUN)
--  Supabase 대시보드 → SQL Editor → 붙여넣고 RUN
-- ============================================================

-- 1) 게시글 옵션 컬럼 (관리자가 만들 때 선택)
alter table public.boards add column if not exists show_quantity boolean not null default false;
alter table public.boards add column if not exists show_note     boolean not null default true;

-- 2) 게시글 만들기/고치기/지우기 정책 (임시 개방 — 인증 단계에서 관리자만으로 잠금)
drop policy if exists boards_insert_anon on public.boards;
create policy boards_insert_anon on public.boards for insert with check (true);

drop policy if exists boards_update_anon on public.boards;
create policy boards_update_anon on public.boards for update using (true) with check (true);

drop policy if exists boards_delete_anon on public.boards;
create policy boards_delete_anon on public.boards for delete using (true);

-- 3) 항목 추가/삭제 정책 (수정 정책 items_update_anon 은 이미 있음)
drop policy if exists items_insert_anon on public.items;
create policy items_insert_anon on public.items for insert with check (true);

drop policy if exists items_delete_anon on public.items;
create policy items_delete_anon on public.items for delete using (true);
