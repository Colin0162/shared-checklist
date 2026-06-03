import Item from './Item'

// 평평한 items 배열을 group_name 기준으로 묶는다.
function groupItems(items) {
  const groups = []
  const indexByName = new Map()
  for (const it of items) {
    const key = it.group_name || ''
    if (!indexByName.has(key)) {
      indexByName.set(key, groups.length)
      groups.push({ name: key, items: [] })
    }
    groups[indexByName.get(key)].items.push(it)
  }
  return groups
}

// 한 게시글의 체크리스트 화면.
// props: board, items, onBack, onEdit, onReset, onSetStatus, onSetNote
function Checklist({ board, items, onBack, onEdit, onReset, onSetStatus, onSetNote }) {
  const total = items.length
  const done = items.filter((it) =>
    board.mode === 'check' ? it.status === 'done' : Boolean(it.status),
  ).length
  const doneLabel = board.mode === 'check' ? '완료' : '평가함'
  const percent = total ? Math.round((done / total) * 100) : 0
  const groups = groupItems(items)

  return (
    <section className="checklist">
      <div className="checklist-head">
        <button className="back-btn" onClick={onBack}>← 목록</button>
        <h2 className="board-heading">{board.title}</h2>
        <div className="head-actions">
          <button className="btn" onClick={onEdit}>편집</button>
          <button className="btn" onClick={onReset}>초기화</button>
        </div>
      </div>

      <div className="progress">
        <span className="progress-text">
          {doneLabel} {done} / {total}
        </span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {groups.map((group) => (
        <div className="group" key={group.name || '_'}>
          {group.name && <h3 className="group-title">{group.name}</h3>}
          <ul className="item-list">
            {group.items.map((item) => (
              <Item
                key={item.id}
                item={item}
                mode={board.mode}
                showQuantity={board.show_quantity}
                showNote={board.show_note}
                onSetStatus={onSetStatus}
                onSetNote={onSetNote}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default Checklist
