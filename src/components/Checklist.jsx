import { useState } from 'react'
import Item from './Item'
import TableView from './TableView'
import { ddayLabel } from '../lib/constants'

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
//        onEdit, onReset, onSetStatus, onSetNote
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
  noteLocks,
  myName,
  onNoteLock,
}) {
  const [unfinishedOnly, setUnfinishedOnly] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const mode = board.mode
  const isTodo = mode === 'todo'
  const isTable = mode === 'table'
  const hasProgress = mode === 'check' || mode === 'rate'
  const assignees = [...new Set(items.map((it) => it.assignee).filter(Boolean))]

  const total = items.length
  const doneCount = items.filter((it) => isDone(it, mode)).length
  const percent = total ? Math.round((doneCount / total) * 100) : 0
  const doneLabel = mode === 'check' ? '완료' : '평가함'

  const groups = groupItems(items, board.categories)
  const visible = (it) =>
    (!unfinishedOnly || !isDone(it, mode)) && (!assigneeFilter || it.assignee === assigneeFilter)

  return (
    <section className="checklist">
      {/* 스크롤해도 고정되는 상단(제목 + 진행률) */}
      <div className="board-top">
        <div className="checklist-head">
          <button className="back-btn" onClick={onBack}>←</button>
          <h2 className="board-heading">{board.title}</h2>
          {board.event_date && <span className="dday">{ddayLabel(board.event_date)}</span>}
          <div className="head-actions">
            <button
              className="btn btn-small"
              onClick={() => window.print()}
              title="인쇄 / PDF로 저장"
            >
              🖨 인쇄
            </button>
            {adminMode ? (
              <>
                <button className="btn btn-small" onClick={onEdit}>편집</button>
                {hasProgress && (
                  <button className="btn btn-small" onClick={onReset}>초기화</button>
                )}
                <button className="btn btn-small" onClick={onExitAdmin}>해제</button>
              </>
            ) : (
              <button className="btn btn-small" onClick={onEnterAdmin}>관리자 모드</button>
            )}
          </div>
        </div>

        {hasProgress && (
          <div className="progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
            </div>
            <span className="progress-text">
              {doneLabel} {doneCount} / {total} · {percent}%
            </span>
          </div>
        )}
      </div>

      {board.created_by && <p className="board-author">작성자 {board.created_by}</p>}

      {isTable ? (
        <TableView data={board.table_data} />
      ) : (
        <>
          {!isTodo && (
            <div className="toolbar">
              <button
                className={'btn' + (unfinishedOnly ? ' btn-primary' : '')}
                onClick={() => setUnfinishedOnly((v) => !v)}
              >
                {unfinishedOnly ? '전체 보기' : '미완료만 보기'}
              </button>
              {assignees.length > 0 && (
                <select
                  className="text-input filter-select"
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                >
                  <option value="">담당자 전체</option>
                  {assignees.map((a) => (
                    <option key={a} value={a}>
                      담당: {a}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {groups.map((group) => {
            const gTotal = group.items.length
            const gDone = group.items.filter((it) => isDone(it, mode)).length
            const shown = group.items.filter(visible)
            if (unfinishedOnly && shown.length === 0) return null
            return (
              <div className="group" key={group.name || '_'}>
                {group.name && (
                  <div className="group-head">
                    <h3 className="group-title">{group.name}</h3>
                    {hasProgress && <span className="group-progress">{gDone}/{gTotal}</span>}
                  </div>
                )}
                <ul className="item-list">
                  {shown.map((item) => (
                    <Item
                      key={item.id}
                      item={item}
                      mode={mode}
                      onSetStatus={onSetStatus}
                      onSetNote={onSetNote}
                      noteLockedBy={(noteLocks && noteLocks[item.id] && noteLocks[item.id].user) || ''}
                      myName={myName}
                      onNoteLock={onNoteLock}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}

export default Checklist
