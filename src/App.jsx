import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import { getBoards, getBoardItems, setItemStatus, setItemNote, resetBoard } from './lib/api'
import BoardList from './components/BoardList'
import Checklist from './components/Checklist'
import AdminEditor from './components/AdminEditor'
import ConfirmModal from './components/ConfirmModal'

function App() {
  const [boards, setBoards] = useState([])
  const [openBoard, setOpenBoard] = useState(null) // 보고 있는 게시글
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(false) // 편집기 열림 여부
  const [editTarget, setEditTarget] = useState(null) // 편집 대상(없으면 새 글)
  const [confirmReset, setConfirmReset] = useState(false)
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

  // 협업 상태: 화면 먼저 갱신(낙관적) 후 DB 저장
  async function handleSetStatus(id, status) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)))
    try {
      await setItemStatus(id, status)
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

  // 편집기 열기/닫기
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
        // 편집으로 바뀐 게시글 객체(카테고리 등)도 최신으로 교체
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

  // 전체 초기화
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

  const nextSortOrder =
    boards.reduce((max, b) => Math.max(max, b.sort_order ?? 0), 0) + 1

  return (
    <div className="app">
      <header className="app-header">
        <h1>체크리스트</h1>
      </header>

      {(configError || error) && (
        <p className="error">오류: {configError || error}</p>
      )}
      {loading && <p className="muted">불러오는 중…</p>}

      {/* 편집기 */}
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

      {/* 게시글 화면 */}
      {!loading && !editing && openBoard && (
        <Checklist
          board={openBoard}
          items={items}
          onBack={goBack}
          onEdit={openEdit}
          onReset={() => setConfirmReset(true)}
          onSetStatus={handleSetStatus}
          onSetNote={handleSetNote}
        />
      )}

      {/* 게시글 목록 */}
      {!loading && !editing && !openBoard && (
        <>
          <div className="list-head">
            <button className="btn btn-primary" onClick={openNew}>+ 새 게시글</button>
          </div>
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
