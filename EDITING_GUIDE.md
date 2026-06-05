# 직접 수정 가이드 (혼자 고칠 때 보는 문서)

> 이 앱이 **어떤 파일로 어느 화면을 그리는지**, 그리고 **네가 자주 바꿀 만한 것들의 정확한 위치**를 정리했어.
> 규칙 하나만 기억하면 돼:
> - **`src/` 안의 `.jsx`(화면)·`.css`(디자인)·`.js`(DB 호출)** 를 바꾸면 → **`git add . && git commit && git push`** 하면 Vercel이 자동 배포.
> - **`supabase/*.sql`(데이터베이스 구조/규칙)** 를 바꾸면 → **Supabase 대시보드 → SQL Editor에서 직접 RUN** 해야 반영됨. (push만으론 DB는 안 바뀜)

---

## 1. 폴더/파일 지도 (무엇이 어느 화면인가)

```
src/
├─ App.jsx                  ← 전체 흐름의 '교통정리'. 로그인/폴더/게시글/편집 화면 전환, DB 호출 연결
├─ App.css                  ← 거의 모든 디자인(색·여백·글씨크기). 색 바꾸려면 여기
├─ lib/
│   ├─ supabase.js          ← DB 접속 설정(보통 안 건드림)
│   ├─ api.js               ← DB에 읽고/쓰는 함수 모음. "어떤 데이터를 가져오나" 바꿀 때
│   └─ constants.js         ← 상중하 등급 같은 상수 (RATINGS = ['상','중','하'])
└─ components/              ← 화면 조각들
    ├─ Login.jsx            ← 로그인/가입 신청 화면
    ├─ Clock.jsx            ← 상단 날짜·시간 시계
    ├─ FolderList.jsx       ← 폴더 목록 + '새 폴더'
    ├─ BoardList.jsx        ← (폴더 안) 게시글 목록 카드
    ├─ Checklist.jsx        ← 게시글 열었을 때: 진행률, 미완료/담당자 필터, 관리자 모드 버튼, 항목들
    ├─ Item.jsx             ← 항목 한 줄(체크박스 / 상중하 / 할 일 텍스트 / 비고칸)
    ├─ AdminEditor.jsx      ← '새 게시글'·'편집' 화면(제목·형식·대항목·항목·비밀번호)
    ├─ PendingUsers.jsx     ← (관리자) 가입 신청 승인/거절
    ├─ PasswordPrompt.jsx   ← 비밀번호 입력 모달(입장/관리자)
    └─ ConfirmModal.jsx     ← '정말 삭제할까요?' 확인 모달

supabase/                   ← DB 설계(SQL). 바꾸면 SQL Editor에서 RUN 필요
    └─ schema_admin_password.sql  ← 지금 쓰는 메인 스키마(사용자/세션/게시글/폴더/비번/RPC 전부)
```

---

## 2. 자주 바꿀 만한 것 — 위치 정리

### 글씨(문구) 바꾸기
| 바꾸고 싶은 것 | 파일 | 찾을 단어 |
|---|---|---|
| 로그인 화면 안내문구 | `src/components/Login.jsx` | `login-hint`, `placeholder="이름(세례명)...`  |
| 가입 신청 후 안내 ("강무관에게 연락...") | `src/components/Login.jsx` | `가입 신청이 접수되었습니다` |
| 버튼 글씨 (가입 신청/로그인) | `src/components/Login.jsx` | `가입 신청`, `로그인` |
| 게시글 형식 이름(체크박스/상중하/할 일) | `src/components/AdminEditor.jsx` | `체크박스`, `상·중·하 평가`, `할 일 리스트` |
| '관리자 모드' 버튼, '미완료만 보기' | `src/components/Checklist.jsx` | `관리자 모드`, `미완료만 보기` |
| 상단 제목 "체크리스트" | `src/App.jsx` | `<h1>체크리스트</h1>` |
| 날짜·시간 표시 형식 | `src/components/Clock.jsx` | `toLocaleString` 안의 옵션들 |

### 색·디자인 바꾸기 (전부 `src/App.css` 위쪽 변수)
`src/index.css` 맨 위 `:root { ... }` 에 색이 모여 있어:
```css
--accent: #2f6df6;   /* 강조색(버튼·링크). 여기만 바꾸면 전체 톤 변함 */
--done:   #16a34a;   /* 완료/체크 초록색 */
--bg:     #f4f5f7;   /* 배경 */
--card:   #ffffff;   /* 카드 배경 */
--text:   #1f2328;   /* 글씨색 */
--muted:  #6b7280;   /* 흐린 글씨 */
```
→ `--accent` 하나만 바꿔도 버튼·강조가 한 번에 바뀜. (디자인은 주로 여기 + `App.css`)

### 기본값·규칙 바꾸기
| 바꾸고 싶은 것 | 위치 | 메모 |
|---|---|---|
| 상중하 등급 글자 | `src/lib/constants.js` `RATINGS` | 예: `['상','중','하']` → `['좋음','보통','나쁨']` |
| 사이트 관리자 계정 아이디 | `supabase/schema_admin_password.sql` | `'anrhks456'` 를 찾아 바꾸면 됨 (2군데: register, update) → **SQL RUN 필요** |
| 가입 후 자동 승인 여부 | `supabase/schema_admin_password.sql` | register 함수의 `case when v_admin then 'approved' else 'pending'` → **RUN 필요** |
| 기존 게시글 기본 관리자 비번(1234) | `supabase/schema_admin_password.sql` | `crypt('1234', ...)` → **RUN 필요** |

---

## 3. 흔한 작업 예시

**A. 버튼 글씨 바꾸기** (예: '새 게시글' → '체크리스트 만들기')
1. `src/App.jsx` 에서 `+ 새 게시글` 검색 → 글씨 수정
2. 저장 → `git add . && git commit -m "버튼 글씨 변경" && git push`

**B. 강조색 바꾸기** (파랑 → 초록)
1. `src/index.css` 의 `--accent: #2f6df6;` → 원하는 색 코드로
2. 저장 → push

**C. 항목 형식에 새 옵션 추가** 같은 큰 변경은 화면(`.jsx`)+DB(`.sql`) 둘 다 손봐야 해서 난이도 있음 → 이런 건 나(클로드)한테 부탁하는 게 안전.

---

## 4. 실행·배포

```powershell
# 로컬에서 보기
npm run dev        # http://localhost:5173

# 문법 오류 검사 / 빌드 확인 (push 전에 해보면 좋음)
npm run lint
npm run build
```
- `git push` 하면 Vercel이 자동으로 새 버전 배포 (라이브 주소 그대로).
- **DB 구조(.sql)를 바꿨다면** push와 별개로 **Supabase SQL Editor에서 RUN** 잊지 말기.

---

## 5. 주의할 점
- `.env.local` (연결 키)·비밀번호는 **절대 깃에 올리지 마.** (이미 `.gitignore` 처리됨)
- `.sql` 파일을 고치고 RUN 할 때, 사용자 삭제(`delete from users`) 같은 줄이 있으면 데이터가 지워질 수 있으니 **무엇을 RUN 하는지 확인**.
- 헷갈리면 push 전에 `npm run build` 가 통과하는지 확인 → 빨간 에러 없으면 대체로 안전.
