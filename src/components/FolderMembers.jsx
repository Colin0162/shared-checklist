import { useState, useEffect, useCallback } from 'react'
import { listFolderMembers, kickMember, transferFolderAdmin } from '../lib/api'
import { displayName } from '../lib/constants'

// 공유 폴더 참여자 목록 + (관리자면) 내보내기·관리자 넘기기.
// props: token, folder, myName, isAdmin, onChanged(폴더 목록 갱신용), onClose
function FolderMembers({ token, folder, myName, isAdmin, onChanged, onClose }) {
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

  async function kick(m) {
    setBusy(true)
    setErr('')
    try {
      await kickMember(token, folder.id, m.user_id)
      await load()
      onChanged?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function transfer(m) {
    setBusy(true)
    setErr('')
    try {
      await transferFolderAdmin(token, folder.id, m.user_id)
      await load()
      onChanged?.() // 내 권한(my_role)이 바뀌므로 폴더 목록 다시 로드
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-msg">‘{folder.name}’ 참여자</p>
        {err && <p className="error" style={{ marginTop: 8 }}>오류: {err}</p>}
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
                  <button className="btn btn-small" disabled={busy} onClick={() => transfer(m)}>
                    관리자 넘기기
                  </button>
                  <button className="btn btn-danger btn-small" disabled={busy} onClick={() => kick(m)}>
                    내보내기
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}

export default FolderMembers
