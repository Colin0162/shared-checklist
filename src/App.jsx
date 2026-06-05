// App.jsx = 화면 전환의 '교통정리' 파일.
//   로그인 → 폴더 목록 → (폴더 안) 게시글 목록 → 게시글(체크리스트) → 편집
//   각 화면 조각은 src/components/* 에 있음. 어떤 파일이 어느 화면인지,
//   무엇을 바꾸면 어디가 바뀌는지는 → 프로젝트 루트의 EDITING_GUIDE.md 참고.
import { useState, useEffect } from 'react'
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
  const [openFolder, setOpenFolder] = useState(null) // 보고 있는 폴더(없으면 폴더 목록)
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
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  const configError = supabase ? '' : 'Supabase 연결 정보가 없습니다 (.env.local 확인).'

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

  function handleLogin(u) {
    const value = { name: u.name, is_site_admin: u.is_site_admin, token: u.token }
    localStorage.setItem('user', JSON.stringify(value))
    setUser(value)
  }
  function logout() {
    localStorage.removeItem('user')
    setUser(null)
    setOpenBoard(null)
    setOpenFolder(null)
    setEditing(false)
    setAdminPw(null)
    setShowPending(false)
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
      await createFolder(user.token, name, isPrivate)
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

  async function handleSetStatus(id, status) {
    const checkedBy = status ? user?.name || '' : ''
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status, checked_by: checkedBy } : it)),
    )
    try {
      await setItemStatus(id, status, checkedBy)
    } catch (e) {
      setError(e.message)
    }
  }
  async function handleSetNote(id, note) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, note } : it)))
    try {
      await setItemNote(id, note)
    } catch (e) {
      setError(e.message)
    }
  }
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
          <h1>체크리스트</h1>
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>체크리스트</h1>
        {user && (
          <>
            <div className="user-bar">
              <span className="user-name">
                {user.name}님{user.is_site_admin ? ' (사이트 관리자)' : ''}
              </span>
              <button className="btn btn-small" onClick={() => setShowGuide(true)}>사용 가이드</button>
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
          folderId={openFolder?.id || ''}
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
        />
      )}

      {/* 폴더 안: 그 폴더의 게시글 목록 */}
      {!loading && !editing && !showPending && !openBoard && openFolder && (
        <>
          <div className="list-head">
            <button className="back-btn" onClick={() => setOpenFolder(null)}>← 폴더</button>
            <span className="folder-title">
              {openFolder.is_private ? '🔒 ' : '📁 '}
              {openFolder.name}
            </span>
            <button className="btn btn-primary" onClick={openNew}>+ 새 게시글</button>
          </div>
          <BoardList
            boards={boards.filter((b) => b.folder_id === openFolder.id)}
            onOpen={tryOpen}
            siteAdmin={Boolean(user.is_site_admin)}
            onDelete={(b) => setConfirmDeleteBoard(b)}
          />
        </>
      )}

      {/* 최상위: 폴더 목록 */}
      {!loading && !editing && !showPending && !openBoard && !openFolder && (
        <>
          {user.is_site_admin && (
            <div className="list-head">
              <button className="btn" onClick={() => setShowPending(true)}>계정 관리</button>
            </div>
          )}
          <FolderList
            folders={folders.filter((f) => !f.is_private || f.owner === user.name)}
            onOpen={(f) => setOpenFolder(f)}
            onNew={doCreateFolder}
            onDelete={(f) => setConfirmDeleteFolder(f)}
            canDelete={(f) => (f.is_private ? f.owner === user.name : Boolean(user.is_site_admin))}
          />
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
