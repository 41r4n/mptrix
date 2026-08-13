import { useUpdates } from '../contexts/UpdatesContext.jsx'
import Ico from './Icones.jsx'

export default function UpdateBanner() {
  const { showBanner, checkInfo, runUpdate, dismiss } = useUpdates()
  if (!showBanner) return null

  return (
    <div className="update-banner">
      {/* desenhado, nunca emoji — regra da casa */}
      <div className="update-banner-icon"><Ico nome="baixar" tamanho={18} /></div>
      <div className="update-banner-text">
        <strong>Novo motor de download disponível</strong>
        <div className="update-banner-sub">
          Atual: <code>{checkInfo.current || '?'}</code>{' → '}
          Nova: <code>{checkInfo.latest}</code>
          {checkInfo.publishedAt && (
            <span className="muted">
              {' · publicada em '}
              {new Date(checkInfo.publishedAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
        <div className="update-banner-hint muted small">
          É a peça que conversa com o YouTube. Se seus downloads pararam de funcionar do nada, atualizar geralmente resolve.
        </div>
      </div>
      <div className="update-banner-actions">
        <button className="btn-primary btn-small" onClick={runUpdate}>Atualizar agora</button>
        <button className="link-btn" onClick={dismiss}>depois</button>
      </div>
    </div>
  )
}
