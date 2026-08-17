// 폴더 목록. 폴더는 모두 공개(누구나 보임) — 종류 구분 없음.
// props: folders, onOpen(f), onMove(f), onDelete(f), canDelete(f)
function FolderList({ folders, onOpen, onMove, onDelete, canDelete }) {
  if (!folders.length) return null
  return (
    <ul className="board-list">
      {folders.map((f) => (
        <li key={f.id} className="board-row">
          <button className="board-card" onClick={() => onOpen(f)}>
            <span className="board-title">📁 {f.name}</span>
          </button>
          <div className="folder-actions">
            <button className="btn btn-small" onClick={() => onMove(f)}>이동</button>
            {canDelete(f) && (
              <button className="btn btn-danger btn-small" onClick={() => onDelete(f)}>삭제</button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default FolderList
