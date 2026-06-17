import { displayName } from '../lib/constants'

// 폴더 한 종류(공유/개인/공개)의 목록만 렌더.
//   참여자·나가기는 '폴더 안'으로 옮겨서 여기엔 없음. 여기선 공유 전환·삭제만.
// props:
//   folders   : 이미 분류된 폴더 배열 (각 항목에 visibility, my_role, owner)
//   onOpen(f) / onShare(f) / onDelete(f)
//   canShare(f) / canDelete(f) : 그 버튼을 보일지
const VIS = {
  public: { icon: '📁', label: '공개' },
  private: { icon: '🔒', label: '개인' },
  shared: { icon: '🤝', label: '공유' },
}

function FolderList({ folders, onOpen, onShare, onDelete, canShare, canDelete }) {
  if (!folders.length) return null
  return (
    <ul className="board-list">
      {folders.map((f) => {
        const v = VIS[f.visibility] || VIS.private
        return (
          <li key={f.id} className="board-row">
            <button className="board-card" onClick={() => onOpen(f)}>
              <span className="board-title">
                {v.icon} {f.name}
              </span>
              <span className="board-meta">
                {v.label}
                {f.visibility === 'shared' && f.my_role === 'admin' && ' · 내가 관리자'}
                {f.visibility === 'private' && f.owner && ` · ${displayName(f.owner)}`}
              </span>
            </button>
            <div className="folder-actions">
              {canShare(f) && (
                <button className="btn btn-small" onClick={() => onShare(f)}>공유</button>
              )}
              {canDelete(f) && (
                <button className="btn btn-danger btn-small" onClick={() => onDelete(f)}>삭제</button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default FolderList
