import { useEffect, useState } from 'react'

function formatBytes(b) {
  if (!b) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let v = b, i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return v.toFixed(v >= 10 || i < 2 ? 0 : 1) + ' ' + u[i]
}

export default function ShareApp() {
  const [installer, setInstaller] = useState(null)
  const [zipping, setZipping] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    window.mptrix.app.findInstaller().then(setInstaller)
  }, [])

  if (!installer) return null

  const copyToClipboard = async () => {
    const r = await window.mptrix.shell.copyFilesToClipboard([installer.path])
    if (r?.error) setStatus({ kind: 'error', text: r.error })
    else setStatus({ kind: 'ok', text: 'Instalador copiado! Cola onde quiser com Ctrl+V (WhatsApp Web, Discord, email…)' })
    setTimeout(() => setStatus(null), 5000)
  }

  const showInExplorer = () => window.mptrix.shell.showInFolder(installer.path)

  const openInstaller = () => window.mptrix.shell.openPath(installer.path)

  const zipIt = async () => {
    setZipping(true)
    setStatus(null)
    const r = await window.mptrix.shell.zipFile(installer.path)
    setZipping(false)
    if (r?.error) {
      setStatus({ kind: 'error', text: 'Erro ao compactar: ' + r.error })
    } else {
      setStatus({ kind: 'ok', text: `ZIP criado (${formatBytes(r.size)}). Mostrando no Explorer…` })
      window.mptrix.shell.showInFolder(r.zipPath)
    }
    setTimeout(() => setStatus(null), 5000)
  }

  const openDrive = async () => {
    setStatus(null)
    const r = await window.mptrix.shell.copyFilesToClipboard([installer.path])
    if (r?.error) {
      setStatus({ kind: 'error', text: 'Erro ao copiar o arquivo: ' + r.error })
      setTimeout(() => setStatus(null), 5000)
      return
    }
    window.mptrix.shell.openExternal('https://drive.google.com/drive/my-drive')
    setStatus({
      kind: 'ok',
      text: 'Drive aberto! Entra em qualquer pasta e aperta Ctrl+V pra colar o instalador. Vai subir como anexo.'
    })
    setTimeout(() => setStatus(null), 8000)
  }

  return (
    <section className="share-app">
      <div className="share-app-head">
        <div>
          <h3>📤 Compartilhar este app</h3>
          <p className="muted small">
            Você tem um instalador pronto pra mandar pros seus amigos. {installer.name} ({formatBytes(installer.size)})
          </p>
        </div>
      </div>

      <div className="share-app-grid">
        <button className="share-tile" onClick={copyToClipboard}>
          <span className="share-tile-icon">📋</span>
          <span className="share-tile-title">Copiar arquivo</span>
          <span className="share-tile-desc">Cola em WhatsApp Web, Discord, email… com Ctrl+V</span>
        </button>

        <button className="share-tile" onClick={showInExplorer}>
          <span className="share-tile-icon">📁</span>
          <span className="share-tile-title">Mostrar no Explorer</span>
          <span className="share-tile-desc">Abre a pasta com o instalador selecionado</span>
        </button>

        <button className="share-tile" onClick={zipIt} disabled={zipping}>
          <span className="share-tile-icon">🗜️</span>
          <span className="share-tile-title">{zipping ? 'Compactando…' : 'Compactar em ZIP'}</span>
          <span className="share-tile-desc">Cria .zip ao lado pra subir em serviços que limitam .exe</span>
        </button>

        <button className="share-tile" onClick={openDrive}>
          <span className="share-tile-icon">🌐</span>
          <span className="share-tile-title">Copiar + abrir Drive</span>
          <span className="share-tile-desc">Copia o instalador e abre o Drive. Cola com Ctrl+V em qualquer pasta.</span>
        </button>

        <button className="share-tile" onClick={openInstaller}>
          <span className="share-tile-icon">▶️</span>
          <span className="share-tile-title">Executar instalador</span>
          <span className="share-tile-desc">Testa você mesmo antes de mandar</span>
        </button>
      </div>

      {status && (
        <div className={`share-status share-status-${status.kind}`}>{status.text}</div>
      )}
    </section>
  )
}
