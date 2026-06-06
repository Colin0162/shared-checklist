import { useState } from 'react'

// 비밀번호 입력 모달. onSubmit(pw) 는 실패 시 에러 문자열, 성공 시 빈 값/null 반환.
// props: title, onSubmit, onCancel
function PasswordPrompt({ title, onSubmit, onCancel }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)

  async function go() {
    if (!pw.trim()) {
      setErr('비밀번호를 입력하세요.')
      return
    }
    setBusy(true)
    setErr('')
    const res = await onSubmit(pw.trim())
    if (res) {
      setErr(res)
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-msg">{title}</p>
        <div className="pw-field">
          <input
            className="text-input"
            type={showPw ? 'text' : 'password'}
            value={pw}
            autoFocus
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
            placeholder="비밀번호"
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
        {err && <p className="error" style={{ marginTop: 8 }}>오류: {err}</p>}
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={onCancel} disabled={busy}>취소</button>
          <button className="btn btn-primary" onClick={go} disabled={busy}>확인</button>
        </div>
      </div>
    </div>
  )
}

export default PasswordPrompt
