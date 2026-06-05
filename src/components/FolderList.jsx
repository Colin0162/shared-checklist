import { useState } from 'react'

// 폴더 목록 + 새 폴더 만들기.
// props:
//   folders   : 화면에 보일 폴더들(상위에서 비공개 필터 끝낸 목록)
//   onOpen(f) : 폴더 열기
//   onNew(name, isPrivate) : 폴더 생성
//   onDelete(f) : 폴더 삭제 요청
//   canDelete(f) : 이 폴더 삭제 버튼 보일지
function FolderList({ folders, onOpen, onNew, onDelete, canDelete }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  async function submit() {
    if (!name.trim()) return
    await onNew(name.trim(), isPrivate)
    setName('')
    setIsPrivate(false)
    setAdding(false)
  }

  return (
    <>
      <div className="list-head">
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>+ 새 폴더</button>
      </div>

      {adding && (
        <div className="folder-new">
          <input
            className="text-input"
            placeholder="폴더 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <label className="row-note">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            나만 보기(비공개)
          </label>
          <button className="btn btn-primary" onClick={submit}>만들기</button>
        </div>
      )}

      {folders.length === 0 ? (
        <p className="muted">폴더가 없습니다. '새 폴더'로 만들어 보세요.</p>
      ) : (
        <ul className="board-list">
          {folders.map((f) => (
            <li key={f.id} className="board-row">
              <button className="board-card" onClick={() => onOpen(f)}>
                <span className="board-title">
                  {f.is_private ? '🔒 ' : '📁 '}
                  {f.name}
                </span>
                <span className="board-meta">
                  {f.is_private ? '나만 보기' : '공개'}
                  {f.owner ? ` · ${f.owner}` : ''}
                </span>
              </button>
              {canDelete(f) && (
                <button className="btn btn-danger btn-small board-del" onClick={() => onDelete(f)}>
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default FolderList
