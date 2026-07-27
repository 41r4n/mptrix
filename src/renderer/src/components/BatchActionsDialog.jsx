export default function BatchActionsDialog({ open, count, onClose, onDelete, onShare }) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-actions-picker" onClick={(e) => e.stopPropagation()}>
        <header className="actions-header">
          <h3>O que fazer com {count} item{count !== 1 ? 's' : ''}?</h3>
          <button className="btn-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="actions-body">
          <button className="action-tile action-tile-share" onClick={onShare}>
            <div className="action-tile-icon">📤</div>
            <div className="action-tile-text">
              <div className="action-tile-title">Compartilhar</div>
              <div className="action-tile-desc">
                Copia os arquivos pra área de transferência.
                Cola em WhatsApp Web, Discord, email, etc. com <kbd>Ctrl</kbd>+<kbd>V</kbd>.
              </div>
            </div>
          </button>

          <button className="action-tile action-tile-delete" onClick={onDelete}>
            <div className="action-tile-icon">🗑️</div>
            <div className="action-tile-text">
              <div className="action-tile-title">Apagar do histórico</div>
              <div className="action-tile-desc">
                Apaga de verdade: sai da lista, o arquivo vai pra Lixeira do Windows
                e as faixas separadas são removidas. Pede confirmação duas vezes.
              </div>
            </div>
          </button>
        </div>

        <div className="actions-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
