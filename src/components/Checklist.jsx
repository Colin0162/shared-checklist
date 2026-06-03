import { useState } from 'react'
import Item from './Item'
import Memo from './Memo'

const isDone = (it, mode) => (mode === 'check' ? it.status === 'done' : Boolean(it.status))

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

// props: board, items, adminMode, onBack, onEnterAdmin, onExitAdmin,
//        onEdit, onReset, onSetStatus, onSetNote, onSetMemo
function Checklist({
  board,
  items,
  adminMode,
  onBack,
  onEnterAdmin,
  onExitAdmin,
  onEdit,
  onReset,
  onSetStatus,
  onSetNote,
  onSetMemo,
}) {
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
          {adminMode ? (
            <>
              <button className="btn" onClick={onEdit}>편집</button>
              <button className="btn" onClick={onReset}>초기화</button>
              <button className="btn btn-small" onClick={onExitAdmin}>관리자 해제</button>
            </>
          ) : (
            <button className="btn" onClick={onEnterAdmin}>관리자 모드</button>
          )}
        </div>
      </div>

      {board.created_by && <p className="board-author">작성자: {board.created_by}</p>}

      <Memo value={board.memo} onSave={onSetMemo} />

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
              <h3 className={'group-title' + (group.name ? '' : ' group-title-muted')}>
                {group.name || '(대항목 없음)'}
              </h3>
              <span className="group-progress">{gDone}/{gTotal}</span>
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
