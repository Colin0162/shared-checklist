import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { listMessages, sendMessage, deleteMessage } from '../lib/api'

// 공유 폴더 채팅: 메시지 로드 + 실시간(INSERT/DELETE) + 보내기/삭제 + 안읽음 표시.
//   active: 공유 폴더 안에 있고 참여자일 때만 true (그 외엔 구독 안 함)
//   초기화(setMessages([]))는 cleanup에서 → effect 본문 동기 setState 금지 룰 회피
export function useFolderChat(folderId, token, active) {
  const [messages, setMessages] = useState([])
  const [unread, setUnread] = useState(false)
  const [chatError, setChatError] = useState('')

  useEffect(() => {
    if (!active || !folderId || !token || !supabase) return
    let alive = true
    listMessages(token, folderId)
      .then((ms) => alive && setMessages(ms))
      .catch((e) => alive && setChatError(e.message))
    const ch = supabase
      .channel('folder-chat-' + folderId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'folder_messages', filter: `folder_id=eq.${folderId}` },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]))
          setUnread(true)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'folder_messages' },
        (payload) => setMessages((prev) => prev.filter((m) => m.id !== payload.old.id)),
      )
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(ch)
      setMessages([])
      setUnread(false)
      setChatError('')
    }
  }, [folderId, token, active])

  const markRead = useCallback(() => setUnread(false), [])

  const send = useCallback(
    async (content, isNotice = false) => {
      try {
        await sendMessage(token, folderId, content, isNotice) // 내 메시지도 실시간 INSERT로 목록에 들어옴
      } catch (e) {
        setChatError(e.message)
      }
    },
    [token, folderId],
  )

  const remove = useCallback(
    async (id) => {
      try {
        await deleteMessage(token, id)
        setMessages((prev) => prev.filter((m) => m.id !== id))
      } catch (e) {
        setChatError(e.message)
      }
    },
    [token],
  )

  return { messages, unread, markRead, send, remove, chatError }
}
