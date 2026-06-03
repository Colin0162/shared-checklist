import { supabase } from './supabase'

// DB 접근을 한곳에 모은 모듈. 화면 컴포넌트는 이 함수들만 호출한다.

// ── 인증 (이름+PIN, RPC로 검증) ────────────────────────
export async function register(name, pin) {
  const { data, error } = await supabase.rpc('register', { p_name: name, p_pin: pin })
  if (error) throw error
  return data // { ok, name, is_admin } 또는 { ok:false, error }
}

export async function login(name, pin) {
  const { data, error } = await supabase.rpc('login', { p_name: name, p_pin: pin })
  if (error) throw error
  return data
}

// ── 읽기 ──────────────────────────────────────────────
export async function getBoards() {
  const { data, error } = await supabase
    .from('boards')
    .select('id, title, description, mode, categories, event_date, sort_order')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function getBoardItems(boardId) {
  const { data, error } = await supabase
    .from('items')
    .select('id, group_name, label, quantity, show_note, sort_order, status, note, checked_by')
    .eq('board_id', boardId)
    .order('sort_order')
  if (error) throw error
  return data
}

// ── 협업 상태 변경 (누구나) ────────────────────────────
export async function setItemStatus(id, status, checkedBy = '') {
  const { error } = await supabase
    .from('items')
    .update({ status, checked_by: checkedBy, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setItemNote(id, note) {
  const { error } = await supabase
    .from('items')
    .update({ note, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// 전체 초기화: 이 게시글의 모든 항목 체크/체크한사람을 비움 (비고는 유지)
export async function resetBoard(boardId) {
  const { error } = await supabase
    .from('items')
    .update({ status: '', checked_by: '', updated_at: new Date().toISOString() })
    .eq('board_id', boardId)
  if (error) throw error
}

// ── 관리자: 게시글 구조 만들기/고치기/지우기 ───────────
export async function createBoard(fields) {
  const { data, error } = await supabase
    .from('boards')
    .insert(fields)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBoard(id, fields) {
  const { error } = await supabase.from('boards').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteBoard(id) {
  // items 는 board_id FK on delete cascade 로 함께 삭제됨
  const { error } = await supabase.from('boards').delete().eq('id', id)
  if (error) throw error
}

// 항목 여러 개 한꺼번에 추가 (구조)
export async function insertItems(boardId, items) {
  if (!items.length) return
  const rows = items.map((it) => ({
    board_id: boardId,
    group_name: it.group_name || '',
    label: it.label || '',
    quantity: it.quantity || '',
    show_note: it.show_note ?? false,
    sort_order: it.sort_order ?? 0,
  }))
  const { error } = await supabase.from('items').insert(rows)
  if (error) throw error
}

// 항목의 구조(그룹/라벨/수량/순서)만 수정 — 상태/비고는 건드리지 않음
export async function updateItemStructure(id, fields) {
  const { error } = await supabase.from('items').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}
