import { useState } from 'react'

// 처음 들어왔을 때 이름만 한 번 물어보는 화면 (로그인·비밀번호 없음).
//   이름은 기기에 저장되어 '체크한 사람'·'작성자'에 쓰인다. 언제든 바꿀 수 있음.
// props: initial, onDone(name), onCancel(선택 — 있으면 취소 버튼 표시)
function NamePrompt({ initial = '', onDone, onCancel }) {
  const [name, setName] = useState(initial)
  const [err, setErr] = useState('')

  function submit() {
    const n = name.trim()
    if (!n) {
      setErr('이름을 입력하세요.')
      return
    }
    onDone(n)
  }

  return (
    <section className="name-prompt">
      <h2 className="name-title">이름을 알려주세요</h2>
      <p className="name-desc">
        체크한 사람 이름을 표시하는 데만 써요. 비밀번호도, 가입도 없어요.
        <br />
        이 기기에 저장되니 다음부터는 바로 들어옵니다.
      </p>
      <input
        className="text-input"
        value={name}
        autoFocus
        maxLength={20}
        placeholder="예: 강무관(필립보)"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {err && <p className="error">{err}</p>}
      <div className="name-actions">
        {onCancel && (
          <button className="btn" onClick={onCancel}>취소</button>
        )}
        <button className="btn btn-primary" onClick={submit}>시작하기</button>
      </div>
    </section>
  )
}

export default NamePrompt
