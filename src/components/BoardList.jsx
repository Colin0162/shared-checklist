// 게시글 목록. 카드를 누르면 그 게시글을 연다.
// props: boards, onOpen
function BoardList({ boards, onOpen }) {
  if (boards.length === 0) {
    return <p className="muted">게시글이 없습니다.</p>
  }

  return (
    <ul className="board-list">
      {boards.map((b) => (
        <li key={b.id}>
          <button className="board-card" onClick={() => onOpen(b)}>
            <span className="board-title">
              {b.has_entry_password && <span className="lock" title="비밀번호 입장">🔒 </span>}
              {b.title}
            </span>
            <span className="board-meta">
              {b.mode === 'check' ? '체크리스트' : '평가 (상·중·하)'}
              {b.created_by && ` · 작성자 ${b.created_by}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default BoardList
