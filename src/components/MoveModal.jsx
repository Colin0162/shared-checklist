import { useState } from 'react'

// candidate가 ancestor(자기 포함)의 후손인지 — 폴더 이동 시 자기/후손으로 못 들어가게
function isDescendant(folders, candidateId, ancestorId) {
  const byId = new Map(folders.map((f) => [String(f.id), f]))
  let cur = byId.get(String(candidateId))
  const seen = new Set()
  while (cur && !seen.has(String(cur.id))) {
    if (String(cur.id) === String(ancestorId)) return true
    seen.add(String(cur.id))
    cur = cur.parent_id ? byId.get(String(cur.parent_id)) : null
  }
  return false
}

// 폴더를 한 단계씩 들어가며 이동 대상을 고르는 모달.
//   폴더를 누르면 그 안으로 들어가고, 원하는 위치에서 '여기로 이동'.
// props:
//   title, folders(전체 보이는 폴더), kind('board'|'folder'),
//   excludeId(폴더 이동 시 자기 폴더 id — 자기/후손으로는 못 감),
//   onMove(targetId|null) : 성공 시 falsy, 실패 시 에러문자열
//   onCancel
function MoveModal({ title, folders, kind, excludeId, onMove, onCancel }) {
  const [cursor, setCursor] = useState(null) // 현재 보고 있는 폴더 id (null=홈/최상위)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const byId = new Map(folders.map((f) => [String(f.id), f]))
  const children = folders.filter((f) => (f.parent_id || null) === cursor)

  // 폴더 이동: 자기 자신/후손으로는 들어갈 수 없음
  const blocked = (f) => kind === 'folder' && isDescendant(folders, f.id, excludeId)

  // 현재 위치(cursor)로 가는 경로(브레드크럼)
  const path = []
  let c = cursor ? byId.get(String(cursor)) : null
  const seen = new Set()
  while (c && !seen.has(String(c.id))) {
    seen.add(String(c.id))
    path.unshift(c)
    c = c.parent_id ? byId.get(String(c.parent_id)) : null
  }

  // 게시글은 폴더 안에만(홈 불가). 폴더는 홈(최상위)도 가능.
  const canSelectHere = kind === 'board' ? cursor !== null : true
  const cursorName = cursor ? byId.get(String(cursor))?.name : null

  async function selectHere() {
    setBusy(true)
    setErr('')
    const res = await onMove(cursor)
    if (res) {
      setErr(res)
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-msg">{title}</p>

        <nav className="move-crumbs">
          <button className="crumb" onClick={() => setCursor(null)}>🏠 홈</button>
          {path.map((f) => (
            <span className="crumb-wrap" key={f.id}>
              <span className="crumb-sep">›</span>
              <button className="crumb" onClick={() => setCursor(f.id)}>{f.name}</button>
            </span>
          ))}
        </nav>

        <ul className="move-list">
          {children.length === 0 && <li className="muted" style={{ padding: 8 }}>하위 폴더가 없습니다.</li>}
          {children.map((f) => (
            <li key={f.id}>
              <button
                className="move-row"
                disabled={blocked(f)}
                onClick={() => setCursor(f.id)}
                title={blocked(f) ? '자기 자신/하위로는 옮길 수 없어요' : '열기'}
              >
                <span>📁 {f.name}</span>
                <span className="move-into">›</span>
              </button>
            </li>
          ))}
        </ul>

        {err && <p className="error" style={{ marginTop: 8 }}>오류: {err}</p>}
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={onCancel} disabled={busy}>취소</button>
          <button className="btn btn-primary" onClick={selectHere} disabled={busy || !canSelectHere}>
            {cursor ? `‘${cursorName}’ 안으로 이동` : '홈(최상위)으로 이동'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MoveModal
