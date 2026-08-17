// 사용 가이드 화면 ('사용 가이드' 버튼으로 열림).
// 문구만 바꾸고 싶으면 이 파일을 수정하면 됨.
// props: onBack
function Guide({ onBack }) {
  return (
    <section className="guide">
      <div className="checklist-head">
        <button className="back-btn" onClick={onBack}>← 목록</button>
        <h2 className="board-heading">사용 가이드</h2>
      </div>

      <p className="guide-intro">
        여러 명이 함께 쓰는 체크리스트예요. <b>가입도, 로그인도 없습니다.</b> 링크만 있으면 바로
        들어와서 다 같이 실시간으로 체크하고 메모할 수 있어요.
      </p>

      <h3 className="guide-h">1. 시작하기</h3>
      <ul className="guide-list">
        <li>처음 들어오면 <b>이름</b>만 한 번 적어요. 비밀번호도 승인도 없어요.</li>
        <li>이름은 <b>체크한 사람</b>·<b>작성자</b> 표시에 쓰여요. 기기에 저장되니 다음부터는 바로 들어옵니다.</li>
        <li>이름을 바꾸려면 위쪽 <b>‘이름 바꾸기’</b>를 누르세요.</li>
        <li>휴대폰에서 <b>홈 화면에 추가</b>하면 앱처럼 쓸 수 있어요.</li>
      </ul>

      <h3 className="guide-h">2. 폴더</h3>
      <ul className="guide-list">
        <li>폴더는 <b>모두에게 보여요.</b> 누구나 만들고 열 수 있어요.</li>
        <li>폴더 안에 폴더도 만들 수 있고, 위쪽 <b>경로(🏠 홈 › 폴더 …)</b>로 이동해요.</li>
        <li><b>게시글은 폴더 안에서만</b> 만들어요.</li>
        <li><b>이동</b> 버튼으로 자리를 옮길 수 있어요. (같은 큰 폴더 안에서만)</li>
        <li><b>삭제</b>는 폴더가 <b>비어 있을 때만</b> 돼요(재확인).</li>
      </ul>

      <h3 className="guide-h">3. 게시글 만들기 · 고치기</h3>
      <ul className="guide-list">
        <li>폴더 안에서 <b>+ 새 게시글</b> → 제목·형식·항목을 정하고 <b>관리자 비밀번호</b>를 설정해요.</li>
        <li>이 비밀번호는 <b>나중에 고치거나 지울 때만</b> 필요해요. 보기·체크는 누구나 자유롭게 할 수 있어요.</li>
        <li>고치려면 게시글을 열고 <b>‘관리자 모드’</b> → 비밀번호 입력 → <b>편집 / 초기화 / 삭제</b>.</li>
        <li><b>행사일</b>을 정하면 <b>D-7 / D-DAY</b> 처럼 남은 날짜가 떠요.</li>
        <li>자주 쓰는 구성은 <b>‘템플릿으로 저장’</b> → 다음에 <b>불러오기</b>로 그대로 가져와요.</li>
      </ul>

      <h3 className="guide-h">4. ⚡ 글로 한 번에 만들기</h3>
      <ul className="guide-list">
        <li>편집 화면 위쪽 칸에 준비물을 적고 버튼을 누르면 <b>항목이 한 번에</b> 만들어져요.</li>
        <li>예) <b>음식: 수박 1개, 라면 5봉지</b> → 대항목 ‘음식’ + 수박(1개)·라면(5봉지)</li>
        <li>규칙 3개: <b>‘분류:’</b> 는 대항목, <b>쉼표·줄바꿈</b>으로 항목 구분, 끝의 <b>숫자+단위</b>는 수량.</li>
        <li>만들어진 뒤에는 평소처럼 고치고 저장하면 돼요.</li>
      </ul>

      <h3 className="guide-h">5. 함께 체크하기</h3>
      <ul className="guide-list">
        <li>줄(항목)을 <b>탭하면 체크</b>돼요. 옆에 <b>내 이름</b>이 뜨고 다른 사람 화면에도 <b>실시간</b> 반영돼요.</li>
        <li><b>비고</b>는 누구나 입력 가능(여러 줄 OK). 다른 사람이 쓰는 중이면 잠깐 잠겨요.</li>
        <li>위쪽엔 <b>진행률</b>, <b>미완료만 보기</b>·<b>담당자</b>·<b>대항목</b> 필터가 있어요.</li>
        <li><b>🖨 인쇄</b>로 종이에 뽑거나 PDF로 저장할 수 있어요.</li>
      </ul>

      <h3 className="guide-h">6. 알아두기</h3>
      <ul className="guide-list">
        <li>링크를 아는 사람은 누구나 들어와 <b>보고 체크</b>할 수 있어요. 링크 공유에 주의하세요.</li>
        <li>고치기·지우기는 <b>관리자 비밀번호를 아는 사람</b>만 할 수 있어요.</li>
        <li>연락처 같은 <b>민감한 개인정보는 적지 마세요.</b></li>
      </ul>
    </section>
  )
}

export default Guide
