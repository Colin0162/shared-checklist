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
function Item({ item, mode, onSetStatus, onSetNote, noteLockedBy = '', myName = '', onNoteLock, saveError, onRetry }) {
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

  // 저장 실패 시 그 항목에 표시(인터넷 약할 때) — 누르면 실패했던 값으로 다시 저장
  const retryUI = saveError && (
    <div className="save-failed" role="status">
      <span className="save-failed-text">⚠ 저장 안 됨</span>
      <button type="button" className="retry-btn" onClick={() => onRetry && onRetry(item.id, saveError)}>
        ↻ 다시
      </button>
    </div>
  )

  // 다른 사람이 이 비고를 쓰는 중이면 잠금(내가 입력 중일 땐 풀림)
  const lockedByOther = Boolean(noteLockedBy) && noteLockedBy !== myName && !focused

  const note = item.show_note && (
    <>
      {lockedByOther && <div className="note-lock-tag">🔒 {noteLockedBy}님이 작성 중…</div>}
      <textarea
        ref={taRef}
        className={'item-note-input' + (lockedByOther ? ' locked' : '')}
        rows={1}
        disabled={lockedByOther}
        placeholder="비고 입력… (줄바꿈 가능)"
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
    </>
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
        {retryUI}
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
      {retryUI}
    </li>
  )
}

// memo: item/콜백이 그대로면 다시 그리지 않음 → 체크 시 바뀐 항목만 갱신(부드러움)
export default memo(Item)
