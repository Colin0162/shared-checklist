# 직접 수정 가이드 (혼자 고칠 때 보는 문서)

> 이 앱이 **어떤 파일로 어느 화면을 그리는지**, **자주 바꿀 만한 것의 정확한 위치**를 정리했어요.
> (앱 안에서도 로그인 후 **'사용 가이드'** 버튼으로 사용법을 볼 수 있어요 — 그 내용은 `src/components/Guide.jsx`)
>
> **두 가지 규칙만 기억:**
> - **`src/`의 `.jsx`(화면)·`.css`(디자인)·`.js`(DB 호출)** 수정 → `git add . && git commit && git push` 하면 Vercel이 자동 배포.
> - **`supabase/*.sql`(DB 구조/규칙)** 수정 → **Supabase 대시보드 → SQL Editor에서 RUN** 해야 반영. (push만으론 DB 안 바뀜)

---

## 1. 폴더/파일 지도 (무엇이 어느 화면인가)

```
src/
├─ App.jsx              ← 전체 화면 전환의 '교통정리'. 로그인/폴더/게시글/편집/가이드 등
├─ App.css              ← 거의 모든 디자인(색·여백·표 스타일 등)
├─ index.css            ← 색상 변수 모음(:root). 색 톤 바꾸려면 여기
├─ lib/
│   ├─ supabase.js      ← DB 접속 설정 (보통 안 건드림)
│   ├─ api.js           ← DB에 읽고/쓰는 함수 모음(로그인·게시글·항목·폴더·템플릿·계정 등)
│   └─ constants.js     ← 상수: RATINGS(상중하), ddayLabel(D-day 계산)
└─ components/
    ├─ Login.jsx        ← 로그인 / 가입 신청 (비밀번호 👁 보기 토글 포함)
    ├─ Guide.jsx        ← '사용 가이드' 화면 내용 ★사용법 문구는 여기서 수정★
    ├─ Clock.jsx        ← 상단 날짜·시간 시계
    ├─ FolderList.jsx   ← 폴더 목록 + '새 폴더'(공개/나만보기)
    ├─ BoardList.jsx    ← (폴더 안) 게시글 카드 목록 + 형식 라벨 + D-day + (관리자)삭제
    ├─ Checklist.jsx    ← 게시글 열었을 때: 진행률, 미완료/담당자 필터, 관리자 모드, 항목들/표
    ├─ Item.jsx         ← 항목 한 줄(체크박스 / 상중하 / 할 일 텍스트 / 비고칸 / 담당자)
    ├─ TableView.jsx    ← '일정표/표' 형식 보기(링크 클릭)
    ├─ AdminEditor.jsx  ← '새 게시글'·'편집': 제목·행사일·형식·대항목·항목·표·비밀번호·템플릿
    ├─ PendingUsers.jsx ← (관리자) '계정 관리': 가입 승인 / 삭제 / 비번 재설정
    ├─ PasswordPrompt.jsx ← 비밀번호 입력 모달(입장/관리자/비번재설정)
    └─ ConfirmModal.jsx ← '정말 삭제/초기화할까요?' 확인 모달

supabase/
    └─ schema_admin_password.sql ← 지금 쓰는 메인 스키마(사용자/세션/게시글/항목/폴더/템플릿/표/비번/계정 RPC 전부)
```

---

## 2. 자주 바꿀 만한 것 — 위치표

### 글씨(문구)
| 바꾸고 싶은 것 | 파일 | 찾을 단어 |
|---|---|---|
| **사용 가이드 내용** | `components/Guide.jsx` | 통째로 문구 수정 가능 |
| 로그인 안내·가입 후 메시지 | `components/Login.jsx` | `강무관(필립보)`, `login-hint` |
| 형식 이름(체크박스/상중하/할일/일정표) | `components/AdminEditor.jsx` | `체크박스`, `상·중·하 평가`, `할 일 리스트`, `일정표 / 표` |
| 목록 카드의 형식 라벨 | `components/BoardList.jsx` | `체크리스트`, `일정표 / 표` |
| 상단 제목 "체크리스트" | `App.jsx` | `<h1>체크리스트</h1>` |
| 헤더 버튼(사용 가이드/로그아웃) | `App.jsx` | `사용 가이드`, `로그아웃` |
| 날짜·시간 표시 형식 | `components/Clock.jsx` | `toLocaleString` 옵션 |

### 색·디자인 — `src/index.css` 맨 위 `:root`
```css
--accent: #2f6df6;  /* 강조색(버튼·링크·D-day). 한 번에 톤 바꾸려면 여기 */
--done:   #16a34a;  /* 완료/체크 초록 */
--bg / --card / --text / --muted / --border  /* 배경·카드·글씨·흐린글씨·테두리 */
```
표·항목 등 세부 디자인은 `src/App.css` (구역별 주석 있음).

### 기본값·규칙 (바꾸면 SQL RUN 필요)
| 바꾸고 싶은 것 | 위치(supabase/schema_admin_password.sql) |
|---|---|
| 상중하 글자 | (이건 화면) `src/lib/constants.js` `RATINGS` |
| 사이트 관리자 계정 아이디 | `'anrhks456'` (register 함수 + update 줄) |
| 일반 가입 자동 승인 여부 | register 함수의 `'approved'/'pending'` |
| 기존 게시글 기본 관리자 비번 | `crypt('1234', ...)` |

---

## 3. 흔한 작업 예시
- **버튼/문구 바꾸기**: 해당 `.jsx`에서 글씨 검색 → 수정 → `git push`
- **강조색 바꾸기**: `src/index.css`의 `--accent` → push
- **사용법 안내 바꾸기**: `components/Guide.jsx` 수정 → push
- **형식 추가/항목 컬럼 추가** 같은 큰 변경: 화면(`.jsx`)+DB(`.sql`) 둘 다라 난이도 ↑ → 도움 요청 권장

---

## 4. 실행·배포
```powershell
npm run dev      # 로컬 미리보기(http://localhost:5173)
npm run lint     # 문법 검사
npm run build    # 빌드 확인(빨간 에러 없으면 대체로 안전)
```
- `git push` → Vercel 자동 배포.
- **DB(.sql) 수정 시** → Supabase SQL Editor에서 **RUN** 별도로.

## 5. 주의
- `.env.local`(연결 키)·비밀번호는 **절대 깃에 올리지 마세요**(이미 무시 처리됨).
- `.sql` RUN 전, `delete from ...` 같은 줄이 있으면 데이터가 지워질 수 있으니 내용 확인.
- 막히면 `npm run build` 통과하는지부터 확인.
