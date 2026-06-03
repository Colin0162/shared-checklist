import { useState } from 'react'

// 공유 메모 / 할 일 (게시글마다, 함께 편집).
// props: value, onSave(memo)
function Memo({ value, onSave }) {
  const [draft, setDraft] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  const [synced, setSynced] = useState(value ?? '')

  // 입력 중이 아닐 때만 다른 사람의 변경(실시간)을 반영 (동시편집 보호)
  if (!focused && value !== synced) {
    setSynced(value ?? '')
    setDraft(value ?? '')
  }

  return (
    <details className="memo" open>
      <summary className="memo-summary">메모 / 할 일 (함께 편집)</summary>
      <textarea
        className="memo-input"
        rows={8}
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false)
          if (draft !== (value ?? '')) onSave(draft)
        }}
        placeholder="장소 / 시간 / 할 일 / 링크 등 자유롭게 적어요. (저장: 입력칸 밖을 클릭)"
      />
    </details>
  )
}

export default Memo
