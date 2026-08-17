import { supabase } from './supabase'

// 로그인 없음. 이름만 기기에 저장해서 '체크한 사람' 표시에 쓴다.
// 폴더·게시글은 누구나 조회, 게시글 편집/삭제만 '관리자 비밀번호'로 확인.

// 현재 이름(localStorage) — 오류 기록 등 내부에서 사용
function currentName() {
  try {
    return localStorage.getItem('name') || ''
  } catch {
    return ''
  }
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
export async function getFolders() {
  const { data, error } = await supabase
    .from('folders')
    .select('id, name, parent_id, sort_order')
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

// ── 오류 기록 (베스트에포트: 실패해도 throw 안 함) ──
export async function logClientError(message) {
  if (!supabase) return
  try {
    await supabase.rpc('log_client_error', {
      p_name: currentName(),
      p_message: String(message ?? '').slice(0, 500),
      p_context: `${location.pathname} · ${navigator.userAgent}`.slice(0, 300),
    })
  } catch {
    /* 로깅 실패는 조용히 무시 */
  }
}

// ── 체크 / 비고 (이름으로 기록) ──
export async function setItemStatus(name, id, status) {
  const { error } = await supabase.rpc('check_item', {
    p_name: name,
    p_item_id: id,
    p_status: status,
  })
  if (error) throw error
}
export async function setItemNote(name, id, note) {
  const { error } = await supabase.rpc('set_note', { p_name: name, p_item_id: id, p_note: note })
  if (error) throw error
}
export async function setMemo(boardId, memo) {
  const { error } = await supabase.rpc('set_memo', { p_board_id: boardId, p_memo: memo })
  if (error) throw error
}

// ── 게시글 (관리자 비밀번호로 확인) ──
export async function createBoard(author, board, items, adminPw, entryPw) {
  const { data, error } = await supabase.rpc('create_board', {
    p_author: author,
    p_board: board,
    p_items: items,
    p_admin_pw: adminPw,
    p_entry_pw: entryPw || '',
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
  return data // { ok, key } — key는 공유 링크 만들 때 사용
}
// 입장 확인: 입장 비밀번호 또는 공유 링크의 열쇠(k) 둘 중 하나면 통과
export async function verifyBoardEntry(boardId, pw, key) {
  const { data, error } = await supabase.rpc('verify_board_entry', {
    p_board_id: boardId,
    p_pw: pw || '',
    p_key: key || '',
  })
  if (error) throw error
  return data // { ok, key } | { ok:false, error }
}
// 입장 비밀번호 추가/변경/삭제 (빈 값이면 삭제=누구나 입장). 관리자 비번으로 확인
export async function setEntryPassword(boardId, adminPw, newEntry) {
  const { error } = await supabase.rpc('set_entry_password', {
    p_board_id: boardId,
    p_admin_pw: adminPw,
    p_new_entry: newEntry,
  })
  if (error) throw error
}

// ── 폴더 (모두 공개) ──
export async function createFolder(name, parentId) {
  const { data, error } = await supabase.rpc('create_folder', {
    p_name: name,
    p_parent_id: parentId,
  })
  if (error) throw error
  return data
}
export async function deleteFolder(folderId) {
  const { error } = await supabase.rpc('delete_folder', { p_folder_id: folderId })
  if (error) throw error
}
export async function moveBoard(boardId, targetFolderId) {
  const { error } = await supabase.rpc('move_board', {
    p_board_id: boardId,
    p_target_folder_id: targetFolderId,
  })
  if (error) throw error
}
export async function moveFolder(folderId, targetParentId) {
  const { error } = await supabase.rpc('move_folder', {
    p_folder_id: folderId,
    p_target_parent_id: targetParentId,
  })
  if (error) throw error
}

// ── 템플릿 (모두 함께 쓰는 공용 목록) ──
export async function getTemplates() {
  const { data, error } = await supabase.rpc('list_templates')
  if (error) throw error
  return data
}
export async function saveTemplate(owner, name, mode, categories, items, tableData) {
  const { data, error } = await supabase.rpc('save_template', {
    p_owner: owner,
    p_name: name,
    p_mode: mode,
    p_categories: categories,
    p_items: items,
    p_table_data: tableData,
  })
  if (error) throw error
  return data
}
export async function deleteTemplate(id) {
  const { error } = await supabase.rpc('delete_template', { p_id: id })
  if (error) throw error
}
