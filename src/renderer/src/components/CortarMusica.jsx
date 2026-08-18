import { useEffect, useRef, useState } from 'react'

/* ██████████ CORTAR ██████████
 *
 * O dono olhou a fila da emenda com dois campos de texto ("de 0:00 até o fim")
 * e disse que precisava de um estúdio com as faixas, pra cortar e recortar.
 * Ele tem razão, e o motivo é simples: digitar tempo é ADIVINHAR. Ninguém sabe
 * de cabeça que o refrão começa em 1:47 — a pessoa sabe que ele começa
 * "depois daquele pedaço mais quieto", e isso ela VÊ na onda.
 *
 * Aqui ela arrasta em cima da onda, e ouve o que marcou antes de aceitar. Sem
 * ouvir, cortar continua sendo adivinhar — só que com um desenho junto.
 */
const mmss = (s) => {
  const n = Math.max(0, Number(s) || 0)
  const m = Math.floor(n / 60)
  const r = Math.floor(n % 60)
  return m + ':' + String(r).padStart(2, '0')
}

export default function CortarMusica({ peca, onPronto, onFechar }) {
  const [onda, setOnda] = useState(null)
  const [dur, setDur] = useState(0)
  const [ini, setIni] = useState(0)
  const [fim, setFim] = useState(0)
  const [tocando, setTocando] = useState(false)
  const [agora, setAgora] = useState(0)
  const telaRef = useRef(null)
  const somRef = useRef(null)
  const rafRef = useRef(0)

  useEffect(() => {
    let vivo = true
    window.mptrix.emenda.onda({ path: peca.arquivo }).then((r) => {
      if (!vivo || !r) return
      setOnda(r.onda)
      setDur(r.duracao)
      setIni(Number(peca.ini) || 0)
      setFim(Number(peca.fim) || r.duracao)
    })
    return () => { vivo = false }
  }, [peca.arquivo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── desenha ──
  useEffect(() => {
    const c = telaRef.current
    if (!c || !onda) return
    const desenhar = () => {
      const dpr = window.devicePixelRatio || 1
      const L = c.clientWidth
      const A = c.clientHeight
      if (c.width !== L * dpr) { c.width = L * dpr; c.height = A * dpr }
      const g = c.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, L, A)

      const meio = A / 2
      const passo = L / onda.length
      for (let i = 0; i < onda.length; i++) {
        const t = (i / onda.length) * dur
        // FORA DO TRECHO a onda fica apagada. O trecho não é pintado por cima:
        // é o RESTO que recua. Pintar por cima escondia justamente o desenho
        // que a pessoa veio olhar pra decidir onde cortar.
        const dentro = t >= ini && t <= fim
        g.fillStyle = dentro ? 'rgba(182,255,59,0.92)' : 'rgba(255,255,255,0.13)'
        const h = Math.max(1, onda[i] * (A * 0.46))
        g.fillRect(i * passo, meio - h, Math.max(1, passo - 0.5), h * 2)
      }
      // as duas pontas
      for (const t of [ini, fim]) {
        const x = (t / dur) * L
        g.fillStyle = '#b6ff3b'
        g.fillRect(x - 1, 0, 2, A)
      }
      // onde o som está agora
      if (tocando) {
        const x = (agora / dur) * L
        g.fillStyle = '#fff'
        g.fillRect(x - 0.5, 0, 1, A)
      }
    }
    desenhar()
    const ro = new ResizeObserver(desenhar)
    ro.observe(c)
    return () => ro.disconnect()
  }, [onda, dur, ini, fim, agora, tocando])

  // ── arrastar pra marcar ──
  const noPonto = (e) => {
    const r = telaRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur
  }
  const pegar = (e) => {
    if (!dur) return
    const t0 = noPonto(e)
    let mexeu = false
    const mover = (ev) => {
      const t1 = noPonto(ev)
      if (Math.abs(t1 - t0) > 0.15) mexeu = true
      if (mexeu) { setIni(Math.min(t0, t1)); setFim(Math.max(t0, t1)) }
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      // clique seco sem arrastar não some com a marcação: aqui a marcação É o
      // trabalho, e perdê-la por um toque errado seria refazer tudo
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  // ── ouvir o trecho ──
  const ouvir = () => {
    const a = somRef.current
    if (!a) return
    if (tocando) { a.pause(); setTocando(false); return }
    a.currentTime = ini
    a.play().then(() => setTocando(true)).catch(() => {})
  }
  useEffect(() => {
    if (!tocando) { cancelAnimationFrame(rafRef.current); return }
    const passo = () => {
      const a = somRef.current
      if (!a) return
      setAgora(a.currentTime)
      // para no fim do trecho: ouvir o que vem DEPOIS confunde a decisão
      if (a.currentTime >= fim) { a.pause(); setTocando(false); return }
      rafRef.current = requestAnimationFrame(passo)
    }
    rafRef.current = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tocando, fim])

  // devolve SEGUNDOS, nao texto: quem recebe e a mesa, e mesa mede em segundo.
  // Antes isto devolvia "1:47" porque do outro lado havia um campo de digitar —
  // e o texto ia e voltava por duas conversoes so pra virar numero de novo.
  const aceitar = () => {
    const inteira = ini <= 0.05 && fim >= dur - 0.05
    onPronto(inteira ? { ini: 0, fim: 0 } : { ini, fim })
  }

  return (
    <div className="cor-fundo" onClick={onFechar}>
      <div className="cor-caixa" onClick={(e) => e.stopPropagation()}>
        <span className="cor-olho">a música inteira · marque o pedaço que entra</span>
        <h3>{peca.nome}</h3>

        <canvas ref={telaRef} className="cor-onda" onPointerDown={pegar} />

        {!onda && <p className="cor-carregando">desenhando a onda…</p>}

        <div className="cor-linha">
          <div className="cor-hud">
            <span className="cor-cel"><i>começa</i><b>{mmss(ini)}</b></span>
            <span className="cor-cel"><i>acaba</i><b>{mmss(fim)}</b></span>
            <span className="cor-cel"><i>dura</i><b>{mmss(Math.max(0, fim - ini))}</b></span>
          </div>
          <div className="cor-botoes">
            <button className="btn-secondary btn-small" onClick={ouvir} disabled={!onda}>
              {tocando ? 'parar' : 'ouvir o trecho'}
            </button>
            <button className="btn-secondary btn-small" onClick={() => { setIni(0); setFim(dur) }} disabled={!onda}>
              a música inteira
            </button>
          </div>
        </div>

        <audio
          ref={somRef}
          src={'acervo://a/?f=' + encodeURIComponent(peca.arquivo)}
          preload="auto"
        />

        <div className="cor-acoes">
          <button className="btn-secondary" onClick={onFechar}>cancelar</button>
          <button className="btn-primary" onClick={aceitar} disabled={!onda}>usar este pedaço</button>
        </div>
      </div>
    </div>
  )
}
