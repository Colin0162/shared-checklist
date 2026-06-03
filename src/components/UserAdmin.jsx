import { useState, useEffect } from 'react'
import { listUsers, setUserAdmin } from '../lib/api'

// 관리자 전용: 사용자 목록 + 관리자 지정/해제.
// props: token, currentName, onBack
function UserAdmin({ token, currentName, onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    listUsers(token)
      .then((d) => alive && setUsers(d))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [token])

  async function toggle(u) {
    setErr('')
    try {
      await setUserAdmin(token, u.id, !u.is_admin)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_admin: !u.is_admin } : x)))
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <section className="editor">
      <div className="checklist-head">
        <button className="back-btn" onClick={onBack}>← 목록</button>
        <h2 className="board-heading">사용자 관리</h2>
      </div>

      {err && <p className="error">오류: {err}</p>}
      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <ul className="user-list">
          {users.map((u) => (
            <li className="user-row" key={u.id}>
              <span className="user-row-name">
                {u.name}
                {u.name === currentName && ' (나)'}
              </span>
              <label className="row-note">
                <input type="checkbox" checked={u.is_admin} onChange={() => toggle(u)} />
                관리자
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default UserAdmin
