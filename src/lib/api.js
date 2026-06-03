import { supabase } from './supabase'

// DB 접근 모듈.
//  - 읽기: 직접 SELECT (실시간 구독 위해 열려 있음)
//  - 쓰기: 전부 토큰 기반 RPC (서버에서 권한 검증)

// ── 인증 ──────────────────────────────────────────────
export async function register(name, pin) {
  const { data, error } = await supabase.rpc('register', { p_name: name, p_pin: pin })
  if (error) throw error
  return data // { ok, name, is_admin, token } | { ok:false, error }
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
    .select('id, group_name, label, quantity, show_note, assignee, sort_order, status, note, checked_by')
    .eq('board_id', boardId)
    .order('sort_order')
  if (error) throw error
  return data
}

// ── 협업 쓰기 (토큰 RPC) ───────────────────────────────
export async function setItemStatus(token, id, status) {
  const { error } = await supabase.rpc('check_item', {
    p_token: token,
    p_item_id: id,
    p_status: status,
  })
  if (error) throw error
}

export async function setItemNote(token, id, note) {
  const { error } = await supabase.rpc('set_note', { p_token: token, p_item_id: id, p_note: note })
  if (error) throw error
}

export async function resetBoard(token, boardId) {
  const { error } = await supabase.rpc('reset_board', { p_token: token, p_board_id: boardId })
  if (error) throw error
}

// ── 관리자 (토큰 RPC) ──────────────────────────────────
// board = { id?, title, mode, categories, sort_order? }
// items = [{ id?, group_name, label, quantity, show_note, sort_order }]
export async function saveBoard(token, board, items) {
  const { data, error } = await supabase.rpc('admin_save_board', {
    p_token: token,
    p_board: board,
    p_items: items,
  })
  if (error) throw error
  return data // board id
}

export async function deleteBoard(token, id) {
  const { error } = await supabase.rpc('admin_delete_board', { p_token: token, p_board_id: id })
  if (error) throw error
}

export async function listUsers(token) {
  const { data, error } = await supabase.rpc('admin_list_users', { p_token: token })
  if (error) throw error
  return data
}

export async function setUserAdmin(token, userId, isAdmin) {
  const { error } = await supabase.rpc('admin_set_admin', {
    p_token: token,
    p_user_id: userId,
    p_is_admin: isAdmin,
  })
  if (error) throw error
}
