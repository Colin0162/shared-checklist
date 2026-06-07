// App.jsx = 화면 전환의 '교통정리' 파일.
//   로그인 → 폴더 목록 → (폴더 안) 게시글 목록 → 게시글(체크리스트) → 편집
//   각 화면 조각은 src/components/* 에 있음. 어떤 파일이 어느 화면인지,
//   무엇을 바꾸면 어디가 바뀌는지는 → 프로젝트 루트의 EDITING_GUIDE.md 참고.
import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import {
  getBoards,
  getBoardItems,
  setItemStatus,
  setItemNote,
  resetBoard,
  verifyBoardAdmin,
  verifyBoardEntry,
  siteDeleteBoard,
  getFolders,
  createFolder,
  deleteFolder,
} from './lib/api'
import BoardList from './components/BoardList'
import FolderList from './components/FolderList'
import Checklist from './components/Checklist'
import AdminEditor from './components/AdminEditor'
import ConfirmModal from './components/ConfirmModal'
import Login from './components/Login'
import PasswordPrompt from './components/PasswordPrompt'
import Clock from './components/Clock'
import PendingUsers from './components/PendingUsers'
import Guide from './components/Guide'
import ChangePassword from './components/ChangePassword'

function applyItemChange(prev, payload) {
  if (payload.eventType === 'INSERT') {
    if (prev.some((it) => it.id === payload.new.id)) return prev
    return [...prev, payload.new].sort((a, b) => a.sort_order - b.sort_order)
  }
  if (payload.eventType === 'UPDATE') {
    return prev.map((it) => (it.id === payload.new.id ? { ...it, ...payload.new } : it))
  }
  if (payload.eventType === 'DELETE') {
    return prev.filter((it) => it.id !== payload.old.id)
  }
  return prev
}

function loadUser() {
  try {
    const u = JSON.parse(localStorage.getItem('user'))
    return u && u.name && u.token ? u : null // 토큰 없으면(구버전) 재로그인
  } catch {
    return null
  }
}

function App() {
  const [user, setUser] = useState(loadUser)
  const [boards, setBoards] = useState([])
  const [folders, setFolders] = useState([])
  const [folderPath, setFolderPath] = useState([]) // 현재 위치 경로(루트=빈 배열)
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null)
  const [openBoard, setOpenBoard] = useState(null)
  const [items, setItems] = useState([])
  const [adminPw, setAdminPw] = useState(null) // 관리자 모드면 편집 비번 보관
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [entryPrompt, setEntryPrompt] = useState(null) // 입장 비번 받을 board
  const [adminPrompt, setAdminPrompt] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(null)
  const [showPending, setShowPending] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [noteLocks, setNoteLocks] = useState({}) // { itemId: { user, ts } } 비고 작성 중 잠금
  const lockChanRef = useRef(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  const configError = supabase ? '' : 'Supabase 연결 정보가 없습니다 (.env.local 확인).'
  const currentFolder = folderPath.length ? folderPath[folderPath.length - 1] : null
  const currentBoards = boards.filter((b) => (b.folder_id || null) === (currentFolder?.id || null))

  useEffect(() => {
    if (!supabase) return
    Promise.all([getBoards(), getFolders()])
      .then(([bs, fs]) => {
        setBoards(bs)
        setFolders(fs)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // 실시간: 게시글 목록/메모 변경
  useEffect(() => {
    if (!supabase) return
    const ch = supabase
      .channel('boards-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => {
        getBoards()
          .then((bs) => {
            setBoards(bs)
            setOpenBoard((ob) => (ob ? bs.find((b) => b.id === ob.id) || ob : ob))
          })
          .catch(() => {})
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  // 실시간: 열린 게시글의 항목 변경
  useEffect(() => {
    if (!supabase || !openBoard) return
    const ch = supabase
      .channel('items-' + openBoard.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `board_id=eq.${openBoard.id}` },
        (payload) => setItems((prev) => applyItemChange(prev, payload)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [openBoard])

  // 실시간: 비고 작성 잠금(broadcast). 누가 어떤 항목 비고를 쓰는 중인지 공유
  useEffect(() => {
    if (!supabase || !openBoard) return
    const ch = supabase.channel('notelock-' + openBoard.id, {
      config: { broadcast: { self: false } },
    })
    ch.on('broadcast', { event: 'lock' }, ({ payload }) => {
      setNoteLocks((prev) => {
        const next = { ...prev }
        if (payload.locked) next[payload.itemId] = { user: payload.user, ts: Date.now() }
        else delete next[payload.itemId]
        return next
      })
    }).subscribe()
    lockChanRef.current = ch
    // 연결 끊김 등으로 남은 잠금은 45초 뒤 자동 해제(스턱 방지)
    const prune = setInterval(() => {
      setNoteLocks((prev) => {
        const now = Date.now()
        let changed = false
        const next = {}
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.ts < 45000) next[k] = v
          else changed = true
        }
        return changed ? next : prev
      })
    }, 5000)
    return () => {
      clearInterval(prune)
      supabase.removeChannel(ch)
      lockChanRef.current = null
      setNoteLocks({}) // 보드 떠날 때 잠금 표시 정리
    }
  }, [openBoard])

  const sendNoteLock = useCallback(
    (itemId, locked) => {
      lockChanRef.current?.send({
        type: 'broadcast',
        event: 'lock',
        payload: { itemId, user: user?.name || '', locked },
      })
    },
    [user],
  )

  function handleLogin(u) {
    const value = { name: u.name, is_site_admin: u.is_site_admin, token: u.token }
    localStorage.setItem('user', JSON.stringify(value))
    setUser(value)
  }
  function logout() {
    localStorage.removeItem('user')
    setUser(null)
    setOpenBoard(null)
    setFolderPath([])
    setEditing(false)
    setAdminPw(null)
    setShowPending(false)
    setShowChangePw(false)
  }

  async function reloadBoards() {
    try {
      setBoards(await getBoards())
    } catch (e) {
      setError(e.message)
    }
  }
  async function reloadFolders() {
    try {
      setFolders(await getFolders())
    } catch (e) {
      setError(e.message)
    }
  }
  async function doCreateFolder(name, isPrivate) {
    try {
      await createFolder(user.token, name, isPrivate, currentFolder?.id || null)
      await reloadFolders()
    } catch (e) {
      setError(e.message)
    }
  }
  async function doDeleteFolder() {
    try {
      await deleteFolder(user.token, confirmDeleteFolder.id)
      await reloadFolders()
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmDeleteFolder(null)
    }
  }

  // 게시글 열기 (입장 비번 있으면 먼저 확인)
  function tryOpen(board) {
    if (board.has_entry_password) setEntryPrompt(board)
    else openConfirmed(board)
  }
  async function openConfirmed(board) {
    setLoading(true)
    setError('')
    try {
      setItems(await getBoardItems(board.id))
      setOpenBoard(board)
      setAdminPw(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  async function submitEntry(pw) {
    try {
      const res = await verifyBoardEntry(entryPrompt.id, pw)
      if (!res.ok) return res.error || '실패'
      const b = entryPrompt
      setEntryPrompt(null)
      await openConfirmed(b)
      return null
    } catch (e) {
      return e.message
    }
  }

  function goBack() {
    setOpenBoard(null)
    setItems([])
    setAdminPw(null)
  }

  // 관리자 모드 진입
  async function submitAdmin(pw) {
    try {
      const res = await verifyBoardAdmin(openBoard.id, pw)
      if (!res.ok) return res.error || '실패'
      setAdminPw(pw)
      setAdminPrompt(false)
      return null
    } catch (e) {
      return e.message
    }
  }

  // useCallback: 함수 신원 고정 → memo(Item)이 바뀐 항목만 다시 그림(체크 시 부드러움)
  const handleSetStatus = useCallback(
    async (id, status) => {
      const checkedBy = status ? user?.name || '' : ''
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status, checked_by: checkedBy } : it)),
      )
      try {
        await setItemStatus(user.token, id, status)
      } catch (e) {
        setError(e.message)
      }
    },
    [user],
  )
  const handleSetNote = useCallback(
    async (id, note) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, note } : it)))
      try {
        await setItemNote(user.token, id, note)
      } catch (e) {
        setError(e.message)
      }
    },
    [user],
  )
  function openNew() {
    setEditTarget(null)
    setEditing(true)
  }
  function openEdit() {
    setEditTarget(openBoard)
    setEditing(true)
  }
  async function handleSaved() {
    setEditing(false)
    try {
      const fresh = await getBoards()
      setBoards(fresh)
      if (openBoard) {
        const updated = fresh.find((b) => b.id === openBoard.id) || null
        setOpenBoard(updated)
        if (updated) setItems(await getBoardItems(updated.id))
      }
    } catch (e) {
      setError(e.message)
    }
  }
  async function handleDeleted() {
    setEditing(false)
    setOpenBoard(null)
    setItems([])
    setAdminPw(null)
    await reloadBoards()
  }
  async function doReset() {
    try {
      await resetBoard(openBoard.id, adminPw)
      setItems(await getBoardItems(openBoard.id))
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmReset(false)
    }
  }

  async function doDeleteBoardSite() {
    try {
      await siteDeleteBoard(user.token, confirmDeleteBoard.id)
      await reloadBoards()
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmDeleteBoard(null)
    }
  }

  const nextSortOrder = boards.reduce((max, b) => Math.max(max, b.sort_order ?? 0), 0) + 1

  if (supabase && !user) {
    return (
      <div className="app">
        <header className="app-header">
          <img
          className="parish-banner"
          src="/parish-header.png"
          alt="천주교 마산교구 문산본당"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <h1>청년회 체크리스트</h1>
        </header>
        <Login onLogin={handleLogin} />
      </div>
    )
  }

  // 사용 가이드 화면 (헤더 없이 가이드만, 자체 '← 목록' 버튼으로 닫음)
  if (showGuide) {
    return (
      <div className="app">
        <Guide onBack={() => setShowGuide(false)} />
      </div>
    )
  }

  // 비밀번호 변경 화면
  if (showChangePw) {
    return (
      <div className="app">
        <ChangePassword token={user.token} onBack={() => setShowChangePw(false)} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <img
          className="parish-banner"
          src="/parish-header.png"
          alt="천주교 마산교구 문산본당"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <h1>청년회 체크리스트</h1>
        {user && (
          <>
            <div className="user-bar">
              <span className="user-name">
                {user.name}님{user.is_site_admin ? ' (사이트 관리자)' : ''}
              </span>
              <button className="btn btn-small" onClick={() => setShowGuide(true)}>사용 가이드</button>
              <button className="btn btn-small" onClick={() => setShowChangePw(true)}>비밀번호 변경</button>
              <button className="btn btn-small" onClick={logout}>로그아웃</button>
            </div>
            <Clock />
          </>
        )}
      </header>

      {(configError || error) && <p className="error">오류: {configError || error}</p>}
      {loading && <p className="muted">불러오는 중…</p>}

      {!loading && editing && (
        <AdminEditor
          token={user.token}
          author={user.name}
          adminPw={adminPw}
          folderId={currentFolder?.id || ''}
          board={editTarget}
          originalItems={editTarget ? items : []}
          nextSortOrder={nextSortOrder}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
          onDeleted={handleDeleted}
        />
      )}

      {!loading && !editing && showPending && (
        <PendingUsers token={user.token} onBack={() => setShowPending(false)} />
      )}

      {!loading && !editing && !showPending && openBoard && (
        <Checklist
          board={openBoard}
          items={items}
          adminMode={Boolean(adminPw)}
          onBack={goBack}
          onEnterAdmin={() => setAdminPrompt(true)}
          onExitAdmin={() => setAdminPw(null)}
          onEdit={openEdit}
          onReset={() => setConfirmReset(true)}
          onSetStatus={handleSetStatus}
          onSetNote={handleSetNote}
          noteLocks={noteLocks}
          myName={user.name}
          onNoteLock={sendNoteLock}
        />
      )}

      {/* 폴더/게시글 화면 (루트 또는 현재 폴더) */}
      {!loading && !editing && !showPending && !openBoard && (
        <>
          {/* 경로(브레드크럼) — 조각을 누르면 그 폴더로 이동 */}
          <nav className="crumbs">
            <button className="crumb" onClick={() => setFolderPath([])}>🏠 홈</button>
            {folderPath.map((f, i) => (
              <span className="crumb-wrap" key={f.id}>
                <span className="crumb-sep">›</span>
                <button className="crumb" onClick={() => setFolderPath(folderPath.slice(0, i + 1))}>
                  {f.name}
                </button>
              </span>
            ))}
          </nav>

          {user.is_site_admin && !currentFolder && (
            <div className="list-head">
              <button className="btn" onClick={() => setShowPending(true)}>계정 관리</button>
            </div>
          )}

          {/* 하위 폴더 */}
          <FolderList
            folders={folders.filter(
              (f) =>
                (f.parent_id || null) === (currentFolder?.id || null) &&
                (!f.is_private || f.owner === user.name),
            )}
            onOpen={(f) => setFolderPath((p) => [...p, f])}
            onNew={doCreateFolder}
            onDelete={(f) => setConfirmDeleteFolder(f)}
            canDelete={(f) =>
              (f.owner === user.name || Boolean(user.is_site_admin)) &&
              !folders.some((c) => c.parent_id === f.id) &&
              !boards.some((b) => b.folder_id === f.id)
            }
          />

          {/* 게시글: 홈(루트)에선 못 만들고 폴더만. 폴더 안에서만 새 게시글 */}
          {currentFolder ? (
            <>
              <div className="list-head list-head-boards">
                <button className="btn btn-primary" onClick={openNew}>+ 새 게시글</button>
              </div>
              <BoardList
                boards={currentBoards}
                onOpen={tryOpen}
                siteAdmin={Boolean(user.is_site_admin)}
                onDelete={(b) => setConfirmDeleteBoard(b)}
              />
            </>
          ) : (
            // 홈: 폴더만. 혹시 옛 루트 게시글이 있으면 그것만 보여줌(새 생성 버튼은 없음)
            currentBoards.length > 0 && (
              <BoardList
                boards={currentBoards}
                onOpen={tryOpen}
                siteAdmin={Boolean(user.is_site_admin)}
                onDelete={(b) => setConfirmDeleteBoard(b)}
              />
            )
          )}
        </>
      )}

      {entryPrompt && (
        <PasswordPrompt
          title={`'${entryPrompt.title}' 입장 비밀번호`}
          onSubmit={submitEntry}
          onCancel={() => setEntryPrompt(null)}
        />
      )}
      {adminPrompt && openBoard && (
        <PasswordPrompt
          title={`'${openBoard.title}' 관리자 비밀번호`}
          onSubmit={submitAdmin}
          onCancel={() => setAdminPrompt(false)}
        />
      )}
      {confirmReset && openBoard && (
        <ConfirmModal
          message={`'${openBoard.title}'의 체크를 모두 초기화할까요?`}
          confirmLabel="초기화"
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
      {confirmDeleteBoard && (
        <ConfirmModal
          message={`'${confirmDeleteBoard.title}' 게시글을 삭제할까요?`}
          confirmLabel="삭제"
          onConfirm={doDeleteBoardSite}
          onCancel={() => setConfirmDeleteBoard(null)}
        />
      )}
      {confirmDeleteFolder && (
        <ConfirmModal
          message={`'${confirmDeleteFolder.name}' 폴더를 삭제할까요?`}
          confirmLabel="삭제"
          onConfirm={doDeleteFolder}
          onCancel={() => setConfirmDeleteFolder(null)}
        />
      )}
    </div>
  )
}

export default App
