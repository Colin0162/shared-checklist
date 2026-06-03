import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import { getBoards, getBoardItems, setItemStatus, setItemNote } from './lib/api'
import BoardList from './components/BoardList'
import Checklist from './components/Checklist'

function App() {
  const [boards, setBoards] = useState([])
  const [openBoard, setOpenBoard] = useState(null) // 선택된 게시판(없으면 목록 화면)
  const [items, setItems] = useState([])
  // supabase가 없으면 처음부터 로딩 아님(=설정 오류 메시지를 바로 보여줌)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  // supabase 미설정은 effect가 아니라 렌더 시점에 판단 (effect 안 동기 setState 회피)
  const configError = supabase ? '' : 'Supabase 연결 정보가 없습니다 (.env.local 확인).'

  // 처음 진입 시 게시판 목록 로드
  useEffect(() => {
    if (!supabase) return
    getBoards()
      .then(setBoards)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // 게시판 열기 → 항목 로드
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

  // 화면을 먼저 바꾸고(낙관적 업데이트) DB에 저장 → 반응이 빠르게 느껴진다
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>체크리스트</h1>
      </header>

      {(configError || error) && (
        <p className="error">오류: {configError || error}</p>
      )}
      {loading && <p className="muted">불러오는 중…</p>}

      {!loading && !openBoard && (
        <BoardList boards={boards} onOpen={openBoardById} />
      )}

      {!loading && openBoard && (
        <Checklist
          board={openBoard}
          items={items}
          onBack={goBack}
          onSetStatus={handleSetStatus}
          onSetNote={handleSetNote}
        />
      )}
    </div>
  )
}

export default App
