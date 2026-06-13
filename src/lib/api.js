import { supabase } from './supabase'

// 인증 (토큰 없음 — 이름만 보관)
export async function register(name, pin) {
  const { data, error } = await supabase.rpc('register', { p_name: name, p_pin: pin })
  if (error) throw error
  return data // { ok, name } | { ok:false, error }
}
export async function login(name, pin) {
  const { data, error } = await supabase.rpc('login', { p_name: name, p_pin: pin })
  if (error) throw error
  return data
}

// ── 읽기 ──
export async function getBoards() {
  const { data, error } = await supabase
    .from('boards')
    .select(
      'id, title, description, mode, categories, created_by, has_entry_password, memo, folder_id, event_date, table_data, sort_order',
    )
    .order('sort_order')
  if (error) throw error
  return data
}
export async function getBoardItems(boardId) {
  const { data, error } = await supabase
    .from('items')
    .select(
      'id, group_name, label, quantity, show_note, assignee, sort_order, status, note, checked_by',
    )
    .eq('board_id', boardId)
    .order('sort_order')
  if (error) throw error
  return data
}

// ── 활동 로그 (#3) ──
export async function getBoardActivity(token, boardId, limit = 50) {
  const { data, error } = await supabase.rpc('list_board_activity', {
    p_token: token,
    p_board_id: boardId,
    p_limit: limit,
  })
  if (error) throw error
  return data
}

// ── 콘텐츠 쓰기 (직접, 로그인 사용자) ──
// 체크/비고는 로그인 토큰으로 서버 RPC 호출 (체크한 사람은 서버가 토큰에서 결정)
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
export async function setMemo(boardId, memo) {
  const { error } = await supabase.rpc('set_memo', { p_board_id: boardId, p_memo: memo })
  if (error) throw error
}

// ── 게시글 관리 (비밀번호 RPC) ──
export async function createBoard(author, board, items, adminPw, entryPw) {
  const { data, error } = await supabase.rpc('create_board', {
    p_author: author,
    p_board: board,
    p_items: items,
    p_admin_pw: adminPw,
    p_entry_pw: entryPw,
  })
  if (error) throw error
  return data
}
export async function updateBoard(boardId, pw, board, items) {
  const { error } = await supabase.rpc('update_board', {
    p_board_id: boardId,
    p_pw: pw,
    p_board: board,
    p_items: items,
  })
  if (error) throw error
}
export async function deleteBoard(boardId, pw) {
  const { error } = await supabase.rpc('delete_board', { p_board_id: boardId, p_pw: pw })
  if (error) throw error
}
export async function resetBoard(boardId, pw) {
  const { error } = await supabase.rpc('reset_board', { p_board_id: boardId, p_pw: pw })
  if (error) throw error
}
export async function verifyBoardAdmin(boardId, pw) {
  const { data, error } = await supabase.rpc('verify_board_admin', { p_board_id: boardId, p_pw: pw })
  if (error) throw error
  return data
}
export async function verifyBoardEntry(boardId, pw) {
  const { data, error } = await supabase.rpc('verify_board_entry', { p_board_id: boardId, p_pw: pw })
  if (error) throw error
  return data
}

// ── 폴더 (#4) ──
export async function getFolders() {
  const { data, error } = await supabase
    .from('folders')
    .select('id, name, owner, is_private, parent_id, sort_order')
    .order('sort_order')
  if (error) throw error
  return data
}
export async function createFolder(token, name, isPrivate, parentId) {
  const { data, error } = await supabase.rpc('create_folder', {
    p_token: token,
    p_name: name,
    p_is_private: isPrivate,
    p_parent_id: parentId,
  })
  if (error) throw error
  return data
}
export async function deleteFolder(token, folderId) {
  const { error } = await supabase.rpc('delete_folder', { p_token: token, p_folder_id: folderId })
  if (error) throw error
}

// ── 템플릿 (#1) ──
export async function getTemplates(token) {
  // 본인 템플릿만 (개인용)
  const { data, error } = await supabase.rpc('list_templates', { p_token: token })
  if (error) throw error
  return data
}
export async function saveTemplate(token, name, mode, categories, items, tableData) {
  const { data, error } = await supabase.rpc('save_template', {
    p_token: token,
    p_name: name,
    p_mode: mode,
    p_categories: categories,
    p_items: items,
    p_table_data: tableData,
  })
  if (error) throw error
  return data
}
export async function deleteTemplate(token, id) {
  const { error } = await supabase.rpc('delete_template', { p_token: token, p_id: id })
  if (error) throw error
}

// ── 사이트 관리자 (예약 계정으로 로그인한 경우) ──
export async function siteDeleteBoard(token, boardId) {
  const { error } = await supabase.rpc('site_delete_board', { p_token: token, p_board_id: boardId })
  if (error) throw error
}
export async function listPendingUsers(token) {
  const { data, error } = await supabase.rpc('list_pending_users', { p_token: token })
  if (error) throw error
  return data
}
export async function approveUser(token, userId) {
  const { error } = await supabase.rpc('approve_user', { p_token: token, p_user_id: userId })
  if (error) throw error
}
export async function rejectUser(token, userId) {
  const { error } = await supabase.rpc('reject_user', { p_token: token, p_user_id: userId })
  if (error) throw error
}
export async function listAllUsers(token) {
  const { data, error } = await supabase.rpc('list_all_users', { p_token: token })
  if (error) throw error
  return data
}
export async function deleteUser(token, userId) {
  const { error } = await supabase.rpc('delete_user', { p_token: token, p_user_id: userId })
  if (error) throw error
}
export async function adminResetPassword(token, userId, newPw) {
  const { error } = await supabase.rpc('admin_reset_password', {
    p_token: token,
    p_user_id: userId,
    p_new_pw: newPw,
  })
  if (error) throw error
}
export async function changeMyPassword(token, oldPw, newPw) {
  const { data, error } = await supabase.rpc('change_my_password', {
    p_token: token,
    p_old_pw: oldPw,
    p_new_pw: newPw,
  })
  if (error) throw error
  return data
}
