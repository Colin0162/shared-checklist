import { useState } from 'react'
import { saveBoard, deleteBoard } from '../lib/api'
import ConfirmModal from './ConfirmModal'

let seq = 0
const newKey = () => 'k-' + ++seq

// 관리자 게시글 빌더 (생성/편집).
// props: token, board, originalItems, nextSortOrder, onSaved, onCancel, onDeleted
function AdminEditor({ token, board, originalItems, nextSortOrder, onSaved, onCancel, onDeleted }) {
  const isNew = !board

  const [title, setTitle] = useState(board?.title ?? '')
  const [mode, setMode] = useState(board?.mode ?? 'check')

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
        ...(isNew ? {} : { id: board.id }),
        title: title.trim(),
        mode,
        categories: categoryList,
        sort_order: isNew ? nextSortOrder : board.sort_order ?? 0,
      }
      // 한 번의 RPC로 보드+항목 저장 (서버에서 관리자 검증 + 항목 diff로 체크상태 보존)
      await saveBoard(token, boardPayload, itemsPayload)
      onSaved()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteBoard(token, board.id)
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
          placeholder="예: 6월 29일 교리 준비물"
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
        </div>
      </div>

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
                placeholder="예: 전체 필수품목"
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
                <option value="">(대항목 없음)</option>
                {categoryOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {row.group_name && !categoryOptions.includes(row.group_name) && (
                  <option value={row.group_name}>{row.group_name}</option>
                )}
              </select>
              <input
                className="text-input row-label"
                value={row.label}
                onChange={(e) => updateRow(row.key, 'label', e.target.value)}
                placeholder="항목명"
              />
              {mode === 'check' && (
                <input
                  className="text-input row-qty"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, 'quantity', e.target.value)}
                  placeholder="수량(선택)"
                />
              )}
              <input
                className="text-input row-assignee"
                value={row.assignee}
                onChange={(e) => updateRow(row.key, 'assignee', e.target.value)}
                placeholder="담당자(선택)"
              />
              <label className="row-note" title="비고칸 사용">
                <input
                  type="checkbox"
                  checked={row.show_note}
                  onChange={(e) => updateRow(row.key, 'show_note', e.target.checked)}
                />
                비고
              </label>
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
