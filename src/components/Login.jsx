import { useState } from 'react'
import { login, register } from '../lib/api'

// 이름(세례명) + 비밀번호 로그인 / 가입 신청.
// props: onLogin(user) — user = { name, is_site_admin, token }
function Login({ onLogin }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [showPw, setShowPw] = useState(false)

  async function submit(kind) {
    if (!name.trim() || !pin.trim()) {
      setErr('이름과 비밀번호를 입력하세요.')
      return
    }
    setBusy(true)
    setErr('')
    setInfo('')
    try {
      const fn = kind === 'register' ? register : login
      const res = await fn(name.trim(), pin.trim())
      if (!res.ok) {
        setErr(res.error || '실패했습니다.')
        setBusy(false)
        return
      }
      if (res.pending) {
        // 가입 신청만 됨 (관리자 승인 대기)
        setInfo('가입 신청이 접수되었습니다. 강무관(필립보)에게 연락해 승인을 받으세요.')
        setBusy(false)
        return
      }
      onLogin({ name: res.name, is_site_admin: res.is_site_admin, token: res.token })
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <h2>로그인</h2>
      <input
        className="text-input"
        placeholder="이름(세례명) 예: 강무관(필립보)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="pw-field">
        <input
          className="text-input"
          type={showPw ? 'text' : 'password'}
          placeholder="비밀번호"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit('login')}
        />
        <button
          type="button"
          className="pw-eye"
          onClick={() => setShowPw((v) => !v)}
          title={showPw ? '숨기기' : '보기'}
        >
          {showPw ? '🙈' : '👁'}
        </button>
      </div>
      {err && <p className="error">오류: {err}</p>}
      {info && <p className="info-box">{info}</p>}
      <div className="login-actions">
        <button className="btn" onClick={() => submit('register')} disabled={busy}>
          가입 신청
        </button>
        <button className="btn btn-primary" onClick={() => submit('login')} disabled={busy}>
          로그인
        </button>
      </div>
      <div className="login-guide">
        <p className="guide-h">처음이신가요? — 로그인 / 가입 안내</p>
        <ul className="guide-list">
          <li><b>이름(세례명)</b> + <b>비밀번호</b>로 로그인해요.<b>예: 강무관(필립보)</b></li>
          <li>처음이면 <b>'가입 신청'</b> → <b>관리자 승인</b> 후 로그인할 수 있어요. <b>승인 문의: 강무관(필립보)</b></li>
          <li>비밀번호 칸의 <b>👁</b> 를 누르면 입력한 비밀번호를 볼 수 있어요.</li>
          <li>비밀번호를 잊으면 강무관(필립보)에게 재설정을 요청하세요.</li>
        </ul>
      </div>
    </div>
  )
}

export default Login
