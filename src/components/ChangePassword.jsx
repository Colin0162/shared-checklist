import { useState } from 'react'
import { changeMyPassword } from '../lib/api'

// 본인 비밀번호 변경 화면. props: token, onBack
function ChangePassword({ token, onBack }) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!oldPw || !newPw) {
      setErr('현재 비밀번호와 새 비밀번호를 입력하세요.')
      return
    }
    if (newPw !== newPw2) {
      setErr('새 비밀번호가 서로 달라요.')
      return
    }
    setBusy(true)
    setErr('')
    setInfo('')
    try {
      const res = await changeMyPassword(token, oldPw, newPw)
      if (!res.ok) {
        setErr(res.error || '실패했습니다.')
        setBusy(false)
        return
      }
      setInfo('비밀번호가 변경되었습니다.')
      setOldPw('')
      setNewPw('')
      setNewPw2('')
      setBusy(false)
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  const type = show ? 'text' : 'password'

  return (
    <section className="editor">
      <div className="checklist-head">
        <button className="back-btn" onClick={onBack}>← 목록</button>
        <h2 className="board-heading">비밀번호 변경</h2>
      </div>

      {err && <p className="error">오류: {err}</p>}
      {info && <p className="info-box">{info}</p>}

      <label className="field">
        <span className="field-label">현재 비밀번호</span>
        <input className="text-input" type={type} value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">새 비밀번호</span>
        <input className="text-input" type={type} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">새 비밀번호 확인</span>
        <input
          className="text-input"
          type={type}
          value={newPw2}
          onChange={(e) => setNewPw2(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </label>

      <label className="row-note" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        비밀번호 보기
      </label>

      <div className="editor-foot">
        <span />
        <div className="editor-foot-right">
          <button className="btn" onClick={onBack} disabled={busy}>닫기</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>변경</button>
        </div>
      </div>
    </section>
  )
}

export default ChangePassword
