import { ddayLabel } from '../lib/constants'

// 게시글 목록. 카드를 누르면 그 게시글을 연다(링크만 있으면 누구나 입장).
//   삭제는 게시글 안에서 '관리자 모드'로만 — 여기선 열기/이동만.
// props: boards, onOpen, onMove(b)
function BoardList({ boards, onOpen, onMove }) {
  if (boards.length === 0) {
    return <p className="muted">게시글이 없습니다.</p>
  }

  return (
    <ul className="board-list">
      {boards.map((b) => (
        <li key={b.id} className="board-row">
          <button className="board-card" onClick={() => onOpen(b)}>
            <span className="board-title">
              {b.has_entry_password && <span className="lock" title="비밀번호 입장">🔒 </span>}
              {b.title}
            </span>
            <span className="board-meta">
              {b.mode === 'check'
                ? '체크리스트'
                : b.mode === 'rate'
                  ? '평가 (상·중·하)'
                  : b.mode === 'table'
                    ? '표'
                    : '할 일 리스트'}
              {b.created_by && ` · 작성자 ${b.created_by}`}
              {b.event_date && <span className="dday"> {ddayLabel(b.event_date)}</span>}
            </span>
          </button>
          {onMove && (
            <div className="folder-actions">
              <button className="btn btn-small" onClick={() => onMove(b)}>이동</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

export default BoardList
