import { useState, memo, useRef, useEffect } from 'react'
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
//   check : 줄 전체를 탭하면 체크/해제 (큰 터치 영역) + 커스텀 체크표시
//   rate  : 라벨 + 상/중/하 버튼
//   todo  : 텍스트만(링크 클릭)
// 비고칸(item.show_note)이 켜진 항목은 아래에 입력칸.
// props: item, mode, onSetStatus(id,상태), onSetNote(id,비고)
function Item({ item, mode, onSetStatus, onSetNote, noteLockedBy = '', myName = '', onNoteLock }) {
  const checked = item.status === 'done'
  const [noteDraft, setNoteDraft] = useState(item.note ?? '')
  const [focused, setFocused] = useState(false)
  const [syncedNote, setSyncedNote] = useState(item.note ?? '')
  const taRef = useRef(null)

  // 비고칸을 내용(줄바꿈)만큼 자동으로 키움 → 스크롤 없이 한눈에
  useEffect(() => {
    const el = taRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [noteDraft, item.show_note])

  // 동시편집 보호: 입력 중이 아닐 때만 실시간 변경을 반영
  if (!focused && item.note !== syncedNote) {
    setSyncedNote(item.note ?? '')
    setNoteDraft(item.note ?? '')
  }

  if (mode === 'todo') {
    return <li className="todo-line">{withLinks(item.label)}</li>
  }

  const main = (
    <span className="item-main">
      <span className="item-label">{item.label}</span>
      {mode === 'check' && item.quantity && <span className="item-qty">{item.quantity}</span>}
      {item.assignee && <span className="item-assignee">담당 {item.assignee}</span>}
      {item.status && item.checked_by && <span className="item-by">{item.checked_by}</span>}
    </span>
  )

  // 다른 사람이 이 비고를 쓰는 중이면 잠금(내가 입력 중일 땐 풀림)
  const lockedByOther = Boolean(noteLockedBy) && noteLockedBy !== myName && !focused

  const note = item.show_note && (
    <textarea
      ref={taRef}
      className={'item-note-input' + (lockedByOther ? ' locked' : '')}
      rows={1}
      disabled={lockedByOther}
      placeholder={lockedByOther ? `${noteLockedBy}님이 작성 중…` : '비고 입력… (줄바꿈 가능)'}
      value={noteDraft}
      onFocus={() => {
        setFocused(true)
        if (onNoteLock) onNoteLock(item.id, true)
      }}
      onChange={(e) => setNoteDraft(e.target.value)}
      onBlur={() => {
        setFocused(false)
        if (onNoteLock) onNoteLock(item.id, false)
        if (noteDraft !== (item.note ?? '')) onSetNote(item.id, noteDraft)
      }}
    />
  )

  if (mode === 'check') {
    return (
      <li className={'item' + (checked ? ' checked' : '')}>
        <button
          type="button"
          className="item-body item-tap"
          onClick={() => onSetStatus(item.id, checked ? '' : 'done')}
        >
          {main}
          <span className={'check-box' + (checked ? ' on' : '')} aria-hidden="true">
            ✓
          </span>
        </button>
        {note}
      </li>
    )
  }

  // rate
  return (
    <li className="item">
      <div className="item-body">
        {main}
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
      </div>
      {note}
    </li>
  )
}

// memo: item/콜백이 그대로면 다시 그리지 않음 → 체크 시 바뀐 항목만 갱신(부드러움)
export default memo(Item)
