// App.jsx = 화면 전환의 '교통정리' 파일(오케스트레이터).
//   로그인 → 폴더 목록 → (폴더 안) 게시글 목록 → 게시글(체크리스트) → 편집
//   데이터·라우팅·조율만 담당하고, 화면 조각은 components/*, 항목/잠금 로직은 hooks/*.
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
  verifyBoardEntry,
  siteDeleteBoard,
  getFolders,
  createFolder,
  deleteFolder,
} from './lib/api'
import { useBoardItems } from './hooks/useBoardItems'
import { useNoteLocks } from './hooks/useNoteLocks'
import AppHeader from './components/AppHeader'
import FolderView from './components/FolderView'
import Checklist from './components/Checklist'
import AdminEditor from './components/AdminEditor'
import ConfirmModal from './components/ConfirmModal'
import Login from './components/Login'
import PasswordPrompt from './components/PasswordPrompt'
import PendingUsers from './components/PendingUsers'
import Guide from './components/Guide'
import ChangePassword from './components/ChangePassword'

function loadUser() {
  try {
    const u = JSON.parse(localStorage.getItem('user'))
    return u && u.name && u.token ? u : null // 토큰 없으면(구버전) 재로그인
  } catch {
    return null
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

function App() {
  const [user, setUser] = useState(loadUser)
  const [boards, setBoards] = useState([])
  const [folders, setFolders] = useState([])
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null)
  const [verifiedBoards, setVerifiedBoards] = useState(() => new Set()) // 입장 비번 통과한 게시글 id
  const [admin, setAdmin] = useState(null) // { boardId, pw } 관리자 모드(그 게시글에서만 유효)
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [adminPrompt, setAdminPrompt] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(null)
  const [showPending, setShowPending] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')

  const location = useLocation()
  const navigate = useNavigate()
  const { folderId: routeFolderId, boardId: routeBoardId } = parseRoute(location.pathname)

  const configError = supabase ? '' : 'Supabase 연결 정보가 없습니다 (.env.local 확인).'

  // ── 현재 위치는 URL에서 '파생'(별도 state로 들고 동기화하지 않음) ──
  // 폴더 경로(브레드크럼): URL folderId에서 parent_id를 타고 올라가 재구성
  const folderPath = buildFolderPath(folders, routeFolderId)
  const currentFolder = folderPath.length ? folderPath[folderPath.length - 1] : null
  const currentBoards = boards.filter((b) => (b.folder_id || null) === (currentFolder?.id || null))

  // 열린 게시글: URL boardId로 결정. 입장 비번 게시글은 통과 전엔 잠금(openBoard=null)
  const targetBoard = routeBoardId ? boards.find((b) => String(b.id) === routeBoardId) || null : null
  const needsEntry = Boolean(
    targetBoard && targetBoard.has_entry_password && !verifiedBoards.has(String(targetBoard.id)),
  )
  const openBoard = targetBoard && !needsEntry ? targetBoard : null
  const openBoardId = openBoard ? openBoard.id : null
  const adminPw = admin && openBoard && admin.boardId === openBoard.id ? admin.pw : null

  const logout = useCallback(() => {
    localStorage.removeItem('user')
    setUser(null)
    setEditing(false)
    setAdmin(null)
    setShowPending(false)
    setShowChangePw(false)
    navigate('/') // openBoard/folderPath는 URL에서 파생되므로 자동 정리
  }, [navigate])

  // 열린 게시글의 항목(로드·실시간·체크/비고·저장실패) + 비고 잠금은 훅으로 분리
  const { items, setItems, boardReady, saveErrors, handleSetStatus, handleSetNote, retrySave } =
    useBoardItems(openBoardId, user, logout, setError)
  const { noteLocks, sendNoteLock } = useNoteLocks(openBoardId, user?.name)

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

  // 없는/삭제된 게시글 URL로 들어오면 홈으로 (로드 끝난 뒤 판단)
  useEffect(() => {
    if (loading || !routeBoardId) return
    if (!boards.some((b) => String(b.id) === routeBoardId)) {
      navigate('/', { replace: true })
    }
  }, [loading, routeBoardId, boards, navigate])

  // 실시간: 게시글 목록/메모 변경 (openBoard는 boards에서 파생되므로 자동 갱신)
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

  function handleLogin(u) {
    const value = { name: u.name, is_site_admin: u.is_site_admin, token: u.token }
    localStorage.setItem('user', JSON.stringify(value))
    setUser(value)
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

  // 게시글 열기 → URL로 이동. 로드/입장 비번 게이트는 위 파생값·훅이 처리
  function tryOpen(board) {
    navigate('/board/' + board.id)
  }
  // 입장 비번 통과 → 통과 목록에 추가하면 openBoard가 파생되어 열림
  async function submitEntry(pw) {
    if (!targetBoard) return '게시글을 찾을 수 없습니다.'
    try {
      const res = await verifyBoardEntry(targetBoard.id, pw)
      if (!res.ok) return res.error || '실패'
      setVerifiedBoards((prev) => new Set(prev).add(String(targetBoard.id)))
      return null
    } catch (e) {
      return e.message
    }
  }

  function goBack() {
    // 원래 있던 폴더로. openBoard는 URL에서 파생되므로 navigate만 하면 정리됨
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
    setEditing(true)
  }
  function openEdit() {
    setEditTarget(openBoard)
    setEditing(true)
  }
  async function handleSaved() {
    setEditing(false)
    try {
      setBoards(await getBoards()) // openBoard는 boards에서 파생되어 자동 갱신
      if (openBoardId) setItems(await getBoardItems(openBoardId)) // 편집된 항목 다시 로드
    } catch (e) {
      setError(e.message)
    }
  }
  async function handleDeleted() {
    const folderId = openBoard?.folder_id // 정리 전에 폴더 기억
    setEditing(false)
    navigate(folderUrl(folderId)) // openBoard는 URL에서 파생되므로 자동 정리
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
        <AppHeader />
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
      <AppHeader
        user={user}
        onShowGuide={() => setShowGuide(true)}
        onShowChangePw={() => setShowChangePw(true)}
        onLogout={logout}
      />

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

      {/* 게시글 진입했지만 항목 로드 전 */}
      {!loading && !editing && !showPending && openBoard && !boardReady && (
        <p className="muted">불러오는 중…</p>
      )}

      {!loading && !editing && !showPending && boardReady && (
        <Checklist
          board={openBoard}
          items={items}
          adminMode={Boolean(adminPw)}
          onBack={goBack}
          onEnterAdmin={() => setAdminPrompt(true)}
          onExitAdmin={() => setAdmin(null)}
          onEdit={openEdit}
          onReset={() => setConfirmReset(true)}
          onSetStatus={handleSetStatus}
          onSetNote={handleSetNote}
          noteLocks={noteLocks}
          myName={user.name}
          onNoteLock={sendNoteLock}
          saveErrors={saveErrors}
          onRetry={retrySave}
          token={user.token}
        />
      )}

      {/* 폴더/게시글 목록 화면 (게시글을 보고 있지 않을 때만) */}
      {!loading && !editing && !showPending && !routeBoardId && (
        <FolderView
          user={user}
          folders={folders}
          boards={boards}
          folderPath={folderPath}
          currentFolder={currentFolder}
          currentBoards={currentBoards}
          onGoHome={() => navigate('/')}
          onGoFolder={(folderId) => navigate(folderUrl(folderId))}
          onNewFolder={doCreateFolder}
          onDeleteFolder={(f) => setConfirmDeleteFolder(f)}
          onShowPending={() => setShowPending(true)}
          onNewBoard={openNew}
          onOpenBoard={tryOpen}
          onDeleteBoard={(b) => setConfirmDeleteBoard(b)}
        />
      )}

      {needsEntry && targetBoard && (
        <PasswordPrompt
          title={`'${targetBoard.title}' 입장 비밀번호`}
          onSubmit={submitEntry}
          onCancel={() => navigate(folderUrl(targetBoard.folder_id))}
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
