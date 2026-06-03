import { useState } from 'react'
import { RATINGS } from '../lib/constants'

// 항목 한 줄.
//   위: 라벨(+수량 있으면 표시) / 체크박스 or 상중하
//   아래: 비고 입력 — item.show_note 가 켜진 항목에만
// props: item, mode, onSetStatus(id,상태), onSetNote(id,비고)
function Item({ item, mode, onSetStatus, onSetNote }) {
  const checked = item.status === 'done'
  const [noteDraft, setNoteDraft] = useState(item.note ?? '')
  const [focused, setFocused] = useState(false)
  const [syncedNote, setSyncedNote] = useState(item.note ?? '')

  // 동시편집 충돌 방지: 내가 입력 중(focused)이 아닐 때만, 다른 사람이 바꾼
  // 비고(item.note, 실시간)를 입력칸에 반영. (effect 대신 렌더 중 보정 — React 권장)
  if (!focused && item.note !== syncedNote) {
    setSyncedNote(item.note ?? '')
    setNoteDraft(item.note ?? '')
  }

  return (
    <li className={'item' + (mode === 'check' && checked ? ' checked' : '')}>
      <div className="item-body">
        <span className="item-main">
          <span className="item-label">{item.label}</span>
          {mode === 'check' && item.quantity && (
            <span className="item-qty"> · {item.quantity}</span>
          )}
          {item.status && item.checked_by && (
            <span className="item-by">— {item.checked_by}</span>
          )}
        </span>

        {mode === 'check' ? (
          <input
            type="checkbox"
            className="item-checkbox"
            checked={checked}
            onChange={(e) => onSetStatus(item.id, e.target.checked ? 'done' : '')}
          />
        ) : (
          <div className="rating">
            {RATINGS.map((r) => (
              <button
                key={r}
                className={item.status === r ? 'rate-btn active' : 'rate-btn'}
                onClick={() => onSetStatus(item.id, item.status === r ? '' : r)}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {item.show_note && (
        <input
          className="item-note-input"
          placeholder="비고 입력…"
          value={noteDraft}
          onFocus={() => setFocused(true)}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            setFocused(false)
            if (noteDraft !== (item.note ?? '')) onSetNote(item.id, noteDraft)
          }}
        />
      )}
    </li>
  )
}

export default Item
