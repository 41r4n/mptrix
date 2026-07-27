import { useEffect, useRef, useState } from 'react'

export default function EditEntryModal({ entry, onClose, onSaved }) {
  const initial = entry.customName || entry.displayName || entry.title || ''
  const [name, setName] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
    return () => clearTimeout(t)
  }, [])

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Escreve um nome.')
      return
    }
    if (trimmed === (entry.customName || entry.displayName)) {
      onClose()
      return
    }
    setSaving(true)
    setError('')
    const result = await window.mptrix.history.rename(entry.id, trimmed)
    setSaving(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    onSaved?.(result.updated)
    onClose()
  }

  const restoreDefault = () => {
    setName(entry.displayName || entry.title || '')
    setError('')
  }

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter') save()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-edit" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <header className="edit-header">
          <div className="edit-header-icon">✏️</div>
          <div className="edit-header-text">
            <h3>Renomear</h3>
            <p className="modal-sub">O arquivo no Windows também vai ser renomeado junto.</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="modal-body edit-body">
          <div className="edit-field">
            <label htmlFor="edit-name">Nome</label>
            <input
              id="edit-name"
              ref={inputRef}
              type="text"
              className="edit-input"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              onKeyDown={handleKey}
              spellCheck={false}
              placeholder="Como você quer chamar esse arquivo"
            />
            <div className="edit-input-hint">
              {name.length > 0
                ? <>{name.length} caractere{name.length !== 1 ? 's' : ''}</>
                : <>&nbsp;</>
              }
            </div>
          </div>

          {error && <div className="form-error">⚠ {error}</div>}

          <div className="info-card">
            <div className="info-card-header">Detalhes do arquivo</div>

            <div className="info-row">
              <div className="info-row-icon">📄</div>
              <div className="info-row-content">
                <div className="info-row-label">Nome original do YouTube</div>
                <div className="info-row-value">{entry.title}</div>
              </div>
            </div>

            {entry.url && (
              <div className="info-row">
                <div className="info-row-icon">🔗</div>
                <div className="info-row-content">
                  <div className="info-row-label">Link do vídeo</div>
                  <span
                    className="info-row-value info-link"
                    title="Abrir no navegador"
                    onClick={() => window.mptrix.shell.openExternal(entry.url)}
                  >
                    {entry.url}
                  </span>
                </div>
              </div>
            )}

            {entry.primaryFile && (
              <div className="info-row">
                <div className="info-row-icon">📁</div>
                <div className="info-row-content">
                  <div className="info-row-label">Local no computador</div>
                  <div className="info-row-value info-path">{entry.primaryFile}</div>
                </div>
              </div>
            )}
          </div>

          <div className="edit-footer">
            <button className="link-btn" onClick={restoreDefault} type="button">
              ↺ usar nome automático
            </button>
            <div className="edit-footer-actions">
              <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
