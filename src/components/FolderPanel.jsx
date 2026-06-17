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
//   채팅 삭제는 '본인 메시지만'. 공지(📢)는 폴더 관리자만 작성 → 상단 공지 영역에 표시.
// props: token, folder, myName, isAdmin, messages, onSend(content,isNotice), onRemove,
//        onLeave(f), onShare(f), onMembersChanged, onClose
function FolderPanel({
  token,
  folder,
  myName,
  isAdmin,
  messages,
  chatError,
  onSend,
  onRemove,
  onLeave,
  onShare,
  onMembersChanged,
  onClose,
}) {
  const [text, setText] = useState('')
  const [noticeMode, setNoticeMode] = useState(false)
  const endRef = useRef(null)

  const notices = messages.filter((m) => m.is_notice)
  const normal = messages.filter((m) => !m.is_notice)

  // 새 메시지 오면 맨 아래로 스크롤
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [normal.length])

  function submit() {
    const t = text.trim()
    if (!t) return
    onSend(t, isAdmin && noticeMode)
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

        {/* 공지 (관리자가 남긴 것) */}
        {notices.length > 0 && (
          <div className="notice-box">
            {notices.map((m) => (
              <div key={m.id} className="notice-item">
                <span className="notice-flag">📢</span>
                <div className="notice-body">
                  <div className="notice-text">{m.content}</div>
                  <div className="notice-meta">
                    <span>{displayName(m.user_name)} · {fmtTime(m.created_at)}</span>
                    {m.user_name === myName && (
                      <button className="chat-del" onClick={() => onRemove(m.id)} title="공지 삭제">✕</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="chat">
          {chatError && <p className="error" style={{ margin: '0 0 6px' }}>오류: {chatError}</p>}
          <div className="chat-messages">
            {normal.length === 0 ? (
              <p className="muted chat-empty">아직 메시지가 없습니다.</p>
            ) : (
              normal.map((m) => {
                const mine = m.user_name === myName
                return (
                  <div key={m.id} className={'chat-msg' + (mine ? ' mine' : '')}>
                    <div className="chat-msg-meta">
                      <span className="chat-author">{displayName(m.user_name)}</span>
                      <time className="chat-time">{fmtTime(m.created_at)}</time>
                      {mine && (
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

          {isAdmin && (
            <label className="notice-toggle">
              <input
                type="checkbox"
                checked={noticeMode}
                onChange={(e) => setNoticeMode(e.target.checked)}
              />
              📢 공지로 보내기
            </label>
          )}
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
              placeholder={isAdmin && noticeMode ? '공지 내용 입력' : '메시지 입력'}
            />
            <button className="btn btn-primary" onClick={submit}>
              {isAdmin && noticeMode ? '공지' : '전송'}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default FolderPanel
