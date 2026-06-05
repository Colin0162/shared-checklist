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
} from './lib/api'
import BoardList from './components/BoardList'
import Checklist from './components/Checklist'
import AdminEditor from './components/AdminEditor'
import ConfirmModal from './components/ConfirmModal'
import Login from './components/Login'
import PasswordPrompt from './components/PasswordPrompt'
import Clock from './components/Clock'
import PendingUsers from './components/PendingUsers'

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
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  const configError = supabase ? '' : 'Supabase 연결 정보가 없습니다 (.env.local 확인).'

  useEffect(() => {
    if (!supabase) return
    getBoards()
      .then(setBoards)
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
          author={user.name}
          adminPw={adminPw}
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

      {!loading && !editing && !showPending && !openBoard && (
        <>
          <div className="list-head">
            <button className="btn btn-primary" onClick={openNew}>+ 새 게시글</button>
            {user.is_site_admin && (
              <button className="btn" onClick={() => setShowPending(true)}>가입 신청</button>
            )}
          </div>
          <BoardList
            boards={boards}
            onOpen={tryOpen}
            siteAdmin={Boolean(user.is_site_admin)}
            onDelete={(b) => setConfirmDeleteBoard(b)}
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
    </div>
  )
}

export default App
