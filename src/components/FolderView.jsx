import { useState } from 'react'
import FolderList from './FolderList'
import BoardList from './BoardList'

// 폴더/게시글 목록 화면.
//   홈(최상위)에서는 폴더를 공유/개인/공개로 분류해 보여주고, '공유 폴더 참여' 입력을 제공.
//   폴더 안에서는 하위 폴더 + 게시글.
//   가시성 필터는 서버(RPC)가 끝냄 → folders/boards에는 '내가 볼 수 있는 것'만 들어온다.
// props: user, folders, boards, folderPath, currentFolder, currentBoards,
//        onGoHome, onGoFolder(id), onNewFolder(name), onJoinFolder, onShareFolder(f),
//        onShowMembers(f), onLeaveFolder(f), onDeleteFolder(f),
//        onShowPending, onNewBoard, onOpenBoard(b), onDeleteBoard(b)
function FolderView({
  user,
  folders,
  boards,
  folderPath,
  currentFolder,
  currentBoards,
  onGoHome,
  onGoFolder,
  onNewFolder,
  onJoinFolder,
  onShareFolder,
  onShowMembers,
  onLeaveFolder,
  onDeleteFolder,
  onShowPending,
  onNewBoard,
  onOpenBoard,
  onDeleteBoard,
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const atHome = !currentFolder
  const children = folders.filter((f) => (f.parent_id || null) === (currentFolder?.id || null))
  const shared = children.filter((f) => f.visibility === 'shared')
  const mine = children.filter((f) => f.visibility === 'private')
  const open = children.filter((f) => f.visibility === 'public')

  const hasChildren = (id) => folders.some((c) => c.parent_id === id)
  const hasBoards = (id) => boards.some((b) => b.folder_id === id)

  // 공유 버튼: 최상위 폴더만 / 내 개인 폴더이거나 내가 관리자인 공유 폴더
  const canShare = (f) =>
    !f.parent_id &&
    ((f.visibility === 'private' && f.owner === user.name) ||
      (f.visibility === 'shared' && f.my_role === 'admin'))
  // 삭제 버튼: 빈 폴더만 / 종류별 권한
  const canDelete = (f) => {
    if (hasChildren(f.id) || hasBoards(f.id)) return false
    if (f.visibility === 'public') return Boolean(user.is_site_admin)
    if (f.visibility === 'shared') return f.my_role === 'admin' || Boolean(user.is_site_admin)
    return f.owner === user.name || Boolean(user.is_site_admin)
  }

  const listProps = {
    onOpen: (f) => onGoFolder(f.id),
    onShare: onShareFolder,
    onMembers: onShowMembers,
    onLeave: onLeaveFolder,
    onDelete: onDeleteFolder,
    canShare,
    canDelete,
  }

  async function submitNew() {
    if (!name.trim()) return
    await onNewFolder(name.trim())
    setName('')
    setAdding(false)
  }

  return (
    <>
      {/* 경로(브레드크럼) */}
      <nav className="crumbs">
        <button className="crumb" onClick={onGoHome}>🏠 홈</button>
        {folderPath.map((f) => (
          <span className="crumb-wrap" key={f.id}>
            <span className="crumb-sep">›</span>
            <button className="crumb" onClick={() => onGoFolder(f.id)}>{f.name}</button>
          </span>
        ))}
      </nav>

      {user.is_site_admin && atHome && (
        <div className="list-head">
          <button className="btn" onClick={onShowPending}>계정 관리</button>
        </div>
      )}

      {/* 만들기 / (홈에서만) 참여 */}
      <div className="folder-bar">
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>+ 새 폴더</button>
        {atHome && (
          <button className="btn" onClick={onJoinFolder}>🔑 공유 폴더 참여</button>
        )}
      </div>
      {adding && (
        <div className="folder-new">
          <input
            className="text-input"
            placeholder="폴더 이름 (만들면 나만 볼 수 있어요)"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNew()}
          />
          <button className="btn btn-primary" onClick={submitNew}>만들기</button>
        </div>
      )}

      {atHome ? (
        <>
          {shared.length > 0 && (
            <>
              <h3 className="section-title">🤝 공유 폴더</h3>
              <FolderList folders={shared} {...listProps} />
            </>
          )}
          <h3 className="section-title">🔒 내 폴더</h3>
          {mine.length > 0 ? (
            <FolderList folders={mine} {...listProps} />
          ) : (
            <p className="muted">아직 만든 폴더가 없습니다. ‘+ 새 폴더’로 만들어 보세요.</p>
          )}
          {open.length > 0 && (
            <>
              <h3 className="section-title">📁 공개</h3>
              <FolderList folders={open} {...listProps} />
            </>
          )}
          {/* 혹시 남아있는 옛 루트 게시글 */}
          {currentBoards.length > 0 && (
            <BoardList
              boards={currentBoards}
              onOpen={onOpenBoard}
              siteAdmin={Boolean(user.is_site_admin)}
              onDelete={onDeleteBoard}
            />
          )}
        </>
      ) : (
        <>
          <FolderList folders={children} {...listProps} />
          <div className="list-head list-head-boards">
            <button className="btn btn-primary" onClick={onNewBoard}>+ 새 게시글</button>
          </div>
          <BoardList
            boards={currentBoards}
            onOpen={onOpenBoard}
            siteAdmin={Boolean(user.is_site_admin)}
            onDelete={onDeleteBoard}
          />
        </>
      )}
    </>
  )
}

export default FolderView
