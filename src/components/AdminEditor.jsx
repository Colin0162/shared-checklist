import { useState } from 'react'
import {
  createBoard,
  updateBoard,
  deleteBoard,
  insertItems,
  updateItemStructure,
  deleteItem,
} from '../lib/api'
import ConfirmModal from './ConfirmModal'

// 새 행에 줄 임시 키 (DB id가 없는 행 구분용)
let tmpCounter = 0
const tmpKey = () => 'tmp-' + ++tmpCounter

// 관리자 게시글 빌더 (생성/편집).
// props:
//   board         : 편집 대상 게시글(없으면 새로 만들기)
//   originalItems : 편집 대상의 기존 항목들(구조+상태) — diff용
//   nextSortOrder : 새 게시글일 때 부여할 정렬값
//   onSaved, onCancel, onDeleted
function AdminEditor({ board, originalItems, nextSortOrder, onSaved, onCancel, onDeleted }) {
  const isNew = !board

  const [title, setTitle] = useState(board?.title ?? '')
  const [mode, setMode] = useState(board?.mode ?? 'check')
  const [showQuantity, setShowQuantity] = useState(board?.show_quantity ?? false)
  const [showNote, setShowNote] = useState(board?.show_note ?? true)

  // 편집용 행: { key, id?, group_name, label, quantity }
  const [rows, setRows] = useState(() =>
    (originalItems ?? []).map((it) => ({
      key: it.id,
      id: it.id,
      group_name: it.group_name,
      label: it.label,
      quantity: it.quantity,
    })),
  )

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function addRow() {
    const lastGroup = rows.length ? rows[rows.length - 1].group_name : ''
    setRows((r) => [...r, { key: tmpKey(), group_name: lastGroup, label: '', quantity: '' }])
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
      const fields = {
        title: title.trim(),
        mode,
        show_quantity: showQuantity,
        show_note: showNote,
      }

      // 라벨이 빈 행은 제외하고, 화면 순서대로 sort_order 부여
      const ordered = rows
        .filter((r) => r.label.trim())
        .map((r, i) => ({ ...r, label: r.label.trim(), sort_order: i }))

      if (isNew) {
        const created = await createBoard({ ...fields, sort_order: nextSortOrder })
        await insertItems(created.id, ordered)
      } else {
        await updateBoard(board.id, fields)
        // 항목 diff: 기존 id는 update, 새 행은 insert, 빠진 기존은 delete (상태/비고 보존)
        const toUpdate = ordered.filter((r) => r.id)
        const toInsert = ordered.filter((r) => !r.id)
        const keepIds = new Set(toUpdate.map((r) => r.id))
        const toDelete = (originalItems ?? []).filter((it) => !keepIds.has(it.id))

        await Promise.all([
          ...toDelete.map((it) => deleteItem(it.id)),
          ...toUpdate.map((r) =>
            updateItemStructure(r.id, {
              group_name: r.group_name || '',
              label: r.label,
              quantity: r.quantity || '',
              sort_order: r.sort_order,
            }),
          ),
        ])
        await insertItems(board.id, toInsert)
      }
      onSaved()
    } catch (e) {
      setErr(e.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteBoard(board.id)
      onDeleted()
    } catch (e) {
      setErr(e.message)
      setConfirmDelete(false)
    }
  }

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
            <input
              type="radio"
              name="mode"
              checked={mode === 'check'}
              onChange={() => setMode('check')}
            />
            체크박스
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              checked={mode === 'rate'}
              onChange={() => setMode('rate')}
            />
            상·중·하 평가
          </label>
        </div>
      </div>

      <div className="field">
        <span className="field-label">옵션</span>
        <div className="radio-row">
          <label>
            <input
              type="checkbox"
              checked={showQuantity}
              onChange={(e) => setShowQuantity(e.target.checked)}
            />
            수량 칸
          </label>
          <label>
            <input
              type="checkbox"
              checked={showNote}
              onChange={(e) => setShowNote(e.target.checked)}
            />
            비고 칸 (누구나 입력)
          </label>
        </div>
      </div>

      <div className="field">
        <span className="field-label">항목</span>
        <ul className="editor-rows">
          {rows.map((row) => (
            <li className="editor-row" key={row.key}>
              <input
                className="text-input row-group"
                value={row.group_name}
                onChange={(e) => updateRow(row.key, 'group_name', e.target.value)}
                placeholder="소제목(선택)"
              />
              <input
                className="text-input row-label"
                value={row.label}
                onChange={(e) => updateRow(row.key, 'label', e.target.value)}
                placeholder="항목명"
              />
              {showQuantity && (
                <input
                  className="text-input row-qty"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.key, 'quantity', e.target.value)}
                  placeholder="수량"
                />
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
