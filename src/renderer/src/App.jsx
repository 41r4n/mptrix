import { useEffect, useState } from 'react'
import DownloadModal from './components/DownloadModal.jsx'
import PlaylistModal from './components/PlaylistModal.jsx'
import StudioView from './components/StudioView.jsx'
import HistoryList from './components/HistoryList.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import UpdateFooter from './components/UpdateFooter.jsx'
import ShareApp from './components/ShareApp.jsx'
import { UpdatesProvider } from './contexts/UpdatesContext.jsx'

const PRESET_ICONS = {
  music: '🎵',
  playlist: '📀',
  fast: '⚡',
  video: '🎬'
}

export default function App() {
  const [env, setEnv] = useState(null)
  const [outputDir, setOutputDir] = useState('')
  const [activePreset, setActivePreset] = useState(null)
  const [history, setHistory] = useState([])
  const [studioSource, setStudioSource] = useState(null)

  useEffect(() => {
    window.mptrix.getEnvironment().then((e) => {
      setEnv(e)
      setOutputDir(e.settings.downloadDir)
      setHistory(e.history || [])
    })
    const off = window.mptrix.history.onChanged((next) => setHistory(next))
    return off
  }, [])

  const presets = env?.presets ?? []
  const binariesOk = env && env.binariesPresent.ytDlp && env.binariesPresent.ffmpeg

  const pickFolder = async () => {
    const picked = await window.mptrix.settings.pickDir()
    if (picked) setOutputDir(picked)
  }

  const openFolder = async () => {
    if (outputDir) await window.mptrix.shell.openPath(outputDir)
  }

  const openStudioFromFile = async () => {
    const path = await window.mptrix.studio.pickAudio()
    if (!path) return
    const title = path.split(/[\\/]/).pop().replace(/\.[a-z0-9]{2,5}$/i, '')
    setStudioSource({ path, title })
  }

  const openStudioFromEntry = (entry) => {
    if (!entry?.primaryFile) return
    setStudioSource({
      path: entry.primaryFile,
      title: entry.customName || entry.displayName || entry.title || 'Estúdio'
    })
  }

  const openQuickEditFromEntry = (entry) => {
    if (!entry?.primaryFile) return
    setStudioSource({
      path: entry.primaryFile,
      title: entry.customName || entry.displayName || entry.title || 'Edição rápida',
      model: 'quick'
    })
  }

  if (!env) {
    return (
      <div className="app">
        <p className="muted">Carregando…</p>
      </div>
    )
  }

  return (
    <UpdatesProvider>
      <div className="app">
        <header className="hero">
          <h1>MPTRIX</h1>
          <p className="tagline">Baixe MP3 e MP4 do YouTube em um clique.</p>
        </header>

        <UpdateBanner />

        {!binariesOk && (
        <div className="banner banner-error">
          <strong>Binários ausentes.</strong>{' '}
          Coloque <code>yt-dlp.exe</code> e <code>ffmpeg.exe</code> em <code>resources/bin/</code> e reinicie.
          <ul>
            <li className={env.binariesPresent.ytDlp ? 'ok' : 'missing'}>
              yt-dlp.exe — {env.binariesPresent.ytDlp ? 'ok' : 'faltando'}
            </li>
            <li className={env.binariesPresent.ffmpeg ? 'ok' : 'missing'}>
              ffmpeg.exe — {env.binariesPresent.ffmpeg ? 'ok' : 'faltando'}
            </li>
          </ul>
        </div>
      )}

      <section className="folder-row">
        <div className="folder-info">
          <span className="folder-label">Pasta de destino</span>
          <span className="folder-path" title={outputDir}>{outputDir || '(nenhuma)'}</span>
        </div>
        <div className="folder-actions">
          <button className="btn-secondary" onClick={openFolder}>Abrir</button>
          <button className="btn-secondary" onClick={pickFolder}>Mudar…</button>
        </div>
      </section>

      <section>
        <h2>O que você quer baixar?</h2>
        <div className="cards">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`card ${binariesOk ? '' : 'disabled'}`}
              onClick={() => binariesOk && setActivePreset(p)}
              disabled={!binariesOk}
            >
              <span className="card-icon">{PRESET_ICONS[p.id] ?? '⬇'}</span>
              <span className="card-name">{p.name}</span>
              <span className="card-desc">{p.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Estúdio de ensaio <span className="beta-tag">BETA</span></h2>
        <div className="cards">
          <button className="card studio-card" onClick={openStudioFromFile}>
            <span className="card-icon">🎛️</span>
            <span className="card-name">Separar instrumentos</span>
            <span className="card-desc">
              Isole voz, bateria, baixo e mais. Mude o tom, deixe mais lento e ensaie por cima —
              tudo no seu PC. Escolha uma música do computador ou clique no 🎛️ de um item do histórico.
            </span>
          </button>
        </div>
      </section>

      <section>
        <h2>Histórico</h2>
        <HistoryList
          history={history}
          onChange={setHistory}
          onOpenStudio={openStudioFromEntry}
          onQuickEdit={openQuickEditFromEntry}
        />
      </section>

      <ShareApp />

      {activePreset && activePreset.id === 'playlist' && (
        <PlaylistModal
          outputDir={outputDir}
          onClose={() => setActivePreset(null)}
          onPickFolder={pickFolder}
        />
      )}

      {activePreset && activePreset.id !== 'playlist' && (
        <DownloadModal
          preset={activePreset}
          outputDir={outputDir}
          history={history}
          onClose={() => setActivePreset(null)}
          onPickFolder={pickFolder}
        />
      )}

        {studioSource && (
          <StudioView source={studioSource} onClose={() => setStudioSource(null)} />
        )}

        <UpdateFooter />
      </div>
    </UpdatesProvider>
  )
}
