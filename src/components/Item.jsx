import { RATINGS } from '../data/checklists'

// 항목 한 줄을 그린다. 모드에 따라 오른쪽 컨트롤이 달라진다.
//   check : 체크박스 1개
//   rate  : 상/중/하 버튼 3개
//
// props (부모 Checklist가 내려준다):
//   item        : { id, label, note }
//   mode        : 'check' | 'rate'
//   status      : 현재 상태 (true/false 또는 '상'|'중'|'하'|undefined)
//   onSetStatus : (항목id, 새값) => void   ← 이벤트를 위로 올려보내는 콜백
function Item({ item, mode, status, onSetStatus }) {
  const checked = status === true

  return (
    <li className={'item' + (mode === 'check' && checked ? ' checked' : '')}>
      <div className="item-main">
        <span className="item-label">{item.label}</span>
        {item.note && <span className="item-note">{item.note}</span>}
      </div>

      {mode === 'check' ? (
        // ── 체크박스 모드 (준비물) ──
        <input
          type="checkbox"
          className="item-checkbox"
          checked={checked}
          onChange={(e) => onSetStatus(item.id, e.target.checked)}
        />
      ) : (
        // ── 상/중/하 모드 (장소 답사) ──
        <div className="rating">
          {RATINGS.map((r) => (
            <button
              key={r}
              className={status === r ? 'rate-btn active' : 'rate-btn'}
              // 같은 등급을 다시 누르면 선택 해제(빈 값)
              onClick={() => onSetStatus(item.id, status === r ? '' : r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

export default Item
