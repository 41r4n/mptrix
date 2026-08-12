import { useEffect, useRef, useState } from 'react'
import DownloadModal from './components/DownloadModal.jsx'
import Omnitrix from './components/Omnitrix.jsx'
import TituloVivo, { useFalaDaVez } from './components/TituloVivo.jsx'
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
      <span className="zoom-lupa" aria-hidden="true"><Ico nome="buscar" tamanho={12} /></span>
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
// OS QUATRO ATOS. A mesma lista que a roda usa, dita por extenso — aqui a
// pessoa está lendo, não apontando, então cada um explica o que faz.
const ATOS = [
  { id: 'baixar', ico: 'music', nome: 'Música', tag: 'uma ou a lista',
    desc: 'Baixa em MP3 com qualidade máxima e capa. Se o link for de playlist, abre a lista pra você escolher quais.' },
  { id: 'video', ico: 'video', nome: 'Vídeo', tag: 'até 8K',
    desc: 'Baixa o vídeo. Você escolhe a qualidade na hora.' },
  { id: 'separar', ico: 'studio', nome: 'Separar instrumentos', tag: 'vai pro estúdio', destaque: true,
    desc: 'Baixa o áudio sem reconverter e abre direto no Estúdio pra tirar voz, bateria, baixo e o resto.' },
  { id: 'arquivo', ico: 'pasta', nome: 'Do computador', tag: 'já é sua',
    desc: 'Abre uma música que já está no seu computador — gravação, pen drive, qualquer arquivo de som.' }
]


export default function App() {
  const [env, setEnv] = useState(null)
  const [outputDir, setOutputDir] = useState('')
  const [activePreset, setActivePreset] = useState(null)
  // link que a roda entregou, pra chegar ja preenchido no modal
  const [urlDaRoda, setUrlDaRoda] = useState(null)
  // quando a roda pede SEPARAR, o download deixa de ser o fim e vira o meio
  const [rodaPediuEstudio, setRodaPediuEstudio] = useState(false)
  // link digitado na aba BAIXAR — quem chega por aqui não copiou nada ainda
  const [urlAba, setUrlAba] = useState('')
  // o que a tela do estúdio está anunciando agora
  const fala = useFalaDaVez()
  const [history, setHistory] = useState([])
  const [studioSource, setStudioSource] = useState(null)
  // estado da nuvem só pra LEITURA do console (o controle continua no painel
  // da nuvem, mais abaixo) — null enquanto não respondeu
  const [nuvemLigada, setNuvemLigada] = useState(null)
  // AVISO DE PARADA. A nuvem pode se desligar sozinha no meio de uma
  // separação — e é justamente aí que a pessoa NÃO está olhando pra tela da
  // nuvem. Sem isto o trabalho de repente volta a demorar minutos e ninguém
  // conta por quê.
  const [avisoNuvem, setAvisoNuvem] = useState(null)
  const paradaVista = useRef(null)
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
        if (!vivo) return
        setNuvemLigada(!!(n?.ligada && n?.temChave))
        // só avisa na TRANSIÇÃO: mostrar o mesmo recado a cada 3s viraria
        // parede, e parede a pessoa aprende a ignorar
        const parada = n?.paradaPor || null
        if (parada && parada !== paradaVista.current) {
          // leva os números junto: "está acabando" sem dizer quanto sobra
          // manda a pessoa procurar a informação que o aviso devia ter
          setAvisoNuvem({
            motivo: parada,
            sobra: Math.max(0, (n.creditoInformado || 0) - (n.gastoDesdeCredito || 0)),
            informado: n.creditoInformado || 0
          })
        }
        paradaVista.current = parada
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

  // ██████ OS QUATRO ATOS, NUM LUGAR SÓ ██████
  //
  // A roda e a aba BAIXAR são duas portas pro mesmo cômodo. Se cada uma
  // tivesse a própria decisão elas discordariam com o tempo — alguém conserta
  // um desvio numa e esquece a outra, e aí a mesma escolha passa a fazer
  // coisas diferentes conforme por onde a pessoa entrou. Duas portas, um
  // cérebro.
  //
  // Cada ato resolve sozinho o formato E a fonte: é isso que tira do usuário
  // a conta que a máquina já sabe fazer.
  const executarAto = (ato, url) => {
    if (ato === 'arquivo') return openStudioFromFile()

    if (ato === 'separar') {
      // sem link não há o que baixar: separar vira "abrir um arquivo seu e
      // mandar pro estúdio"
      if (!url) return openStudioFromFile()
      // M4A é a faixa NATIVA do YouTube, sem reconversão. Passar por MP3
      // antes de separar jogaria fora informação que o separador usa, e quem
      // quer os instrumentos quer o material mais limpo possível.
      const p = presets.find((x) => x.id === 'audio_m4a')
      if (!p) return
      setRodaPediuEstudio(true)
      setUrlDaRoda(url)
      setActivePreset(p)
      return
    }

    // "list=" sem "v=" quer dizer lista inteira, e os presets de música rodam
    // com --no-playlist: sem o desvio a pessoa levaria um erro por ter pedido
    // uma coisa razoável. Quem tem que saber disso é o app.
    let alvo = ato === 'video' ? 'video' : 'music'
    try {
      const u = new URL(url)
      if (u.searchParams.has('list') && !u.searchParams.get('v') && ato !== 'video') {
        alvo = 'playlist'
      }
    } catch { /* sem link ou endereço estranho: segue o pedido */ }
    const p = presets.find((x) => x.id === alvo)
    if (!p) return
    setRodaPediuEstudio(false)
    setUrlDaRoda(url)
    setActivePreset(p)
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

  // com o estúdio na frente, trocar de aba mexeria numa tela que está ATRÁS
  // dele — a pessoa clicaria e não veria nada acontecer
  const estudioAberto = !!studioSource

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
            <TituloVivo fala={fala} />
            <p className="palco-linha">
              Voz, bateria, baixo, guitarra, piano — e o resto que ninguém
              costuma achar. Depois mude o tom, deixe mais lento, marque o
              compasso e ensaie por cima.
            </p>
            {/* a etiqueta do que o título está dizendo acende junto: as duas
                deixam de repetir a mesma informação em tamanhos diferentes e
                passam a apontar uma pra outra */}
            <div className="palco-etiquetas">
              {['dissecação', 'tom', 'velocidade', 'metrônomo', 'cifra', 'letra'].map((t) => (
                <i key={t} className={fala.tag === t ? 'on' : ''}>{t}</i>
              ))}
            </div>
            {/* O botão "escolher uma música do computador" saiu daqui: ele
                virou uma fatia da roda ("DO PC"). Nenhuma capacidade se
                perdeu — mudou de porta. Ter um botão grande na cara pra UMA
                das quatro formas de começar era dar a ele um peso que as
                outras três não tinham. */}
            {/* curto de propósito: a roda já mostra as quatro entradas quando
                abre, e explicar as três aqui só fazia a linha crescer até
                encostar na marca */}
            <p className="palco-nota">Toque a ampulheta pra começar.</p>
            {/* A marca d'água daqui era desenho morto — enfeite pra dar peso ao
                palco. Agora ela É o relógio: parada sem link, batendo quando
                acha um, enchendo quando a mão chega. */}
            <Omnitrix
              ligado={binariesOk}
              presets={presets}
              onEscolher={executarAto}
            />
          </div>
        )}

        {aba === 'baixar' && (
          <div className="palco-in">
            <p className="palco-olho">02 / BAIXAR</p>
            <h1 className="palco-titulo">O que você<br />quer levar?</h1>

            {/* AQUI ERAM SEIS CARTÕES DE FORMATO — música única, playlist,
                rápido, M4A, WAV e vídeo. Quatro deles eram o mesmo ato de
                roupa diferente, e o de playlist nem precisava existir: o app
                descobre pelo link.
                Agora são os MESMOS QUATRO ATOS da roda, e de propósito: a
                roda é pra quem já copiou o link e quer velocidade; esta aba é
                pra quem não sabia que existe atalho e entrou pelo mapa. Duas
                portas, um cômodo. Os formatos não sumiram — passaram a ser
                escolha do sistema, e continuam ajustáveis onde importam (por
                música na tela de playlist, por qualidade na de vídeo). */}
            <div className="baixar-campo">
              <span className="baixar-rot">link do vídeo, da música ou da playlist</span>
              <div className="baixar-poco">
                <input
                  type="url"
                  value={urlAba}
                  onChange={(e) => setUrlAba(e.target.value)}
                  placeholder="cole aqui — ou deixe vazio e o app pergunta depois"
                  spellCheck={false}
                />
                {urlAba && (
                  <button className="baixar-x" onClick={() => setUrlAba('')} title="Limpar">×</button>
                )}
              </div>
            </div>

            <div className="grade">
              {ATOS.map((a, i) => {
                // sem yt-dlp/ffmpeg só o arquivo do computador funciona
                const morto = !binariesOk && a.id !== 'arquivo'
                return (
                  <button
                    key={a.id}
                    className={`chip ${morto ? 'disabled' : ''} ${a.destaque ? 'chip-destaque' : ''}`}
                    onClick={() => !morto && executarAto(a.id, urlAba.trim() || null)}
                    disabled={morto}
                  >
                    <span className="chip-borda" aria-hidden="true" />
                    <span className="chip-in">
                      <span className="chip-topo">
                        <span className="chip-num">{String(i + 1).padStart(2, '0')}</span>
                        <span className="chip-ico" aria-hidden="true"><Ico nome={a.ico} tamanho={18} /></span>
                      </span>
                      <span className="chip-nome">{a.nome}</span>
                      <span className="chip-tag">{a.tag}</span>
                      <span className="chip-desc">{a.desc}</span>
                    </span>
                  </button>
                )
              })}
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
          aoConcluir={rodaPediuEstudio ? ((arquivo) => {
            setActivePreset(null)
            setUrlDaRoda(null)
            setRodaPediuEstudio(false)
            setStudioSource({ path: arquivo, title: 'Estúdio' })
          }) : undefined}
          onClose={() => { setActivePreset(null); setUrlDaRoda(null); setRodaPediuEstudio(false) }}
          onPickFolder={pickFolder}
        />
      )}

        {studioSource && (
          <StudioView source={studioSource} onClose={() => setStudioSource(null)} />
        )}

        <UpdateFooter />
      </div>
      <ZoomChip />
      {/* O RECADO — no MEIO da tela, por cima de tudo, e só sai no botão.
          A nuvem pode se desligar durante qualquer coisa: no meio de uma
          separação, com o estúdio aberto, ou com a pessoa em outra aba. Ela
          não pode depender de estar olhando pro canto certo pra saber que o
          dinheiro acabou.

          Era um parágrafo corrido: tudo com o mesmo peso, e as duas coisas que
          importam — "seu trabalho continua" e "vai demorar mais" — enterradas
          no meio do texto. Agora cada uma é uma linha com seu sinal, e o
          número aparece, porque "está acabando" sem dizer quanto sobra manda a
          pessoa procurar a informação que o aviso devia ter. */}
      {avisoNuvem && (
        <div className="recado-palco">
          <div className="recado" role="alertdialog" aria-modal="true">
            <span className="recado-faixa" aria-hidden="true" />
            <span className="recado-canto tl" aria-hidden="true" />
            <span className="recado-canto br" aria-hidden="true" />
            <button className="recado-x" onClick={() => setAvisoNuvem(null)} title="Fechar">×</button>

            <div className="recado-cab">
              <span className="recado-sinal" aria-hidden="true">
                <Ico nome="aviso" tamanho={26} />
              </span>
              <div className="recado-titulo">
                <b>
                  {avisoNuvem.motivo === 'teto-do-mes'
                    ? 'Cheguei no teto do mês'
                    : avisoNuvem.motivo === 'freio-credito'
                      ? 'Seu crédito está acabando'
                      : 'Seu crédito acabou'}
                </b>
                {avisoNuvem.informado > 0 && (
                  <i>
                    sobra <strong>US$ {(avisoNuvem.sobra / 100).toFixed(2).replace('.', ',')}</strong>
                    {' '}de US$ {(avisoNuvem.informado / 100).toFixed(2).replace('.', ',')}
                  </i>
                )}
              </div>
            </div>

            <ul className="recado-fatos">
              <li className="bom">
                <span className="recado-ico" aria-hidden="true"><Ico nome="certo" tamanho={15} /></span>
                <div>
                  <b>Seu trabalho continua</b>
                  <p>Desliguei a nuvem e voltei a separar aqui no seu computador. Nada foi perdido.</p>
                </div>
              </li>
              <li className="atencao">
                <span className="recado-ico" aria-hidden="true"><Ico nome="tempo" tamanho={15} /></span>
                <div>
                  <b>Só vai levar bem mais tempo</b>
                  <p>
                    O que a nuvem fazia em meio minuto, aqui pode levar de alguns
                    minutos a algumas horas — depende da música e do computador.
                  </p>
                </div>
              </li>
              {avisoNuvem.motivo === 'freio-credito' && (
                <li>
                  <span className="recado-ico" aria-hidden="true"><Ico nome="ampulheta" tamanho={13} /></span>
                  <div>
                    <b>Parei antes de acabar</b>
                    <p>Assim você não fica devendo e a conta não é suspensa.</p>
                  </div>
                </li>
              )}
            </ul>

            <div className="recado-acoes">
              {estudioAberto ? (
                <span className="recado-onde">o crédito fica na aba NUVEM, quando você fechar o estúdio</span>
              ) : (
                <button
                  className="recado-ir"
                  onClick={() => { setAba('nuvem'); setAvisoNuvem(null) }}
                >
                  ver crédito
                </button>
              )}
              <button className="recado-ok" onClick={() => setAvisoNuvem(null)}>
                entendi
              </button>
            </div>
          </div>
        </div>
      )}



    </UpdatesProvider>
  )
}
