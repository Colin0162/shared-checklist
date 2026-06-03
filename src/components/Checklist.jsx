import Item from './Item'

// 체크리스트 하나(제목 영역 + 진행률 + 그룹별 항목 목록)를 그린다.
//
// props:
//   checklist       : { id, title, mode, groups }
//   statuses        : { [항목id]: 상태 }   ← App이 통째로 내려준다
//   onSetItemStatus : (항목id, 새값) => void
function Checklist({ checklist, statuses, onSetItemStatus }) {
  // 그룹 안에 흩어진 항목들을 한 줄로 펴서(flat) 진행률을 센다.
  const allItems = checklist.groups.flatMap((g) => g.items)
  const total = allItems.length

  // "완료"의 정의가 모드마다 다르다:
  //   check : 상태가 true
  //   rate  : 상/중/하 중 아무거나 골라졌으면(비어있지 않으면) 평가된 것으로 간주
  const done = allItems.filter((it) => {
    const s = statuses[it.id]
    return checklist.mode === 'check' ? s === true : Boolean(s)
  }).length

  const doneLabel = checklist.mode === 'check' ? '완료' : '평가함'
  const percent = total ? Math.round((done / total) * 100) : 0

  return (
    <section className="checklist">
      <div className="progress">
        <span className="progress-text">
          {doneLabel} {done} / {total}
        </span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {checklist.groups.map((group) => (
        <div className="group" key={group.name}>
          <h2 className="group-title">{group.name}</h2>
          <ul className="item-list">
            {group.items.map((item) => (
              <Item
                key={item.id}
                item={item}
                mode={checklist.mode}
                status={statuses[item.id]}
                onSetStatus={onSetItemStatus}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default Checklist
