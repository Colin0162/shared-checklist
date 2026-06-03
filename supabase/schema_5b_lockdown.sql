-- ============================================================
--  5b 잠금: anon 직접 쓰기 차단 (RPC만 쓰기 가능)
--  ※ schema_5b.sql 먼저 RUN + 앱에서 체크/편집이 잘 되는지 확인한 뒤 실행!
--  읽기(SELECT)는 그대로 열어둠 → 실시간 구독 유지.
-- ============================================================

-- 게시글/항목 직접 쓰기 정책 제거 (이제 SECURITY DEFINER RPC로만 씀)
drop policy if exists boards_insert_anon on public.boards;
drop policy if exists boards_update_anon on public.boards;
drop policy if exists boards_delete_anon on public.boards;
drop policy if exists items_insert_anon  on public.items;
drop policy if exists items_update_anon  on public.items;
drop policy if exists items_delete_anon  on public.items;

-- (참고) 읽기 정책은 유지: boards_select_anon, items_select_anon
-- 되돌리려면 schema_builder.sql 의 정책들을 다시 RUN 하면 됨.
