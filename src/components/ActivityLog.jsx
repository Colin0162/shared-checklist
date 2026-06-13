import { useState, useEffect } from 'react'
import { getBoardActivity } from '../lib/api'

// 활동 기록 모달(#3): 이 게시글의 '누가·언제·무엇을 체크/비고' 최근 기록.
// props: token, boardId, onClose
function fmtTime(ts) {
  const d = new Date(ts)
  return d.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ActivityLog({ token, boardId, onClose }) {
  const [rows, setRows] = useState(null) // null = 로딩 중
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getBoardActivity(token, boardId, 50)
      .then((d) => {
        if (!cancelled) setRows(d || [])
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [token, boardId])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal activity-modal" onClick={(e) => e.stopPropagation()}>
        <div className="activity-head">
          <h3 className="activity-title">활동 기록</h3>
          <button className="btn btn-small" onClick={onClose}>
            닫기
          </button>
        </div>

        {error && <p className="error">오류: {error}</p>}
        {!error && rows === null && <p className="muted">불러오는 중…</p>}
        {!error && rows && rows.length === 0 && <p className="muted">아직 기록이 없습니다.</p>}
        {!error && rows && rows.length > 0 && (
          <ul className="activity-list">
            {rows.map((r, i) => (
              <li className="activity-row" key={i}>
                <span className="activity-when">{fmtTime(r.created_at)}</span>
                <span className="activity-who">{r.user_name}</span>
                <span className="activity-act">{r.action}</span>
                <span className="activity-detail">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ActivityLog
