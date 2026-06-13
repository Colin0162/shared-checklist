import { useState, useEffect } from 'react'
import {
  listAllUsers,
  approveUser,
  deleteUser,
  adminResetPassword,
  getClientErrors,
} from '../lib/api'
import PasswordPrompt from './PasswordPrompt'

function fmtTime(ts) {
  return new Date(ts).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 사이트 관리자: 전체 계정 관리 (승인 / 삭제 / 비번 재설정).
// props: token, onBack
function PendingUsers({ token, onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [resetTarget, setResetTarget] = useState(null) // 비번 재설정 대상 사용자
  const [errors, setErrors] = useState(null) // 최근 오류 로그 (null = 로딩 중)

  useEffect(() => {
    let alive = true
    listAllUsers(token)
      .then((d) => alive && setUsers(d))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false))
    getClientErrors(token, 50)
      .then((d) => alive && setErrors(d || []))
      .catch(() => alive && setErrors([])) // 오류 조회 실패는 조용히(이 화면 핵심 아님)
    return () => {
      alive = false
    }
  }, [token])

  async function approve(u) {
    setErr('')
    try {
      await approveUser(token, u.id)
      setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, status: 'approved' } : x)))
    } catch (e) {
      setErr(e.message)
    }
  }
  async function remove(u) {
    setErr('')
    try {
      await deleteUser(token, u.id)
      setUsers((p) => p.filter((x) => x.id !== u.id))
    } catch (e) {
      setErr(e.message)
    }
  }
  async function submitReset(pw) {
    try {
      await adminResetPassword(token, resetTarget.id, pw)
      setResetTarget(null)
      return null
    } catch (e) {
      return e.message
    }
  }

  return (
    <section className="editor">
      <div className="checklist-head">
        <button className="back-btn" onClick={onBack}>← 목록</button>
        <h2 className="board-heading">계정 관리</h2>
      </div>
      {err && <p className="error">오류: {err}</p>}
      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : users.length === 0 ? (
        <p className="muted">계정이 없습니다.</p>
      ) : (
        <ul className="user-list">
          {users.map((u) => (
            <li className="user-row" key={u.id}>
              <span className="user-row-name">
                {u.name}
                {u.is_site_admin && ' (관리자)'}
                {u.status === 'pending' && <span className="badge-pending"> 승인대기</span>}
              </span>
              <span className="head-actions">
                {u.status === 'pending' && (
                  <button className="btn btn-primary btn-small" onClick={() => approve(u)}>
                    승인
                  </button>
                )}
                {u.status === 'approved' && !u.is_site_admin && (
                  <button className="btn btn-small" onClick={() => setResetTarget(u)}>
                    비번 재설정
                  </button>
                )}
                {!u.is_site_admin && (
                  <button className="btn btn-danger btn-small" onClick={() => remove(u)}>
                    삭제
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 최근 오류 — 사용자가 본 에러를 운영자가 확인(사고 추적) */}
      <div className="error-log">
        <h3 className="error-log-title">최근 오류</h3>
        {errors === null ? (
          <p className="muted">불러오는 중…</p>
        ) : errors.length === 0 ? (
          <p className="muted">기록된 오류가 없습니다.</p>
        ) : (
          <ul className="error-log-list">
            {errors.map((e, i) => (
              <li className="error-log-row" key={i}>
                <span className="error-log-when">{fmtTime(e.created_at)}</span>
                {e.user_name && <span className="error-log-who">{e.user_name}</span>}
                <span className="error-log-msg">{e.message}</span>
                {e.context && <span className="error-log-ctx">{e.context}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {resetTarget && (
        <PasswordPrompt
          title={`'${resetTarget.name}' 새 비밀번호`}
          onSubmit={submitReset}
          onCancel={() => setResetTarget(null)}
        />
      )}
    </section>
  )
}

export default PendingUsers
