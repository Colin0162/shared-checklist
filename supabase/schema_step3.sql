-- ============================================================
--  3단계 스키마: 게시판(boards) + 항목(items)
--  사용법: Supabase 대시보드 → SQL Editor → 붙여넣고 RUN (한 번만)
-- ============================================================

-- 1) 게시판: 체크리스트 하나 = 게시판 하나
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  description text        not null default '',
  mode        text        not null default 'check' check (mode in ('check','rate')),
  event_date  date,                              -- D-day용(선택)
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now()
);

-- 2) 항목: 게시판 안의 한 줄
create table if not exists public.items (
  id          uuid        primary key default gen_random_uuid(),
  board_id    uuid        not null references public.boards(id) on delete cascade,
  group_name  text        not null default '',   -- 그룹/구분
  label       text        not null,              -- 항목명
  quantity    text        not null default '',   -- 수량(자유 텍스트: "22개", "2L*30")
  sort_order  int         not null default 0,
  -- 아래는 '협업 상태'(누구나 변경, 실시간 공유) — 4·5단계에서 본격 사용
  status      text        not null default '',   -- check:'done'/'' | rate:'상'/'중'/'하'/''
  note        text        not null default '',   -- 비고(누구나 타이핑)
  checked_by  text        not null default '',   -- 체크한 사람 이름
  updated_at  timestamptz not null default now()
);

create index if not exists items_board_id_idx on public.items(board_id);

-- 3) RLS 켜기 (자동 RLS를 켰다면 이미 켜져 있을 수 있음 — 중복 실행 무해)
alter table public.boards enable row level security;
alter table public.items  enable row level security;

-- 4) 임시 개발용 정책 (3단계)
--    ※ 5·6단계에서 비밀번호/PIN/관리자 검증으로 '잠글' 예정.
drop policy if exists boards_select_anon on public.boards;
create policy boards_select_anon on public.boards
  for select using (true);

drop policy if exists items_select_anon on public.items;
create policy items_select_anon on public.items
  for select using (true);

-- 항목의 '상태/비고/체크한사람'만 갱신 허용 (구조 변경은 6단계 관리자 몫)
drop policy if exists items_update_anon on public.items;
create policy items_update_anon on public.items
  for update using (true) with check (true);

-- 5) 샘플 데이터 (지금 화면과 동일하게 2개 게시판 시드)
--    전체 실데이터는 6단계 관리자 빌더에서 입력 예정이라, 여기선 몇 개만.
insert into public.boards (title, mode, sort_order) values
  ('MT 준비물', 'check', 1),
  ('장소 답사', 'rate', 2);

insert into public.items (board_id, group_name, label, quantity, sort_order) values
  ((select id from public.boards where title = 'MT 준비물'), '전체 필수품목 (음식 외)', '성당 엠프 (마이크/블루투스)', '', 1),
  ((select id from public.boards where title = 'MT 준비물'), '전체 필수품목 (음식 외)', '작업등', '2개', 2),
  ((select id from public.boards where title = 'MT 준비물'), '전체 필수품목 (음식)', '물', '2L × 30개', 3),
  ((select id from public.boards where title = 'MT 준비물'), '2일차 점심 (카레)', '카레', '큰 거 1개', 4),
  ((select id from public.boards where title = '장소 답사'), '거리·접근성', '근처 마트 존재 여부', '', 1),
  ((select id from public.boards where title = '장소 답사'), '건물 및 시설', '단체 적절성', '', 2),
  ((select id from public.boards where title = '장소 답사'), '물놀이', '물놀이 장소', '', 3);
