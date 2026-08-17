# DB 마이그레이션 (번호별 .sql, 한 번씩만)

DB 구조를 바꾸는 새 방식이에요. 예전엔 `schema_admin_password.sql` 한 파일을 **통째로 다시 RUN**했는데,
스키마가 커지면서 ① 매번 전체를 돌려야 하고 ② 뭐가 새로 바뀌었는지 한눈에 안 보였어요.
이제 **변경 하나 = 번호별 작은 파일 하나**로 관리합니다.

## 큰 그림

- **베이스라인**: `../schema_admin_password.sql` 전체 = `001_baseline`.
  지금까지의 모든 스키마(사용자/세션/게시글/항목/폴더/템플릿/표/활동로그/에러로그…)가 여기 있어요.
  **새 DB를 처음부터 만들 땐 이 파일을 한 번 RUN** 하면 끝(추적 테이블·기록도 같이 만들어짐).
- **추적 테이블** `public.schema_migrations`: 어떤 버전이 적용됐는지 기록(원장).
- **앞으로의 변경**: 이 폴더에 `002_<설명>.sql`, `003_<설명>.sql` … 번호 순서대로 **한 파일씩**.

## 새 변경을 추가하는 법

1. `_template.sql`을 복사해 `002_<짧은설명>.sql` 처럼 다음 번호로 만든다. (예: `002_add_board_color.sql`)
2. 안에 바뀌는 SQL을 쓴다. **idempotent(여러 번 RUN해도 안전)** 하게:
   `create or replace …`, `… if not exists`, `add column if not exists`, 가드(아래) 사용.
3. Supabase 대시보드 → **SQL Editor** → 그 파일 내용 붙여넣기 → **RUN**. (그 파일 **하나만**, 한 번)
4. 파일 끝의 `insert into schema_migrations …` 가 자동으로 "적용됨"으로 기록한다.

## 무엇이 적용됐는지 보기

SQL Editor에서:

```sql
select * from public.schema_migrations order by version;
```

## 두 가지 작성 패턴

**A. 테이블/컬럼/데이터 변경** → 가드로 "한 번만" 보장 (이미 적용됐으면 건너뜀):

```sql
do $$
begin
  if exists (select 1 from public.schema_migrations where version = '002_example') then
    raise notice '002_example 이미 적용됨 — 건너뜀';
    return;
  end if;

  -- 여기에 변경 (예)
  alter table public.boards add column if not exists color text not null default '';

  insert into public.schema_migrations (version) values ('002_example');
end $$;
```

**B. 함수(RPC) 추가/수정** → `create or replace` 자체가 idempotent라 가드 불필요.
함수는 `$$`를 쓰므로 위 `do $$ … $$` 안에 넣지 말고 **밖에서** 정의하고, 끝에 기록만 추가:

```sql
create or replace function public.my_rpc(...) returns ... language plpgsql
security definer set search_path = public as $fn$
begin
  ...
end; $fn$;
grant execute on function public.my_rpc(...) to anon, authenticated;

insert into public.schema_migrations (version) values ('003_my_rpc')
on conflict (version) do nothing;
```

## 지금까지 적용된 것 (요약)

| 번호 | 내용 |
|---|---|
| 001 (베이스라인) | 계정/게시글/항목/폴더/템플릿 등 초기 스키마 |
| 002 | 활동 로그 제거 |
| 003~013 | 폴더 공유 모델(개인/공유/공개)·채팅·참여자·이동·권한 |
| **014** | **로그인 없애기** — 계정·공유폴더·채팅 제거, 폴더 전부 공개, 이름만 사용 |

### ⚠️ 옛 파일(003~013)을 지우지 마세요

014로 그 기능들을 없앴지만, **파일은 그대로 둬야 합니다.**

- `.sql` 파일은 **"무엇을 실행했는지 적어둔 장부"**입니다. 파일을 지워도 이미 적용된 DB는 바뀌지 않아요.
- **014가 이전 파일에 의존합니다** — `folders.visibility` 컬럼은 003에서, `_folder_root()` 함수는 011에서 만들어졌어요.
  새 DB를 처음부터 만들 때 003을 건너뛰면 **014가 오류로 멈춥니다.**

즉 새 DB 구축 순서는 여전히 `베이스라인 → 002 → 003 → … → 014` 전부입니다.

## 주의

- 번호는 **겹치지 않게**, 순서대로.
- 한 마이그레이션은 가능한 한 **작게**(한 가지 변경).
- `delete from …` 같이 데이터를 지우는 줄이 있으면 RUN 전에 꼭 내용 확인.
- 베이스라인(`schema_admin_password.sql`)은 "지금까지의 전체"라서, 과거 변경을 굳이 002,003…으로 쪼개 옮길 필요는 없어요. **새 변경부터** 이 폴더에 쌓으면 됩니다.
