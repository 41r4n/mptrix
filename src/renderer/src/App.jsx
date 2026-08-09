import { useEffect, useState } from 'react'
import DownloadModal from './components/DownloadModal.jsx'
import Omnitrix from './components/Omnitrix.jsx'
import PlaylistModal from './components/PlaylistModal.jsx'
import StudioView from './components/StudioView.jsx'
import HistoryList from './components/HistoryList.jsx'
import UpdateBanner from './components/UpdateBanner.jsx'
import UpdateFooter from './components/UpdateFooter.jsx'
import ShareApp from './components/ShareApp.jsx'
import NuvemConfig from './components/NuvemConfig.jsx'
import Ico from './components/Icones.jsx'
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

// (os ícones agora moram em components/Icones.jsx, compartilhados com o acervo)

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
  // link que a roda entregou, pra chegar ja preenchido no modal
  const [urlDaRoda, setUrlDaRoda] = useState(null)
  const [history, setHistory] = useState([])
  const [studioSource, setStudioSource] = useState(null)
  // estado da nuvem só pra LEITURA do console (o controle continua no painel
  // da nuvem, mais abaixo) — null enquanto não respondeu
  const [nuvemLigada, setNuvemLigada] = useState(null)
  // ABA ATIVA. O app deixa de ser uma pagina que se rola de cima a baixo e
  // passa a ser um aparelho: trilho fixo a esquerda, area de trabalho a
  // direita. Era o esqueleto que fazia a tela "parecer a mesma" por baixo de
  // qualquer pele nova.
  const [aba, setAba] = useState('estudio')
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
      {/* ═══════════ TRILHO ═══════════
          O app parou de ser uma página que se rola de cima a baixo. As três
          coisas que ele faz viram DESTINOS, não seções empilhadas — e o estado
          do aparelho (destino, nuvem, acervo) mora no pé do trilho, sempre à
          vista, como painel de equipamento. */}
      <nav className="trilho">
        <div className="trilho-marca">
          <span className="brand-hex" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="15" height="15" className="brand-glyph">
              <path d="M5 4.5h14l-5.2 7.5L19 19.5H5l5.2-7.5z" />
            </svg>
          </span>
          <span className="trilho-nome">MPTRIX</span>
        </div>

        <div className="trilho-itens">
          {[
            { id: 'estudio', n: '01', rot: 'ESTÚDIO', sub: 'separar e ensaiar' },
            { id: 'baixar', n: '02', rot: 'BAIXAR', sub: 'MP3, WAV, vídeo' },
            { id: 'acervo', n: '03', rot: 'ACERVO', sub: `${history.length} itens` },
            { id: 'nuvem', n: '04', rot: 'NUVEM', sub: nuvemLigada ? 'ligada' : 'desligada' }
          ].map((it) => (
            <button
              key={it.id}
              className={`trilho-item ${aba === it.id ? 'on' : ''}`}
              onClick={() => setAba(it.id)}
            >
              <span className="trilho-n">{it.n}</span>
              <span className="trilho-txt">
                <span className="trilho-rot">{it.rot}</span>
                <span className="trilho-sub">{it.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="trilho-pe">
          <div className="pe-linha">
            <span className="pe-rot">DESTINO</span>
            <span className="pe-val" title={outputDir}>
              {outputDir ? outputDir.split(/[\\/]/).filter(Boolean).slice(-1)[0] : '—'}
            </span>
          </div>
          <div className="pe-acoes">
            <button className="btn-ghost-min" onClick={openFolder}>abrir</button>
            <button className="btn-ghost-min" onClick={pickFolder}>mudar</button>
          </div>
          <div className="pe-linha">
            <span className="pe-rot">NUVEM</span>
            <span className={`pe-val ${nuvemLigada ? 'aceso' : ''}`}>
              {nuvemLigada === null ? '…' : nuvemLigada ? 'LIGADA' : 'DESLIGADA'}
            </span>
          </div>
        </div>
      </nav>

      {/* ═══════════ ÁREA DE TRABALHO ═══════════ */}
      <main className="palco">
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

        {aba === 'estudio' && (
          <div className="palco-in">
            <p className="palco-olho">01 / ESTÚDIO DE ENSAIO <span className="beta-tag">BETA</span></p>
            <h1 className="palco-titulo">Separar<br />instrumentos</h1>
            <p className="palco-linha">
              Voz, bateria, baixo, guitarra, piano — e o resto que ninguém
              costuma achar. Depois mude o tom, deixe mais lento, marque o
              compasso e ensaie por cima.
            </p>
            <div className="palco-etiquetas">
              <i>dissecação</i><i>tom</i><i>velocidade</i><i>metrônomo</i><i>cifra</i><i>letra</i>
            </div>
            <button className="acao" onClick={openStudioFromFile}>
              <span className="acao-borda" aria-hidden="true" />
              <span className="acao-in">
                <Ico nome="studio" tamanho={20} />
                Escolher uma música do computador
              </span>
            </button>
            <p className="palco-nota">
              Ou abra pelo botão de estúdio de qualquer item do acervo.
            </p>
            {/* A marca d'água daqui era desenho morto — enfeite pra dar peso ao
                palco. Agora ela É o relógio: parada sem link, batendo quando
                acha um, enchendo quando a mão chega. */}
            <Omnitrix
              ligado={binariesOk}
              onEscolher={(presetId, url) => {
                const p = presets.find((x) => x.id === presetId)
                if (!p) return
                setUrlDaRoda(url)
                setActivePreset(p)
              }}
            />
          </div>
        )}

        {aba === 'baixar' && (
          <div className="palco-in">
            <p className="palco-olho">02 / BAIXAR</p>
            <h1 className="palco-titulo">O que você<br />quer levar?</h1>
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
          </div>
        )}

        {aba === 'acervo' && (
          <div className="palco-in">
            <p className="palco-olho">03 / ACERVO</p>
            <h1 className="palco-titulo">{history.length} <small>itens</small></h1>
            <HistoryList
              history={history}
              onChange={setHistory}
              onOpenStudio={openStudioFromEntry}
              onQuickEdit={openQuickEditFromEntry}
            />
          </div>
        )}

        {aba === 'nuvem' && (
          <div className="palco-in">
            <p className="palco-olho">04 / NUVEM</p>
            <h1 className="palco-titulo">Separação<br />na nuvem</h1>
            <NuvemConfig />
            <ShareApp />
          </div>
        )}
      </main>



      {activePreset && activePreset.id === 'playlist' && (
        <PlaylistModal
          outputDir={outputDir}
          urlInicial={urlDaRoda}
          onClose={() => { setActivePreset(null); setUrlDaRoda(null) }}
          onPickFolder={pickFolder}
        />
      )}

      {activePreset && activePreset.id !== 'playlist' && (
        <DownloadModal
          preset={activePreset}
          outputDir={outputDir}
          history={history}
          urlInicial={urlDaRoda}
          onClose={() => { setActivePreset(null); setUrlDaRoda(null) }}
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
