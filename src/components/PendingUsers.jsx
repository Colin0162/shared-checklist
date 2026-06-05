import { useState, useEffect } from 'react'
import { listPendingUsers, approveUser, rejectUser } from '../lib/api'

// 사이트 관리자: 가입 신청 목록 + 승인/거절.
// props: token, onBack
function PendingUsers({ token, onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    listPendingUsers(token)
      .then((d) => alive && setUsers(d))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [token])

  async function act(u, approve) {
    setErr('')
    try {
      if (approve) await approveUser(token, u.id)
      else await rejectUser(token, u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <section className="editor">
      <div className="checklist-head">
        <button className="back-btn" onClick={onBack}>← 목록</button>
        <h2 className="board-heading">가입 신청 관리</h2>
      </div>
      {err && <p className="error">오류: {err}</p>}
      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : users.length === 0 ? (
        <p className="muted">대기 중인 가입 신청이 없습니다.</p>
      ) : (
        <ul className="user-list">
          {users.map((u) => (
            <li className="user-row" key={u.id}>
              <span className="user-row-name">{u.name}</span>
              <span className="head-actions">
                <button className="btn btn-primary btn-small" onClick={() => act(u, true)}>
                  승인
                </button>
                <button className="btn btn-danger btn-small" onClick={() => act(u, false)}>
                  거절
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default PendingUsers
