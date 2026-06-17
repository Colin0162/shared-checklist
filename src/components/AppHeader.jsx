import Clock from './Clock'
import { displayName } from '../lib/constants'

// 상단 헤더: 본당 배너 + 제목. 로그인한 경우만 유저바(이름/가이드/비번변경/로그아웃)+시계.
// props: user?, onShowGuide, onShowChangePw, onLogout
function AppHeader({ user, onShowGuide, onShowChangePw, onLogout }) {
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
      {user && (
        <>
          <div className="user-bar">
            <span className="user-name">
              {displayName(user.name)}님{user.is_site_admin ? ' (사이트 관리자)' : ''}
            </span>
            <button className="btn btn-small" onClick={onShowGuide}>사용 가이드</button>
            <button className="btn btn-small" onClick={onShowChangePw}>비밀번호 변경</button>
            <button className="btn btn-small" onClick={onLogout}>로그아웃</button>
          </div>
          <Clock />
        </>
      )}
    </header>
  )
}

export default AppHeader
