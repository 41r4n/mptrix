import { useUpdates } from '../contexts/UpdatesContext.jsx'

export default function UpdateBanner() {
  const { showBanner, checkInfo, runUpdate, dismiss } = useUpdates()
  if (!showBanner) return null

  return (
    <div className="update-banner">
      <div className="update-banner-icon">🆕</div>
      <div className="update-banner-text">
        <strong>Nova versão do yt-dlp disponível</strong>
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
          Se o YouTube mudou alguma coisa e seus downloads pararam de funcionar, atualizar geralmente resolve.
        </div>
      </div>
      <div className="update-banner-actions">
        <button className="btn-primary btn-small" onClick={runUpdate}>Atualizar agora</button>
        <button className="link-btn" onClick={dismiss}>depois</button>
      </div>
    </div>
  )
}
