import { useState } from 'react'
import FolderList from './FolderList'
import BoardList from './BoardList'

// 폴더/게시글 목록 화면. 로그인이 없으므로 모든 폴더가 누구에게나 보인다.
// props: folders, boards, folderPath, currentFolder, currentBoards,
//        onGoHome, onGoFolder(id), onNewFolder(name), onMoveFolder(f), onMoveBoard(b),
//        onDeleteFolder(f), onNewBoard, onOpenBoard(b)
function FolderView({
  folders,
  boards,
  folderPath,
  currentFolder,
  currentBoards,
  onGoHome,
  onGoFolder,
  onNewFolder,
  onMoveFolder,
  onMoveBoard,
  onDeleteFolder,
  onNewBoard,
  onOpenBoard,
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const children = folders.filter((f) => (f.parent_id || null) === (currentFolder?.id || null))
  const hasChildren = (id) => folders.some((c) => c.parent_id === id)
  const hasBoards = (id) => boards.some((b) => b.folder_id === id)
  // 삭제는 '비어 있는 폴더'만 (안에 든 게 있으면 실수 방지)
  const canDelete = (f) => !hasChildren(f.id) && !hasBoards(f.id)

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

      <div className="folder-bar">
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>+ 새 폴더</button>
      </div>
      {adding && (
        <div className="folder-new">
          <input
            className="text-input"
            placeholder="폴더 이름"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNew()}
          />
          <button className="btn btn-primary" onClick={submitNew}>만들기</button>
        </div>
      )}

      <FolderList
        folders={children}
        onOpen={(f) => onGoFolder(f.id)}
        onMove={onMoveFolder}
        onDelete={onDeleteFolder}
        canDelete={canDelete}
      />

      {/* 게시글은 폴더 안에서만 만든다 */}
      {currentFolder ? (
        <>
          <div className="list-head list-head-boards">
            <button className="btn btn-primary" onClick={onNewBoard}>+ 새 게시글</button>
          </div>
          <BoardList boards={currentBoards} onOpen={onOpenBoard} onMove={onMoveBoard} />
        </>
      ) : (
        // 홈: 폴더만. 혹시 옛 루트 게시글이 있으면 그것만 보여줌
        currentBoards.length > 0 && (
          <BoardList boards={currentBoards} onOpen={onOpenBoard} onMove={onMoveBoard} />
        )
      )}
    </>
  )
}

export default FolderView
