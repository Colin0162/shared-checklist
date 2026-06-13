import FolderList from './FolderList'
import BoardList from './BoardList'

// 폴더/게시글 목록 화면: 브레드크럼 + (홈에서만)계정관리 + 하위 폴더 + 게시글.
//   현재 위치(folderPath/currentFolder)는 App이 URL에서 파생해 내려준다.
// props: user, folders, boards, folderPath, currentFolder, currentBoards,
//        onGoHome, onGoFolder(folderId), onNewFolder, onDeleteFolder(f),
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
  onDeleteFolder,
  onShowPending,
  onNewBoard,
  onOpenBoard,
  onDeleteBoard,
}) {
  return (
    <>
      {/* 경로(브레드크럼) — 조각을 누르면 그 폴더로 이동 */}
      <nav className="crumbs">
        <button className="crumb" onClick={onGoHome}>🏠 홈</button>
        {folderPath.map((f) => (
          <span className="crumb-wrap" key={f.id}>
            <span className="crumb-sep">›</span>
            <button className="crumb" onClick={() => onGoFolder(f.id)}>
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      {user.is_site_admin && !currentFolder && (
        <div className="list-head">
          <button className="btn" onClick={onShowPending}>계정 관리</button>
        </div>
      )}

      {/* 하위 폴더 */}
      <FolderList
        folders={folders.filter(
          (f) =>
            (f.parent_id || null) === (currentFolder?.id || null) &&
            (!f.is_private || f.owner === user.name),
        )}
        onOpen={(f) => onGoFolder(f.id)}
        onNew={onNewFolder}
        onDelete={onDeleteFolder}
        canDelete={(f) =>
          (f.owner === user.name || Boolean(user.is_site_admin)) &&
          !folders.some((c) => c.parent_id === f.id) &&
          !boards.some((b) => b.folder_id === f.id)
        }
      />

      {/* 게시글: 홈(루트)에선 못 만들고 폴더만. 폴더 안에서만 새 게시글 */}
      {currentFolder ? (
        <>
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
      ) : (
        // 홈: 폴더만. 혹시 옛 루트 게시글이 있으면 그것만 보여줌(새 생성 버튼은 없음)
        currentBoards.length > 0 && (
          <BoardList
            boards={currentBoards}
            onOpen={onOpenBoard}
            siteAdmin={Boolean(user.is_site_admin)}
            onDelete={onDeleteBoard}
          />
        )
      )}
    </>
  )
}

export default FolderView
