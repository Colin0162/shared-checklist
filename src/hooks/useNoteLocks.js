import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// 비고 작성 잠금(#실시간): 누가 어떤 항목 비고를 쓰는 중인지 broadcast로 공유.
//   openBoardId가 바뀌면 채널을 새로 연결하고, 떠날 때 정리한다.
//   반환: { noteLocks, sendNoteLock }
export function useNoteLocks(openBoardId, userName) {
  const [noteLocks, setNoteLocks] = useState({}) // { itemId: { user, ts } }
  const lockChanRef = useRef(null)

  useEffect(() => {
    if (!supabase || !openBoardId) return
    const ch = supabase.channel('notelock-' + openBoardId, {
      config: { broadcast: { self: false } },
    })
    ch.on('broadcast', { event: 'lock' }, ({ payload }) => {
      setNoteLocks((prev) => {
        const next = { ...prev }
        if (payload.locked) next[payload.itemId] = { user: payload.user, ts: Date.now() }
        else delete next[payload.itemId]
        return next
      })
    }).subscribe()
    lockChanRef.current = ch
    // 연결 끊김 등으로 남은 잠금은 45초 뒤 자동 해제(스턱 방지)
    const prune = setInterval(() => {
      setNoteLocks((prev) => {
        const now = Date.now()
        let changed = false
        const next = {}
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.ts < 45000) next[k] = v
          else changed = true
        }
        return changed ? next : prev
      })
    }, 5000)
    return () => {
      clearInterval(prune)
      supabase.removeChannel(ch)
      lockChanRef.current = null
      setNoteLocks({}) // 보드 떠날 때 잠금 표시 정리
    }
  }, [openBoardId])

  const sendNoteLock = useCallback(
    (itemId, locked) => {
      lockChanRef.current?.send({
        type: 'broadcast',
        event: 'lock',
        payload: { itemId, user: userName || '', locked },
      })
    },
    [userName],
  )

  return { noteLocks, sendNoteLock }
}
