import { useState, useEffect, useCallback } from 'react'
import { listFolderMembers, kickMember, transferFolderAdmin } from '../lib/api'
import { displayName } from '../lib/constants'

// 공유 폴더 참여자 패널 — 폴더 안 상단에 '항상' 표시(모달 아님).
//   관리자면 각 참여자 옆에 관리자 넘기기·내보내기.
// props: token, folder, myName, isAdmin, onChanged(권한/구성 바뀌면 폴더 다시 로드)
function FolderMembers({ token, folder, myName, isAdmin, onChanged }) {
  const [members, setMembers] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // .then 콜백 안에서 set → effect 본문 동기 setState 금지 룰을 피함(앱의 다른 로더와 동일 패턴)
  const load = useCallback(
    () =>
      listFolderMembers(token, folder.id)
        .then(setMembers)
        .catch((e) => setErr(e.message)),
    [token, folder.id],
  )

  useEffect(() => {
    load()
  }, [load])

  async function act(fn) {
    setBusy(true)
    setErr('')
    try {
      await fn()
      await load()
      onChanged?.() // 관리자 넘기면 내 권한(my_role)이 바뀌므로 폴더 목록도 갱신
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="member-panel">
      <h3 className="section-title" style={{ marginTop: 0 }}>👥 참여자 ({members.length})</h3>
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
                  onClick={() => act(() => transferFolderAdmin(token, folder.id, m.user_id))}
                >
                  관리자 넘기기
                </button>
                <button
                  className="btn btn-danger btn-small"
                  disabled={busy}
                  onClick={() => act(() => kickMember(token, folder.id, m.user_id))}
                >
                  내보내기
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FolderMembers
