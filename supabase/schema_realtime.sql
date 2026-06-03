-- ============================================================
--  실시간(Realtime) 켜기 (한 번만 RUN, 재실행 안전)
--  items/boards 의 변경을 클라이언트가 구독할 수 있게 publication에 추가.
-- ============================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.items;
  exception when duplicate_object then null;  -- 이미 추가됨
  end;
  begin
    alter publication supabase_realtime add table public.boards;
  exception when duplicate_object then null;
  end;
end $$;
