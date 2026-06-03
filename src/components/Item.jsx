import { useState } from 'react'
import { RATINGS } from '../lib/constants'

// 항목 한 줄.
//   위: 라벨(+수량 있으면 표시) / 체크박스 or 상중하
//   아래: 비고 입력 — item.show_note 가 켜진 항목에만
// props: item, mode, onSetStatus(id,상태), onSetNote(id,비고)
function Item({ item, mode, onSetStatus, onSetNote }) {
  const checked = item.status === 'done'
  const [noteDraft, setNoteDraft] = useState(item.note ?? '')

  return (
    <li className={'item' + (mode === 'check' && checked ? ' checked' : '')}>
      <div className="item-body">
        <span className="item-main">
          <span className="item-label">{item.label}</span>
          {item.quantity && <span className="item-qty"> · {item.quantity}</span>}
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
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft !== (item.note ?? '')) onSetNote(item.id, noteDraft)
          }}
        />
      )}
    </li>
  )
}

export default Item
