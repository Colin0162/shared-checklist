import { useState, useEffect, useCallback } from 'react'
import {
  listFolderMembers,
  kickMember,
  transferFolderAdmin,
  listJoinRequests,
  approveJoin,
  rejectJoin,
} from '../lib/api'
import { displayName } from '../lib/constants'
import ConfirmModal from './ConfirmModal'

// 공유 폴더 참여자 패널 — 폴더 안 상단에 '항상' 표시(모달 아님).
//   관리자면: 참여 요청 수락/거부 + 각 참여자 관리자 넘기기·내보내기.
// props: token, folder, myName, isAdmin, onChanged(권한/구성 바뀌면 폴더 다시 로드)
function FolderMembers({ token, folder, myName, isAdmin, onChanged }) {
  const [members, setMembers] = useState([])
  const [requests, setRequests] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null) // { message, run } 재확인 대상

  const load = useCallback(
    () => listFolderMembers(token, folder.id).then(setMembers).catch((e) => setErr(e.message)),
    [token, folder.id],
  )
  const loadRequests = useCallback(
    () =>
      isAdmin
        ? listJoinRequests(token, folder.id).then(setRequests).catch(() => {})
        : Promise.resolve(),
    [token, folder.id, isAdmin],
  )

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  async function act(fn) {
    setBusy(true)
    setErr('')
    try {
      await fn()
      await load()
      onChanged?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function respond(userId, accept) {
    setBusy(true)
    setErr('')
    try {
      if (accept) await approveJoin(token, folder.id, userId)
      else await rejectJoin(token, folder.id, userId)
      await loadRequests()
      if (accept) {
        await load()
        onChanged?.()
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="member-panel">
      {isAdmin && requests.length > 0 && (
        <>
          <h3 className="section-title">🙋 참여 요청 ({requests.length})</h3>
          <ul className="member-list">
            {requests.map((r) => (
              <li key={r.user_id} className="member-row">
                <span className="member-name">{displayName(r.name)}</span>
                <span className="member-actions">
                  <button className="btn btn-small" disabled={busy} onClick={() => respond(r.user_id, true)}>
                    수락
                  </button>
                  <button className="btn btn-danger btn-small" disabled={busy} onClick={() => respond(r.user_id, false)}>
                    거부
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="section-title">👥 참여자 ({members.length})</h3>
      {err && <p className="error">오류: {err}</p>}
      <ul className="member-list">
        {members.map((m) => (
          <li key={m.user_id} className="member-row">
            <span className="member-name">
              {displayName(m.name)}
              {m.role === 'admin' && ' (관리자)'}
              {m.name === myName && ' · 나'}
            </span>
            {isAdmin && m.role !== 'admin' && (
              <span className="member-actions">
                <button
                  className="btn btn-small"
                  disabled={busy}
                  onClick={() =>
                    setPending({
                      message: `'${displayName(m.name)}'님에게 폴더 관리자를 넘길까요? 내 권한은 일반 참여자가 됩니다.`,
                      run: () => act(() => transferFolderAdmin(token, folder.id, m.user_id)),
                    })
                  }
                >
                  관리자 넘기기
                </button>
                <button
                  className="btn btn-danger btn-small"
                  disabled={busy}
                  onClick={() =>
                    setPending({
                      message: `'${displayName(m.name)}'님을 이 폴더에서 내보낼까요?`,
                      run: () => act(() => kickMember(token, folder.id, m.user_id)),
                    })
                  }
                >
                  내보내기
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {pending && (
        <ConfirmModal
          message={pending.message}
          confirmLabel="확인"
          onConfirm={() => {
            const run = pending.run
            setPending(null)
            run()
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

export default FolderMembers
