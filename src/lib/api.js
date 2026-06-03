import { supabase } from './supabase'

// DB 접근을 한곳에 모은 모듈. 화면 컴포넌트는 이 함수들만 호출한다.
// (나중에 실시간/권한이 붙어도 화면 코드는 거의 그대로)

// 게시판 목록
export async function getBoards() {
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, description, mode, event_date, sort_order')
    .order('sort_order')
  if (error) throw error
  return data
}

// 특정 게시판의 항목들
export async function getBoardItems(boardId) {
  const { data, error } = await supabase
    .from('items')
    .select('id, group_name, label, quantity, sort_order, status, note, checked_by')
    .eq('board_id', boardId)
    .order('sort_order')
  if (error) throw error
  return data
}

// 항목 상태 변경 (check: 'done'/'' , rate: '상'|'중'|'하'|'')
export async function setItemStatus(id, status) {
  const { error } = await supabase
    .from('items')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// 비고 변경 (누구나 입력)
export async function setItemNote(id, note) {
  const { error } = await supabase
    .from('items')
    .update({ note, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
