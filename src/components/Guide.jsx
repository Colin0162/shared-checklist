// 사용 가이드 화면 (로그인 후 '사용 가이드' 버튼으로 열림).
// 사용자 입장에서 기능을 정리한 내용. 문구만 바꾸고 싶으면 이 파일을 수정하면 됨.
// props: onBack
function Guide({ onBack }) {
  return (
    <section className="guide">
      <div className="checklist-head">
        <button className="back-btn" onClick={onBack}>← 목록</button>
        <h2 className="board-heading">사용 가이드</h2>
      </div>

      <p className="guide-intro">
        여러 명이 함께 쓰는 체크리스트예요. 로그인하면 폴더 → 게시글(체크리스트) 순으로
        들어가서, 다 같이 실시간으로 체크하고 메모할 수 있어요.
      </p>

      <h3 className="guide-h">1. 로그인 / 가입</h3>
      <ul className="guide-list">
        <li><b>이름(세례명)</b>과 <b>비밀번호</b>로 로그인해요. 예: <b>강무관(필립보)</b></li>
        <li>처음이면 <b>'가입 신청'</b> → <b>관리자 승인</b> 후 로그인할 수 있어요. (승인은 강무관(필립보)에게 문의)</li>
        <li>비밀번호 칸의 <b>👁</b> 를 누르면 입력한 비밀번호를 볼 수 있어요.</li>
        <li>비밀번호를 잊으면 관리자에게 재설정을 요청하세요.</li>
      </ul>

      <h3 className="guide-h">2. 폴더</h3>
      <ul className="guide-list">
        <li>맨 처음 화면은 <b>폴더 목록</b>이에요. 폴더를 누르면 그 안의 게시글이 보여요.</li>
        <li><b>+ 새 폴더</b>로 폴더를 만들 수 있어요. <b>'나만 보기(비공개)'</b>로 만들면 <b>나에게만</b> 보이는 폴더가 돼요.</li>
      </ul>

      <h3 className="guide-h">3. 게시글(체크리스트) 만들기 · 편집</h3>
      <ul className="guide-list">
        <li>폴더 안에서 <b>+ 새 게시글</b> → 제목, 형식, 항목을 정하고 <b>관리자 비밀번호</b>를 설정해요.</li>
        <li>나중에 고치려면 게시글을 열고 <b>'관리자 모드'</b> → 비밀번호 입력 → <b>편집</b>.</li>
        <li><b>입장 비밀번호</b>를 걸면 비번을 아는 사람만 그 게시글을 열 수 있어요(🔒).</li>
        <li><b>행사일</b>을 정하면 목록·상단에 <b>D-7 / D-DAY</b> 처럼 표시돼요.</li>
        <li>자주 쓰는 구성은 <b>'템플릿으로 저장'</b> → 다음에 <b>'템플릿 불러오기'</b>로 그대로 가져와요. (템플릿은 나만의 것)</li>
      </ul>

      <h3 className="guide-h">4. 게시글 형식 4가지</h3>
      <ul className="guide-list">
        <li><b>체크박스</b> — 준비물처럼 하나씩 체크. 수량·담당자·비고를 항목마다 켤 수 있어요.</li>
        <li><b>상·중·하 평가</b> — 답사처럼 항목을 상/중/하로 평가.</li>
        <li><b>할 일 리스트</b> — 대항목 아래 자유롭게 적는 메모형(링크는 눌러서 이동). 체크 없음, 보기용.</li>
        <li><b>일정표 / 표</b> — 시간·프로그램·내용 등 <b>열을 직접 정해</b> 표로 정리(링크 클릭 가능). 보기용.</li>
      </ul>

      <h3 className="guide-h">5. 함께 체크하기</h3>
      <ul className="guide-list">
        <li>항목을 체크하면 <b>내 이름</b>이 옆에 표시되고, 다른 사람 화면에도 <b>실시간</b>으로 반영돼요.</li>
        <li><b>비고</b>는 누구나 입력 가능(여러 줄 OK). 위쪽에 <b>진행률</b>(전체·대항목별)이 보여요.</li>
        <li><b>'미완료만 보기'</b>로 안 챙긴 것만, <b>담당자 필터</b>로 특정 담당자 항목만 모아볼 수 있어요.</li>
        <li><b>관리자 모드 → 초기화</b>로 체크를 전부 비울 수 있어요(재확인 후).</li>
      </ul>

      <h3 className="guide-h">6. 관리자(사이트 관리자) 전용</h3>
      <ul className="guide-list">
        <li><b>계정 관리</b> — 가입 승인 / 계정 삭제 / 비밀번호 재설정.</li>
        <li>목록에서 게시글을 <b>삭제</b>할 수 있어요(불필요한 글 정리).</li>
      </ul>
    </section>
  )
}

export default Guide
