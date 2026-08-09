import { useEffect, useState } from 'react'
import DownloadModal from './components/DownloadModal.jsx'
import PlaylistModal from './components/PlaylistModal.jsx'
import StudioView from './components/StudioView.jsx'
import HistoryList from './components/HistoryList.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import UpdateFooter from './components/UpdateFooter.jsx'
import ShareApp from './components/ShareApp.jsx'
import NuvemConfig from './components/NuvemConfig.jsx'
import { UpdatesProvider } from './contexts/UpdatesContext.jsx'

// Lupinha: controle de tamanho da interface (Ctrl+= / Ctrl+- / Ctrl+0 também
// funcionam) — flutuante, visível em qualquer tela, com memória
function ZoomChip() {
  const [z, setZ] = useState(1)
  useEffect(() => {
    window.mptrix.ui?.zoomGet?.().then((v) => setZ(v || 1)).catch(() => {})
    const off = window.mptrix.ui?.onZoom?.((v) => setZ(v || 1))
    return off
  }, [])
  if (!window.mptrix.ui) return null
  return (
    <div className="zoom-chip" title="Tamanho da tela — atalhos: Ctrl+= aproxima, Ctrl+- afasta, Ctrl+0 normal">
      <span className="zoom-lupa">🔍</span>
      <button className="zoom-btn" onClick={() => window.mptrix.ui.zoom(-1)} aria-label="Diminuir tela">−</button>
      <button className="zoom-pct" onClick={() => window.mptrix.ui.zoom(0)} title="Clique pra voltar ao tamanho normal">
        {Math.round(z * 100)}%
      </button>
      <button className="zoom-btn" onClick={() => window.mptrix.ui.zoom(1)} aria-label="Aumentar tela">+</button>
    </div>
  )
}

// ÍCONES DESENHADOS, NÃO EMOJI.
//
// Emoji quebra a lei do proprio app: o documento manda um destaque unico
// (lima) e nada de cor solta -- e cada emoji chega com vermelho, amarelo e azul
// proprios. Alem disso ele muda de desenho conforme o Windows, entao nem
// controle do traco a gente tem.
//
// Aqui sao caminhos SVG de traco, na cor herdada (currentColor), com a mesma
// espessura em todos. Desenhados no codigo porque o app e 100% offline: fonte
// de icone vinda de CDN esta fora de questao.
const ICO = {
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  playlist: <><path d="M21 15V6" /><circle cx="18" cy="16" r="3" /><path d="M12 12H3M16 6H3M12 18H3" /></>,
  fast: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  audio_m4a: <path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2" />,
  audio_wav: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  video: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4" /></>,
  studio: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  baixar: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
}

function Ico({ nome, tamanho = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICO[nome] || ICO.baixar}
    </svg>
  )
}

// ETIQUETA TÉCNICA de cada cartão: formato e o que ele entrega, em mono e
// caixa-alta. É leitura de painel — o mesmo jeito do estúdio de dizer medida —
// e resolve na hora a pergunta que o título não responde ("isso me dá o quê?").
const PRESET_TAG = {
  music: 'MP3 · MÁXIMA · COM CAPA',
  playlist: 'MP3 · LOTE',
  fast: 'MP3 · MÉDIA · LEVE',
  audio_m4a: 'M4A · NATIVO · SEM PERDA',
  audio_wav: 'WAV · SEM COMPRESSÃO',
  video: 'MP4 · ATÉ 8K'
}

export default function App() {
  const [env, setEnv] = useState(null)
  const [outputDir, setOutputDir] = useState('')
  const [activePreset, setActivePreset] = useState(null)
  const [history, setHistory] = useState([])
  const [studioSource, setStudioSource] = useState(null)
  // estado da nuvem só pra LEITURA do console (o controle continua no painel
  // da nuvem, mais abaixo) — null enquanto não respondeu
  const [nuvemLigada, setNuvemLigada] = useState(null)
  useEffect(() => {
    let vivo = true
    const ler = async () => {
      try {
        const n = await window.mptrix.nuvem?.estado()
        if (vivo) setNuvemLigada(!!(n?.ligada && n?.temChave))
      } catch { /* sem nuvem configurada: a leitura mostra DESLIGADA */ }
    }
    ler()
    // o painel da nuvem fica na mesma tela: reconsulta de vez em quando pra a
    // leitura não mentir depois que a pessoa liga/desliga lá embaixo
    const t = setInterval(ler, 3000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

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
        {/* ================= CONSOLE ==================
            O problema nao era organizacao, era FALTA DE ESCALA: a tela inteira
            vivia entre 10 e 17px, tudo com o mesmo peso, e isso le como
            relatorio. Aqui a marca ocupa o tamanho que uma marca ocupa, e ao
            lado dela fica uma LEITURA DE INSTRUMENTO (destino, nuvem, acervo)
            no lugar da antiga linha de pasta -- estado do aparelho, nao
            formulario. */}
        <header className="console">
          <span className="console-mira tl" aria-hidden="true" />
          <span className="console-mira tr" aria-hidden="true" />
          <div className="console-marca">
            <span className="brand-hex brand-hex-lg" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" className="brand-glyph">
                <path d="M5 4.5h14l-5.2 7.5L19 19.5H5l5.2-7.5z" />
              </svg>
            </span>
            <div className="console-marca-texto">
              <h1 className="console-nome">MPTRIX</h1>
              <p className="console-lema">BAIXAR <i>·</i> SEPARAR <i>·</i> ENSAIAR</p>
            </div>
          </div>

          <div className="leitura">
            <div className="leitura-linha">
              <span className="leitura-rot">DESTINO</span>
              <span className="leitura-val" title={outputDir}>
                {outputDir ? outputDir.split(/[\/]/).filter(Boolean).slice(-1)[0] : '—'}
              </span>
              <span className="leitura-acoes">
                <button className="btn-ghost-min" onClick={openFolder}>abrir</button>
                <button className="btn-ghost-min" onClick={pickFolder}>mudar</button>
              </span>
            </div>
            <div className="leitura-linha">
              <span className="leitura-rot">NUVEM</span>
              <span className={`leitura-val ${nuvemLigada ? 'aceso' : ''}`}>
                {nuvemLigada === null ? '…' : nuvemLigada ? 'LIGADA' : 'DESLIGADA'}
              </span>
            </div>
            <div className="leitura-linha">
              <span className="leitura-rot">ACERVO</span>
              <span className="leitura-val num">{history.length}</span>
              <span className="leitura-sufixo">itens</span>
            </div>
          </div>
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

      {/* ESTUDIO PRIMEIRO E EM FAIXA LARGA: e o que o app tem de proprio, e
          estava escondido como mais um cartao igual aos seis de baixar. */}
      <section className="bloco">
        <h2 className="secao"><b>01</b> ESTÚDIO DE ENSAIO <span className="beta-tag">BETA</span></h2>
        <button className="faixa" onClick={openStudioFromFile}>
          <span className="faixa-fundo" aria-hidden="true" />
          <span className="faixa-corpo">
            <span className="faixa-titulo">Separar<br />instrumentos</span>
            <span className="faixa-lista">
              <i>voz</i><i>bateria</i><i>baixo</i><i>guitarra</i><i>piano</i><i>e o resto</i>
            </span>
            <span className="faixa-desc">
              Muda o tom, deixa mais lento, marca o compasso e ensaia por cima. Escolha uma
              música do computador ou pelo botão de estúdio de um item do acervo.
            </span>
          </span>
          <span className="faixa-ico" aria-hidden="true"><Ico nome="studio" tamanho={112} /></span>
        </button>
      </section>

      <section className="bloco">
        <h2 className="secao"><b>02</b> BAIXAR</h2>
        <div className="grade">
          {presets.map((p, i) => (
            <button
              key={p.id}
              className={`chip ${binariesOk ? '' : 'disabled'}`}
              onClick={() => binariesOk && setActivePreset(p)}
              disabled={!binariesOk}
            >
              <span className="chip-borda" aria-hidden="true" />
              <span className="chip-in">
                <span className="chip-topo">
                  <span className="chip-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="chip-ico" aria-hidden="true"><Ico nome={p.id} tamanho={18} /></span>
                </span>
                <span className="chip-nome">{p.name}</span>
                {PRESET_TAG[p.id] && <span className="chip-tag">{PRESET_TAG[p.id]}</span>}
                <span className="chip-desc">{p.description}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <NuvemConfig />

      <section className="bloco">
        <h2 className="secao"><b>03</b> ACERVO</h2>
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
      <ZoomChip />
    </UpdatesProvider>
  )
}
