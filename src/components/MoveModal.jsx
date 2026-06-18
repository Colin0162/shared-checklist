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
//   같은 '최상위 폴더(rootId)' 안에서만 탐색 — 다른 최상위로는 못 옮김.
// props:
//   title, folders(전체 보이는 폴더), kind('board'|'folder'),
//   excludeId(폴더 이동 시 자기 폴더 id), rootId(현재 항목의 최상위 폴더 id),
//   onMove(targetId) : 성공 시 falsy, 실패 시 에러문자열, onCancel
function MoveModal({ title, folders, kind, excludeId, rootId, onMove, onCancel }) {
  const [cursor, setCursor] = useState(rootId ?? null) // 현재 보고 있는 폴더 id
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const byId = new Map(folders.map((f) => [String(f.id), f]))
  const children = folders.filter((f) => (f.parent_id || null) === cursor)
  const blocked = (f) => kind === 'folder' && isDescendant(folders, f.id, excludeId)

  // 경로: 현재 위치 → 최상위(rootId)까지만 (그 위 홈은 안 보여줌)
  const path = []
  let c = cursor ? byId.get(String(cursor)) : null
  const seen = new Set()
  while (c && !seen.has(String(c.id))) {
    seen.add(String(c.id))
    path.unshift(c)
    if (String(c.id) === String(rootId)) break
    c = c.parent_id ? byId.get(String(c.parent_id)) : null
  }

  // 게시글은 폴더 안에만(cursor 필요). 폴더는 현재 위치가 자기/후손이면 불가
  const cursorBlocked = kind === 'folder' && cursor && isDescendant(folders, cursor, excludeId)
  const canSelectHere = cursor !== null && !cursorBlocked
  const cursorName = cursor ? byId.get(String(cursor))?.name : null

  async function go() {
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
          {path.map((f, i) => (
            <span className="crumb-wrap" key={f.id}>
              {i > 0 && <span className="crumb-sep">›</span>}
              <button className="crumb" onClick={() => setCursor(f.id)}>{f.name}</button>
            </span>
          ))}
        </nav>

        <ul className="move-list">
          {children.length === 0 && (
            <li className="muted" style={{ padding: 8 }}>하위 폴더가 없습니다.</li>
          )}
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
          <button className="btn btn-primary" onClick={go} disabled={busy || !canSelectHere}>
            {cursorName ? `‘${cursorName}’ 안으로 이동` : '이동'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MoveModal
