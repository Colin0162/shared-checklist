import { useState } from 'react'
import Item from './Item'

const isDone = (it, mode) => (mode === 'check' ? it.status === 'done' : Boolean(it.status))

// 항목을 group_name으로 묶되, board.categories 순서를 우선 적용. 나머지는 뒤에.
function groupItems(items, categoryOrder) {
  const map = new Map()
  for (const it of items) {
    const key = it.group_name || ''
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(it)
  }
  const ordered = []
  const seen = new Set()
  for (const name of categoryOrder || []) {
    if (map.has(name)) {
      ordered.push({ name, items: map.get(name) })
      seen.add(name)
    }
  }
  for (const [name, its] of map) {
    if (!seen.has(name)) ordered.push({ name, items: its })
  }
  return ordered
}

// 한 게시글의 체크리스트 화면.
// props: board, items, onBack, onEdit, onReset, onSetStatus, onSetNote
function Checklist({ board, items, onBack, onEdit, onReset, onSetStatus, onSetNote }) {
  const [unfinishedOnly, setUnfinishedOnly] = useState(false)
  const mode = board.mode

  const total = items.length
  const doneCount = items.filter((it) => isDone(it, mode)).length
  const percent = total ? Math.round((doneCount / total) * 100) : 0
  const doneLabel = mode === 'check' ? '완료' : '평가함'

  const groups = groupItems(items, board.categories)
  const visible = (it) => !unfinishedOnly || !isDone(it, mode)

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
          {doneLabel} {doneCount} / {total} ({percent}%)
        </span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="toolbar">
        <button
          className={'btn' + (unfinishedOnly ? ' btn-primary' : '')}
          onClick={() => setUnfinishedOnly((v) => !v)}
        >
          {unfinishedOnly ? '전체 보기' : '미완료만 보기'}
        </button>
      </div>

      {groups.map((group) => {
        const gTotal = group.items.length
        const gDone = group.items.filter((it) => isDone(it, mode)).length
        const shown = group.items.filter(visible)
        if (unfinishedOnly && shown.length === 0) return null
        return (
          <div className="group" key={group.name || '_'}>
            <div className="group-head">
              {group.name ? (
                <h3 className="group-title">{group.name}</h3>
              ) : (
                <h3 className="group-title group-title-muted">(대항목 없음)</h3>
              )}
              <span className="group-progress">
                {gDone}/{gTotal}
              </span>
            </div>
            <ul className="item-list">
              {shown.map((item) => (
                <Item
                  key={item.id}
                  item={item}
                  mode={mode}
                  onSetStatus={onSetStatus}
                  onSetNote={onSetNote}
                />
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

export default Checklist
