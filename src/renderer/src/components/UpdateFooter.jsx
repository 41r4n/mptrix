import { useState } from 'react'
import { useUpdates } from '../contexts/UpdatesContext.jsx'
import UpdateHelpModal from './UpdateHelpModal.jsx'

function computeStatus({ versions, checkInfo, errorMsg, checking }) {
  if (!versions.ytDlp) return { key: 'missing', label: 'Faltando', title: 'yt-dlp não encontrado' }
  if (errorMsg) return { key: 'error', label: 'Erro', title: errorMsg }
  if (checking && !checkInfo) return { key: 'unknown', label: 'Verificando…', title: 'Checando GitHub' }
  if (!checkInfo) return { key: 'unknown', label: 'Não verificado', title: 'Ainda não verifiquei a versão mais nova' }
  if (checkInfo.hasUpdate) return {
    key: 'update',
    label: 'Atualização disponível',
    title: `Nova versão: ${checkInfo.latest}`
  }
  const title = checkInfo?.aheadOfStable
    ? `Você tem a versão mais recente (nightly ${checkInfo.latest})`
    : 'Você tem a versão mais recente'
  return { key: 'ok', label: 'Em dia', title }
}

function formatRel(ts) {
  if (!ts) return ''
  const sec = Math.round((Date["now"]() - ts) / 1000)
  if (sec < 60) return 'agora'
  return 'há ' + Math.round(sec / 60) + 'min'
}

export default function UpdateFooter() {
  const ctx = useUpdates()
  const { versions, checkInfo, checking, updating, errorMsg, check, lastCheckedAt } = ctx
  const [helpOpen, setHelpOpen] = useState(false)
  const status = computeStatus(ctx)

  return (
    <>
      <footer className="version-footer">
        <div className="version-info">
          <span className={`status-dot status-${status.key}`} title={status.title}>●</span>
          {versions.ytDlp ? (
            <span className="version-pill" title="Versão do yt-dlp instalada">
              yt-dlp <code>{versions.ytDlp}</code>
            </span>
          ) : (
            <span className="version-pill missing">yt-dlp ausente</span>
          )}
          {versions.ffmpeg && (
            <span className="version-pill" title="Versão do ffmpeg instalada">
              ffmpeg <code>{versions.ffmpeg.split('-')[0]}</code>
            </span>
          )}
          <span className={`status-label status-label-${status.key}`}>{status.label}</span>
        </div>
        <div className="version-actions">
          {lastCheckedAt && (
            <span className="last-checked-rel" title="Última checagem">
              última checagem {formatRel(lastCheckedAt)}
            </span>
          )}
          <button
            className="link-btn"
            onClick={() => check(true)}
            disabled={checking || updating}
          >
            {checking ? 'verificando…' : 'verificar atualizações'}
          </button>
          <button
            className="help-btn"
            onClick={() => setHelpOpen(true)}
            title="O que é isso? Como funciona?"
            aria-label="Ajuda sobre atualizações"
          >?</button>
        </div>
      </footer>

      <UpdateHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}
