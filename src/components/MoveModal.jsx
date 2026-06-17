import { useState } from 'react'

// 이동 대상 폴더를 고르는 모달.
// props:
//   title       : 안내 문구
//   candidates  : [{ id, name, depth }] 고를 수 있는 폴더들
//   allowHome   : true면 '홈(최상위)' 선택지 표시 (폴더 이동용)
//   onMove(targetId|null) : 성공 시 falsy, 실패 시 에러 문자열 반환
//   onCancel
function MoveModal({ title, candidates, allowHome, onMove, onCancel }) {
  const [target, setTarget] = useState(undefined) // undefined=미선택 / null=홈 / id
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function go() {
    if (target === undefined) {
      setErr('옮길 위치를 선택하세요.')
      return
    }
    setBusy(true)
    setErr('')
    const res = await onMove(target)
    if (res) {
      setErr(res)
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-msg">{title}</p>
        <ul className="move-list">
          {allowHome && (
            <li>
              <label className="move-row">
                <input
                  type="radio"
                  name="move-target"
                  checked={target === null}
                  onChange={() => setTarget(null)}
                />
                🏠 홈 (최상위)
              </label>
            </li>
          )}
          {candidates.map((c) => (
            <li key={c.id}>
              <label className="move-row" style={{ paddingLeft: 8 + c.depth * 16 }}>
                <input
                  type="radio"
                  name="move-target"
                  checked={target === c.id}
                  onChange={() => setTarget(c.id)}
                />
                📁 {c.name}
              </label>
            </li>
          ))}
          {candidates.length === 0 && !allowHome && (
            <li className="muted">옮길 수 있는 폴더가 없습니다.</li>
          )}
        </ul>
        {err && <p className="error" style={{ marginTop: 8 }}>오류: {err}</p>}
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={onCancel} disabled={busy}>취소</button>
          <button className="btn btn-primary" onClick={go} disabled={busy}>여기로 이동</button>
        </div>
      </div>
    </div>
  )
}

export default MoveModal
