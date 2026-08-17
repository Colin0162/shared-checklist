import Clock from './Clock'

// 상단 헤더: 본당 배너 + 제목. 이름이 있으면 유저바(이름/가이드/이름변경)+시계.
//   로그인이 없으므로 로그아웃도 없다. 이름은 기기에만 저장.
// props: name?, onShowGuide, onChangeName
function AppHeader({ name, onShowGuide, onChangeName }) {
  return (
    <header className="app-header">
      <img
        className="parish-banner"
        src="/parish-header.png"
        alt="천주교 마산교구 문산본당"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
      <h1>청년회 체크리스트</h1>
      {name && (
        <>
          <div className="user-bar">
            <span className="user-name">{name}님</span>
            <button className="btn btn-small" onClick={onShowGuide}>사용 가이드</button>
            <button className="btn btn-small" onClick={onChangeName}>이름 바꾸기</button>
          </div>
          <Clock />
        </>
      )}
    </header>
  )
}

export default AppHeader
