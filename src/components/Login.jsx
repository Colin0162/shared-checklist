import { useState } from 'react'
import { login, register } from '../lib/api'

// 이름 + PIN 로그인/가입 화면.
// props: onLogin(user) — user = { name, is_admin }
function Login({ onLogin }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(kind) {
    if (!name.trim() || !pin.trim()) {
      setErr('이름과 PIN을 입력하세요.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const fn = kind === 'register' ? register : login
      const res = await fn(name.trim(), pin.trim())
      if (!res.ok) {
        setErr(res.error || '실패했습니다.')
        setBusy(false)
        return
      }
      onLogin({ name: res.name, is_admin: res.is_admin })
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
        placeholder="이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="text-input"
        type="password"
        inputMode="numeric"
        placeholder="PIN (숫자)"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit('login')}
      />
      {err && <p className="error">오류: {err}</p>}
      <div className="login-actions">
        <button className="btn" onClick={() => submit('register')} disabled={busy}>
          가입
        </button>
        <button className="btn btn-primary" onClick={() => submit('login')} disabled={busy}>
          로그인
        </button>
      </div>
      <p className="muted login-hint">
        처음이면 '가입'을 누르세요. 첫 사용자는 자동으로 관리자가 됩니다.
      </p>
    </div>
  )
}

export default Login
