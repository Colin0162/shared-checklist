# 직접 수정 가이드 (혼자 고칠 때 보는 문서)

> 이 앱이 **어떤 파일로 어느 화면을 그리는지**, **자주 바꿀 만한 것의 위치**를 정리했어요.
> (앱 안에서도 로그인 후 **'사용 가이드'** 버튼으로 사용법을 볼 수 있어요 — 그 내용은 `src/components/Guide.jsx`)
>
> **두 가지 규칙만 기억:**
> - **`src/`의 `.jsx`(화면)·`.css`(디자인)·`.js`(DB 호출)** 수정 → `git add . && git commit && git push` 하면 Vercel이 자동 배포.
> - **DB 구조/규칙** 변경 → **Supabase 대시보드 → SQL Editor에서 RUN** 해야 반영(push만으론 DB 안 바뀜).
>   새 변경은 **`supabase/migrations/`에 번호별 파일 하나씩**(한 번만 RUN) — 방법은 `supabase/migrations/README.md`.

---

## 1. 폴더/파일 지도 (무엇이 어느 화면인가)

```
src/
├─ App.jsx              ← '교통정리'(오케스트레이터): 데이터 로드·URL 라우팅·화면 조율 + 공유폴더 채팅 연결
├─ App.css              ← 거의 모든 디자인(색·여백·표·채팅·패널 등)
├─ index.css            ← 색상 변수 모음(:root). 색 톤 바꾸려면 여기
├─ lib/
│   ├─ supabase.js      ← DB 접속 설정 (보통 안 건드림)
│   ├─ api.js           ← DB 읽고/쓰는 함수(로그인·게시글·항목·폴더·공유·채팅·이동·템플릿·계정)
│   └─ constants.js     ← RATINGS(상중하), ddayLabel(D-day), displayName(anrhks456→'서버 관리자' 표시)
├─ hooks/               ← 화면이 아니라 '로직 묶음'
│   ├─ useBoardItems.js ← 열린 게시글 항목: 로드·실시간·체크/비고 저장·저장실패 재시도
│   ├─ useNoteLocks.js  ← 비고 '작성 중' 잠금(실시간 broadcast)
│   └─ useFolderChat.js ← 공유 폴더 채팅: 로드·실시간(INSERT/DELETE)·전송/삭제·안읽음 표시
└─ components/
    ├─ AppHeader.jsx    ← 상단 헤더(본당 배너·제목·유저바·시계)
    ├─ Login.jsx        ← 로그인 / 가입 신청
    ├─ Guide.jsx        ← '사용 가이드' 화면 내용 ★사용법 문구는 여기서 수정★
    ├─ ChangePassword.jsx ← 본인 비밀번호 변경 화면
    ├─ Clock.jsx        ← 상단 날짜·시간 시계
    ├─ FolderView.jsx   ← 폴더/게시글 목록 화면(홈=공유/개인/공개 분류 + '공유 폴더 참여')
    ├─ FolderList.jsx   ← 폴더 목록(종류 뱃지 🔒개인/🤝공유/📁공개 + 공유·이동·삭제 버튼)
    ├─ FolderPanel.jsx  ← 공유 폴더 💬 패널: 참여자 + 채팅(데스크톱=왼쪽 사이드 / 폰=드로어)
    ├─ FolderMembers.jsx← 참여자 목록 + (관리자)내보내기·관리자 넘기기 (재확인)
    ├─ MoveModal.jsx    ← 폴더/게시글 '이동' 대상 고르기(폴더 한 단계씩 들어가며 선택)
    ├─ BoardList.jsx    ← (폴더 안) 게시글 카드 목록 + 이동/삭제 버튼 + D-day
    ├─ Checklist.jsx    ← 게시글 열기: 진행률·미완료/담당자 필터·관리자·인쇄·항목들/표
    ├─ Item.jsx         ← 항목 한 줄(체크 / 상중하 / 할 일 / 비고칸 / 담당자 / 저장실패 ↻)
    ├─ TableView.jsx    ← '표/일정표' 보기(링크 클릭, 폰에서는 카드형: 라벨|값)
    ├─ AdminEditor.jsx  ← '새 게시글'·'편집': 제목·행사일·형식·대항목·항목·표·비밀번호·입장비번·템플릿
    ├─ PendingUsers.jsx ← (관리자) '계정 관리': 가입 승인/삭제/비번 재설정 + 최근 오류
    ├─ PasswordPrompt.jsx ← 비밀번호 입력 모달(입장/관리자/공유 암호/참여)
    └─ ConfirmModal.jsx ← '정말 삭제/초기화/나가기할까요?' 확인 모달

supabase/
    ├─ schema_admin_password.sql ← 베이스라인 = '001'(지금까지의 전부). 새 DB는 이거 한 번 RUN
    └─ migrations/               ← 앞으로의 DB 변경은 번호별 파일 하나씩(한 번만 RUN)
        ├─ README.md             ← 마이그레이션 방법(필독) / _template.sql ← 새로 만들 틀
        ├─ 002 활동로그 제거    ├─ 003 폴더 공유 모델   ├─ 004 입장비번·폴더표시
        ├─ 005 채팅            ├─ 006 이동·삭제 권한   ├─ 007 공유암호 유일
        ├─ 008 채팅 삭제·공지   ├─ 009 채팅 24시간 보존 └─ 010 list_messages 수정

vite.config.js          ← Vite + PWA(manifest·서비스워커) 설정
public/pwa-icon.svg     ← 앱(홈 화면) 아이콘
vercel.json             ← SPA 폴백(/board/.. 새로고침 404 방지)
```

---

## 2. 자주 바꿀 만한 것 — 위치표

### 글씨(문구)
| 바꾸고 싶은 것 | 파일 | 찾을 단어 |
|---|---|---|
| **사용 가이드 내용** | `components/Guide.jsx` | 통째로 문구 수정 |
| 상단 제목 "청년회 체크리스트" | `components/AppHeader.jsx` | `<h1>` |
| 로그인 안내·가입 메시지 | `components/Login.jsx` | `강무관(필립보)` |
| 형식 이름(체크박스/상중하/할일/표) | `components/AdminEditor.jsx` | `체크박스`, `상·중·하 평가` |
| 폴더 종류 라벨(개인/공유/공개) | `components/FolderList.jsx` | `VIS` |
| 채팅 입력 안내 | `components/FolderPanel.jsx` | `메시지 입력` |

### 색·디자인 — `src/index.css` 맨 위 `:root`
```css
--accent: #4f46e5;   /* 강조색(버튼·링크·선택) 인디고 — 한 번에 톤 바꾸려면 여기 */
--accent-2: #6366f1; /* 밝은 강조(그라데이션·채팅 아이콘) */
--done: #15a34a;     /* 완료/체크 초록 */
--danger: #d1453b;   /* 삭제/경고 */
--bg / --card / --text / --muted / --border  /* 배경·카드·글씨·흐린글씨·테두리(크림 톤) */
```
표·채팅·패널 등 세부는 `src/App.css`(구역별 주석 있음).

### 폴더 공유·채팅·이동 (바꾸면 SQL RUN 필요)
| 바꾸고 싶은 것 | 위치 |
|---|---|
| 공유 암호 유일/참여 규칙 | `migrations/003,007` — `share_folder`, `join_folder` |
| 채팅 보존(공지 영구·일반 24시간) | `migrations/009,010` — `list_messages` |
| 이동/삭제 권한(볼 수 있는 사람) | `migrations/006` — `move_board`, `move_folder`, `delete_folder`, `_can_see_folder` |
| 사이트 관리자 계정 | `'anrhks456'` (베이스라인 + `lib/constants.js`의 `displayName`) |

---

## 3. 흔한 작업
- **문구/색 바꾸기**: 해당 `.jsx`/`index.css` 수정 → `git push`
- **폴더 공유·채팅·이동 등 DB가 얽힌 기능**: 화면(`.jsx`) + DB(`migrations/*.sql` RUN) 둘 다라 난이도↑ → 도움 요청 권장

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
- `.sql` RUN 전 `delete from ...` 같은 줄이 있으면 데이터가 지워질 수 있으니 확인.
- 막히면 `npm run build` 통과하는지부터 확인.

## 6. 주소(URL) 구조 — 링크 공유·뒤로가기
- `/` 홈(폴더 목록) · `/folder/<폴더id>` 그 폴더 안 · `/board/<게시글id>` 그 게시글
- `App.jsx`가 주소를 따로 state로 들지 않고 **주소에서 현재 위치를 계산(파생)**. 누르면 `navigate(...)`로 주소만 바꿈.

## 7. PWA (홈 화면 앱 설치 · 오프라인 셸)
- 설정: `vite.config.js`의 `VitePWA`. 빌드하면 `dist/sw.js`·`manifest.webmanifest` 자동 생성.
- 앱 화면(셸)을 캐시 → 네트워크가 끊겨도 앱은 열림. **데이터(폴더·체크·채팅)는 실시간이라 연결 필요**(끊기면 '연결 중').
- 아이콘은 `public/pwa-icon.svg`(교체 가능). 아이폰 홈 아이콘을 완벽히 하려면 `180×180 png`도 추가하면 좋음.
- 새로 배포하면 다음 접속 때 **자동 업데이트**.
