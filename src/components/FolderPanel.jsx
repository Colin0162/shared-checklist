import { useState, useRef, useEffect } from 'react'
import FolderMembers from './FolderMembers'
import { displayName } from '../lib/constants'

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// 공유 폴더 채팅+참여자 패널. 데스크톱=왼쪽 사이드 / 모바일=드로어 (App.css).
// props: token, folder, myName, isAdmin, messages, onSend, onRemove,
//        onLeave(f), onShare(f), onMembersChanged, onClose
function FolderPanel({
  token,
  folder,
  myName,
  isAdmin,
  messages,
  onSend,
  onRemove,
  onLeave,
  onShare,
  onMembersChanged,
  onClose,
}) {
  const [text, setText] = useState('')
  const endRef = useRef(null)

  // 새 메시지 오면 맨 아래로 스크롤
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  function submit() {
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <aside className="folder-panel">
        <div className="folder-panel-head">
          <span className="folder-panel-title">💬 {folder.name}</span>
          <button className="icon-btn" onClick={onClose} title="닫기">✕</button>
        </div>

        <FolderMembers
          token={token}
          folder={folder}
          myName={myName}
          isAdmin={isAdmin}
          onChanged={onMembersChanged}
        />

        <div className="folder-panel-actions">
          {isAdmin ? (
            <button className="btn btn-small" onClick={() => onShare(folder)}>암호 변경</button>
          ) : (
            <button className="btn btn-danger btn-small" onClick={() => onLeave(folder)}>
              이 폴더에서 나가기
            </button>
          )}
        </div>

        <div className="chat">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <p className="muted chat-empty">아직 메시지가 없습니다.</p>
            ) : (
              messages.map((m) => {
                const mine = m.user_name === myName
                return (
                  <div key={m.id} className={'chat-msg' + (mine ? ' mine' : '')}>
                    <div className="chat-msg-meta">
                      <span className="chat-author">{displayName(m.user_name)}</span>
                      <time className="chat-time">{fmtTime(m.created_at)}</time>
                      {(mine || isAdmin) && (
                        <button className="chat-del" onClick={() => onRemove(m.id)} title="삭제">✕</button>
                      )}
                    </div>
                    <div className="chat-bubble">{m.content}</div>
                  </div>
                )
              })
            )}
            <div ref={endRef} />
          </div>
          <div className="chat-input">
            <textarea
              className="text-input"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="메시지 입력 (Enter 전송, Shift+Enter 줄바꿈)"
            />
            <button className="btn btn-primary" onClick={submit}>전송</button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default FolderPanel
