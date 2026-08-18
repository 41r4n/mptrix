import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import CortarMusica from './CortarMusica.jsx'

/* ██████████ O EDITOR DA EMENDA ██████████
 *
 * Quinta versão. As quatro anteriores eram uma TELA que mostrava um medley; o
 * dono pediu um EDITOR, e listou o que faltava com precisão: pause que pausa,
 * agulha que vai aonde ele quer, cortar e duplicar que funcionam, e uma pista
 * grande o bastante pra enxergar.
 *
 * Ele estava certo item por item, e um deles era falha minha grave: eu tinha
 * TIRADO o duplicar ao refazer a tela pelo desenho novo. Feature não some por
 * causa de visual — é regra da casa, e eu quebrei.
 *
 * O que separa um editor de uma tela bonita, e que agora está aqui:
 *
 * · TRANSPORTE DE VERDADE. Tocar, pausar (continua de onde parou) e parar
 *   (volta ao começo) são três coisas diferentes. Antes havia duas, e a que
 *   parecia pause era stop — por isso "ele reinicia e só".
 *
 * · A AGULHA É UM LUGAR, não um efeito de estar tocando. Ela existe parada,
 *   você a põe onde quiser, e tudo age a partir dela.
 *
 * · DESFAZER. Sem ele a pessoa para de experimentar, porque todo gesto vira
 *   risco. (Mora no componente de cima, que é dono da fila.)
 *
 * · ZOOM E ALTURA. "Não consigo ver nada" não é reclamação de gosto: numa pista
 *   de 900px um medley de 12 minutos dá 1,3 pixel por segundo, e não existe
 *   corte possível nessa escala.
 *
 * · TECLADO. Espaço, S, D, Delete, Ctrl+Z. Editor que exige mira do mouse pra
 *   tudo é editor lento.
 *
 * · VOLUME POR PEDAÇO. Num medley as fontes são diferentes — um ao vivo de
 *   celular ao lado de um estúdio. Sem equilibrar, a emenda certa soa errada.
 *
 * A régua, a agulha lima com marcador triangular e o tint do que já tocou são
 * os mesmos do Estúdio. AGULHA, TINT E RELÓGIO ANDAM POR QUADRO, ESCRITOS NO
 * NÓ — nunca re-render de React 60 vezes por segundo. O estado `agulha` existe
 * em paralelo e anda ~4×/s, só pra habilitar botão e desenhar o resto.
 */
const mmss = (s) => {
  const n = Math.max(0, Number(s) || 0)
  return Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0')
}
const mmssc = (s) => {
  const n = Math.max(0, Number(s) || 0)
  const c = Math.floor((n % 1) * 10)
  return mmss(n) + ',' + c
}
const umaCasa = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')

const CORES = ['#b4e85a', '#4ecb8c', '#dff9a0', '#27a08d', '#7ed97a', '#8fa57a']

// ── O QUE ESTRAGA UMA EMENDA, medido na onda ──
// Estalo: corte no meio de onda alta, emendado noutra onda alta, sem passagem.
// Silêncio: o rabo vazio do fim de uma gravação vira buraco no meio do louvor.
const ALTO = 0.22
const QUIETO = 0.07
const SILENCIO_MINIMO = 0.25
const nivelEm = (o, t) => {
  if (!o?.onda?.length || !o.duracao) return 0
  const i = Math.min(o.onda.length - 1, Math.max(0, Math.floor((t / o.duracao) * o.onda.length)))
  return o.onda[i] || 0
}
function rabodeSilencio(o, de, ate) {
  if (!o?.onda?.length || !o.duracao) return 0
  const porPonto = o.duracao / o.onda.length
  const fim = Math.min(o.onda.length - 1, Math.floor((ate / o.duracao) * o.onda.length) - 1)
  const piso = Math.max(0, Math.floor((de / o.duracao) * o.onda.length))
  let n = 0
  for (let i = fim; i >= piso; i--) {
    if ((o.onda[i] || 0) > QUIETO) break
    n++
  }
  return n * porPonto
}

// escalas de zoom em pixels por segundo. A menor mostra ~20min numa tela larga;
// a maior deixa meio segundo com 30px, que é onde dá pra cortar no detalhe
const ZOOMS = [0.8, 1.5, 3, 6, 12, 25, 50, 100]
const ALTURAS = [110, 160, 220, 300]

export default function MesaDaEmenda({
  fila, onMudar, onAcrescentar, onDesfazer, onRefazer, podeDesfazer, podeRefazer
}) {
  const [ondas, setOndas] = useState({})
  const [analises, setAnalises] = useState({})
  const [rodando, setRodando] = useState(false)
  const [escolhido, setEscolhido] = useState(-1)
  const [arrastando, setArrastando] = useState(null)
  const [grande, setGrande] = useState(-1)
  const [renomeando, setRenomeando] = useState(false)
  const [zoom, setZoom] = useState(3)
  const [altura, setAltura] = useState(160)
  // a agulha em segundos do medley. O ref é a verdade por quadro; o estado é a
  // cópia lenta (~4×/s) que habilita botão e redesenha o resto sem travar.
  const agulhaRef = useRef(0)
  const [agulha, setAgulha] = useState(0)
  const pecaTocandoRef = useRef(-1)

  const somRef = useRef(null)
  const rafRef = useRef(0)
  const quadroRef = useRef(null)
  const pistaRef = useRef(null)
  const phRef = useRef(null)
  const triRef = useRef(null)
  const tintRef = useRef(null)
  const relogioRef = useRef(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      for (const f of fila) {
        if (!vivo) return
        if (!ondas[f.arquivo]) {
          const r = await window.mptrix.emenda.onda({ path: f.arquivo }).catch(() => null)
          if (vivo && r) setOndas((o) => ({ ...o, [f.arquivo]: r }))
        }
        if (!analises[f.arquivo]) {
          const a = await window.mptrix.emenda.analiseDe({ path: f.arquivo }).catch(() => null)
          if (vivo && a) setAnalises((m) => ({ ...m, [f.arquivo]: a }))
        }
      }
    })()
    return () => { vivo = false }
  }, [fila.map((f) => f.arquivo).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const inicioDe = (f) => Number(f.ini) || 0
  const fimDe = (f) => Number(f.fim) || (ondas[f.arquivo]?.duracao || 0)
  const duracaoDe = (f) => {
    if (!ondas[f.arquivo]) return 30
    return Math.max(0.2, fimDe(f) - inicioDe(f))
  }
  const fadeDe = (f) => (f.fade === undefined ? 1 : Number(f.fade) || 0)
  const ganhoDe = (f) => (f.ganho === undefined ? 1 : Number(f.ganho))

  const total = fila.reduce((s, f) => s + duracaoDe(f), 0) || 1
  const inicios = []
  fila.reduce((acc, f) => { inicios.push(acc); return acc + duracaoDe(f) }, 0)
  const cores = (() => {
    const unicos = [...new Set(fila.map((f) => f.arquivo))]
    return fila.map((f) => CORES[unicos.indexOf(f.arquivo) % CORES.length])
  })()
  const px = (t) => t * zoom
  const larguraTotal = Math.max(320, px(total))
  const pecaEm = (t) => fila.findIndex((f, k) => t >= inicios[k] && t < inicios[k] + duracaoDe(f))

  const avisoDaEmenda = (i) => {
    if (i <= 0 || i >= fila.length) return null
    const a = fila[i - 1]
    const b = fila[i]
    const oa = ondas[a.arquivo]
    const ob = ondas[b.arquivo]
    if (!oa || !ob) return null
    const rabo = rabodeSilencio(oa, inicioDe(a), fimDe(a))
    if (rabo >= SILENCIO_MINIMO) return umaCasa(rabo) + ' s de silêncio'
    if (fadeDe(b) < 0.05 && nivelEm(oa, fimDe(a) - 0.05) > ALTO && nivelEm(ob, inicioDe(b)) > ALTO) {
      return 'estalo na emenda'
    }
    return null
  }
  const comAviso = fila.reduce((n, _, i) => n + (avisoDaEmenda(i) ? 1 : 0), 0)

  // ── ESCREVE NO NÓ (por quadro) ──
  const escrever = (t) => {
    agulhaRef.current = t
    const x = px(t)
    if (phRef.current) phRef.current.style.transform = `translateX(${x}px)`
    if (triRef.current) triRef.current.style.transform = `translateX(${x}px)`
    if (tintRef.current) tintRef.current.style.width = x + 'px'
    if (relogioRef.current) relogioRef.current.textContent = mmssc(t)
  }
  // depois de mudar zoom/fila, o nó precisa reencontrar a agulha
  useLayoutEffect(() => { escrever(agulhaRef.current) }) // eslint-disable-line react-hooks/exhaustive-deps

  // ── TRANSPORTE ──
  //
  // Três coisas diferentes, e é por não separá-las que "o pause reiniciava":
  // tocar continua da agulha, pausar deixa a agulha onde está, parar volta ao
  // começo. O que antes se chamava pause era stop.
  const tocar = () => {
    const a = somRef.current
    if (!a || !fila.length) return
    let t = agulhaRef.current
    if (t >= total - 0.05) t = 0
    const i = Math.max(0, pecaEm(t))
    const dentro = inicioDe(fila[i]) + (t - inicios[i])
    pecaTocandoRef.current = i
    const alvo = 'acervo://a/?f=' + encodeURIComponent(fila[i].arquivo)
    if (a.src !== alvo) a.src = alvo
    a.currentTime = dentro
    a.play().then(() => setRodando(true)).catch(() => setRodando(false))
  }
  const pausar = () => {
    somRef.current?.pause()
    setRodando(false)
    setAgulha(agulhaRef.current)
  }
  const parar = () => {
    somRef.current?.pause()
    setRodando(false)
    escrever(0)
    setAgulha(0)
    pecaTocandoRef.current = -1
  }
  const irPara = (t) => {
    const limpo = Math.max(0, Math.min(total, t))
    escrever(limpo)
    setAgulha(limpo)
    if (rodando) {
      const i = Math.max(0, pecaEm(limpo))
      const a = somRef.current
      const alvo = 'acervo://a/?f=' + encodeURIComponent(fila[i].arquivo)
      if (a.src !== alvo) a.src = alvo
      a.currentTime = inicioDe(fila[i]) + (limpo - inicios[i])
      pecaTocandoRef.current = i
      a.play().catch(() => {})
    }
  }

  useEffect(() => {
    if (!rodando) { cancelAnimationFrame(rafRef.current); return }
    let ultimoEstado = 0
    const passo = () => {
      const a = somRef.current
      const i = pecaTocandoRef.current
      const f = fila[i]
      if (!a || !f) { setRodando(false); return }
      const t = (inicios[i] || 0) + (a.currentTime - inicioDe(f))
      escrever(t)
      // o estado anda 4×/s: é o bastante pra habilitar botão e não custa nada
      if (t - ultimoEstado > 0.25 || ultimoEstado - t > 0.25) { ultimoEstado = t; setAgulha(t) }
      seguirAAgulha(t)
      if (a.currentTime >= fimDe(f) - 0.01) {
        if (i + 1 < fila.length) {
          pecaTocandoRef.current = i + 1
          const prox = fila[i + 1]
          const alvo = 'acervo://a/?f=' + encodeURIComponent(prox.arquivo)
          if (a.src !== alvo) a.src = alvo
          a.currentTime = inicioDe(prox)
          a.play().catch(() => {})
        } else { parar(); return }
      }
      rafRef.current = requestAnimationFrame(passo)
    }
    rafRef.current = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(rafRef.current)
  }, [rodando, fila, ondas, zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  // a janela persegue a agulha, mas só quando ela passa da borda: rolar a cada
  // quadro tira a referência de onde a pessoa estava olhando
  const seguirAAgulha = (t) => {
    const q = quadroRef.current
    if (!q) return
    const x = px(t)
    const margem = 80
    if (x < q.scrollLeft + margem || x > q.scrollLeft + q.clientWidth - margem) {
      q.scrollLeft = Math.max(0, x - q.clientWidth / 2)
    }
  }

  // ── FERRAMENTAS ──
  const cortarNaAgulha = () => {
    const t = agulhaRef.current
    const i = fila.findIndex((f, k) => t > inicios[k] + 0.15 && t < inicios[k] + duracaoDe(f) - 0.15)
    if (i < 0) return
    const f = fila[i]
    const dentro = inicioDe(f) + (t - inicios[i])
    const n = [...fila]
    n.splice(i, 1,
      { ...f, fim: dentro },
      // o pedaço da frente nasce seco: é a continuação exata da mesma gravação,
      // e amaciar uma emenda que não existe inventaria um sumiço de som
      { ...f, id: f.id + ':c' + Date.now(), ini: dentro, fim: fimDe(f), fade: 0 })
    onMudar(n)
    setEscolhido(i + 1)
  }
  const podeCortar = agulha > 0 && fila.some((f, k) =>
    agulha > inicios[k] + 0.15 && agulha < inicios[k] + duracaoDe(f) - 0.15)

  // O DUPLICAR VOLTOU. Eu o havia tirado ao refazer a tela por um desenho que
  // não o mostrava — e feature não some por causa de visual.
  const duplicar = (i) => {
    if (i < 0) return
    const n = [...fila]
    n.splice(i + 1, 0, { ...fila[i], id: fila[i].id + ':d' + Date.now() })
    onMudar(n)
    setEscolhido(i + 1)
  }
  const tirar = (i) => { if (i < 0) return; onMudar(fila.filter((_, k) => k !== i)); setEscolhido(-1) }
  const trocar = (i, d) => {
    const j = i + d
    if (i < 0 || j < 0 || j >= fila.length) return
    const n = [...fila]
    ;[n[i], n[j]] = [n[j], n[i]]
    onMudar(n)
    setEscolhido(j)
  }
  const mexer = (i, campo, v) => {
    const n = [...fila]
    n[i] = { ...n[i], [campo]: v }
    onMudar(n)
  }

  // ── TECLADO ──
  useEffect(() => {
    const noTexto = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
    const tecla = (e) => {
      if (noTexto(e)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); e.shiftKey ? onRefazer?.() : onDesfazer?.(); return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); onRefazer?.(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      switch (e.key) {
        case ' ': e.preventDefault(); rodando ? pausar() : tocar(); break
        case 's': case 'S': e.preventDefault(); cortarNaAgulha(); break
        case 'd': case 'D': e.preventDefault(); duplicar(escolhido); break
        case 'Delete': case 'Backspace': e.preventDefault(); tirar(escolhido); break
        case 'Home': e.preventDefault(); irPara(0); break
        case 'End': e.preventDefault(); irPara(total); break
        case 'ArrowLeft': e.preventDefault(); irPara(agulhaRef.current - (e.shiftKey ? 5 : 1)); break
        case 'ArrowRight': e.preventDefault(); irPara(agulhaRef.current + (e.shiftKey ? 5 : 1)); break
        case '+': case '=': e.preventDefault(); mudarZoom(1); break
        case '-': case '_': e.preventDefault(); mudarZoom(-1); break
        default: break
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }) // sem deps: o teclado precisa enxergar o estado desta pintura

  const mudarZoom = (d) => {
    const i = ZOOMS.indexOf(zoom)
    const j = Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 2 : i) + d))
    setZoom(ZOOMS[j])
  }
  const ajustar = () => {
    const q = quadroRef.current
    if (!q) return
    const alvo = (q.clientWidth - 8) / total
    // escolhe a escala existente mais próxima de caber: manter a lista de
    // escalas fixas deixa o zoom previsível ao apertar + e −
    setZoom(ZOOMS.reduce((a, b) => (Math.abs(b - alvo) < Math.abs(a - alvo) ? b : a), ZOOMS[0]))
  }
  useEffect(() => { if (fila.length && quadroRef.current) ajustar() }, [fila.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // roda do mouse com Ctrl = zoom, como em qualquer editor
  const naRoda = (e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    mudarZoom(e.deltaY < 0 ? 1 : -1)
  }

  // ── arrastar a borda pra cortar ──
  const pegarBorda = (i, lado) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    const f0 = fila[i]
    const dur = ondas[f0.arquivo]?.duracao || 0
    const ini0 = inicioDe(f0)
    const fim0 = fimDe(f0)
    const x0 = e.clientX
    setEscolhido(i)
    setArrastando({ i, lado })
    const mover = (ev) => {
      // um pixel vale 1/zoom segundos — a conta é direta porque a pista agora é
      // medida em pixels por segundo, e não em porcentagem
      const d = (ev.clientX - x0) / zoom
      const n = [...fila]
      if (lado === 'ini') n[i] = { ...f0, ini: Math.max(0, Math.min(fim0 - 0.3, ini0 + d)), fim: fim0 }
      else n[i] = { ...f0, ini: ini0, fim: Math.max(ini0 + 0.3, Math.min(dur, fim0 + d)) }
      onMudar(n)
    }
    const soltar = () => {
      setArrastando(null)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const pegarPeca = (i) => (e) => {
    if (e.target.closest('.mesa-alca')) return
    setEscolhido(i)
    setRenomeando(false)
    const x0 = e.clientX
    let atual = i
    const ordem = [...fila]
    let mexeu = false
    const mover = (ev) => {
      const andou = ev.clientX - x0
      if (!mexeu && Math.abs(andou) > 3) { mexeu = true; setArrastando({ i, lado: 'mover' }) }
      const dir = andou > 0 ? 1 : -1
      const alvo = atual + dir
      if (alvo < 0 || alvo >= ordem.length) return
      if (Math.abs(andou) > px(duracaoDe(ordem[alvo])) / 2) {
        ;[ordem[atual], ordem[alvo]] = [ordem[alvo], ordem[atual]]
        onMudar([...ordem])
        atual = alvo
        setEscolhido(alvo)
      }
    }
    const soltar = () => {
      setArrastando(null)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  // clicar na régua leva a agulha; arrastar nela varre
  const naRegua = (e) => {
    const varrer = (ev) => {
      const r = e.currentTarget?.getBoundingClientRect?.() ||
        quadroRef.current.querySelector('.mesa-regua').getBoundingClientRect()
      irPara((ev.clientX - r.left) / zoom)
    }
    varrer(e)
    const soltar = () => {
      window.removeEventListener('pointermove', varrer)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', varrer)
    window.addEventListener('pointerup', soltar)
  }

  // marcas da régua: o passo cresce com o zoom pra os rótulos nunca colidirem
  const marcas = []
  {
    const minimo = 70 / zoom
    const passo = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((p) => p >= minimo) || 900
    for (let s = 0; s <= total + 0.001; s += passo) {
      marcas.push(
        <div key={s} className="ruler-tick major" style={{ left: px(s) + 'px' }}>
          <span className="ruler-label">{mmss(s)}</span>
        </div>
      )
    }
  }

  const sel = escolhido >= 0 && escolhido < fila.length ? fila[escolhido] : null
  const an = sel ? analises[sel.arquivo] : null

  return (
    <div className="mesa">
      {/* ── TRANSPORTE ── */}
      <div className="mesa-topo">
        <div className="ed-transporte">
          <button className="ed-tp" onClick={() => irPara(0)} title="voltar ao começo (Home)">⏮</button>
          <button className="ed-tp ed-tp-play" onClick={() => (rodando ? pausar() : tocar())}
            title={rodando ? 'pausar (espaço)' : 'tocar (espaço)'}>
            {rodando ? '❙❙' : '▶'}
          </button>
          <button className="ed-tp" onClick={parar} title="parar e voltar ao começo">■</button>
        </div>

        <span className="mesa-relogio">
          <b ref={relogioRef}>0:00,0</b>
          <i>/ {mmss(total)}</i>
        </span>

        <span className="mesa-flex" />

        <span className="hud mesa-hud">
          <span className="hud-cel"><b>{fila.length}</b><i>pedaços</i></span>
          <span className="hud-cel"><b className="lima">{mmss(total)}</b><i>duração</i></span>
          <span className={`hud-cel ${comAviso ? 'alerta' : ''}`}>
            <b>{comAviso}</b><i>emendas c/ aviso</i>
          </span>
        </span>

        <div className="ed-ferramentas">
          <button className="mesa-icone" onClick={onDesfazer} disabled={!podeDesfazer} title="desfazer (Ctrl+Z)">↶</button>
          <button className="mesa-icone" onClick={onRefazer} disabled={!podeRefazer} title="refazer (Ctrl+Shift+Z)">↷</button>
          <span className="ed-sep" />
          <button className="mesa-icone" onClick={() => mudarZoom(-1)} title="afastar (−)">−</button>
          <button className="mesa-icone" onClick={ajustar} title="caber na tela">⤢</button>
          <button className="mesa-icone" onClick={() => mudarZoom(1)} title="aproximar (+)">+</button>
          <span className="ed-sep" />
          <button className="mesa-icone" title="altura da pista"
            onClick={() => setAltura(ALTURAS[(ALTURAS.indexOf(altura) + 1) % ALTURAS.length])}>⇕</button>
        </div>

        <button className="mesa-add" onClick={onAcrescentar}>+ Trazer música</button>
      </div>

      {/* ── A PISTA, em pixels por segundo, rolável ── */}
      <div className="mesa-daw ed-quadro" ref={quadroRef} onWheel={naRoda}>
        <div className="ed-conteudo" style={{ width: larguraTotal + 'px' }}>
          <div className="mesa-regua" onPointerDown={naRegua} title="clique ou arraste pra levar a agulha">
            {marcas}
            <span className="mesa-tri" ref={triRef} aria-hidden="true" />
          </div>

          <div className="mesa-juntas">
            {fila.map((f, i) => {
              const aviso = avisoDaEmenda(i)
              if (!aviso) return null
              return (
                <span key={f.id} className="mesa-junta" style={{ left: px(inicios[i]) + 'px' }}>
                  <em>{aviso}</em>
                </span>
              )
            })}
          </div>

          <div
            className="mesa-pista"
            ref={pistaRef}
            style={{ height: altura + 'px' }}
            onPointerDown={(e) => { if (!e.target.closest('.mesa-peca')) { setEscolhido(-1); setRenomeando(false) } }}
          >
            {fila.map((f, i) => (
              <Fragment key={f.id}>
                <div
                  className={`mesa-peca ${escolhido === i ? 'sel' : ''} ${arrastando?.i === i ? 'pegando' : ''}`}
                  style={{ left: px(inicios[i]) + 'px', width: px(duracaoDe(f)) + 'px', '--cor': cores[i] }}
                  onPointerDown={pegarPeca(i)}
                  onDoubleClick={() => setGrande(i)}
                >
                  <PecaOnda
                    onda={ondas[f.arquivo]?.onda}
                    duracao={ondas[f.arquivo]?.duracao}
                    ini={inicioDe(f)} fim={fimDe(f)}
                    cor={cores[i]} ganho={ganhoDe(f)}
                  />
                  <span className="mesa-nome">
                    {f.nome}
                    {ganhoDe(f) !== 1 && <i>{(ganhoDe(f) * 100).toFixed(0)}%</i>}
                  </span>
                  <span className="mesa-alca mesa-alca-e" onPointerDown={pegarBorda(i, 'ini')}
                    title="arraste pra cortar o começo" />
                  <span className="mesa-alca mesa-alca-d" onPointerDown={pegarBorda(i, 'fim')}
                    title="arraste pra cortar o fim" />
                </div>
              </Fragment>
            ))}

            <div className="mesa-tint" ref={tintRef} aria-hidden="true" />
            <div className="mesa-ph" ref={phRef} aria-hidden="true"><span /></div>
          </div>
        </div>
      </div>

      {/* ── a barra do pedaço escolhido ── */}
      <div className={`mesa-barra ${sel ? 'tem' : ''}`}>
        {sel ? (
          <>
            <span className="mesa-barra-bar" style={{ background: cores[escolhido] }} />
            {renomeando ? (
              <input
                className="mesa-renome" defaultValue={sel.nome} autoFocus
                onBlur={(e) => { mexer(escolhido, 'nome', e.target.value.trim() || sel.nome); setRenomeando(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
              />
            ) : (
              <span className="mesa-barra-nome" style={{ color: cores[escolhido] }}>{sel.nome}</span>
            )}
            <span className="mesa-barra-hud">
              <em>{mmss(duracaoDe(sel))}</em>
              <em>{mmss(inicioDe(sel))} → {mmss(fimDe(sel))}</em>
              {an?.tom && <em>{an.tom}</em>}
            </span>
            <span className="mesa-flex" />

            <button className="mesa-acao" onClick={() => irPara(inicios[escolhido])}>Tocar daqui</button>
            <button className="mesa-acao" onClick={cortarNaAgulha} disabled={!podeCortar}
              title="parte o pedaço no ponto da agulha (S)">Cortar aqui</button>
            <button className="mesa-acao" onClick={() => duplicar(escolhido)} title="duplicar (D)">Duplicar</button>

            <label className="mesa-fade" title="volume deste pedaço · 100% = como veio">
              Vol
              <input type="number" min="0" max="400" step="5"
                value={Math.round(ganhoDe(sel) * 100)}
                onChange={(e) => mexer(escolhido, 'ganho', Math.max(0, Math.min(4, (parseFloat(e.target.value) || 0) / 100)))} />
              %
            </label>

            {escolhido > 0 && (
              <label className="mesa-fade" title="passagem com o pedaço anterior · 0 = emenda seca">
                Fade
                <input type="number" min="0" max="8" step="0.5" value={fadeDe(sel)}
                  onChange={(e) => mexer(escolhido, 'fade', Math.max(0, Math.min(8, parseFloat(e.target.value) || 0)))} />
                s
              </label>
            )}

            <span className="mesa-mover">
              <button onClick={() => trocar(escolhido, -1)} disabled={escolhido === 0} aria-label="mover pra trás">←</button>
              <button onClick={() => trocar(escolhido, 1)} disabled={escolhido === fila.length - 1} aria-label="mover pra frente">→</button>
            </span>
            <button className="mesa-icone" onClick={() => setRenomeando(true)} title="renomear">✎</button>
            <button className="mesa-icone perigo" onClick={() => tirar(escolhido)} title="tirar (Delete)">🗑</button>
          </>
        ) : (
          <span className="mesa-barra-vazia">
            clique num pedaço pra editar · <b>espaço</b> toca e pausa · <b>S</b> corta na agulha ·
            <b> D</b> duplica · <b>Ctrl+Z</b> desfaz · <b>Ctrl+roda</b> aproxima
          </span>
        )}
      </div>

      <p className="mesa-garantia">
        Nada é gravado por cima: o <b>juntado</b> sai num arquivo novo, na pasta do ensaio.
      </p>

      {grande >= 0 && fila[grande] && (
        <CortarMusica
          peca={fila[grande]}
          onFechar={() => setGrande(-1)}
          onPronto={({ ini, fim }) => {
            const n = [...fila]
            n[grande] = { ...n[grande], ini, fim }
            onMudar(n)
            setGrande(-1)
          }}
        />
      )}

      <audio ref={somRef} preload="auto" />
    </div>
  )
}

/* A onda do PEDAÇO que entra — só o trecho, esticado na largura dele. Corpo
   cheio espelhado, não barrinhas: no tamanho em que os pedaços aparecem, barra
   vira chuvisco. O ganho mexe na ALTURA do desenho, porque volume que muda no
   arquivo e não muda na tela é volume que a pessoa esquece que mexeu. */
function PecaOnda({ onda, duracao, ini, fim, cor, ganho = 1 }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const desenhar = () => {
      const dpr = window.devicePixelRatio || 1
      const L = c.clientWidth
      const A = c.clientHeight
      if (!L || !A) return
      if (c.width !== Math.round(L * dpr) || c.height !== Math.round(A * dpr)) {
        c.width = Math.round(L * dpr); c.height = Math.round(A * dpr)
      }
      const g = c.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, L, A)
      if (!onda || !duracao) return
      const de = Math.floor((ini / duracao) * onda.length)
      const ate = Math.max(de + 1, Math.floor(((fim || duracao) / duracao) * onda.length))
      const n = ate - de
      const meio = A / 2
      const alt = A * 0.42
      const em = (x) => Math.min(1.15, (onda[de + Math.floor((x / L) * n)] || 0) * ganho)
      g.beginPath()
      g.moveTo(0, meio)
      for (let x = 0; x <= L; x++) g.lineTo(x, meio - em(x) * alt)
      for (let x = L; x >= 0; x--) g.lineTo(x, meio + em(x) * alt)
      g.closePath()
      g.fillStyle = cor || '#b4e85a'
      g.globalAlpha = 0.62
      g.fill()
      g.globalAlpha = 1
    }
    desenhar()
    const ro = new ResizeObserver(desenhar)
    ro.observe(c)
    return () => ro.disconnect()
  }, [onda, duracao, ini, fim, cor, ganho])
  return <canvas ref={ref} className="mesa-onda" />
}
