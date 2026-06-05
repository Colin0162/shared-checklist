import { useState, useEffect } from 'react'
import { createBoard, updateBoard, deleteBoard, getTemplates, saveTemplate } from '../lib/api'
import ConfirmModal from './ConfirmModal'

let seq = 0
const newKey = () => 'k-' + ++seq

// 관리자 게시글 빌더 (생성/편집).
// props: token, author, adminPw, folderId, board, originalItems, nextSortOrder, onSaved, onCancel, onDeleted
function AdminEditor({ token, author, adminPw, folderId, board, originalItems, nextSortOrder, onSaved, onCancel, onDeleted }) {
  const isNew = !board

  const [title, setTitle] = useState(board?.title ?? '')
  const [mode, setMode] = useState(board?.mode ?? 'check')

  // 새 게시글일 때만: 편집 비밀번호 + 입장 설정
  const [newAdminPw, setNewAdminPw] = useState('')
  const [entryMode, setEntryMode] = useState('public') // 'public' | 'password'
  const [newEntryPw, setNewEntryPw] = useState('')

  // 대항목(카테고리): [{ key, name }]
  const [categories, setCategories] = useState(() =>
    (board?.categories ?? []).map((name) => ({ key: newKey(), name })),
  )

  // 항목 행: { key, id?, group_name, label, quantity, show_note }
  const [rows, setRows] = useState(() =>
    (originalItems ?? []).map((it) => ({
      key: it.id,
      id: it.id,
      group_name: it.group_name ?? '',
      label: it.label ?? '',
      quantity: it.quantity ?? '',
      show_note: it.show_note ?? false,
      assignee: it.assignee ?? '',
    })),
  )

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 템플릿
  const [templates, setTemplates] = useState([])
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [tplName, setTplName] = useState('')

  useEffect(() => {
    if (!token) return
    getTemplates()
      .then(setTemplates)
      .catch(() => {})
  }, [token])

  function loadTemplate(id) {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setMode(t.mode)
    setCategories((t.categories || []).map((name) => ({ key: newKey(), name })))
    setRows(
      (t.items || []).map((it) => ({
        key: newKey(),
        group_name: it.group_name || '',
        label: it.label || '',
        quantity: it.quantity || '',
        show_note: it.show_note ?? false,
        assignee: it.assignee || '',
      })),
    )
  }

  async function saveCurrentAsTemplate() {
    if (!tplName.trim()) {
      setErr('템플릿 이름을 입력하세요.')
      return
    }
    setErr('')
    try {
      const categoryList = categories.map((c) => c.name.trim()).filter(Boolean)
      const itemsStruct = rows
        .filter((r) => r.label.trim())
        .map((r) => ({
          group_name: r.group_name || '',
          label: r.label.trim(),
          quantity: mode === 'check' ? r.quantity || '' : '',
          show_note: r.show_note ?? false,
          assignee: r.assignee || '',
        }))
      await saveTemplate(token, tplName.trim(), mode, categoryList, itemsStruct)
      setTemplates(await getTemplates())
      setShowSaveTpl(false)
      setTplName('')
    } catch (e) {
      setErr(e.message)
    }
  }

  // ── 카테고리 조작 ──
  function addCategory() {
    setCategories((c) => [...c, { key: newKey(), name: '' }])
  }
  function renameCategory(key, name) {
    const old = categories.find((c) => c.key === key)?.name
    setCategories((c) => c.map((x) => (x.key === key ? { ...x, name } : x)))
    // 이 카테고리를 쓰던 항목들의 group_name 도 같이 바꿔줌
    if (old && old !== name) {
      setRows((rs) => rs.map((r) => (r.group_name === old ? { ...r, group_name: name } : r)))
    }
  }
  function removeCategory(key) {
    const name = categories.find((c) => c.key === key)?.name
    setCategories((c) => c.filter((x) => x.key !== key))
    if (name) setRows((rs) => rs.map((r) => (r.group_name === name ? { ...r, group_name: '' } : r)))
  }

  // ── 항목 조작 ──
  function addRow() {
    const lastGroup = rows.length ? rows[rows.length - 1].group_name : ''
    setRows((r) => [
      ...r,
      { key: newKey(), group_name: lastGroup, label: '', quantity: '', show_note: false, assignee: '' },
    ])
  }
  function updateRow(key, field, value) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
  }
  function removeRow(key) {
    setRows((r) => r.filter((row) => row.key !== key))
  }
  function move(key, dir) {
    setRows((r) => {
      const i = r.findIndex((x) => x.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= r.length) return r
      const copy = [...r]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  async function handleSave() {
    if (!title.trim()) {
      setErr('제목을 입력하세요.')
      return
    }
    if (isNew && !newAdminPw.trim()) {
      setErr('편집 비밀번호를 설정하세요.')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const categoryList = categories.map((c) => c.name.trim()).filter(Boolean)
      // 항목 payload (라벨 빈 행 제외, 화면 순서대로 sort_order)
      const itemsPayload = rows
        .filter((r) => r.label.trim())
        .map((r, i) => ({
          ...(r.id ? { id: r.id } : {}),
          group_name: r.group_name || '',
          label: r.label.trim(),
          quantity: mode === 'check' ? r.quantity || '' : '',
          show_note: r.show_note ?? false,
          assignee: r.assignee || '',
          sort_order: i,
        }))
      const boardPayload = {
        title: title.trim(),
        mode,
        categories: categoryList,
        folder_id: folderId || '', // 생성 시 이 폴더에 소속(수정 땐 서버가 무시)
        sort_order: isNew ? nextSortOrder : board.sort_order ?? 0,
      }
      if (isNew) {
        const entryPw = entryMode === 'password' ? newEntryPw.trim() : ''
        await createBoard(author, boardPayload, itemsPayload, newAdminPw.trim(), entryPw)
      } else {
        await updateBoard(board.id, adminPw, boardPayload, itemsPayload)
      }
      onSaved()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteBoard(board.id, adminPw)
      onDeleted()
    } catch (e) {
      setErr(e.message)
      setConfirmDelete(false)
    }
  }

  const categoryOptions = categories.map((c) => c.name.trim()).filter(Boolean)

  return (
    <section className="editor">
      <div className="editor-head">
        <h2>{isNew ? '새 게시글' : '게시글 편집'}</h2>
      </div>

      {err && <p className="error">오류: {err}</p>}

      <label className="field">
        <span className="field-label">제목</span>
        <input
          className="text-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
        />
      </label>

      <div className="field">
        <span className="field-label">형식</span>
        <div className="radio-row">
          <label>
            <input type="radio" name="mode" checked={mode === 'check'} onChange={() => setMode('check')} />
            체크박스
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'rate'} onChange={() => setMode('rate')} />
            상·중·하 평가
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === 'todo'} onChange={() => setMode('todo')} />
            할 일 리스트
          </label>
        </div>
      </div>

      {isNew && templates.length > 0 && (
        <div className="field">
          <span className="field-label">템플릿 불러오기</span>
          <select
            className="text-input"
            defaultValue=""
            onChange={(e) => e.target.value && loadTemplate(e.target.value)}
          >
            <option value="">— 선택 —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isNew && (
        <>
          <label className="field">
            <span className="field-label">관리자 비밀번호 (게시글을 수정할 때 필요)</span>
            <input
              className="text-input"
              type="password"
              value={newAdminPw}
              onChange={(e) => setNewAdminPw(e.target.value)}
              placeholder="편집 비밀번호"
            />
          </label>
          <div className="field">
            <span className="field-label">입장 설정</span>
            <div className="radio-row">
              <label>
                <input
                  type="radio"
                  name="entry"
                  checked={entryMode === 'public'}
                  onChange={() => setEntryMode('public')}
                />
                전체 공개
              </label>
              <label>
                <input
                  type="radio"
                  name="entry"
                  checked={entryMode === 'password'}
                  onChange={() => setEntryMode('password')}
                />
                비밀번호 입장
              </label>
            </div>
            {entryMode === 'password' && (
              <input
                className="text-input"
                type="password"
                style={{ marginTop: 8 }}
                value={newEntryPw}
                onChange={(e) => setNewEntryPw(e.target.value)}
                placeholder="입장 비밀번호"
              />
            )}
          </div>
        </>
      )}

      {/* 대항목(카테고리) */}
      <div className="field">
        <span className="field-label">대항목 (카테고리)</span>
        <ul className="cat-list">
          {categories.map((c) => (
            <li className="cat-row" key={c.key}>
              <input
                className="text-input"
                value={c.name}
                onChange={(e) => renameCategory(c.key, e.target.value)}
                placeholder="대항목 이름"
              />
              <button className="icon-btn" onClick={() => removeCategory(c.key)} title="삭제">✕</button>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={addCategory}>+ 대항목 추가</button>
      </div>

      {/* 항목 */}
      <div className="field">
        <span className="field-label">항목</span>
        <ul className="editor-rows">
          {rows.map((row) => (
            <li className="editor-row" key={row.key}>
              <select
                className="text-input row-cat"
                value={row.group_name}
                onChange={(e) => updateRow(row.key, 'group_name', e.target.value)}
              >
                <option value="">—</option>
                {categoryOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {row.group_name && !categoryOptions.includes(row.group_name) && (
                  <option value={row.group_name}>{row.group_name}</option>
                )}
              </select>
              {mode === 'todo' ? (
                <textarea
                  className="text-input row-label"
                  rows={2}
                  value={row.label}
                  onChange={(e) => updateRow(row.key, 'label', e.target.value)}
                  placeholder="내용 (링크/줄바꿈 가능)"
                />
              ) : (
                <input
                  className="text-input row-label"
                  value={row.label}
                  onChange={(e) => updateRow(row.key, 'label', e.target.value)}
                  placeholder="항목명"
                />
              )}
              {mode === 'check' && (
                <input
                  className="text-input row-qty"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, 'quantity', e.target.value)}
                  placeholder="수량(선택)"
                />
              )}
              {mode !== 'todo' && (
                <input
                  className="text-input row-assignee"
                  value={row.assignee}
                  onChange={(e) => updateRow(row.key, 'assignee', e.target.value)}
                  placeholder="담당자(선택)"
                />
              )}
              {mode !== 'todo' && (
                <label className="row-note" title="비고칸 사용">
                  <input
                    type="checkbox"
                    checked={row.show_note}
                    onChange={(e) => updateRow(row.key, 'show_note', e.target.checked)}
                  />
                  비고
                </label>
              )}
              <div className="row-actions">
                <button className="icon-btn" onClick={() => move(row.key, -1)} title="위로">↑</button>
                <button className="icon-btn" onClick={() => move(row.key, 1)} title="아래로">↓</button>
                <button className="icon-btn" onClick={() => removeRow(row.key)} title="삭제">✕</button>
              </div>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={addRow}>+ 항목 추가</button>
      </div>

      <div className="field">
        {showSaveTpl ? (
          <div className="folder-new">
            <input
              className="text-input"
              placeholder="템플릿 이름"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
            />
            <button className="btn btn-primary" onClick={saveCurrentAsTemplate}>저장</button>
            <button className="btn" onClick={() => setShowSaveTpl(false)}>취소</button>
          </div>
        ) : (
          <button className="btn" onClick={() => setShowSaveTpl(true)}>
            현재 구성을 템플릿으로 저장
          </button>
        )}
      </div>

      <div className="editor-foot">
        <div className="editor-foot-left">
          {!isNew && (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              게시글 삭제
            </button>
          )}
        </div>
        <div className="editor-foot-right">
          <button className="btn" onClick={onCancel} disabled={saving}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          message={`'${board.title}' 게시글을 삭제할까요? 항목과 체크 기록이 모두 사라집니다.`}
          confirmLabel="삭제"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </section>
  )
}

export default AdminEditor
