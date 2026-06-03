// 게시판 목록 (포럼 인덱스처럼). 카드를 누르면 그 게시판을 연다.
// props: boards(배열), onOpen(board => void)
function BoardList({ boards, onOpen }) {
  if (boards.length === 0) {
    return <p className="muted">게시판이 없습니다.</p>
  }

  return (
    <ul className="board-list">
      {boards.map((b) => (
        <li key={b.id}>
          <button className="board-card" onClick={() => onOpen(b)}>
            <span className="board-title">{b.title}</span>
            <span className="board-meta">
              {b.mode === 'check' ? '체크리스트' : '평가 (상·중·하)'}
            </span>
            {b.description && <span className="board-desc">{b.description}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

export default BoardList
