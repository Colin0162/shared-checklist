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
  shareFolder,
  joinFolder,
  leaveFolder,
  moveBoard,
  moveFolder,
  logClientError,
} from './lib/api'
import { useBoardItems } from './hooks/useBoardItems'
import { useNoteLocks } from './hooks/useNoteLocks'
import { useFolderChat } from './hooks/useFolderChat'
import AppHeader from './components/AppHeader'
import FolderView from './components/FolderView'
import Checklist from './components/Checklist'
import AdminEditor from './components/AdminEditor'
import ConfirmModal from './components/ConfirmModal'
import Login from './components/Login'
import PasswordPrompt from './components/PasswordPrompt'
import PendingUsers from './components/PendingUsers'
import FolderPanel from './components/FolderPanel'
import MoveModal from './components/MoveModal'
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
  const [shareTarget, setShareTarget] = useState(null) // 공유 전환/암호변경 대상 폴더
  const [showJoin, setShowJoin] = useState(false) // 공유 폴더 참여(암호 입력) 모달
  const [confirmLeaveFolder, setConfirmLeaveFolder] = useState(null) // 나가기 재확인 대상 폴더
  const [chatOpenFor, setChatOpenFor] = useState(null) // 채팅 패널이 열린 폴더 id
  const [moveBoardTarget, setMoveBoardTarget] = useState(null) // 이동할 게시글
  const [moveFolderTarget, setMoveFolderTarget] = useState(null) // 이동할 폴더
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

  // 에러를 화면에 표시 + 서버에 기록(운영자가 '계정 관리'에서 봄). 기록은 베스트에포트
  const reportError = useCallback((msg) => {
    setError(msg)
    logClientError(msg)
  }, [])

  // 열린 게시글의 항목(로드·실시간·체크/비고·저장실패) + 비고 잠금은 훅으로 분리
  const { items, setItems, boardReady, saveErrors, handleSetStatus, handleSetNote, retrySave } =
    useBoardItems(openBoardId, user, logout, reportError)
  const { noteLocks, sendNoteLock } = useNoteLocks(openBoardId, user?.name)

  // 공유 폴더 채팅: 폴더 화면이든 '그 폴더의 게시글을 보는 중'이든 같은 폴더면 유지
  //   (게시글 들어갔다 나와도 folderId가 같아 메시지를 다시 비우지 않음)
  const contextFolder = openBoard
    ? folders.find((f) => f.id === openBoard.folder_id) || null
    : currentFolder
  const chatFolder = contextFolder && contextFolder.visibility === 'shared' ? contextFolder : null
  const chat = useFolderChat(chatFolder?.id, user?.token, Boolean(chatFolder))
  const chatOpen = Boolean(chatFolder && chatOpenFor === chatFolder.id)

  // 보이는 폴더/게시글은 토큰에 따라 달라지므로 로그인(토큰 변경) 때 다시 로드
  useEffect(() => {
    if (!supabase) return
    let alive = true
    Promise.all([getBoards(user?.token), getFolders(user?.token)])
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
  }, [user?.token, reportError])

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
        getBoards(user?.token)
          .then((bs) => setBoards(bs))
          .catch(() => {})
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [user?.token])

  function handleLogin(u) {
    const value = { name: u.name, is_site_admin: u.is_site_admin, token: u.token }
    localStorage.setItem('user', JSON.stringify(value))
    setUser(value)
  }

  async function reloadBoards() {
    try {
      setBoards(await getBoards(user.token))
    } catch (e) {
      reportError(e.message)
    }
  }
  async function reloadFolders() {
    try {
      setFolders(await getFolders(user.token))
    } catch (e) {
      reportError(e.message)
    }
  }
  // 새 폴더는 무조건 개인(나만 보기). 공유는 만든 뒤 '공유' 버튼으로.
  async function doCreateFolder(name) {
    try {
      await createFolder(user.token, name, currentFolder?.id || null)
      await reloadFolders()
    } catch (e) {
      reportError(e.message)
    }
  }
  async function doDeleteFolder() {
    try {
      await deleteFolder(user.token, confirmDeleteFolder.id)
      await reloadFolders()
    } catch (e) {
      reportError(e.message)
    } finally {
      setConfirmDeleteFolder(null)
    }
  }
  // 폴더 가시성이 바뀌면(참여/나가기/공유 전환) 보이는 게시글도 달라지므로 둘 다 다시 로드
  async function reloadFoldersAndBoards() {
    await Promise.all([reloadFolders(), reloadBoards()])
  }
  // 공유 전환 / 암호 변경 (PasswordPrompt: 성공 시 null, 실패 시 에러문자열)
  async function doShareFolder(pw) {
    try {
      await shareFolder(user.token, shareTarget.id, pw)
      await reloadFoldersAndBoards()
      setShareTarget(null)
      return null
    } catch (e) {
      return e.message
    }
  }
  // 암호(키워드)로 공유 폴더 참여
  async function doJoinFolder(pw) {
    try {
      const res = await joinFolder(user.token, pw)
      if (!res.ok) return res.error || '참여하지 못했습니다.'
      await reloadFoldersAndBoards()
      setShowJoin(false)
      return null
    } catch (e) {
      return e.message
    }
  }
  // 공유 폴더에서 나가기 (재확인 모달의 확인을 거쳐 실행)
  async function doLeaveFolder() {
    try {
      await leaveFolder(user.token, confirmLeaveFolder.id)
      await reloadFoldersAndBoards()
      navigate('/') // 나간 폴더 안에 있으면 안 되므로 홈으로
    } catch (e) {
      reportError(e.message)
    } finally {
      setConfirmLeaveFolder(null)
    }
  }
  // 이동 (MoveModal: 성공 시 null, 실패 시 에러문자열)
  async function doMoveBoard(targetFolderId) {
    try {
      await moveBoard(user.token, moveBoardTarget.id, targetFolderId)
      await reloadBoards()
      setMoveBoardTarget(null)
      return null
    } catch (e) {
      return e.message
    }
  }
  async function doMoveFolder(targetParentId) {
    try {
      await moveFolder(user.token, moveFolderTarget.id, targetParentId)
      await reloadFolders()
      setMoveFolderTarget(null)
      return null
    } catch (e) {
      return e.message
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
      reportError(e.message)
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
      reportError(e.message)
    } finally {
      setConfirmReset(false)
    }
  }

  async function doDeleteBoardSite() {
    try {
      await siteDeleteBoard(user.token, confirmDeleteBoard.id)
      await reloadBoards()
    } catch (e) {
      reportError(e.message)
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
          onJoinFolder={() => setShowJoin(true)}
          onShareFolder={(f) => setShareTarget(f)}
          onMoveFolder={(f) => setMoveFolderTarget(f)}
          onMoveBoard={(b) => setMoveBoardTarget(b)}
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
      {shareTarget && (
        <PasswordPrompt
          title={
            shareTarget.visibility === 'shared'
              ? `'${shareTarget.name}' 공유 암호 변경`
              : `'${shareTarget.name}' 공유 — 암호(키워드) 설정`
          }
          onSubmit={doShareFolder}
          onCancel={() => setShareTarget(null)}
        />
      )}
      {showJoin && (
        <PasswordPrompt
          title="참여할 공유 폴더의 암호(키워드)"
          onSubmit={doJoinFolder}
          onCancel={() => setShowJoin(false)}
        />
      )}
      {confirmLeaveFolder && (
        <ConfirmModal
          message={`'${confirmLeaveFolder.name}' 폴더에서 나갈까요? 다시 들어오려면 암호가 필요합니다.`}
          confirmLabel="나가기"
          onConfirm={doLeaveFolder}
          onCancel={() => setConfirmLeaveFolder(null)}
        />
      )}
      {moveBoardTarget && (
        <MoveModal
          title={`'${moveBoardTarget.title}'을(를) 어디로 옮길까요?`}
          folders={folders}
          kind="board"
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
          onMove={doMoveFolder}
          onCancel={() => setMoveFolderTarget(null)}
        />
      )}

      {/* 공유 폴더 채팅: 아이콘(💬) → 누르면 패널(데스크톱 왼쪽 / 모바일 드로어) */}
      {chatFolder && !editing && !chatOpen && (
        <button
          className="chat-fab"
          onClick={() => {
            setChatOpenFor(chatFolder.id)
            chat.markRead()
          }}
          title="참여자 · 채팅"
        >
          💬{chat.unread && <span className="chat-fab-badge" />}
        </button>
      )}
      {chatFolder && !editing && chatOpen && (
        <FolderPanel
          token={user.token}
          folder={chatFolder}
          myName={user.name}
          isAdmin={chatFolder.my_role === 'admin'}
          messages={chat.messages}
          chatError={chat.chatError}
          onSend={chat.send}
          onRemove={chat.remove}
          onLeave={(f) => setConfirmLeaveFolder(f)}
          onShare={(f) => setShareTarget(f)}
          onMembersChanged={reloadFolders}
          onClose={() => setChatOpenFor(null)}
        />
      )}
    </div>
  )
}

export default App
