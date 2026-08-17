import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getBoardItems, setItemStatus, setItemNote } from '../lib/api'

// 실시간 변경(payload)을 현재 items 배열에 반영
function applyItemChange(prev, payload) {
  if (payload.eventType === 'INSERT') {
    if (prev.some((it) => it.id === payload.new.id)) return prev
    return [...prev, payload.new].sort((a, b) => a.sort_order - b.sort_order)
  }
  if (payload.eventType === 'UPDATE') {
    // 필드만 갱신하지 말고 sort_order로 다시 정렬 → 순서 변경이 실시간으로 반영됨
    return prev
      .map((it) => (it.id === payload.new.id ? { ...it, ...payload.new } : it))
      .sort((a, b) => a.sort_order - b.sort_order)
  }
  if (payload.eventType === 'DELETE') {
    return prev.filter((it) => it.id !== payload.old.id)
  }
  return prev
}

// 열린 게시글의 항목: 로드 + 실시간 + 체크/비고 저장(+실패 표시·재시도).
//   openBoardId가 바뀌면 새로 로드한다. setState는 비동기 콜백 안에서만(eslint 규칙).
//   name: 체크한 사람으로 기록할 이름(로그인 없음)
//   반환: { items, setItems, boardReady, saveErrors, handleSetStatus, handleSetNote, retrySave }
export function useBoardItems(openBoardId, name, reportError) {
  const [items, setItems] = useState([])
  const [itemsBoardId, setItemsBoardId] = useState(null) // 지금 items가 어느 게시글 것인지
  const [saveErrors, setSaveErrors] = useState({}) // { itemId: { kind:'status'|'note', value } }
  const boardReady = openBoardId != null && itemsBoardId === openBoardId // items까지 로드됨

  // 게시글이 바뀌면 항목 새로 로드
  useEffect(() => {
    if (!openBoardId || itemsBoardId === openBoardId) return
    let cancelled = false
    getBoardItems(openBoardId)
      .then((its) => {
        if (cancelled) return
        setItems(its)
        setItemsBoardId(openBoardId)
      })
      .catch((e) => {
        if (!cancelled) reportError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [openBoardId, itemsBoardId, reportError])

  // 실시간: 열린 게시글의 항목 변경
  useEffect(() => {
    if (!supabase || !openBoardId) return
    const ch = supabase
      .channel('items-' + openBoardId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `board_id=eq.${openBoardId}` },
        (payload) => setItems((prev) => applyItemChange(prev, payload)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [openBoardId])

  // 저장 실패: 그 항목에 '저장 안 됨' 표시(재시도용)
  const onSaveFail = useCallback((id, kind, value) => {
    setSaveErrors((prev) => ({ ...prev, [id]: { kind, value } }))
  }, [])
  const clearSaveError = useCallback((id) => {
    setSaveErrors((prev) => {
      if (!prev[id]) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  // useCallback: 함수 신원 고정 → memo(Item)이 바뀐 항목만 다시 그림(체크 시 부드러움)
  const handleSetStatus = useCallback(
    async (id, status) => {
      const checkedBy = status ? name || '' : ''
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status, checked_by: checkedBy } : it)),
      )
      try {
        await setItemStatus(name, id, status)
        clearSaveError(id)
      } catch {
        onSaveFail(id, 'status', status)
      }
    },
    [name, onSaveFail, clearSaveError],
  )
  const handleSetNote = useCallback(
    async (id, note) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, note } : it)))
      try {
        await setItemNote(name, id, note)
        clearSaveError(id)
      } catch {
        onSaveFail(id, 'note', note)
      }
    },
    [name, onSaveFail, clearSaveError],
  )
  // 항목별 '↻ 다시' — 실패했던 값(pending)으로 그대로 재시도. 콜백은 고정(memo 유지)
  const retrySave = useCallback(
    (id, pending) => {
      if (!pending) return
      if (pending.kind === 'status') handleSetStatus(id, pending.value)
      else handleSetNote(id, pending.value)
    },
    [handleSetStatus, handleSetNote],
  )

  return { items, setItems, boardReady, saveErrors, handleSetStatus, handleSetNote, retrySave }
}
