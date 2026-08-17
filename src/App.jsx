// App.jsx = 화면 전환의 '교통정리' 파일(오케스트레이터).
//   이름 입력 → 폴더 목록 → (폴더 안) 게시글 목록 → 게시글(체크리스트) → 편집
//   로그인 없음: 이름만 기기에 저장해 '체크한 사람'에 쓰고, 폴더·게시글은 누구나 볼 수 있다.
//   게시글을 고치거나 지울 때만 '관리자 비밀번호'를 확인한다.
//   무엇을 바꾸면 어디가 바뀌는지는 → 프로젝트 루트의 EDITING_GUIDE.md 참고.
import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { supabase } from './lib/supabase'
import {
  getBoards,
  getBoardItems,
  resetBoard,
  verifyBoardAdmin,
  deleteBoard,
  getFolders,
  createFolder,
  deleteFolder,
  moveBoard,
  moveFolder,
  logClientError,
} from './lib/api'
import { useBoardItems } from './hooks/useBoardItems'
import { useNoteLocks } from './hooks/useNoteLocks'
import AppHeader from './components/AppHeader'
import FolderView from './components/FolderView'
import Checklist from './components/Checklist'
import AdminEditor from './components/AdminEditor'
import ConfirmModal from './components/ConfirmModal'
import NamePrompt from './components/NamePrompt'
import PasswordPrompt from './components/PasswordPrompt'
import MoveModal from './components/MoveModal'
import Guide from './components/Guide'

function loadName() {
  try {
    return localStorage.getItem('name') || ''
  } catch {
    return ''
  }
}

// URL 경로 파싱: '/', '/folder/:id', '/board/:id' → { folderId, boardId }
function parseRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'folder' && parts[1]) return { folderId: parts[1], boardId: null }
  if (parts[0] === 'board' && parts[1]) return { folderId: null, boardId: parts[1] }
  return { folderId: null, boardId: null }
}

// folderId에서 parent_id를 타고 올라가 브레드크럼 경로(루트→현재) 재구성
function buildFolderPath(folders, folderId) {
  if (!folderId) return []
  const byId = new Map(folders.map((f) => [String(f.id), f]))
  const path = []
  const seen = new Set() // 순환 방지
  let cur = byId.get(String(folderId))
  while (cur && !seen.has(String(cur.id))) {
    seen.add(String(cur.id))
    path.unshift(cur)
    cur = cur.parent_id ? byId.get(String(cur.parent_id)) : null
  }
  return path
}

// 폴더로 가는 URL (루트면 '/')
function folderUrl(folderId) {
  return folderId ? '/folder/' + folderId : '/'
}

// 그 폴더의 최상위 조상 id (이동을 같은 최상위 폴더 안으로 제한할 때 사용)
function rootIdOf(folders, folderId) {
  const byId = new Map(folders.map((f) => [String(f.id), f]))
  let cur = folderId ? byId.get(String(folderId)) : null
  const seen = new Set()
  while (cur && cur.parent_id && byId.has(String(cur.parent_id)) && !seen.has(String(cur.id))) {
    seen.add(String(cur.id))
    cur = byId.get(String(cur.parent_id))
  }
  return cur ? cur.id : null
}

function App() {
  const [name, setName] = useState(loadName)
  const [boards, setBoards] = useState([])
  const [folders, setFolders] = useState([])
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null)
  const [moveBoardTarget, setMoveBoardTarget] = useState(null)
  const [moveFolderTarget, setMoveFolderTarget] = useState(null)
  const [admin, setAdmin] = useState(null) // { boardId, pw } 관리자 모드(그 게시글에서만 유효)
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editFolderId, setEditFolderId] = useState('') // 편집 시작 시 폴더 기억(주소 바뀌어도 고정)
  const [adminPrompt, setAdminPrompt] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDeleteOwnBoard, setConfirmDeleteOwnBoard] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showName, setShowName] = useState(false) // 이름 바꾸기
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  const location = useLocation()
  const navigate = useNavigate()
  const { folderId: routeFolderId, boardId: routeBoardId } = parseRoute(location.pathname)

  const configError = supabase ? '' : 'Supabase 연결 정보가 없습니다 (.env.local 확인).'

  // ── 현재 위치는 URL에서 '파생'(별도 state로 들고 동기화하지 않음) ──
  const folderPath = buildFolderPath(folders, routeFolderId)
  const currentFolder = folderPath.length ? folderPath[folderPath.length - 1] : null
  const currentBoards = boards.filter((b) => (b.folder_id || null) === (currentFolder?.id || null))

  // 열린 게시글: URL boardId로 결정 (입장 비번 없음 — 링크만 있으면 열림)
  const openBoard = routeBoardId ? boards.find((b) => String(b.id) === routeBoardId) || null : null
  const openBoardId = openBoard ? openBoard.id : null
  const adminPw = admin && openBoard && admin.boardId === openBoard.id ? admin.pw : null

  // 에러를 화면에 표시 + 서버에 기록. 기록은 베스트에포트
  const reportError = useCallback((msg) => {
    setError(msg)
    logClientError(msg)
  }, [])

  // 열린 게시글의 항목(로드·실시간·체크/비고·저장실패) + 비고 잠금은 훅으로 분리
  const { items, setItems, boardReady, saveErrors, handleSetStatus, handleSetNote, retrySave } =
    useBoardItems(openBoardId, name, reportError)
  const { noteLocks, sendNoteLock } = useNoteLocks(openBoardId, name)

  // 편집/작성 중 브라우저 '뒤로가기' → 그 화면에서 나감(편집 닫기)
  useEffect(() => {
    if (!editing) return
    const onPop = () => setEditing(false)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [editing])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    Promise.all([getBoards(), getFolders()])
      .then(([bs, fs]) => {
        if (!alive) return
        setBoards(bs)
        setFolders(fs)
      })
      .catch((e) => reportError(e.message))
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [reportError])

  // 없는/삭제된 게시글 URL로 들어오면 홈으로 (로드 끝난 뒤 판단)
  useEffect(() => {
    if (loading || !routeBoardId) return
    if (!boards.some((b) => String(b.id) === routeBoardId)) {
      navigate('/', { replace: true })
    }
  }, [loading, routeBoardId, boards, navigate])

  // 실시간: 게시글 목록/메모 변경
  useEffect(() => {
    if (!supabase) return
    const ch = supabase
      .channel('boards-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards' }, () => {
        getBoards()
          .then((bs) => setBoards(bs))
          .catch(() => {})
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  function saveName(n) {
    localStorage.setItem('name', n)
    setName(n)
    setShowName(false)
  }

  async function reloadBoards() {
    try {
      setBoards(await getBoards())
    } catch (e) {
      reportError(e.message)
    }
  }
  async function reloadFolders() {
    try {
      setFolders(await getFolders())
    } catch (e) {
      reportError(e.message)
    }
  }
  async function doCreateFolder(folderName) {
    try {
      await createFolder(folderName, currentFolder?.id || null)
      await reloadFolders()
    } catch (e) {
      reportError(e.message)
    }
  }
  async function doDeleteFolder() {
    try {
      await deleteFolder(confirmDeleteFolder.id)
      await reloadFolders()
    } catch (e) {
      reportError(e.message)
    } finally {
      setConfirmDeleteFolder(null)
    }
  }
  // 이동 (MoveModal: 성공 시 null, 실패 시 에러문자열)
  async function doMoveBoard(targetFolderId) {
    try {
      await moveBoard(moveBoardTarget.id, targetFolderId)
      await reloadBoards()
      setMoveBoardTarget(null)
      return null
    } catch (e) {
      return e.message
    }
  }
  async function doMoveFolder(targetParentId) {
    try {
      await moveFolder(moveFolderTarget.id, targetParentId)
      await reloadFolders()
      setMoveFolderTarget(null)
      return null
    } catch (e) {
      return e.message
    }
  }

  function tryOpen(board) {
    navigate('/board/' + board.id)
  }
  function goBack() {
    navigate(folderUrl(openBoard?.folder_id))
  }

  // 관리자 모드 진입 (해당 게시글에서만 유효 — admin.boardId로 묶음)
  async function submitAdmin(pw) {
    try {
      const res = await verifyBoardAdmin(openBoard.id, pw)
      if (!res.ok) return res.error || '실패'
      setAdmin({ boardId: openBoard.id, pw })
      setAdminPrompt(false)
      return null
    } catch (e) {
      return e.message
    }
  }

  function openNew() {
    setEditTarget(null)
    setEditFolderId(currentFolder?.id || '')
    setEditing(true)
  }
  function openEdit() {
    setEditTarget(openBoard)
    setEditFolderId(openBoard?.folder_id || '')
    setEditing(true)
  }
  async function handleSaved() {
    const target = editTarget
    setEditing(false)
    try {
      setBoards(await getBoards())
      if (target) {
        setItems(await getBoardItems(target.id))
        navigate('/board/' + target.id)
      } else {
        navigate(folderUrl(editFolderId))
      }
    } catch (e) {
      reportError(e.message)
    }
  }
  async function handleDeleted() {
    const folderId = openBoard?.folder_id
    setEditing(false)
    navigate(folderUrl(folderId))
    await reloadBoards()
  }
  async function doReset() {
    try {
      await resetBoard(openBoard.id, adminPw)
      setItems(await getBoardItems(openBoard.id))
    } catch (e) {
      reportError(e.message)
    } finally {
      setConfirmReset(false)
    }
  }
  // 관리자 모드에서 이 게시글 삭제 → 목록으로
  async function doDeleteOwnBoard() {
    const folderId = openBoard?.folder_id
    try {
      await deleteBoard(openBoard.id, adminPw)
      setConfirmDeleteOwnBoard(false)
      navigate(folderUrl(folderId))
      await reloadBoards()
    } catch (e) {
      reportError(e.message)
      setConfirmDeleteOwnBoard(false)
    }
  }

  const nextSortOrder = boards.reduce((max, b) => Math.max(max, b.sort_order ?? 0), 0) + 1

  // 이름이 없으면 이름부터 (로그인 대신)
  if (supabase && !name) {
    return (
      <div className="app">
        <AppHeader />
        <NamePrompt onDone={saveName} />
      </div>
    )
  }

  if (showGuide) {
    return (
      <div className="app">
        <Guide onBack={() => setShowGuide(false)} />
      </div>
    )
  }

  if (showName) {
    return (
      <div className="app">
        <AppHeader />
        <NamePrompt initial={name} onDone={saveName} onCancel={() => setShowName(false)} />
      </div>
    )
  }

  return (
    <div className="app">
      <AppHeader
        name={name}
        onShowGuide={() => setShowGuide(true)}
        onChangeName={() => setShowName(true)}
      />

      {(configError || error) && <p className="error">오류: {configError || error}</p>}
      {loading && <p className="muted">불러오는 중…</p>}

      {!loading && editing && (
        <AdminEditor
          author={name}
          adminPw={adminPw}
          folderId={editFolderId}
          board={editTarget}
          originalItems={editTarget ? items : []}
          nextSortOrder={nextSortOrder}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
          onDeleted={handleDeleted}
        />
      )}

      {/* 게시글 진입했지만 항목 로드 전 */}
      {!loading && !editing && openBoard && !boardReady && <p className="muted">불러오는 중…</p>}

      {!loading && !editing && boardReady && (
        <Checklist
          board={openBoard}
          items={items}
          adminMode={Boolean(adminPw)}
          onBack={goBack}
          onEnterAdmin={() => setAdminPrompt(true)}
          onExitAdmin={() => setAdmin(null)}
          onEdit={openEdit}
          onReset={() => setConfirmReset(true)}
          onDeleteBoard={() => setConfirmDeleteOwnBoard(true)}
          onSetStatus={handleSetStatus}
          onSetNote={handleSetNote}
          noteLocks={noteLocks}
          myName={name}
          onNoteLock={sendNoteLock}
          saveErrors={saveErrors}
          onRetry={retrySave}
        />
      )}

      {/* 폴더/게시글 목록 화면 (게시글을 보고 있지 않을 때만) */}
      {!loading && !editing && !routeBoardId && (
        <FolderView
          folders={folders}
          boards={boards}
          folderPath={folderPath}
          currentFolder={currentFolder}
          currentBoards={currentBoards}
          onGoHome={() => navigate('/')}
          onGoFolder={(folderId) => navigate(folderUrl(folderId))}
          onNewFolder={doCreateFolder}
          onMoveFolder={(f) => setMoveFolderTarget(f)}
          onMoveBoard={(b) => setMoveBoardTarget(b)}
          onDeleteFolder={(f) => setConfirmDeleteFolder(f)}
          onNewBoard={openNew}
          onOpenBoard={tryOpen}
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
      {confirmDeleteOwnBoard && openBoard && (
        <ConfirmModal
          message={`'${openBoard.title}' 게시글을 삭제할까요? 항목과 체크 기록이 모두 사라집니다.`}
          confirmLabel="삭제"
          onConfirm={doDeleteOwnBoard}
          onCancel={() => setConfirmDeleteOwnBoard(false)}
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
      {moveBoardTarget && (
        <MoveModal
          title={`'${moveBoardTarget.title}'을(를) 어디로 옮길까요?`}
          folders={folders}
          kind="board"
          rootId={rootIdOf(folders, moveBoardTarget.folder_id)}
          onMove={doMoveBoard}
          onCancel={() => setMoveBoardTarget(null)}
        />
      )}
      {moveFolderTarget && (
        <MoveModal
          title={`'${moveFolderTarget.name}' 폴더를 어디로 옮길까요?`}
          folders={folders}
          kind="folder"
          excludeId={moveFolderTarget.id}
          rootId={rootIdOf(folders, moveFolderTarget.id)}
          onMove={doMoveFolder}
          onCancel={() => setMoveFolderTarget(null)}
        />
      )}
    </div>
  )
}

export default App
