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
// 게시글은 '보이는 폴더'의 것만 서버(RPC)가 내려줌 → 안 보이는 폴더 게시글은 숨겨짐.
// 토큰이 없으면(로그인 전) 호출하지 않음 — 인자 없이 호출하면 RPC를 못 찾는 오류가 남.
export async function getBoards(token) {
  if (!token) return []
  const { data, error } = await supabase.rpc('list_visible_boards', { p_token: token })
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

// ── 에러 로깅(가벼운 버전) ──
// 현재 로그인 토큰을 localStorage에서 직접 읽어, 사용자가 본 에러를 서버에 남긴다.
function currentToken() {
  try {
    return JSON.parse(localStorage.getItem('user'))?.token || null
  } catch {
    return null
  }
}
// 에러 기록(베스트에포트): 실패해도 절대 throw 안 함(앱 흐름·무한루프 방지)
export async function logClientError(message) {
  if (!supabase) return
  try {
    await supabase.rpc('log_client_error', {
      p_token: currentToken(),
      p_message: String(message ?? '').slice(0, 500),
      p_context: `${location.pathname} · ${navigator.userAgent}`.slice(0, 300),
    })
  } catch {
    /* 로깅 실패는 조용히 무시 */
  }
}
export async function getClientErrors(token, limit = 50) {
  const { data, error } = await supabase.rpc('list_client_errors', { p_token: token, p_limit: limit })
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
// 입장 비밀번호 추가/변경/삭제 (빈 문자열이면 삭제=전체 공개). 편집비번(adminPw)로 인증.
export async function setEntryPassword(token, boardId, adminPw, newEntry) {
  const { error } = await supabase.rpc('set_entry_password', {
    p_token: token,
    p_board_id: boardId,
    p_admin_pw: adminPw,
    p_new_entry: newEntry,
  })
  if (error) throw error
}

// ── 폴더 (공유 모델) ──
// 보이는 폴더만: 공개(기본) + 내 개인 + 내가 참여한 공유. (서버 RPC가 걸러서 내려줌)
// 토큰이 없으면(로그인 전) 호출하지 않음 — 인자 없이 호출하면 RPC를 못 찾는 오류가 남.
export async function getFolders(token) {
  if (!token) return []
  const { data, error } = await supabase.rpc('list_visible_folders', { p_token: token })
  if (error) throw error
  return data
}
// 새 폴더는 무조건 개인(private). 소유자 = 본인.
export async function createFolder(token, name, parentId) {
  const { data, error } = await supabase.rpc('create_folder', {
    p_token: token,
    p_name: name,
    p_parent_id: parentId,
  })
  if (error) throw error
  return data
}
export async function deleteFolder(token, folderId) {
  const { error } = await supabase.rpc('delete_folder', { p_token: token, p_folder_id: folderId })
  if (error) throw error
}
// 개인 폴더를 공유로 전환 / 공유 폴더 암호 변경 (최상위 폴더만)
export async function shareFolder(token, folderId, password) {
  const { error } = await supabase.rpc('share_folder', {
    p_token: token,
    p_folder_id: folderId,
    p_password: password,
  })
  if (error) throw error
}
// 공유 해제 → 개인으로 (폴더 관리자만)
export async function unshareFolder(token, folderId) {
  const { error } = await supabase.rpc('unshare_folder', { p_token: token, p_folder_id: folderId })
  if (error) throw error
}
// 암호(키워드)로 공유 폴더 참여 → { ok, joined } | { ok:false, error }
export async function joinFolder(token, password) {
  const { data, error } = await supabase.rpc('join_folder', { p_token: token, p_password: password })
  if (error) throw error
  return data
}
// 공유 폴더에서 나가기
export async function leaveFolder(token, folderId) {
  const { error } = await supabase.rpc('leave_folder', { p_token: token, p_folder_id: folderId })
  if (error) throw error
}
// 참여자 목록 / 내보내기 / 관리자 넘기기
export async function listFolderMembers(token, folderId) {
  const { data, error } = await supabase.rpc('list_folder_members', {
    p_token: token,
    p_folder_id: folderId,
  })
  if (error) throw error
  return data
}
export async function kickMember(token, folderId, userId) {
  const { error } = await supabase.rpc('kick_member', {
    p_token: token,
    p_folder_id: folderId,
    p_user_id: userId,
  })
  if (error) throw error
}
export async function transferFolderAdmin(token, folderId, userId) {
  const { error } = await supabase.rpc('transfer_folder_admin', {
    p_token: token,
    p_folder_id: folderId,
    p_user_id: userId,
  })
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
