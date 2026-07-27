import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  message,
  list,
  note,
  checkbox,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => confirmRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  if (!open) return null

  const handleKey = (e) => {
    if (e.key === 'Escape') onCancel?.()
    if (e.key === 'Enter') onConfirm?.()
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal modal-small"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="confirm-body">
          <div className={`confirm-icon ${danger ? 'confirm-icon-danger' : 'confirm-icon-warn'}`}>
            {danger ? '⚠' : '?'}
          </div>
          <h3 className="confirm-title">{title}</h3>
          {message && <p className="confirm-message">{message}</p>}
          {list && list.length > 0 && (
            <ul className="confirm-list">
              {list.map((item, i) => <li key={i} title={item}>{item}</li>)}
            </ul>
          )}
          {note && <p className="confirm-note">{note}</p>}
          {checkbox && (
            <label className="confirm-checkbox">
              <input
                type="checkbox"
                checked={checkbox.checked}
                onChange={(e) => checkbox.onChange?.(e.target.checked)}
              />
              {' '}{checkbox.label}
            </label>
          )}
          <div className="confirm-actions">
            <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
            <button
              ref={confirmRef}
              className={danger ? 'btn-danger' : 'btn-primary'}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
