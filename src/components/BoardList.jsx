import { ddayLabel } from '../lib/constants'

// 게시글 목록. 카드를 누르면 그 게시글을 연다.
// props: boards, onOpen, siteAdmin, onDelete
function BoardList({ boards, onOpen, siteAdmin, onDelete }) {
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
          {siteAdmin && (
            <button className="btn btn-danger btn-small board-del" onClick={() => onDelete(b)}>
              삭제
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export default BoardList
