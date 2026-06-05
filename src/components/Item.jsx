import { useState } from 'react'
import { RATINGS } from '../lib/constants'

// 텍스트 안의 URL을 클릭 가능한 링크로
function withLinks(text) {
  return String(text)
    .split(/(https?:\/\/[^\s]+)/g)
    .map((p, i) =>
      /^https?:\/\//.test(p) ? (
        <a key={i} href={p} target="_blank" rel="noreferrer" className="todo-link">
          {p}
        </a>
      ) : (
        p
      ),
    )
}

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

  // 할 일 리스트: 체크박스/컨트롤 없이 텍스트만(링크 클릭 가능)
  if (mode === 'todo') {
    return <li className="todo-line">{withLinks(item.label)}</li>
  }

  return (
    <li className={'item' + (mode === 'check' && checked ? ' checked' : '')}>
      <div className="item-body">
        <span className="item-main">
          <span className="item-label">{item.label}</span>
          {mode === 'check' && item.quantity && (
            <span className="item-qty"> · {item.quantity}</span>
          )}
          {item.assignee && <span className="item-assignee">담당: {item.assignee}</span>}
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
        <textarea
          className="item-note-input"
          rows={2}
          placeholder="비고 입력… (줄바꿈 가능)"
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
