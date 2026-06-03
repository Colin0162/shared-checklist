import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import { getBoards, getBoardItems, setItemStatus, setItemNote, resetBoard } from './lib/api'
import BoardList from './components/BoardList'
import Checklist from './components/Checklist'
import AdminEditor from './components/AdminEditor'
import ConfirmModal from './components/ConfirmModal'
import Login from './components/Login'

// 실시간 변경(payload)을 현재 items 목록에 반영
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
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

function App() {
  const [user, setUser] = useState(loadUser)
  const [boards, setBoards] = useState([])
  const [openBoard, setOpenBoard] = useState(null)
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  const configError = supabase ? '' : 'Supabase 연결 정보가 없습니다 (.env.local 확인).'
  const isAdmin = Boolean(user?.is_admin)

  useEffect(() => {
    if (!supabase) return
    getBoards()
      .then(setBoards)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // 실시간: 게시글 목록 변경 구독
  useEffect(() => {
    if (!supabase) return
    const ch = supabase
      .channel('boards-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => {
        getBoards().then(setBoards).catch(() => {})
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  // 실시간: 열려있는 게시글의 항목 변경 구독
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
    localStorage.setItem('user', JSON.stringify(u))
    setUser(u)
  }
  function logout() {
    localStorage.removeItem('user')
    setUser(null)
    setOpenBoard(null)
    setEditing(false)
  }

  async function reloadBoards() {
    try {
      setBoards(await getBoards())
    } catch (e) {
      setError(e.message)
    }
  }
  async function reloadItems(board) {
    try {
      setItems(await getBoardItems(board.id))
    } catch (e) {
      setError(e.message)
    }
  }

  async function openBoardById(board) {
    setLoading(true)
    setError('')
    try {
      setItems(await getBoardItems(board.id))
      setOpenBoard(board)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function goBack() {
    setOpenBoard(null)
    setItems([])
  }

  // 체크: 화면 먼저 갱신 후 DB 저장 (누가 체크했는지 이름 기록)
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
        if (updated) await reloadItems(updated)
      }
    } catch (e) {
      setError(e.message)
    }
  }
  async function handleDeleted() {
    setEditing(false)
    setOpenBoard(null)
    setItems([])
    await reloadBoards()
  }

  async function doReset() {
    try {
      await resetBoard(openBoard.id)
      await reloadItems(openBoard)
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmReset(false)
    }
  }

  const nextSortOrder = boards.reduce((max, b) => Math.max(max, b.sort_order ?? 0), 0) + 1

  // 로그인 전: 로그인 화면만
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
          <div className="user-bar">
            <span className="user-name">
              {user.name}님{isAdmin ? ' (관리자)' : ''}
            </span>
            <button className="btn btn-small" onClick={logout}>로그아웃</button>
          </div>
        )}
      </header>

      {(configError || error) && (
        <p className="error">오류: {configError || error}</p>
      )}
      {loading && <p className="muted">불러오는 중…</p>}

      {!loading && editing && (
        <AdminEditor
          board={editTarget}
          originalItems={editTarget ? items : []}
          nextSortOrder={nextSortOrder}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
          onDeleted={handleDeleted}
        />
      )}

      {!loading && !editing && openBoard && (
        <Checklist
          board={openBoard}
          items={items}
          isAdmin={isAdmin}
          onBack={goBack}
          onEdit={openEdit}
          onReset={() => setConfirmReset(true)}
          onSetStatus={handleSetStatus}
          onSetNote={handleSetNote}
        />
      )}

      {!loading && !editing && !openBoard && (
        <>
          {isAdmin && (
            <div className="list-head">
              <button className="btn btn-primary" onClick={openNew}>+ 새 게시글</button>
            </div>
          )}
          <BoardList boards={boards} onOpen={openBoardById} />
        </>
      )}

      {confirmReset && openBoard && (
        <ConfirmModal
          message={`'${openBoard.title}'의 체크를 모두 초기화할까요?`}
          confirmLabel="초기화"
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}

export default App
