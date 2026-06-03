// 재확인 모달. 오버레이를 누르거나 취소하면 닫힌다.
// props: message, confirmLabel?, onConfirm, onCancel
function ConfirmModal({ message, confirmLabel = '확인', onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="modal-msg">{message}</p>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>취소</button>
          <button className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
