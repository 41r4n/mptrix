import { useEffect, useRef, useState, useCallback } from 'react'

const STEM_META = {
  vocals: { label: 'Voz', icon: '🎤' },
  drums: { label: 'Bateria', icon: '🥁' },
  bass: { label: 'Baixo', icon: '🎸' },
  guitar: { label: 'Guitarra', icon: '🎸' },
  piano: { label: 'Piano/Teclado', icon: '🎹' },
  other: { label: 'Outros', icon: '🎼' },
  trumpet: { label: 'Trompete', icon: '🎺' },
  saxophone: { label: 'Sax', icon: '🎷' },
  violin: { label: 'Violino', icon: '🎻' },
  strings: { label: 'Cordas', icon: '🎻' },
  organ: { label: 'Órgão', icon: '⛪' },
  accordion: { label: 'Acordeon', icon: '🪗' },
  flute: { label: 'Flauta', icon: '🪈' },
  harmonica: { label: 'Gaita', icon: '🎵' },
  'acoustic-guitar': { label: 'Violão', icon: '🎸' },
  'electric-guitar': { label: 'Guitarra elétrica', icon: '🎸' },
  brass: { label: 'Metais (trompete, trombone…)', icon: '🎺' },
  banjo: { label: 'Banjo', icon: '🪕' },
  mandolin: { label: 'Bandolim', icon: '🎸' },
  woodwind: { label: 'Madeiras (grupo)', icon: '🪈' },
  percussion: { label: 'Percussão', icon: '🥁' },
  clarinet: { label: 'Clarinete', icon: '🪈' },
  oboe: { label: 'Oboé', icon: '🪈' },
  bassoon: { label: 'Fagote', icon: '🪈' },
  trombone: { label: 'Trombone', icon: '🎺' },
  'french-horn': { label: 'Trompa', icon: '📯' },
  tuba: { label: 'Tuba', icon: '📯' },
  viola: { label: 'Viola de orquestra', icon: '🎻' },
  cello: { label: 'Violoncelo', icon: '🎻' },
  'double-bass': { label: 'Contrabaixo acústico', icon: '🎻' },
  harp: { label: 'Harpa', icon: '🎼' },
  ukulele: { label: 'Ukulele', icon: '🪕' },
  dobro: { label: 'Dobro (slide)', icon: '🎸' },
  sitar: { label: 'Sitar', icon: '🪕' },
  synth: { label: 'Sintetizador', icon: '🎹' },
  harpsichord: { label: 'Cravo', icon: '🎹' },
  marimba: { label: 'Marimba/Xilofone', icon: '🎶' },
  glockenspiel: { label: 'Glockenspiel (sinos)', icon: '🔔' },
  timpani: { label: 'Tímpanos', icon: '🥁' },
  tambourine: { label: 'Pandeirola', icon: '🪘' },
  triangle: { label: 'Triângulo', icon: '🔺' },
  congas: { label: 'Congas', icon: '🪘' },
  instrumental: { label: 'Resto da música', icon: '🎵' },
  song: { label: 'Música completa', icon: '🎵' }
}

// Minutos de processamento por minuto de música (medido nesta máquina)
// Minutos de trabalho por minuto de música. Estes são do PROCESSADOR: um
// especialista custa 9,7x a duração da música (4,8 min de música = 47 min).
const PROC_FACTOR = 9.7

// E estes são da GPU alugada, MEDIDOS na Azul (4min20):
//   base ....... 78s de relógio  -> 0,30x  (arredondo pra cima)
//   especialista 85s com contêiner quente -> 0,33x (idem)
// A partida a frio é cobrada à parte porque não escala com a música: é o tempo
// de subir a imagem com CUDA, e só a PRIMEIRA da sessão paga.
const NUVEM_BASE = 0.35
const NUVEM_ESP = 0.4
const NUVEM_GP = 0.35
const NUVEM_PARTIDA = 3

// Escala verde do design system — cor por stem (canônicos fixos; extras
// ciclam a escala pela ordem em que aparecem na sessão)
const STEM_SCALE = ['#dff9a0', '#b4e85a', '#7ed97a', '#4ecb8c', '#27a08d', '#8fa57a']
const STEM_COLOR_FIXED = {
  vocals: '#dff9a0',
  drums: '#b4e85a',
  bass: '#7ed97a',
  guitar: '#4ecb8c',
  piano: '#27a08d',
  other: '#8fa57a',
  song: '#b6ff3b'
}
const stemColor = (stem, orderIdx) =>
  STEM_COLOR_FIXED[stem] || STEM_SCALE[orderIdx % STEM_SCALE.length]

// Transposição de acordes: acompanha o chip TOM (Am − 2 semitons = Gm).
// Grafia de músico: Ab/Bb/Eb em vez de G#/A#/D# (como nas cifras reais).
const CHORD_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_SHOW = { 'G#': 'Ab', 'A#': 'Bb', 'D#': 'Eb' }
const transposeChord = (label, semi) => {
  const m = /^([A-G]#?)([^/]*)(?:\/([A-G]#?))?$/.exec(label || '')
  if (!m) return label
  const shift = (note) => {
    const i = CHORD_NOTES.indexOf(note)
    if (i < 0) return note
    const r = CHORD_NOTES[(((i + semi) % 12) + 12) % 12]
    return FLAT_SHOW[r] || r
  }
  return shift(m[1]) + m[2] + (m[3] ? `/${shift(m[3])}` : '')
}

// Ícones do transporte (SVGs do design, viewBox 24)
const IconBack10 = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2.5 4 2.5 10 8.5 10" />
    <path d="M4.6 15a9 9 0 1 0 2.1-9.4L2.5 10" />
    <text x="12" y="16" fontSize="7.5" fontFamily="IBM Plex Mono, monospace" textAnchor="middle" fontWeight="600" fill="currentColor" stroke="none">10</text>
  </svg>
)
const IconFwd10 = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21.5 4 21.5 10 15.5 10" />
    <path d="M19.4 15a9 9 0 1 1-2.1-9.4L21.5 10" />
    <text x="12" y="16" fontSize="7.5" fontFamily="IBM Plex Mono, monospace" textAnchor="middle" fontWeight="600" fill="currentColor" stroke="none">10</text>
  </svg>
)
const IconLoop = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
)
const IconPlay = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginLeft: 2 }}>
    <path d="M8 5l11 7-11 7z" fill="#0b0c0f" />
  </svg>
)
const IconPause = () => (
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="#0b0c0f" />
  </svg>
)

const NOTE_PT = {
  C: 'Dó', 'C#': 'Dó#', D: 'Ré', 'D#': 'Ré#', E: 'Mi', F: 'Fá',
  'F#': 'Fá#', G: 'Sol', 'G#': 'Sol#', A: 'Lá', 'A#': 'Lá#', B: 'Si',
  // O detector às vezes devolve bemóis — mostramos do jeito que músico fala
  Db: 'Réb', Eb: 'Mib', Gb: 'Solb', Ab: 'Láb', Bb: 'Sib', Cb: 'Si', Fb: 'Mi'
}

// Converte bemol pra sustenido equivalente (pra calcular a mudança de tom)
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' }

const STAGE_LABELS = {
  preparing: 'Preparando o áudio…',
  analyzing: 'Detectando tom e BPM…',
  'downloading-model': 'Baixando o modelo de IA (só na primeira vez)…',
  separating: 'Separando os instrumentos…',
  converting: 'Finalizando as faixas…'
}

const SPEED_OPTIONS = [50, 60, 70, 75, 80, 90, 100]
const DRIFT_TOLERANCE = 0.06

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Traduz a nota crua da IA (dialeto comprimido: 0.42 = "forte") pra escala
// humana de 0-100, onde detecção com folga parece o que é: confiança alta.
function humanConf(score) {
  if (score == null) return null
  return Math.round(Math.min(97, 100 * Math.pow(score, 0.3)))
}

function fmtEta(sec) {
  if (sec == null || !isFinite(sec) || sec <= 0) return null
  if (sec < 75) return 'falta menos de 1 min'
  return `faltam ~${Math.round(sec / 60)} min`
}

// Barra viva: desliza continuamente na velocidade medida (sem saltos) e
// estima o tempo restante a partir do ritmo real do trabalho.
function useSmoothProgress(target, active) {
  const [display, setDisplay] = useState(0)
  const [eta, setEta] = useState(null)
  const histRef = useRef([])
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) {
      histRef.current = []
      setDisplay(0)
      setEta(null)
      return
    }
    if (target == null) return
    const h = histRef.current
    const lastP = h.length ? h[h.length - 1].p : null
    if (lastP == null || target > lastP) {
      // Salto grande = pedaço aproveitado de retomada, não velocidade real.
      // Zera a história pra previsão nascer do ritmo verdadeiro dali em diante.
      if (lastP != null && target - lastP > 8) {
        h.length = 0
        setEta(null)
      }
      h.push({ t: Date.now(), p: target })
      if (h.length > 10) h.shift()
    }
  }, [target, active])

  useEffect(() => {
    if (!active) return
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.2, (now - last) / 1000)
      last = now
      const h = histRef.current
      let rate = 0
      if (h.length >= 2) {
        const span = (h[h.length - 1].t - h[0].t) / 1000
        if (span > 2) rate = (h[h.length - 1].p - h[0].p) / span
      }
      const tgt = h.length ? h[h.length - 1].p : 0
      const sinceLast = h.length ? (Date.now() - h[h.length - 1].t) / 1000 : 0
      const predicted = Math.min(tgt + rate * sinceLast, tgt + 8, 99)
      setDisplay((d) => {
        const goal = Math.max(d, Math.min(predicted, 99))
        return d + (goal - d) * Math.min(1, dt * 2)
      })
      // Previsão honesta: só existe com ritmo real; parada há 45s+, se apaga
      // em vez de ficar mentindo na tela
      if (rate > 0.005 && tgt > 2 && tgt < 99 && sinceLast < 45) setEta((100 - tgt) / rate)
      else if (sinceLast >= 45) setEta(null)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active])

  return { display, eta }
}

// Faixa com as "dobras sonoras": desenha os picos, mostra o cursor de
// reprodução, clique = pular pra posição, arrastar = marcar trecho pra Lupa
function WaveLane({ peaks, duration, color, selection, onSeek, onSelect, onNodes }) {
  const canvasRef = useRef(null)
  const boxRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth || 600
      const h = canvas.clientHeight || 34
      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)
      // Traços verticais finos com respiro, como no protótipo (~1 barra a cada
      // 4.5px, largura 1.8, centrados na linha do meio)
      const bars = Math.max(60, Math.floor(w / 4.5))
      const per = peaks.length / bars
      ctx.fillStyle = color || 'rgba(182, 255, 59, 0.9)'
      for (let b = 0; b < bars; b++) {
        let max = 0
        const s0 = Math.floor(b * per)
        const s1 = Math.min(peaks.length, Math.max(s0 + 1, Math.floor((b + 1) * per)))
        for (let s = s0; s < s1; s++) if (peaks[s] > max) max = peaks[s]
        const ph = Math.max(2, max * (h - 8))
        const x = (b + 0.5) * (w / bars)
        ctx.fillRect(x - 0.9, (h - ph) / 2, 1.8, ph)
      }
    }
    draw()
    // Janela mudou de tamanho? Redesenha — senão a onda fica esticada/borrada
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [peaks, color])

  const timeAt = (clientX) => {
    const r = boxRef.current.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return frac * (duration || 1)
  }

  const onDown = (e) => {
    e.preventDefault()
    dragRef.current = { x0: e.clientX, t0: timeAt(e.clientX), moved: false }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d) return
      if (Math.abs(ev.clientX - d.x0) > 6) d.moved = true
      if (d.moved) {
        const t1 = timeAt(ev.clientX)
        onSelect?.({ start: Math.min(d.t0, t1), end: Math.max(d.t0, t1) })
      }
    }
    const onUp = (ev) => {
      const d = dragRef.current
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (d && !d.moved) onSeek?.(timeAt(ev.clientX))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="wave-lane" ref={boxRef} onPointerDown={onDown} title="Clique: pular · Arrastar: marcar trecho pra investigar">
      <div className="wave-zero" />
      <canvas ref={canvasRef} className="wave-canvas" />
      {/* tint da região já tocada + playhead: escritos por frame via ref */}
      <div className="wave-tint" ref={(el) => onNodes?.('tint', el)} />
      {selection && duration > 0 && (
        <div
          className="wave-selection"
          style={{
            left: `${(selection.start / duration) * 100}%`,
            width: `${(Math.max(0.2, selection.end - selection.start) / duration) * 100}%`
          }}
        />
      )}
      <div className="wave-playhead" ref={(el) => onNodes?.('ph', el)}>
        <div className="wave-ph-line" />
      </div>
      {!peaks && <div className="wave-loading muted">· · ·</div>}
    </div>
  )
}

// Onda em miniatura pras faixas guardadas: mostra ONDE o instrumento aparece
// (clique pula pra lá) — faixa sem onda é faixa invisível
function MiniWave({ peaks, duration, color, onSeek, onNodes }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth || 300
      const h = canvas.clientHeight || 26
      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)
      const bars = Math.max(40, Math.floor(w / 3.5))
      const per = peaks.length / bars
      ctx.fillStyle = color || 'rgba(182, 255, 59, 0.9)'
      for (let b = 0; b < bars; b++) {
        let max = 0
        const s0 = Math.floor(b * per)
        const s1 = Math.min(peaks.length, Math.max(s0 + 1, Math.floor((b + 1) * per)))
        for (let s = s0; s < s1; s++) if (peaks[s] > max) max = peaks[s]
        const ph = Math.max(1.5, max * (h - 4))
        const x = (b + 0.5) * (w / bars)
        ctx.fillRect(x - 0.7, (h - ph) / 2, 1.4, ph)
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [peaks, color])

  return (
    <div
      className="mini-wave"
      data-hint="ONDE TOCA — os riscos mostram os momentos em que esse instrumento aparece na música. Clique em qualquer ponto pra pular direto pra lá."
      onPointerDown={(e) => {
        if (!duration) return
        const r = e.currentTarget.getBoundingClientRect()
        onSeek?.(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration)
      }}
    >
      <canvas ref={canvasRef} className="mini-wave-canvas" />
      {/* tint + playhead: escritos por frame pelo relógio do transporte */}
      <div className="mini-tint" ref={(el) => onNodes?.('tint', el)} />
      <div className="mini-ph" ref={(el) => onNodes?.('ph', el)} />
      {!peaks && <span className="mini-wave-load muted">· · ·</span>}
    </div>
  )
}

const SEP_HINTS = [
  'isolando a voz…',
  'peneirando a bateria…',
  'destacando o baixo…',
  'separando as camadas…',
  'lapidando os detalhes…'
]

function keyLabel(analysis) {
  if (!analysis?.key) return null
  const note = NOTE_PT[analysis.key] || analysis.key
  const scale = analysis.scale === 'major' ? 'maior' : 'menor'
  return `${note} ${scale}`
}

// "Mostra o que a música tem": faixas praticamente silenciosas ficam de fora
// Mesa: só quem toca de verdade (nem quase-mudas, nem guardadas na prateleira)
function presentStems(sess) {
  if (!sess?.stemInfo) return sess?.stems || []
  return sess.stems.filter((s) => sess.stemInfo[s]?.present !== false && !sess.stemInfo[s]?.shelved)
}

// Player: TUDO que tem som entra na mistura — inclusive as guardadas. O som
// delas foi descontado do "outros", então deixá-las de fora tocaria a música
// incompleta. A prateleira é só onde elas ficam NA TELA.
function audibleStems(sess) {
  if (!sess?.stemInfo) return sess?.stems || []
  return sess.stems.filter((s) => sess.stemInfo[s]?.present !== false)
}

// Prateleira: faixas guardadas (evidência fraca ou decisão do dono)
function shelvedStems(sess) {
  if (!sess?.stemInfo) return []
  return sess.stems.filter((s) => sess.stemInfo[s]?.present !== false && sess.stemInfo[s]?.shelved)
}

function absentStems(sess) {
  if (!sess?.stemInfo) return []
  return sess.stems.filter((s) => sess.stemInfo[s]?.present === false)
}

function shiftedKeyLabel(analysis, pitch) {
  if (!analysis?.key || !pitch) return null
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const idx = NOTES.indexOf(FLAT_TO_SHARP[analysis.key] || analysis.key)
  if (idx < 0) return null
  const next = NOTES[(idx + pitch + 120) % 12]
  const scale = analysis.scale === 'major' ? 'maior' : 'menor'
  return `${NOTE_PT[next]} ${scale}`
}

// Player por streaming: HTMLAudioElement por faixa (RAM mínima) roteado por
// Web Audio pra permitir mudança de tom em tempo real. Velocidade muda via
// playbackRate (mantendo o tom, nativo do Chromium). Tom muda na hora pelo
// worklet e, em segundo plano, a versão Rubber Band (qualidade máxima) é
// renderizada e trocada sem interromper o uso.
function createStemPlayer() {
  return {
    els: {},
    order: [],
    sources: [],
    playing: false,
    ctx: null,
    mix: null,
    shifter: null,
    filePitch: 0, // semitons já embutidos nos arquivos carregados
    targetPitch: 0,
    tempoRate: 1,

    async ensureGraph() {
      if (this.ctx) return
      const ctx = new AudioContext()
      await ctx.audioWorklet.addModule(new URL('./pitch-worklet.js', window.location.href))
      this.mix = ctx.createGain()
      this.shifter = new AudioWorkletNode(ctx, 'mptrix-pitch-shift', { outputChannelCount: [2] })
      this.mix.connect(this.shifter)
      this.shifter.connect(ctx.destination)
      this.ctx = ctx
    },

    disposeEls() {
      for (const src of this.sources) {
        try { src.disconnect() } catch {}
      }
      this.sources = []
      for (const el of Object.values(this.els)) {
        try { el.pause(); el.removeAttribute('src'); el.load() } catch {}
      }
      this.els = {}
      this.order = []
      this.playing = false
    },

    async load(stems, urlFor, filePitch = 0) {
      await this.ensureGraph()
      this.disposeEls()
      this.order = [...stems]
      await Promise.all(stems.map((stem) => new Promise((resolve, reject) => {
        const el = new Audio()
        el.preload = 'auto'
        el.crossOrigin = 'anonymous'
        el.preservesPitch = true
        el.playbackRate = this.tempoRate
        el.onloadedmetadata = () => resolve()
        // A colheita reescreve arquivos com o estúdio aberto; uma carga pode
        // pegar o arquivo no MEIO da reescrita. Antes isso matava a faixa em
        // silêncio. Uma re-tentativa 900ms depois resolve o caso comum.
        let retentou = false
        el.onerror = () => {
          if (!retentou) {
            retentou = true
            setTimeout(() => { el.src = urlFor(stem) + '&r=1'; el.load() }, 900)
          } else {
            reject(new Error(`Não consegui carregar a faixa "${stem}"`))
          }
        }
        el.src = urlFor(stem)
        this.els[stem] = el
      })))
      for (const stem of stems) {
        const src = this.ctx.createMediaElementSource(this.els[stem])
        src.connect(this.mix)
        this.sources.push(src)
      }
      this.filePitch = filePitch
      this.applyPitchRatio()
    },

    applyPitchRatio() {
      if (!this.shifter) return
      const semis = this.targetPitch - this.filePitch
      this.shifter.parameters.get('ratio').value = Math.pow(2, semis / 12)
    },

    setPitch(totalSemis) {
      this.targetPitch = totalSemis
      this.applyPitchRatio()
    },

    setTempo(rate) {
      this.tempoRate = rate
      for (const el of Object.values(this.els)) el.playbackRate = rate
    },

    master() {
      return this.els[this.order[0]] || null
    },

    duration() {
      const m = this.master()
      return m && isFinite(m.duration) ? m.duration : 0
    },

    position() {
      const m = this.master()
      return m ? m.currentTime : 0
    },

    async play(fromOffset) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume()
      const dur = this.duration()
      let offset = fromOffset != null ? fromOffset : this.position()
      if (offset >= dur - 0.05) offset = 0
      for (const el of Object.values(this.els)) el.currentTime = offset
      await Promise.all(Object.values(this.els).map((el) => el.play().catch(() => {})))
      this.playing = true
    },

    pause() {
      for (const el of Object.values(this.els)) el.pause()
      this.playing = false
    },

    seek(sec) {
      const t = Math.max(0, Math.min(sec, this.duration()))
      for (const el of Object.values(this.els)) el.currentTime = t
    },

    correctDrift() {
      if (!this.playing) return
      const m = this.master()
      if (!m) return
      for (const stem of this.order.slice(1)) {
        const el = this.els[stem]
        if (el && Math.abs(el.currentTime - m.currentTime) > DRIFT_TOLERANCE) {
          el.currentTime = m.currentTime
        }
      }
    },

    applyGains(volumes, muted, solo) {
      for (const [stem, el] of Object.entries(this.els)) {
        const vol = Math.max(0, Math.min(1, volumes[stem] ?? 1))
        const off = muted.has(stem) || (solo.size > 0 && !solo.has(stem))
        el.volume = off ? 0 : vol
      }
    },

    ended() {
      const m = this.master()
      return m ? m.ended : false
    },

    dispose() {
      this.disposeEls()
      try { this.ctx?.close() } catch {}
      this.ctx = null
      this.mix = null
      this.shifter = null
    }
  }
}

// Quanto a letra acende ANTES do instante medido da palavra. Não é maquiagem:
// no karaokê o cantor precisa ver a palavra pra cantar ela, então um fio de
// dianteira é o certo. O valor saiu do ouvido do dono do app — as duas réguas
// automáticas que eu construí discordam até no sinal (uma acusa 82ms adiantado
// medindo o pico da sílaba, a outra 175ms atrasado medindo a saída do
// silêncio), então quem decide aqui é a orelha.
const ADIANTA_LETRA = 0.08

export default function StudioView({ source, onClose }) {
  const [phase, setPhase] = useState('starting')
  const [stage, setStage] = useState(null)
  const [percent, setPercent] = useState(null)
  const [passInfo, setPassInfo] = useState(null)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)
  const [model, setModel] = useState(source.model || 'htdemucs')
  // A conta do tempo muda de casa quando a separação é na nuvem — sem isso a
  // tela prometia 166 minutos pra um trabalho de 8, que é pior que não estimar
  const [naNuvem, setNaNuvem] = useState(false)
  useEffect(() => {
    window.mptrix.nuvem?.estado().then((n) => setNaNuvem(!!(n?.ligada && n?.temChave))).catch(() => {})
  }, [])

  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [volumes, setVolumes] = useState({})
  const [muted, setMuted] = useState(() => new Set())
  const [solo, setSolo] = useState(() => new Set())

  const [pitch, setPitchState] = useState(0)
  const [tempo, setTempoState] = useState(100)
  const [hq, setHq] = useState(null) // null | {state:'rendering',pct} | {state:'done'}
  const [exportMsg, setExportMsg] = useState(null)
  const [scout, setScout] = useState(null) // null | 'loading' | {detections:[...]}
  const [extractSel, setExtractSel] = useState(() => new Set())
  const [arsenal, setArsenal] = useState([]) // catálogo completo de especialistas
  const [showArsenal, setShowArsenal] = useState(false)
  const [peaksMap, setPeaksMap] = useState({}) // forma de onda por faixa
  const [waveSel, setWaveSel] = useState(null) // {start, end} trecho marcado
  const [lupa, setLupa] = useState(null) // null | 'loading' | resultado da lupa
  const [loopOn, setLoopOn] = useState(false) // loop do transporte (trecho ou música)
  const loopRef = useRef({ on: false, sel: null })
  useEffect(() => { loopRef.current = { on: loopOn, sel: waveSel } }, [loopOn, waveSel])
  const [chords, setChords] = useState(null) // null | 'loading' | {list} | {error}
  const [showChords, setShowChords] = useState(false)
  const chordsGridRef = useRef(null)
  const [lyrics, setLyrics] = useState(null) // null | 'loading' | {segments} | {error}
  const [lyricsPct, setLyricsPct] = useState(0)
  useEffect(() => window.mptrix.studio.onLyricsProgress?.((p) => setLyricsPct(p.percent || 0)), [])
  const [showLyrics, setShowLyrics] = useState(false)
  const [showExtract, setShowExtract] = useState(false) // painel Extrair (olheiro/lupa/arsenal)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const lyricsListRef = useRef(null)
  const [trackInfo, setTrackInfo] = useState(null) // stem da ficha técnica aberta
  const [shelfOpen, setShelfOpen] = useState(false) // abinha das guardadas
  // depois que a abertura termina, o corpo volta a "vazar" (pras legendas
  // flutuantes não serem cortadas durante a animação de altura)
  const [shelfSettled, setShelfSettled] = useState(false)
  useEffect(() => {
    if (!shelfOpen) { setShelfSettled(false); return }
    const t = setTimeout(() => setShelfSettled(true), 320)
    return () => clearTimeout(t)
  }, [shelfOpen])
  // altura da área das pistas — usada pra enquadrar um número inteiro de faixas
  const dawScrollRef = useRef(null)
  const [dawH, setDawH] = useState(0)
  const [uiZoom, setUiZoom] = useState(1)
  useEffect(() => {
    window.mptrix.ui?.zoomGet?.().then((v) => setUiZoom(v || 1)).catch(() => {})
    return window.mptrix.ui?.onZoom?.((v) => setUiZoom(v || 1))
  }, [])
  // acorde/verso da vez (escritos pelo relógio de frame)
  const [activeChordIdx, setActiveChordIdx] = useState(-1)
  const [activeLyrIdx, setActiveLyrIdx] = useState(-1)
  const [activeWordIdx, setActiveWordIdx] = useState(-1)
  const lastWordIdxRef = useRef(-1)
  // cópias lima de cada palavra do verso ativo — preenchidas por frame
  const wordFillsRef = useRef([])
  const wordFillRef = useRef(null)
  const chordsListRef = useRef(null)
  const lyrSegsRef = useRef(null)
  const lastChordIdxRef = useRef(-1)
  const lastLyrIdxRef = useRef(-1)
  // Nós do DOM escritos por frame (playhead/tint por pista, ruler, timer, seek)
  const laneNodesRef = useRef({})
  const rulerNodesRef = useRef({})
  const timerElRef = useRef(null)
  const seekElRef = useRef(null)
  const [extractJob, setExtractJob] = useState(null) // {id, label, stage, percent}
  const [autoJob, setAutoJob] = useState(null) // colheita automática: {id, fase, alvos, label}
  const [exportingSong, setExportingSong] = useState(false)
  const [plan, setPlan] = useState(null) // catálogo da pré-análise
  const [planSel, setPlanSel] = useState(() => new Set())
  const [memInfo, setMemInfo] = useState(null) // fiscal de memória
  const [polishJob, setPolishJob] = useState(null) // reservado (polimento interno, sem botão)
  const [hogSel, setHogSel] = useState(() => new Set())
  const [confirmClose, setConfirmClose] = useState(false)
  const [closingApps, setClosingApps] = useState(false)
  const planChoicesRef = useRef(null)
  const separateRef = useRef(null)
  const sessionStarterRef = useRef(null)
  const phaseRef = useRef('starting')
  const memIntervalRef = useRef(null)
  const memResolveRef = useRef(null)
  const memPrevPhaseRef = useRef('starting')

  const jobRef = useRef(null)
  const autoJobRef = useRef(null) // dissecação em voo: cancelada ao fechar a música
  const playerRef = useRef(null)
  const rafRef = useRef(null)
  const aliveRef = useRef(true)
  const draggingRef = useRef(false)
  const pitchRef = useRef(0)
  const hqTimerRef = useRef(null)
  const mixerRef = useRef({ volumes: {}, muted: new Set(), solo: new Set() })

  const mainMeter = useSmoothProgress(percent, phase === 'processing' || phase === 'planning')
  const extractMeter = useSmoothProgress(extractJob?.percent ?? null, !!extractJob)
  const polishMeter = useSmoothProgress(polishJob?.percent ?? null, !!polishJob)
  const [hintIdx, setHintIdx] = useState(0)
  useEffect(() => {
    if (phase !== 'processing' && phase !== 'planning' && !extractJob) return
    const t = setInterval(() => setHintIdx((i) => i + 1), 5000)
    return () => clearInterval(t)
  }, [phase, extractJob])

  const getPlayer = useCallback(() => {
    if (!playerRef.current) playerRef.current = createStemPlayer()
    return playerRef.current
  }, [])

  // O carimbo ?v= muda a cada carga. Sem ele, o "outros" reconstruído pela
  // colheita era servido do CACHE com o conteúdo antigo — você isolava uma
  // faixa e ouvia instrumento que já tinha saído dela. O protocolo stems://
  // ignora a query, então só o cache enxerga a diferença.
  const stemUrl = useCallback((sessKey, variant, format) =>
    (stem) => `stems://s/${sessKey}/${variant}/${stem}.${format}?v=${Date.now()}`, [])

  const pause = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    p.pause()
    setPlaying(false)
    setPos(p.position())
  }, [])

  const play = useCallback(async (fromOffset) => {
    const p = playerRef.current
    if (!p) return
    await p.play(fromOffset)
    setPlaying(true)
  }, [])

  const seekTo = useCallback((sec) => {
    const p = playerRef.current
    if (!p) return
    p.seek(sec)
    setPos(sec)
  }, [])

  // Relógio do transporte — playhead, tint, timer e seek são escritos POR
  // FRAME direto no DOM (refs + style/textContent), nunca via re-render:
  // regra de performance do design. O estado React (pos) atualiza só 4×/s
  // pro restante da UI. O loop A-B do transporte também vive aqui.
  useEffect(() => {
    let lastDrift = 0
    let lastState = 0
    const tick = (ts) => {
      const p = playerRef.current
      if (p) {
        // O que o ouvido escuta está ATRÁS do currentTime: o áudio já entregue
        // à placa de som ainda não saiu pelo alto-falante. Sem descontar isso,
        // playhead, timer e letra andam adiantados uns 10–40ms de graça.
        let t = p.position() - (p.ctx?.outputLatency || p.ctx?.baseLatency || 0)
        if (t < 0) t = 0
        const dur = p.duration() || 0
        if (p.playing) {
          if (p.ended()) {
            const lp = loopRef.current
            if (lp.on) {
              // Loop ligado: fim da música recomeça do ponto A, nunca para
              const A = lp.sel ? lp.sel.start : 0
              p.play(A).catch(() => {})
              t = A
            } else {
              p.pause()
              p.seek(0)
              setPlaying(false)
              setPos(0)
              t = 0
            }
          } else {
            const lp = loopRef.current
            if (lp.on && dur) {
              const A = lp.sel ? lp.sel.start : 0
              const B = lp.sel ? Math.min(lp.sel.end, dur) : dur
              if (t >= B - 0.03) {
                p.seek(A)
                t = A
              }
            }
            if (ts - lastDrift > 500) {
              p.correctDrift()
              lastDrift = ts
            }
          }
        }
        {
          // Playhead, tint e timer acompanham SEMPRE — inclusive durante o
          // arrasto da barra (é justamente aí que o usuário quer ver onde está)
          const pct = dur ? `${((t / dur) * 100).toFixed(3)}%` : '0%'
          for (const nodes of Object.values(laneNodesRef.current)) {
            if (nodes.ph) nodes.ph.style.left = pct
            if (nodes.tint) nodes.tint.style.width = pct
          }
          if (rulerNodesRef.current.ph) rulerNodesRef.current.ph.style.left = pct
          if (rulerNodesRef.current.tint) rulerNodesRef.current.tint.style.width = pct
          if (timerElRef.current) {
            const txt = fmtTime(t)
            if (timerElRef.current.textContent !== txt) timerElRef.current.textContent = txt
          }
          // só a barra de seek não é reescrita durante o arrasto — senão
          // brigaria com o dedo do usuário
          if (!draggingRef.current && seekElRef.current) seekElRef.current.value = String(t)
          // acorde/verso da vez: decididos por frame, com antecipação de 0.3s
          // e segurando o atual até o próximo começar
          const tt = t + 0.3
          const cl = chordsListRef.current
          if (cl && cl.length) {
            let idx = -1
            for (let i = 0; i < cl.length; i++) {
              if (cl[i].t <= tt) idx = i
              else break
            }
            if (idx !== lastChordIdxRef.current) {
              lastChordIdxRef.current = idx
              setActiveChordIdx(idx)
            }
          }
          const ls = lyrSegsRef.current
          if (ls && ls.length) {
            // letra NÃO usa a antecipação dos acordes: verso acende quando é
            // cantado, não antes
            let idx = -1
            for (let i = 0; i < ls.length; i++) {
              if (ls[i].t0 <= t + ADIANTA_LETRA) idx = i
              else break
            }
            if (idx !== lastLyrIdxRef.current) {
              lastLyrIdxRef.current = idx
              setActiveLyrIdx(idx)
            }
            // KARAOKÊ: acende palavra por palavra, no instante em que cada uma
            // é cantada. Só com a marcação de palavras — sem ela, nada de
            // adivinhar (era o que fazia o verde adiantar).
            const seg = ls[idx]
            let w = -1
            if (seg?.words?.length) {
              const fimCantado = seg.words[seg.words.length - 1]?.t1 ?? seg.t1
              if (t > fimCantado + 0.4) {
                // verso acabou e o instrumental correu: ninguém está cantando,
                // então nenhuma palavra fica acesa (todas viram "já cantada")
                w = seg.words.length
              } else {
                for (let k = 0; k < seg.words.length; k++) {
                  if (seg.words[k].t0 <= t + ADIANTA_LETRA) w = k
                  else break
                }
              }
            }
            if (w !== lastWordIdxRef.current) {
              lastWordIdxRef.current = w
              setActiveWordIdx(w)
            }
            // enchimento contínuo: cada palavra é revelada por dentro conforme
            // é cantada (sem palavra medida, o verso inteiro enche linear)
            if (seg) {
              const kws = seg.words?.length ? seg.words : [{ t0: seg.t0, t1: seg.t1 }]
              const fills = wordFillsRef.current
              for (let k = 0; k < kws.length; k++) {
                const el = fills[k]
                if (!el) continue
                const kw = kws[k]
                const dur = Math.max(0.09, (kw.t1 ?? kw.t0) - kw.t0)
                const p = Math.max(0, Math.min(1, (t + 0.06 - kw.t0) / dur))
                el.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`
              }
            }
          }
          if ((p.playing || draggingRef.current) && ts - lastState > 250) {
            setPos(t)
            lastState = ts
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    // Rede de segurança do loop: rAF congela com a janela minimizada, mas o
    // áudio continua — este intervalo garante o retorno ao ponto A mesmo assim
    const loopGuard = setInterval(() => {
      const p = playerRef.current
      const lp = loopRef.current
      if (!p || !p.playing || !lp.on) return
      const dur = p.duration() || 0
      if (!dur) return
      const A = lp.sel ? lp.sel.start : 0
      const B = lp.sel ? Math.min(lp.sel.end, dur) : dur
      if (p.ended()) p.play(A).catch(() => {})
      else if (p.position() >= B - 0.25) p.seek(A)
    }, 250)
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(loopGuard)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Renderização de alta qualidade em segundo plano (tom)
  const scheduleHqRender = useCallback((targetPitch) => {
    clearTimeout(hqTimerRef.current)
    setHq(null)
    if (!session) return
    hqTimerRef.current = setTimeout(async () => {
      const p = playerRef.current
      if (!p || !aliveRef.current) return
      if (p.filePitch === targetPitch) { setHq({ state: 'done' }); return }
      setHq({ state: 'rendering', pct: 0 })
      const offP = window.mptrix.studio.onProgress((ev) => {
        if (ev.id === `render:${session.key}`) setHq({ state: 'rendering', pct: ev.percent || 0 })
      })
      try {
        const res = await window.mptrix.studio.render({ key: session.key, pitch: targetPitch, tempo: 100 })
        if (res?.error) { setHq(null); return }
        if (!aliveRef.current || pitchRef.current !== targetPitch) return
        // Troca os arquivos pela versão qualidade máxima, mantendo posição e estado
        const wasPlaying = p.playing
        const cur = p.position()
        if (wasPlaying) p.pause()
        const variant = res.variant || 'base'
        const format = res.format || 'flac'
        await p.load(audibleStems(session), stemUrl(session.key, variant, format), targetPitch)
        const m = mixerRef.current
        p.applyGains(m.volumes, m.muted, m.solo)
        p.seek(cur)
        if (wasPlaying && aliveRef.current && pitchRef.current === targetPitch) await p.play(cur)
        if (aliveRef.current) setHq({ state: 'done' })
      } catch {
        if (aliveRef.current) setHq(null)
      } finally {
        offP?.()
      }
    }, 1500)
  }, [session, stemUrl])

  // Recarrega as faixas do player preservando posição/estado (faixas novas ou trocadas)
  const reloadSession = useCallback(async (sess) => {
    setSession(sess)
    const p = playerRef.current
    if (!p) return
    const pos = p.position()
    const wasPlaying = p.playing
    if (wasPlaying) p.pause()
    setPitchState(0)
    pitchRef.current = 0
    p.targetPitch = 0
    setVolumes((v) => {
      const next = { ...v }
      for (const stem of sess.stems) if (next[stem] == null) next[stem] = 1
      return next
    })
    try {
      await p.load(audibleStems(sess), stemUrl(sess.key, 'base', 'flac'), 0)
      const m = mixerRef.current
      p.applyGains({ ...m.volumes }, m.muted, m.solo)
      p.seek(pos)
      if (wasPlaying && aliveRef.current) await p.play(pos)
    } catch {
      // engolir a falha deixava o tocador meio-carregado e faixas mudas sem
      // explicação; espera os arquivos assentarem e tenta UMA vez de novo
      await new Promise((r) => setTimeout(r, 1500))
      try {
        await p.load(audibleStems(sess), stemUrl(sess.key, 'base', 'flac'), 0)
        const m = mixerRef.current
        p.applyGains({ ...m.volumes }, m.muted, m.solo)
        p.seek(pos)
        if (wasPlaying && aliveRef.current) await p.play(pos)
      } catch (e2) {
        setExportMsg(`⚠ Uma faixa não carregou (${e2.message}). Feche e abra a música de novo.`)
      }
    }
  }, [stemUrl])

  // Reconector: se um trabalho terminar "órfão" (a tela recarregou no meio e
  // perdeu o vínculo), as faixas novas entram assim mesmo quando ele acabar.
  useEffect(() => {
    const off = window.mptrix.studio.onStatus(async (s) => {
      if (s.state !== 'done' || !s.session?.key) return
      if (!session?.key || s.session.key !== session.key) return
      if (extractJob || polishJob) return // já tem dono cuidando
      if (phaseRef.current !== 'ready') return
      if ((s.session.stems || []).length === (session.stems || []).length) return
      await reloadSession(s.session)
      setScout(null)
      setExportMsg('✓ Faixas novas adicionadas à música!')
    })
    return off
  }, [session, extractJob, polishJob, reloadSession])

  // Colheita automática: acompanha os eventos dela (id próprio + eventos dos
  // trabalhos internos marcados com auto:true) e resume no painel
  useEffect(() => {
    const offS = window.mptrix.studio.onStatus((st) => {
      if (!st.auto) return
      if (st.state !== 'running') {
        // Só o status da dissecação DESTA música mexe no painel: o "done" de uma
        // música fechada antes chegava aqui, zerava o acompanhamento da atual
        // (deixando-a sem quem a cancele) e dava recado de uma música na tela de
        // outra. Sem dissecação nossa em voo, status final não é assunto nosso.
        const meuId = st.autoId || st.id
        if (!autoJobRef.current || (meuId && meuId !== autoJobRef.current)) return
        setAutoJob(null)
        autoJobRef.current = null
        // Adota SÓ a confissão do status final — é o que a tela precisa e não
        // existe em nenhum outro lugar. Trocar a sessão inteira aqui mudaria a
        // lista de faixas sem o tocador carregar as novas; quem faz isso direito
        // é o reconector, que recarrega a música.
        if (st.session?.key && st.session.autoHarvest) {
          setSession((s) => (s && s.key === st.session.key ? { ...s, autoHarvest: st.session.autoHarvest } : s))
        }
        if (st.state === 'done' && (st.procurados?.length || st.semDono?.length || st.parou)) {
          setScout(null) // refaz a lista (vem do cache, instantâneo)
          const trechos = (l) => l.map((r) => `${fmtTime(r.ini)}–${fmtTime(r.fim)}${r.fonte ? ` dentro de ${STEM_META[r.fonte]?.label || r.fonte}` : ''}`).join(', ')
          const orfas = (st.semDono || []).filter((r) => !r.pendente)
          const pendentes = (st.semDono || []).filter((r) => r.pendente)
          const confissao = (orfas.length
            ? ` ⚠ Sobrou som sem dono em ${trechos(orfas)} — ouvi algo aí, mas nenhum especialista reivindicou.`
            : '')
            + (pendentes.length
              ? ` ⚠ Faltou perguntar em ${trechos(pendentes)} — a nuvem derrubou perguntas minhas. Tento de novo na próxima dissecação.`
              : '')
          const parou = st.parou === 'sem-credito'
            ? ' Parei porque acabou o crédito da sua conta na Replicate — recarregue e eu continuo exatamente de onde parei, sem repagar nada.'
            : st.parou === 'nuvem-indisponivel'
            ? ' Parei porque a nuvem ficou indisponível (teto de gasto ou chave) — continuo de onde parei quando ela voltar.'
            : st.parou ? ` Parei antes do fim (${st.parou}) — continuo na próxima abertura.` : ''
          // só diz "dissequei" quando o motor realmente varreu tudo; senão a
          // mensagem seria mentira e a próxima abertura continuaria o trabalho
          const cabeca = st.completo
            ? `✓ Dissequei a música inteira: interroguei ${st.procurados?.length || 0} suspeito(s). O que era real está nas pistas.`
            : `Separei o que deu por enquanto (${st.procurados?.length || 0} suspeito(s) interrogados) — continuo na próxima abertura.`
          setExportMsg(`${cabeca}${confissao}${parou}`)
        }
        if (st.state === 'error') setExportMsg(`⚠ Dissecação parou: ${st.error}`)
      } else if (st.state === 'running') {
        // evento atrasado de OUTRA música não pode instalar um acompanhamento
        // que ninguém consegue limpar depois
        const meuId = st.autoId || st.id
        if (autoJobRef.current && meuId && meuId !== autoJobRef.current) return
        setAutoJob((a) => ({
          ...(a || {}), id: meuId, fase: st.fase || a?.fase,
          alvos: st.alvos || a?.alvos, rodada: st.rodada,
          trecho: st.trecho || (st.fase === 'interrogando' ? a?.trecho : null),
          alvoRevista: st.alvoRevista || (st.fase === 'revistando' ? a?.alvoRevista : null),
          sondando: st.sondando || null
        }))
      }
    })
    const offP = window.mptrix.studio.onProgress((pr) => {
      if (!pr.auto) return
      setAutoJob((a) => ({ ...(a || {}), id: pr.autoId, fase: 'separando', label: pr.label, percent: pr.percent }))
    })
    return () => { offS?.(); offP?.() }
  }, [])

  // Marca no body que o estúdio está aberto (a lupinha sobe pra não cobrir o transporte)
  useEffect(() => {
    document.body.classList.add('studio-open')
    return () => document.body.classList.remove('studio-open')
  }, [])

  // Trocou de música? Zera as ondas — senão a tela mostra a onda da anterior
  useEffect(() => {
    setPeaksMap({})
    setWaveSel(null)
    setLupa(null)
    setChords(null)
    setShowChords(false)
    setLyrics(null)
    setShowLyrics(false)
  }, [session?.key])

  // Extração em andamento? O painel Extrair se mostra sozinho (progresso visível)
  useEffect(() => {
    if (extractJob?.id) {
      setShowExtract(true)
      setShowChords(false)
      setShowLyrics(false)
    }
  }, [extractJob?.id])

  // Painel de acordes: abre/fecha; na primeira abertura detecta (com cache)
  const toggleChords = async () => {
    const next = !showChords
    setShowChords(next)
    if (next) { setShowLyrics(false); setShowExtract(false) }
    if (next && !chords && session) {
      setChords('loading')
      const r = await window.mptrix.studio.chords({ key: session.key })
      setChords(r?.error ? { error: r.error } : r)
    }
  }

  // Painel de letra: transcreve a voz isolada na 1ª vez (com cache); os
  // acordes também são carregados pra aparecerem sobre os versos
  const toggleLyrics = async () => {
    const next = !showLyrics
    setShowLyrics(next)
    if (next) { setShowChords(false); setShowExtract(false) }
    if (next && !lyrics && session) {
      setLyrics('loading')
      let r = await window.mptrix.studio.lyrics({ key: session.key })
      // letra guardada sem marcação de palavra: refaz sozinha, sem pedir nada
      if (!r?.error && r?.segments?.length && !r.segments.some((s) => s.words?.length)) {
        setLyricsPct(0)
        r = await window.mptrix.studio.lyrics({ key: session.key, force: true })
      }
      setLyrics(r?.error ? { error: r.error } : r)
      if (!chords) {
        const c = await window.mptrix.studio.chords({ key: session.key })
        if (!c?.error) setChords(c)
      }
    }
  }

  // A letra que o MPTrix escreveu, em texto puro com as estrofes separadas —
  // é isso que vai pra área de transferência e daí pra onde a pessoa quiser.
  // Vale principalmente pra música que nem letra tem na internet.
  const letraEmTexto = () => {
    const segs = lyrics?.segments || []
    let out = ''
    for (let i = 0; i < segs.length; i++) {
      if (i > 0) out += segs[i].estrofe ? '\n\n' : '\n'
      out += segs[i].text
    }
    const nome = session?.title ? `${session.title}\n\n` : ''
    return nome + out + '\n'
  }

  const [copiado, setCopiado] = useState(false)
  const copiarLetra = async () => {
    try {
      await navigator.clipboard.writeText(letraEmTexto())
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      /* sem área de transferência: não trava a tela */
    }
  }

  // O verso é DESENHADO a partir de s.words (é o que acende palavra por
  // palavra), então trocar só o s.text não apareceria na tela. Aqui o texto novo
  // é remontado em cima dos instantes já medidos: as entradas de voz continuam
  // sendo as mesmas, só as palavras mudam.
  const reword = (s, txt) => {
    const novas = String(txt).trim().split(/\s+/).filter(Boolean)
    if (!novas.length) return { ...s, text: String(txt) }
    const velhas = s.words || []
    const t0 = s.t0
    const t1 = Math.max(s.t1, t0 + 0.4)
    const words = novas.map((text, i) => {
      let inicio
      if (velhas.length >= 2 && novas.length >= 2) {
        // espalha as palavras novas pelos mesmos ataques de voz das antigas
        const j = Math.round((i * (velhas.length - 1)) / (novas.length - 1))
        inicio = velhas[j].t0
      } else if (velhas.length === 1 && i === 0) {
        inicio = velhas[0].t0
      } else {
        inicio = t0 + ((t1 - t0) * i) / novas.length
      }
      return { t0: inicio, t1: inicio, text }
    })
    for (let i = 1; i < words.length; i++) {
      if (words[i].t0 < words[i - 1].t0 + 0.08) words[i].t0 = words[i - 1].t0 + 0.08
    }
    for (let i = 0; i < words.length; i++) {
      words[i].t1 = i + 1 < words.length ? words[i + 1].t0 : Math.max(t1, words[i].t0 + 0.2)
    }
    return { ...s, text: novas.join(' '), words }
  }

  // Correção do verso NO LUGAR. Antes isso chamava window.prompt(), que o
  // Electron simplesmente não tem — o lápis não fazia nada. Agora o verso vira
  // campo ali mesmo: Enter grava, Esc desiste, e o tempo de cada palavra é
  // remontado por cima dos instantes já medidos.
  const [editIdx, setEditIdx] = useState(-1)
  const [editTxt, setEditTxt] = useState('')
  // o Esc fecha o campo, e fechar dispara o blur — que gravaria assim mesmo,
  // porque o React só atualiza o estado depois. Esta bandeira segura isso.
  const desistiuRef = useRef(false)

  // Quais versos são a mesma frase voltando. Vem do mesmo detector que unifica
  // as repetições na transcrição — ele acha SEQUÊNCIAS de linhas parecidas na
  // mesma ordem, não texto igual solto. Foi assim que ele não confundiu
  // "Do céu ficar azul" com "Do céu ferver o azul" na Azul.
  const [gruposRep, setGruposRep] = useState([])
  useEffect(() => {
    const segs = lyrics?.segments
    if (!segs?.length) { setGruposRep([]); return }
    let vivo = true
    window.mptrix.studio
      .lyricsGroups({ segments: segs.map((s) => ({ text: s.text })) })
      .then((r) => { if (vivo) setGruposRep(r?.grupos || []) })
    return () => { vivo = false }
  }, [lyrics])

  // irmãos do verso i: mesma frase musical E hoje com o texto exatamente igual.
  // A segunda trava importa: se duas voltas já estão diferentes, não encosto.
  const irmaosDoVerso = (i) => {
    const segs = lyrics?.segments || []
    const g = gruposRep[i]
    if (g == null || g < 0) return []
    return segs
      .map((s, k) => ({ s, k }))
      .filter(({ s, k }) => k !== i && gruposRep[k] === g && s.text === segs[i].text)
      .map(({ k }) => k)
  }

  // O que o SISTEMA escreveu nesse verso. Se ainda não houve correção gravada,
  // é o próprio texto que está lá — a letra automática.
  const textoDoSistema = (i) =>
    lyrics?.original?.[i]?.text ?? lyrics?.segments?.[i]?.text ?? ''

  // O ↻ aparece sempre que o que está no campo for diferente do que a máquina
  // escreveu. Antes ele só existia depois de uma correção JÁ GRAVADA — ou seja,
  // sumia exatamente na hora em que a pessoa ia procurar por ele.
  const podeVoltar = (i) => editTxt.trim() !== textoDoSistema(i)

  const desfazerVerso = async (i) => {
    setEditIdx(-1)
    desistiuRef.current = true
    const orig = lyrics?.original?.[i]
    // nada gravado ainda: o ↻ só joga fora o que eu estava digitando
    if (!orig) return
    // desfaz nas mesmas voltas em que a correção valeu, pra não sobrar metade
    const alvos = new Set([i, ...irmaosDoVerso(i)])
    const segs = lyrics.segments.map((s, k) =>
      alvos.has(k) && lyrics.original[k] ? { ...lyrics.original[k] } : s
    )
    setLyrics({ ...lyrics, segments: segs })
    avisar(alvos.size > 1 ? `${alvos.size} versos voltaram ao original` : 'verso voltou ao original')
    const r = await window.mptrix.studio.lyricsSave({ key: session.key, segments: segs })
    if (r?.segments) setLyrics(r)
  }

  const abrirEdicao = (i) => {
    const cur = lyrics?.segments?.[i]
    if (!cur) return
    setEditIdx(i)
    setEditTxt(cur.text)
  }

  // A correção vale em todas as voltas da mesma frase, sem perguntar: quem
  // decide isso é o detector de repetição, e ele só entrega verso do MESMO
  // grupo E com o texto hoje idêntico. Como a checagem já foi feita, pedir
  // confirmação seria burocracia. A saída é o ↻, que desfaz tudo de uma vez —
  // desfazer é trava melhor que confirmar: confirmação a gente clica no
  // automático, desfazer só se usa quando algo deu errado de verdade.
  const gravarEdicao = async () => {
    if (desistiuRef.current) { desistiuRef.current = false; return }
    const i = editIdx
    const cur = lyrics?.segments?.[i]
    const irmaos = irmaosDoVerso(i)
    setEditIdx(-1)
    if (!cur) return
    const txt = editTxt.trim()
    if (!txt || txt === cur.text) return
    const alvos = new Set([i, ...irmaos])
    // cada ocorrência recebe o texto novo POR CIMA DOS SEUS PRÓPRIOS instantes:
    // a segunda volta é cantada em outro momento, e o karaokê dela continua o dela
    const segs = lyrics.segments.map((s, k) => (alvos.has(k) ? reword(s, txt) : s))
    setLyrics({ ...lyrics, segments: segs, edited: true })
    avisar(alvos.size > 1 ? `corrigido em ${alvos.size} lugares` : 'verso corrigido')
    await window.mptrix.studio.lyricsSave({ key: session.key, segments: segs })
  }
  const [editAviso, setEditAviso] = useState('')
  const avisoTimerRef = useRef(null)
  // Tempo do recado na tela, ajustado no olho do dono. Ficou curto porque a
  // caixa é grande e no caminho da vista: o que antes parecia "sumiu rápido"
  // era o recado escondido num rótulo, não o tempo.
  const AVISO_MS = 4500
  const SAIDA_MS = 260
  const [avisoSaindo, setAvisoSaindo] = useState(false)
  const saidaTimerRef = useRef(null)
  // Sai em duas etapas: primeiro marca a saída (a animação roda), só depois
  // desmonta. Sem isso o elemento some do DOM na hora e não há o que animar.
  const avisar = (texto) => {
    clearTimeout(avisoTimerRef.current)
    clearTimeout(saidaTimerRef.current)
    setAvisoSaindo(false)
    setEditAviso(texto)
    avisoTimerRef.current = setTimeout(() => {
      setAvisoSaindo(true)
      saidaTimerRef.current = setTimeout(() => {
        setEditAviso('')
        setAvisoSaindo(false)
      }, SAIDA_MS)
    }, AVISO_MS)
  }
  useEffect(() => () => {
    clearTimeout(avisoTimerRef.current)
    clearTimeout(saidaTimerRef.current)
  }, [])

  const teclaEdicao = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); gravarEdicao() }
    else if (e.key === 'Escape') { e.preventDefault(); desistiuRef.current = true; setEditIdx(-1) }
  }

  const applyPaste = async () => {
    const lines = pasteText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length || !lyrics?.segments) {
      setPasteOpen(false)
      return
    }
    const segs = lyrics.segments.map((s, i) => (i < lines.length ? reword(s, lines[i]) : s))
    setLyrics({ ...lyrics, segments: segs, edited: true })
    setPasteOpen(false)
    await window.mptrix.studio.lyricsSave({ key: session.key, segments: segs })
  }

  // trocou de verso? limpa as cópias do verso anterior
  useEffect(() => { wordFillsRef.current = [] }, [activeLyrIdx])

  // Verso ativo: rolagem suave acompanhando a música
  useEffect(() => {
    if (activeLyrIdx < 0 || !lyricsListRef.current) return
    const el = lyricsListRef.current.children[activeLyrIdx]
    if (el) lyricsListRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 150), behavior: 'smooth' })
  }, [activeLyrIdx])

  // Listas espelhadas em refs pro relógio de frame ler sem re-render
  useEffect(() => { chordsListRef.current = chords?.list || null }, [chords])
  useEffect(() => { lyrSegsRef.current = lyrics?.segments || null }, [lyrics])

  // Auto-scroll do painel pro acorde ativo (sempre scrollTo, nunca scrollIntoView)
  useEffect(() => {
    if (activeChordIdx < 0 || !chordsGridRef.current) return
    chordsGridRef.current.scrollTo({
      top: Math.max(0, Math.floor(activeChordIdx / 3) * 70 - 140),
      behavior: 'smooth'
    })
  }, [activeChordIdx])

  // Formas de onda: busca os picos de cada faixa. Roda de novo a cada recarga
  // da sessão (o "Outros" muda a cada desconto) — o cache do motor faz ser leve
  useEffect(() => {
    if (phase !== 'ready' || !session) return
    let alive = true
    ;(async () => {
      // inclui as guardadas: a ficha técnica delas também precisa da onda
      const wanted = session.stems.filter((s) => session.stemInfo?.[s]?.present !== false)
      for (const stem of wanted) {
        const p = await window.mptrix.studio.peaks({ key: session.key, stem })
        if (!alive) return
        if (p) setPeaksMap((m) => ({ ...m, [stem]: p }))
      }
    })()
    return () => { alive = false }
  }, [phase, session]) // eslint-disable-line react-hooks/exhaustive-deps

  // Guardar/promover faixa na prateleira (persistido no meta da sessão)
  const setStemShelf = async (stem, shelved) => {
    if (!session) return
    const res = await window.mptrix.studio.shelve({ key: session.key, stem, shelved })
    if (res?.error) {
      setExportMsg(`⚠ ${res.error}`)
      return
    }
    if (res?.session) await reloadSession(res.session)
  }

  // LEGENDA FLUTUANTE: uma só, posicionada em tela cheia — assim nunca é
  // cortada por área de rolagem nem escapa pela borda da janela
  const [hint, setHint] = useState(null)
  useEffect(() => {
    const HINT_W = 300
    const show = (e) => {
      const el = e.target?.closest?.('[data-hint]')
      if (!el) return
      const text = el.getAttribute('data-hint')
      if (!text) return
      const r = el.getBoundingClientRect()
      const x = Math.max(12, Math.min(window.innerWidth - HINT_W - 12, r.left + r.width / 2 - HINT_W / 2))
      const below = r.top < 150
      setHint({ text, x, y: below ? r.bottom + 10 : r.top - 10, below })
    }
    const hide = (e) => {
      if (e.target?.closest?.('[data-hint]')) setHint(null)
    }
    document.addEventListener('mouseover', show)
    document.addEventListener('mouseout', hide)
    window.addEventListener('scroll', () => setHint(null), true)
    return () => {
      document.removeEventListener('mouseover', show)
      document.removeEventListener('mouseout', hide)
    }
  }, [])

  // Sombras de borda: avisam ao olho que há faixa cortada acima/abaixo
  const [dawCut, setDawCut] = useState({ top: false, bottom: false })
  const updateDawCut = useCallback(() => {
    const el = dawScrollRef.current
    if (!el) return
    const top = el.scrollTop > 2
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2
    setDawCut((c) => (c.top === top && c.bottom === bottom ? c : { top, bottom }))
  }, [])

  // Mede a área das pistas: quantas faixas cabem inteiras, e de que tamanho.
  // Com poucas, elas esticam; com muitas, encaixam N inteiras e o resto rola —
  // nunca sobra meia faixa cortada na borda de baixo.
  useEffect(() => {
    const el = dawScrollRef.current
    if (!el) return
    const measure = () => { setDawH(el.clientHeight); updateDawCut() }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild) // altura do conteúdo
    return () => ro.disconnect()
  }, [phase, session?.key, updateDawCut])

  // TETO DE 10 FAIXAS NA TELA: mais que isso aperta demais e a leitura morre.
  // Com até 10, elas dividem toda a altura (maior tamanho possível); passando
  // disso, o tamanho trava no de 10 e o resto vai pra rolagem.
  const MAX_LANES = 10
  const MIN_LANE = 66
  const laneStyle = (() => {
    const n = presentStems(session).length
    if (!dawH || !n) return undefined
    // em janela pequena, mostra só quantas cabem legíveis (nunca mais que 10)
    const fits = Math.max(1, Math.floor((dawH + 5) / MIN_LANE))
    const visible = Math.min(n, MAX_LANES, fits)
    return { flex: '0 0 auto', height: dawH / visible, minHeight: 0 }
  })()

  // Ficha técnica da faixa: presença e trechos calculados da própria onda
  const trackStats = (stem) => {
    const info = session?.stemInfo?.[stem] || {}
    const pk = peaksMap[stem]
    const dur = playDuration || session?.duration || 0
    let coverage = null
    let ranges = []
    if (pk && pk.length && dur) {
      const thr = 0.15
      let act = 0
      let run = null
      const rs = []
      for (let i = 0; i < pk.length; i++) {
        const t = (i / pk.length) * dur
        if (pk[i] > thr) {
          act++
          if (!run) run = { a: t, b: t }
          else run.b = t
        } else if (run) {
          if (run.b - run.a >= 2) rs.push(run)
          run = null
        }
      }
      if (run && run.b - run.a >= 2) rs.push(run)
      coverage = Math.round((act / pk.length) * 100)
      ranges = rs.sort((x, y) => (y.b - y.a) - (x.b - x.a)).slice(0, 4).sort((x, y) => x.a - y.a)
    }
    return { info, coverage, ranges }
  }

  // Overlay do DAW: um só capturador de ponteiro pra todas as canaletas —
  // clique pula pra posição; arrastar marca o trecho (Lupa + loop)
  const overlayDown = (e) => {
    if (!playDuration) return
    const box = e.currentTarget.getBoundingClientRect()
    const timeAt = (x) => Math.max(0, Math.min(1, (x - box.left) / box.width)) * playDuration
    const t0 = timeAt(e.clientX)
    const x0 = e.clientX
    let moved = false
    const onMove = (ev) => {
      if (Math.abs(ev.clientX - x0) > 6) moved = true
      if (moved) {
        const t1 = timeAt(ev.clientX)
        setWaveSel({ start: Math.min(t0, t1), end: Math.max(t0, t1) })
        setLupa(null)
        // marcar trecho abre o painel Extrair (é lá que mora a Lupa)
        setShowExtract(true)
        setShowChords(false)
        setShowLyrics(false)
      }
    }
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!moved) seekTo(timeAt(ev.clientX))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Lupa de trecho: fareja só o pedaço marcado e ranqueia o que se destaca
  const runLupa = async () => {
    if (!waveSel || !session || lupa === 'loading') return
    setLupa('loading')
    const res = await window.mptrix.studio.investigate({
      key: session.key,
      start: waveSel.start,
      end: waveSel.end
    })
    setLupa(res || { error: 'O investigador não respondeu.' })
  }

  // Tudo que o painel oferece nasce marcado — inclusive Piano/Teclado, que
  // vem do caminho da cascata e ficava órfão da marcação automática
  const defaultExtractSel = (res, sess) => {
    const sel = new Set((res.detections || []).map((d) => d.instrument))
    if (sess && sess.model !== 'quick') {
      for (const s of ['guitar', 'piano']) {
        if (!sess.stems.includes(s) && (res.gp?.[s]?.score || 0) >= (s === 'guitar' ? 0.2 : 0.15)) sel.add(s)
      }
    }
    return sel
  }

  // Olheiro: depois que a sessão abre, procura instrumentos raros no "outros".
  // Com a nuvem ligada NÃO roda: o cardápio que ele alimenta nem aparece (quem
  // decide é a dissecação), e ele é uma rede neural pesada rodando aqui — duas
  // vezes, já que a dissecação fareja o mesmo arquivo ao mesmo tempo.
  useEffect(() => {
    if (phase !== 'ready' || !session || scout !== null) return
    if (!session.stems.includes('other')) return
    if (naNuvem) { setScout({ detections: [] }); return }
    setScout('loading')
    window.mptrix.studio.scout({ key: session.key }).then((res) => {
      if (!aliveRef.current) return
      if (res?.error) { setScout({ detections: [] }); return }
      setScout(res)
      setExtractSel(defaultExtractSel(res, session))
    })
  }, [phase, session, scout]) // eslint-disable-line react-hooks/exhaustive-deps

  // Eventos do trabalho de extração de instrumentos raros
  useEffect(() => {
    if (!extractJob?.id) return
    const offP = window.mptrix.studio.onProgress((p) => {
      if (p.id !== extractJob.id) return
      setExtractJob((cur) => cur && { ...cur, stage: p.stage, label: p.label || cur.label, percent: p.percent })
    })
    const offS = window.mptrix.studio.onStatus(async (s) => {
      if (s.id !== extractJob.id) return
      if (s.state === 'done') {
        setExtractJob(null)
        setScout(null) // refaz a lista (instantâneo, vem do cache)
        await reloadSession(s.session)
        // "✓ tudo certo" com instrumento faltando seria mentira — se a nuvem
        // falhou em algum, é ISSO que a pessoa precisa ler
        setExportMsg(s.aviso ? `⚠ ${s.aviso}` : '✓ Faixas novas adicionadas à música!')
      } else if (s.state === 'error') {
        setExtractJob(null)
        setExportMsg(`⚠ ${s.error}`)
      } else if (s.state === 'cancelled') {
        setExtractJob(null)
      }
    })
    return () => { offP?.(); offS?.() }
  }, [extractJob?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExtractSel = (inst) => {
    setExtractSel((prev) => {
      const next = new Set(prev)
      if (next.has(inst)) next.delete(inst)
      else next.add(inst)
      return next
    })
  }

  // Fiscal de memória: segura o trabalho pesado até ter RAM suficiente.
  // Mostra o que fechar e libera sozinho quando a bancada esvazia.
  const waitForMemory = useCallback(async (needMB, resumePhase = 'starting') => {
    const first = await window.mptrix.studio.memory({ needMB, withHogs: false })
    if (first.ok) return true
    memPrevPhaseRef.current = resumePhase
    const withHogs = await window.mptrix.studio.memory({ needMB, withHogs: true })
    if (!aliveRef.current) return false
    setMemInfo(withHogs)
    setHogSel(new Set((withHogs.hogs || []).map((h) => h.label)))
    setConfirmClose(false)
    setPhase('memcheck')
    return new Promise((resolve) => {
      memResolveRef.current = resolve
      memIntervalRef.current = setInterval(async () => {
        const st = await window.mptrix.studio.memory({ needMB, withHogs: true })
        if (!aliveRef.current) return
        setMemInfo(st)
        setHogSel((prev) => new Set([...prev].filter((l) => (st.hogs || []).some((h) => h.label === l))))
        if (st.ok) {
          clearInterval(memIntervalRef.current)
          memIntervalRef.current = null
          const r = memResolveRef.current
          memResolveRef.current = null
          setPhase(memPrevPhaseRef.current)
          r?.(true)
        }
      }, 3000)
    })
  }, [])

  const doCloseApps = async () => {
    const chosen = (memInfo?.hogs || []).filter((h) => hogSel.has(h.label))
    const procs = [...new Set(chosen.flatMap((h) => h.procs || []))]
    if (!procs.length) return
    setClosingApps(true)
    try {
      await window.mptrix.studio.closeApps({ procs })
    } finally {
      setClosingApps(false)
      setConfirmClose(false)
    }
  }

  const forceMemory = () => {
    clearInterval(memIntervalRef.current)
    memIntervalRef.current = null
    const r = memResolveRef.current
    memResolveRef.current = null
    setPhase(memPrevPhaseRef.current)
    r?.(true)
  }

  // Polir faixa: eventos do trabalho + ações
  useEffect(() => {
    if (!polishJob?.id) return
    const offP = window.mptrix.studio.onProgress((p) => {
      if (p.id !== polishJob.id) return
      setPolishJob((cur) => cur && { ...cur, stage: p.stage, percent: p.percent })
    })
    const offS = window.mptrix.studio.onStatus(async (s) => {
      if (s.id !== polishJob.id) return
      if (s.state === 'done') {
        setPolishJob(null)
        await reloadSession(s.session)
        setExportMsg('✓ Faixa polida! Se não gostar, o botão ↩ desfaz.')
      } else if (s.state === 'error') {
        setPolishJob(null)
        setExportMsg(`⚠ ${s.error}`)
      } else if (s.state === 'cancelled') {
        setPolishJob(null)
      }
    })
    return () => { offP?.(); offS?.() }
  }, [polishJob?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlanSel = (inst) => {
    setPlanSel((prev) => {
      const next = new Set(prev)
      if (next.has(inst)) next.delete(inst)
      else next.add(inst)
      return next
    })
  }

  const confirmPlan = async () => {
    if (!(await waitForMemory(2500))) return
    planChoicesRef.current = [...planSel]
    setPhase('starting')
    separateRef.current?.()
  }

  const startExtraction = async () => {
    if (!session || !extractSel.size || extractJob) return
    if (!(await waitForMemory(2500, 'ready'))) return
    const res = await window.mptrix.studio.extract({ key: session.key, instruments: [...extractSel] })
    if (res?.error) { setExportMsg(`⚠ ${res.error}`); return }
    setExtractJob({ id: res.id, stage: 'preparing', label: '', percent: 0 })
  }

  // Farejar de novo: re-roda o olheiro (músicas antigas ganham os faros novos
  // e os níveis de presença do arsenal)
  const rescout = async () => {
    if (!session || extractJob) return
    setScout('loading')
    const res = await window.mptrix.studio.scout({ key: session.key, force: true })
    if (res?.error) { setScout({ detections: [] }); setExportMsg(`⚠ ${res.error}`); return }
    setScout(res)
    setExtractSel(defaultExtractSel(res, session))
  }

  // Refazer faixa: apaga a extraída (som volta pro "outros") e extrai do zero
  const redoTrack = async (stem) => {
    if (!session || extractJob) return
    // Durante a dissecação o pedido seria adotado pela extração DELA (vacina
    // anti-gêmeo) e o instrumento pedido nunca sairia — só que a faixa já teria
    // sido apagada. Melhor não deixar começar do que apagar e não devolver.
    if (autoJob) {
      setExportMsg('⚠ O MPTRIX está dissecando a música agora. Espere terminar pra refazer uma faixa.')
      return
    }
    const meta = STEM_META[stem] || { label: stem }
    // com a nuvem ligada a conta é outra — prometer 47 min aqui faria a pessoa
    // desistir de refazer uma faixa que na verdade custa ~2 min
    const min = naNuvem
      ? Math.max(2, Math.ceil((session.duration / 60) * NUVEM_ESP) + NUVEM_PARTIDA)
      : Math.max(5, Math.ceil((session.duration / 60) * PROC_FACTOR))
    const ok = window.confirm(
      `Refazer a faixa de ${meta.label} do zero?\n\nEla será apagada (o som volta pra "Outros") e extraída de novo, sem aproveitar nada da rodada anterior (~${min} min).`
    )
    if (!ok) return
    if (!(await waitForMemory(2500, 'ready'))) return
    const res = await window.mptrix.studio.redoStem({ key: session.key, instrument: stem })
    if (res?.error) { setExportMsg(`⚠ ${res.error}`); return }
    if (res?.session) await reloadSession(res.session)
    const ex = await window.mptrix.studio.extract({ key: session.key, instruments: [stem] })
    if (ex?.error) { setExportMsg(`⚠ ${ex.error}`); return }
    setExtractJob({ id: ex.id, stage: 'preparing', label: meta.label, percent: 0 })
  }

  const changePitch = (next) => {
    const clamped = Math.max(-6, Math.min(6, next))
    setPitchState(clamped)
    pitchRef.current = clamped
    playerRef.current?.setPitch(clamped)
    scheduleHqRender(clamped)
  }

  const changeTempo = (next) => {
    setTempoState(next)
    playerRef.current?.setTempo(next / 100)
  }

  const resetPitchTempo = () => {
    changePitch(0)
    changeTempo(100)
  }

  // Abre a sessão (cache direto ou separação com progresso)
  useEffect(() => {
    aliveRef.current = true
    let offProgress = null
    let offStatus = null

    const startSession = async (sess) => {
      setSession(sess)
      const active = audibleStems(sess)
      const vols = {}
      for (const stem of active) vols[stem] = 1
      setVolumes(vols)
      try {
        setPhase('decoding')
        const p = getPlayer()
        p.tempoRate = 1
        p.targetPitch = 0
        await p.load(active, stemUrl(sess.key, 'base', 'flac'), 0)
        if (!aliveRef.current) return
        setPos(0)
        setPhase('ready')
      } catch (err) {
        if (aliveRef.current) { setError(err.message); setPhase('error') }
        return
      }
      // Escolhas feitas no catálogo: dispara a extração automática dos extras
      const choices = planChoicesRef.current
      planChoicesRef.current = null
      if (choices === 'auto' || !choices) {
        // Colheita automática: com a nuvem ligada, TODA sessão (nova ou
        // reaberta) passa por ela. O motor é idempotente — música já colhida
        // responde "já colhi" na hora e nada roda de novo.
        const nv = await window.mptrix.nuvem?.estado().catch(() => null)
        if (nv?.ligada && nv?.temChave && aliveRef.current) {
          const r = await window.mptrix.studio.autoExtract({ key: sess.key })
          // guardado no ref pra que fechar a música pare a dissecação (senão
          // ela segue pagando sondas de uma música que ninguém está ouvindo).
          // Se a tela morreu enquanto o pedido ia e voltava, cancela na hora —
          // senão a dissecação ficaria viva sem ninguém pra desligá-la.
          if (r?.id) {
            if (!aliveRef.current) window.mptrix.studio.cancel(r.id)
            else { autoJobRef.current = r.id; setAutoJob({ id: r.id, fase: 'pesando' }) }
          }
        }
      } else if (choices?.length && aliveRef.current) {
        const r = await window.mptrix.studio.extract({ key: sess.key, instruments: choices })
        if (r?.error) setExportMsg(`⚠ ${r.error}`)
        else setExtractJob({ id: r.id, stage: 'preparing', label: '', percent: 0 })
      }
    }

    const runSeparation = async () => {
      // Doutrina da qualidade máxima: separação sempre no modelo refinado
      const effModel = model === 'quick' ? 'quick' : 'htdemucs_ft'
      const res = await window.mptrix.studio.open({ path: source.path, model: effModel, title: source.title })
      if (res?.error) {
        setError(res.error)
        setPhase('error')
        return
      }
      if (res?.session) {
        await startSession(res.session)
        return
      }

      const jobId = res.id
      jobRef.current = jobId
      setPhase('processing')
      setStage('preparing')
      setPercent(null)
      setPassInfo(null)

      offProgress?.()
      offStatus?.()
      offProgress = window.mptrix.studio.onProgress((p) => {
        if (p.id !== jobId) return
        setStage(p.stage)
        setPercent(p.percent)
        setPassInfo(p.pass || null)
      })
      offStatus = window.mptrix.studio.onStatus(async (s) => {
        if (s.id !== jobId) return
        if (s.state === 'done') {
          jobRef.current = null
          await startSession(s.session)
        } else if (s.state === 'error') {
          jobRef.current = null
          if (s.error === 'engine-missing') setPhase('engine-missing')
          else { setError(s.error); setPhase('error') }
        } else if (s.state === 'cancelled') {
          jobRef.current = null
        }
      })
    }
    separateRef.current = runSeparation
    sessionStarterRef.current = startSession

    const start = async () => {
      setPhase('starting')
      setError(null)
      setSession(null)
      setPitchState(0); pitchRef.current = 0
      setTempoState(100)
      setHq(null)
      setMuted(new Set()); setSolo(new Set())
      setScout(null)
      setExtractSel(new Set())
      setExtractJob(null)
      setPlan(null)
      setPlanSel(new Set())
      planChoicesRef.current = null

      const engine = await window.mptrix.studio.engineStatus()
      if (!engine.ok) {
        setPhase('engine-missing')
        return
      }

      // Edição rápida vai direto; separação normal mostra o CATÁLOGO primeiro
      if (model === 'quick') {
        if (!(await waitForMemory(800))) return
        await runSeparation()
        return
      }

      // Sessão já separada? (capricho máximo tem cache próprio e vence se existir)
      const cachedFt = await window.mptrix.studio.cached({ path: source.path, model: 'htdemucs_ft' })
      const cached = cachedFt || await window.mptrix.studio.cached({ path: source.path, model: 'htdemucs' })
      if (cached) {
        await startSession(cached)
        return
      }

      // MÃO BEIJADA: com a nuvem ligada não existe cardápio. Separa direto e
      // a colheita automática (lá embaixo, pós-sessão) extrai tudo que provar
      // que existe. O catálogo interativo fica pro caminho local, onde cada
      // tentativa custa ~47 min da máquina e escolher É controle de custo.
      const nvPlan = await window.mptrix.nuvem?.estado().catch(() => null)
      if (nvPlan?.ligada && nvPlan?.temChave) {
        planChoicesRef.current = 'auto'
        setPhase('starting')
        separateRef.current?.()
        return
      }

      if (!(await waitForMemory(2000))) return
      const pres = await window.mptrix.studio.plan({ path: source.path })
      if (pres?.error) {
        setError(pres.error)
        setPhase('error')
        return
      }
      if (pres?.plan) {
        // Plano já estava calculado: catálogo na hora, sem corrida de eventos
        setPlan(pres.plan)
        setPlanSel(new Set((pres.plan.extras || []).map((e) => e.instrument)))
        setPhase('plan')
        return
      }
      jobRef.current = pres.id
      setPhase('planning')
      setStage('preparing')
      setPercent(null)

      offProgress = window.mptrix.studio.onProgress((p) => {
        if (p.id !== pres.id) return
        setStage(p.stage)
        setPercent(p.percent ?? null)
      })
      offStatus = window.mptrix.studio.onStatus((s) => {
        if (s.id !== pres.id) return
        if (s.state === 'done') {
          jobRef.current = null
          setPlan(s.plan)
          setPlanSel(new Set((s.plan.extras || []).map((e) => e.instrument)))
          setPhase('plan')
        } else if (s.state === 'error') {
          jobRef.current = null
          setError(s.error)
          setPhase('error')
        } else if (s.state === 'cancelled') {
          jobRef.current = null
        }
      })
    }

    start().catch((err) => {
      // Nenhuma falha pode deixar a tela presa no "Começando…" — tudo vira erro visível
      if (aliveRef.current) {
        setError(String(err?.message || err))
        setPhase('error')
      }
    })

    return () => {
      aliveRef.current = false
      clearTimeout(hqTimerRef.current)
      clearInterval(memIntervalRef.current)
      memIntervalRef.current = null
      offProgress?.()
      offStatus?.()
      if (jobRef.current) window.mptrix.studio.cancel(jobRef.current)
      // A DISSECAÇÃO SOBREVIVE AO FECHAR DA MÚSICA — de propósito.
      //
      // Antes ela morria junto, pra não gastar às escondidas. Mas isso obrigava
      // o dono a ficar de babá numa tela por meia hora, que é o oposto do "de
      // mão beijada" que o app promete: ele quer mandar dissecar e ir fazer
      // outra coisa. O freio contra gasto escondido continua existindo e é
      // melhor: o teto de gasto (agora medido pelo preço real da máquina) e o
      // botão de parar no painel. Quem reabre a música adota a que está
      // rodando, então nada é pago em dobro.
      autoJobRef.current = null
      playerRef.current?.dispose()
      playerRef.current = null
    }
  }, [source.path, model]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mixerRef.current = { volumes, muted, solo }
    playerRef.current?.applyGains(volumes, muted, solo)
  }, [volumes, muted, solo, session, phase])

  useEffect(() => { phaseRef.current = phase }, [phase])

  // Cão de guarda: se algum aviso de "pronto!" se perder (app piscou, evento
  // sumiu), a tela consulta o estado real a cada 3s e se cura sozinha.
  useEffect(() => {
    if (!['starting', 'processing', 'planning'].includes(phase)) return
    const healing = { busy: false }
    const t = setInterval(async () => {
      if (!aliveRef.current || healing.busy) return
      healing.busy = true
      try {
        let cached = await window.mptrix.studio.cached({
          path: source.path,
          model: model === 'quick' ? 'quick' : 'htdemucs_ft'
        })
        if (!cached && model !== 'quick') {
          cached = await window.mptrix.studio.cached({ path: source.path, model: 'htdemucs' })
        }
        if (cached && aliveRef.current && ['starting', 'processing', 'planning'].includes(phaseRef.current)) {
          await sessionStarterRef.current?.(cached)
          return
        }
        if (phaseRef.current === 'planning' && model !== 'quick') {
          const pres = await window.mptrix.studio.plan({ path: source.path, cachedOnly: true })
          if (pres?.plan && aliveRef.current && phaseRef.current === 'planning') {
            setPlan(pres.plan)
            setPlanSel(new Set((pres.plan.extras || []).map((e) => e.instrument)))
            setPhase('plan')
          }
        }
      } catch {} finally {
        healing.busy = false
      }
    }, 3000)
    return () => clearInterval(t)
  }, [phase, model, source.path])

  const toggleMute = (stem) => {
    setMuted((prev) => {
      const next = new Set(prev)
      if (next.has(stem)) next.delete(stem)
      else next.add(stem)
      return next
    })
  }

  const toggleSolo = (stem) => {
    setSolo((prev) => {
      const next = new Set(prev)
      if (next.has(stem)) next.delete(stem)
      else next.add(stem)
      return next
    })
  }

  const doExport = async () => {
    if (!session) return
    const labels = {}
    for (const stem of session.stems) labels[stem] = STEM_META[stem]?.label || stem
    const res = await window.mptrix.studio.exportStems({ key: session.key, labels })
    if (res?.error) setExportMsg(`⚠ ${res.error}`)
    else if (!res?.cancelled) setExportMsg(`✓ ${res.files.length} faixas exportadas em WAV pra ${res.dir}`)
  }

  const doExportSong = async () => {
    if (!session || exportingSong) return
    setExportingSong(true)
    try {
      const res = await window.mptrix.studio.exportSong({ key: session.key, pitch, tempo })
      if (res?.error) setExportMsg(`⚠ ${res.error}`)
      else if (!res?.cancelled) setExportMsg(`✓ Música exportada: ${res.file}`)
    } finally {
      setExportingSong(false)
    }
  }

  const cancelJob = () => {
    if (jobRef.current) window.mptrix.studio.cancel(jobRef.current)
    onClose()
  }

  const playDuration = phase === 'ready' ? (playerRef.current?.duration() || 0) : 0
  const analysisKey = keyLabel(session?.analysis)
  const shiftedKey = shiftedKeyLabel(session?.analysis, pitch)
  const bpm = session?.analysis?.bpm
  const bpmHalf = session?.analysis?.bpmHalf
  const altered = pitch !== 0 || tempo !== 100

  return (
    <div className="studio-overlay">
      <header className="studio-header">
        <button
          className="topbar-icon-btn"
          onClick={phase === 'processing' || phase === 'planning' ? cancelJob : onClose}
          title="Voltar"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="brand-disc" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 4.5h14l-5.2 7.5L19 19.5H5l5.2-7.5z" fill="#0b0c0f" /></svg>
        </span>
        <span className="brand-name">MPTrix</span>
        <span className="topbar-divider" />
        <span className="studio-cover" aria-hidden="true">
          {(source.title || 'MP').split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('')}
        </span>
        <div className="studio-title-wrap">
          <div className="studio-title" title={source.title}>{source.title || 'Estúdio'}</div>
          {model === 'quick' && <div className="studio-title-sub">🎚️ Edição rápida</div>}
        </div>
        <div className="studio-header-actions">
          {bpm && (
            <span className="topbar-chip">
              <span className="topbar-chip-label">BPM</span>
              <span className="topbar-chip-value">
                {bpmHalf ? `${Math.round(bpmHalf)}/${Math.round(bpm)}` : Math.round(bpm)}
                {tempo !== 100 ? `×${tempo}%` : ''}
              </span>
            </span>
          )}
          {analysisKey && (
            <span
              className={`topbar-chip topbar-chip-tom ${pitch !== 0 ? 'transposed' : ''}`}
              title={`Tom da música — confiança ${Math.round((session?.analysis?.strength || 0) * 100)}%. Use − e + pra transpor.`}
            >
              <span className="topbar-chip-label">TOM</span>
              <button className="chip-step" onClick={() => changePitch(pitch - 1)} disabled={phase !== 'ready'} aria-label="Descer meio tom">−</button>
              <span className="topbar-chip-value tom-value">{shiftedKey && pitch !== 0 ? shiftedKey : analysisKey}</span>
              <button className="chip-step" onClick={() => changePitch(pitch + 1)} disabled={phase !== 'ready'} aria-label="Subir meio tom">+</button>
              {pitch !== 0 && (
                <button className="chip-offset" onClick={() => changePitch(0)} title="Voltar ao tom original">
                  {pitch > 0 ? `+${pitch}` : pitch}
                </button>
              )}
            </span>
          )}
          <button
            className={`btn-secondary btn-small panel-toggle ${showExtract ? 'on' : ''}`}
            onClick={() => {
              const n = !showExtract
              setShowExtract(n)
              if (n) { setShowChords(false); setShowLyrics(false) }
            }}
            disabled={phase !== 'ready'}
            title="Extrair mais instrumentos dessa música (olheiro, Lupa e Arsenal)"
          >
            {extractJob ? '⛏️ Extraindo…' : '➕ Extrair faixas'}
          </button>
          <button
            className="btn-secondary btn-small"
            onClick={doExportSong}
            disabled={phase !== 'ready' || exportingSong}
            title="Salva a música inteira em MP3 com o tom e a velocidade escolhidos"
          >
            {exportingSong ? 'Exportando…' : 'Exportar música…'}
          </button>
          {session?.model !== 'quick' && (
            <button className="btn-primary btn-small" onClick={doExport} disabled={phase !== 'ready'}>
              Exportar faixas
            </button>
          )}
        </div>
      </header>

      {phase === 'engine-missing' && (
        <div className="studio-center">
          <div className="studio-progress-card">
            <h3>Motor de separação não instalado</h3>
            <p className="muted">
              O módulo de IA que separa os instrumentos não foi encontrado neste computador.
              Fale com o desenvolvedor pra instalar o motor (pasta <code>MPTRIX\engine</code>).
            </p>
            <button className="btn-secondary" onClick={onClose}>Voltar</button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="studio-center">
          <div className="studio-progress-card">
            <h3>Algo deu errado 😕</h3>
            <p className="muted">{error}</p>
            <button className="btn-secondary" onClick={onClose}>Voltar</button>
          </div>
        </div>
      )}

      {(phase === 'starting' || phase === 'processing' || phase === 'decoding' || phase === 'planning') && (
        <div className="studio-center">
          <div className="studio-progress-card">
            <div className={`studio-progress-icon ${phase === 'processing' || phase === 'planning' ? 'pulse' : ''}`}>
              {phase === 'planning' ? '🔍' : '🎛️'}
            </div>
            {(phase === 'processing' || phase === 'planning') && (
              <div className="studio-eq"><span /><span /><span /><span /><span /></div>
            )}
            <h3>
              {phase === 'planning'
                ? stage === 'scouting'
                  ? 'Catalogando os instrumentos…'
                  : stage === 'separating'
                    ? 'Analisando a música…'
                    : 'Preparando a análise (~2-3 min)…'
                : phase === 'decoding'
                  ? 'Preparando o player…'
                  : STAGE_LABELS[stage] || 'Começando…'}
            </h3>
            {(phase === 'processing' || phase === 'planning') && percent != null && (
              <>
                <div className="proc-head">
                  <span className="proc-cover">
                    {(source.title || 'MP').split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('')}
                  </span>
                  <div className="proc-info">
                    <div className="proc-title" title={source.title}>{source.title || 'Música'}</div>
                    <div className="proc-meta">
                      {phase === 'planning' ? 'CATALOGANDO' : 'SEPARANDO'}
                      {passInfo ? ` · IA ${passInfo.current}/${passInfo.total}` : ''}
                    </div>
                  </div>
                  <span className="proc-pct">{Math.round(mainMeter.display)}%</span>
                </div>
                <div className="progress-bar alive">
                  <div className="progress-fill" style={{ width: `${mainMeter.display}%` }} />
                </div>
                <div className="studio-meter-line">
                  {fmtEta(mainMeter.eta)
                    ? <span className="muted">{fmtEta(mainMeter.eta)}</span>
                    : <span className="muted">medindo a velocidade…</span>}
                </div>
                {stage === 'separating' && (
                  <div className="muted studio-live-hint">{SEP_HINTS[hintIdx % SEP_HINTS.length]}</div>
                )}
              </>
            )}
            {(((phase === 'processing' || phase === 'planning') && percent == null) || phase === 'starting' || phase === 'decoding') && (
              <div className="studio-spinner" />
            )}
            {phase === 'planning' && (
              <p className="muted studio-hint">
                Escutando pedacinhos da música pra descobrir tudo que ela tem — depois você escolhe
                o que quer separar, com os tempos na tela.
              </p>
            )}
            {(phase === 'processing' || phase === 'planning') && (
              <>
                {phase === 'processing' && (
                  <p className="muted studio-hint">
                    A separação usa bastante o processador — pode levar alguns minutos.
                    Você pode minimizar o app enquanto isso.
                  </p>
                )}
                <button className="btn-secondary btn-small" onClick={cancelJob}>Cancelar</button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'memcheck' && memInfo && (() => {
        const pct = Math.min(100, Math.round((memInfo.freeMB / memInfo.needMB) * 100))
        return (
          <div className="studio-center">
            <div className="studio-progress-card studio-mem-card">
              <div className="studio-progress-icon">🧹</div>
              <h3>Seu computador está muito carregado</h3>
              <p className="muted studio-hint">
                Feche algumas janelas — eu continuo sozinho assim que a memória liberar.
              </p>

              <div className="studio-mem-stats">
                <div className="studio-mem-stat">
                  <span className="studio-mem-value">{memInfo.freeMB}</span>
                  <span className="studio-mem-label">MB livres agora</span>
                </div>
                <span className="studio-mem-arrow">›</span>
                <div className="studio-mem-stat">
                  <span className="studio-mem-value goal">{memInfo.needMB}</span>
                  <span className="studio-mem-label">MB necessários</span>
                </div>
              </div>

              <div className="progress-bar studio-mem-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="studio-mem-pct">
                {pct}%<span className="muted"> do necessário · verificando a cada 3s</span>
              </div>

              {memInfo.hogs?.length > 0 && (
                <div className="studio-mem-hogs">
                  <div className="studio-mem-hogs-title">Quem está usando — marque o que posso fechar:</div>
                  {memInfo.hogs.map((h) => (
                    <label className="studio-mem-hog" key={h.label}>
                      <span className="studio-mem-hog-name">
                        <input
                          type="checkbox"
                          checked={hogSel.has(h.label)}
                          onChange={() => {
                            setConfirmClose(false)
                            setHogSel((prev) => {
                              const next = new Set(prev)
                              if (next.has(h.label)) next.delete(h.label)
                              else next.add(h.label)
                              return next
                            })
                          }}
                        />
                        {' '}{h.label}
                      </span>
                      <span className="studio-mem-hog-mb">{h.ramMB} MB</span>
                    </label>
                  ))}
                  {!confirmClose ? (
                    <button
                      className="btn-primary btn-small studio-mem-close-btn"
                      disabled={!hogSel.size || closingApps}
                      onClick={() => setConfirmClose(true)}
                    >
                      🧹 Fechar selecionados pra mim
                    </button>
                  ) : (
                    <div className="studio-mem-confirm">
                      <span className="studio-mem-confirm-text">
                        Vou encerrar: <strong>{[...hogSel].join(', ')}</strong>. Trabalho não salvo
                        neles pode ser perdido. Confirma?
                      </span>
                      <div className="studio-mem-confirm-actions">
                        <button className="btn-primary btn-small" disabled={closingApps} onClick={doCloseApps}>
                          {closingApps ? 'Fechando…' : 'Sim, fechar'}
                        </button>
                        <button className="btn-secondary btn-small" disabled={closingApps} onClick={() => setConfirmClose(false)}>
                          Voltar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="studio-mem-actions">
                <button className="link-btn" onClick={forceMemory}>tentar mesmo assim (pode travar)</button>
                <button className="btn-secondary btn-small" onClick={onClose}>Cancelar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {phase === 'plan' && plan && (() => {
        // Qualidade máxima sempre: base refinada (~4× o normal) e instrumentos
        // cobrindo a música inteira — os tempos refletem o trabalho completo
        const minutos = plan.duration / 60
        const baseMin = naNuvem
          ? Math.max(1, Math.ceil(minutos * NUVEM_BASE))
          : Math.max(4, Math.ceil(minutos * 3.8))
        const gpMin = naNuvem
          ? Math.max(1, Math.ceil(minutos * NUVEM_GP))
          : Math.max(2, Math.ceil(minutos * 1.2))
        const isGp = (inst) => inst === 'guitar' || inst === 'piano'
        const itemMinutes = (inst) =>
          isGp(inst)
            ? gpMin
            : naNuvem
              ? Math.max(1, Math.ceil(minutos * NUVEM_ESP))
              : Math.max(5, Math.ceil(minutos * PROC_FACTOR))
        const gpSelCount = [...planSel].filter(isGp).length
        // guitarra e teclado saem do mesmo passo: o tempo deles conta UMA vez
        // A partida a frio entra uma vez só: é o tempo de subir a imagem com
        // CUDA, não escala com a música e as extrações seguintes não pagam
        const totalMin = baseMin + (gpSelCount ? gpMin : 0) +
          [...planSel].filter((i) => !isGp(i)).reduce((acc, i) => acc + itemMinutes(i), 0) +
          (naNuvem ? NUVEM_PARTIDA : 0)
        const BASE_ALL = [
          ['vocals', '🎤', 'Voz'], ['drums', '🥁', 'Bateria'],
          ['bass', '🎸', 'Baixo'], ['other', '🎼', 'Outros']
        ]
        const basePresent = BASE_ALL.filter(([id]) => !plan.baseInfo || plan.baseInfo[id]?.present !== false)
        const baseAbsent = BASE_ALL.filter(([id]) => plan.baseInfo && plan.baseInfo[id]?.present === false)
        return (
          <div className="studio-center">
            <div className="studio-progress-card studio-plan-card">
              <div className="studio-progress-icon">🔍</div>
              <h3>Isso é o que existe nessa música</h3>

              <div className="studio-plan-section">
                <div className="studio-plan-section-title">A banda base dessa música</div>
                <div className="studio-plan-chips">
                  {basePresent.map(([id, icon, name]) => (
                    <span key={id} className="studio-plan-chip">{icon} {name}</span>
                  ))}
                  <span className="studio-plan-chip time">~{baseMin} min</span>
                </div>
                {baseAbsent.length > 0 && (
                  <div className="muted" style={{ fontSize: '12.5px' }}>
                    Não detectei nessa música: {baseAbsent.map(([, , name]) => name).join(', ')}
                  </div>
                )}
                <div className="muted" style={{ fontSize: '12px' }}>
                  ✨ Tudo já sai na qualidade máxima — modelo refinado e cobertura completa, sempre.
                </div>
              </div>

              <div className="studio-plan-section">
                <div className="studio-plan-section-title">
                  {(plan.extras || []).length > 0 ? 'Encontrei também — marque o que quiser' : 'Instrumentos extras'}
                </div>
                {(plan.extras || []).length === 0 && (
                  <p className="muted studio-hint">
                    Nenhum instrumento extra detectado — essa música é só a banda base mesmo.
                  </p>
                )}
                {gpSelCount === 2 && (
                  <p className="muted studio-hint" style={{ margin: 0 }}>
                    🎸+🎹 saem do mesmo passo de separação — o tempo deles conta uma vez só.
                  </p>
                )}
                {(plan.extras || []).map((e) => {
                  const meta = STEM_META[e.instrument] || { label: e.instrument, icon: '🎚️' }
                  const conf = humanConf(e.score)
                  return (
                    <label key={e.instrument} className={`studio-plan-item ${planSel.has(e.instrument) ? 'on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={planSel.has(e.instrument)}
                        onChange={() => togglePlanSel(e.instrument)}
                      />
                      <span className="studio-plan-item-icon">{meta.icon}</span>
                      <span className="studio-plan-item-name">
                        {meta.label}
                        {(e.at != null || e.coverage != null) && (
                          <span className="studio-plan-when">
                            {e.at != null && <>toca perto de <strong>{fmtTime(e.at)}</strong></>}
                            {e.at != null && e.coverage != null && ' · '}
                            {e.coverage != null && (
                              <>ocupa <strong>{(e.coverage * plan.duration) / 60 < 0.75
                                ? 'menos de 1 min'
                                : `~${Math.round((e.coverage * plan.duration) / 60)} min`}</strong> da música</>
                            )}
                          </span>
                        )}
                      </span>
                      <span className={`studio-plan-conf ${conf >= 75 ? 'high' : conf >= 55 ? 'mid' : 'low'}`}>
                        {conf}%
                      </span>
                      <span className="studio-plan-min">+{itemMinutes(e.instrument)} min</span>
                    </label>
                  )
                })}
                <button
                  className="btn-secondary btn-small"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={async () => {
                    if (!showArsenal && !arsenal.length) {
                      try { setArsenal((await window.mptrix.studio.catalog()) || []) } catch {}
                    }
                    setShowArsenal((v) => !v)
                  }}
                >
                  {showArsenal ? '▾' : '▸'} Arsenal completo — buscar qualquer instrumento
                </button>
                {showArsenal && (() => {
                  const offered = new Set((plan.extras || []).map((e) => e.instrument))
                  const presenceOf = plan.arsenal || null
                  const rest = arsenal
                    .filter((c) => !offered.has(c.id))
                    .sort((a, b) => (presenceOf?.[b.id]?.score || 0) - (presenceOf?.[a.id]?.score || 0))
                  if (!rest.length) return null
                  return (
                    <>
                      <p className="muted studio-hint" style={{ margin: 0 }}>
                        {presenceOf
                          ? 'Nível de presença de cada um segundo o faro — a decisão é sua: a busca cobre a música inteira e custa o mesmo tempo.'
                          : 'O faro não sentiu esses na música — mas dá pra pedir mesmo assim: a busca é às cegas, cobre a música inteira e custa o mesmo tempo.'}
                      </p>
                      {rest.map((c) => {
                        const meta = STEM_META[c.id] || { label: c.label, icon: '🎚️' }
                        const pres = presenceOf?.[c.id] || null
                        const conf = pres ? humanConf(pres.score) : null
                        return (
                          <label key={c.id} className={`studio-plan-item ${planSel.has(c.id) ? 'on' : ''}`}>
                            <input
                              type="checkbox"
                              checked={planSel.has(c.id)}
                              onChange={() => togglePlanSel(c.id)}
                            />
                            <span className="studio-plan-item-icon">{meta.icon}</span>
                            <span className="studio-plan-item-name">
                              {meta.label}
                              {conf != null && (
                                <span className="studio-plan-when">
                                  {conf >= 75 ? 'parece ter mesmo' : conf >= 55 ? 'pode ter' : conf >= 40 ? 'sinal fraco' : 'faro quase não sentiu'}
                                  {conf >= 55 && pres.at != null && <> · perto de <strong>{fmtTime(pres.at)}</strong></>}
                                </span>
                              )}
                            </span>
                            {conf != null ? (
                              <span className={`studio-plan-conf ${conf >= 75 ? 'high' : conf >= 55 ? 'mid' : 'low'}`}>
                                {conf}%
                              </span>
                            ) : <span />}
                            <span className="studio-plan-min">+{itemMinutes(c.id)} min</span>
                          </label>
                        )
                      })}
                    </>
                  )
                })()}
              </div>

              {[...planSel].filter((i) => !isGp(i)).length >= 2 && (
                <p className="muted studio-hint" style={{ margin: 0 }}>
                  ⚠️ Faros parecidos podem estar cheirando o <strong>mesmo som</strong> (ex.:
                  violino + cordas farejando um único véu). Duplicata de verdade não acontece —
                  quem extrai primeiro leva o som, e o seguinte sai quase vazio e se esconde
                  sozinho — mas os minutos dele são gastos do mesmo jeito. Na dúvida: extrai
                  um, re-fareja, e aí decide o próximo.
                </p>
              )}
              <div className="studio-plan-footer2">
                <div className="studio-plan-total">
                  <span className="studio-plan-total-value">~{totalMin} min</span>
                  {/* diz de ONDE vem o número: ver "8 min" sem saber por que
                      não ajuda ninguém a confiar nele */}
                  <span className={`studio-plan-total-label${naNuvem ? ' na-nuvem' : ''}`}>
                    {naNuvem ? 'tempo estimado · na nuvem' : 'tempo total estimado'}
                  </span>
                </div>
                <button className="btn-primary" onClick={confirmPlan}>Separar agora</button>
              </div>
            </div>
          </div>
        )
      })()}

      {phase === 'ready' && session && (
        <>
          <div className="studio-tracks">
            {/* Mesa de DAW: rail de controles 264px + canaletas contínuas,
                com UM overlay de playhead/tint cruzando todas as pistas */}
            <div className="daw-wrap">
            <div className={`daw ${dawCut.top ? 'cut-top' : ''} ${dawCut.bottom ? 'cut-bottom' : ''}`}>
              <div className="daw-row daw-head-row">
                <div className="daw-rail daw-rail-head">
                  <span className="hex-dot" aria-hidden="true" />
                  <span className="daw-cap">PISTAS</span>
                  <span className="daw-rail-flex" />
                  <span className="daw-cap daw-cap-dim">{presentStems(session).length} STEMS</span>
                </div>
                <div className="daw-gutter daw-ruler">
                  {playDuration > 0 && (() => {
                    const ticks = []
                    for (let s = 0; s < playDuration; s += 5) {
                      const major = s % 30 === 0
                      ticks.push(
                        <div
                          key={s}
                          className={`ruler-tick ${major ? 'major' : ''}`}
                          style={{ left: `${(s / playDuration) * 100}%` }}
                        >
                          {major && s > 0 && <span className="ruler-label">{fmtTime(s)}</span>}
                        </div>
                      )
                    }
                    return ticks
                  })()}
                </div>
              </div>
              {/* área rolável: as pistas nunca encolhem abaixo do piso de leitura;
                  passando disso, rola (o ruler fica fixo em cima) */}
              <div className="daw-scrollwrap">
              <div className="daw-scroll" ref={dawScrollRef} onScroll={updateDawCut}>
              <div className="daw-canvas">
              {presentStems(session).map((stem, stemIdx) => {
                const meta = STEM_META[stem] || { label: stem, icon: '🎚️' }
                const col = stemColor(stem, stemIdx)
                const isMuted = muted.has(stem)
                const isSolo = solo.has(stem)
                const effectivelyOff = isMuted || (solo.size > 0 && !isSolo)
                return (
                  <div key={stem} className={`daw-row ${effectivelyOff ? 'off' : ''}`} style={laneStyle}>
                    <div className="daw-rail">
                      <div className="daw-rail-top">
                        <span
                          className="studio-stem-bar"
                          style={{ background: col, boxShadow: `0 0 10px ${col}99` }}
                        />
                        <span
                          className="daw-name"
                          style={{ color: col, textShadow: `0 0 16px ${col}66` }}
                          title={meta.label}
                        >{meta.label}</span>
                        <span className="daw-rail-flex" />
                        {/* mudo: placa que acende em âmbar */}
                        <button
                          className={`rail-mute ${isMuted ? 'on' : ''}`}
                          onClick={() => toggleMute(stem)}
                          data-hint={`MUDO — cala ${meta.label} sem tirar da mesa.`}
                          aria-pressed={isMuted}
                          aria-label={`Silenciar ${meta.label}`}
                        >M</button>
                        {/* ouvir só: hexágono, mesma língua da prateleira */}
                        <button
                          className={`solo-hex sm ${isSolo ? 'on' : ''}`}
                          onClick={() => toggleSolo(stem)}
                          data-hint={`OUVIR SÓ — isola ${meta.label} e silencia o resto.`}
                          aria-pressed={isSolo}
                          aria-label={`Ouvir só ${meta.label}`}
                        >
                          <span className="solo-glyph">{isSolo ? '■' : '▶'}</span>
                        </button>
                        {(session.extracted || []).includes(stem) && !extractJob && !autoJob && (
                          <button
                            className="rail-ghost"
                            onClick={() => redoTrack(stem)}
                            data-hint="REFAZER — apaga essa faixa e extrai de novo do zero, sem reaproveitar nada."
                            aria-label="Refazer faixa"
                          >↻</button>
                        )}
                        <button
                          className="rail-ghost"
                          onClick={() => setTrackInfo(stem)}
                          data-hint="FICHA TÉCNICA — origem, volume, pico, presença e o veredito de existência."
                          aria-label="Ficha técnica"
                        >⋮</button>
                      </div>
                      <div className="daw-rail-bottom">
                        <span className="daw-speaker">🔊</span>
                        <input
                          type="range"
                          className="studio-volume"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volumes[stem] ?? 1}
                          onChange={(e) => setVolumes((v) => ({ ...v, [stem]: parseFloat(e.target.value) }))}
                          style={{ accentColor: col }}
                          title={`Volume: ${Math.round((volumes[stem] ?? 1) * 100)}%`}
                        />
                        <span className="daw-vol-num">{Math.round((volumes[stem] ?? 1) * 100)}</span>
                      </div>
                    </div>
                    <div className="daw-gutter">
                      <WaveLane
                        peaks={peaksMap[stem]}
                        duration={playDuration}
                        color={col}
                      />
                    </div>
                  </div>
                )
              })}
              {/* Overlay único: clique pula, arrastar marca trecho (Lupa/loop) */}
              <div className="daw-overlay" onPointerDown={overlayDown}>
                {playDuration > 0 && (() => {
                  const lines = []
                  for (let s = 30; s < playDuration; s += 30) {
                    lines.push(
                      <div key={s} className="daw-grid" style={{ left: `${(s / playDuration) * 100}%` }} />
                    )
                  }
                  return lines
                })()}
                <div className="daw-tint" ref={(el) => { rulerNodesRef.current.tint = el }} />
                {waveSel && playDuration > 0 && (
                  <div
                    className="daw-loopreg"
                    style={{
                      left: `${(waveSel.start / playDuration) * 100}%`,
                      width: `${(Math.max(0.2, waveSel.end - waveSel.start) / playDuration) * 100}%`
                    }}
                  >
                    <div className="daw-loopreg-top" />
                  </div>
                )}
                <div className="daw-ph" ref={(el) => { rulerNodesRef.current.ph = el }}>
                  <div className="daw-ph-tri" />
                  <div className="daw-ph-line" />
                </div>
              </div>
              </div>
              </div>
              {/* sombras ancoradas na própria área de rolagem (nunca desalinham
                  com a régua): o olho entende que tem mais faixa acima/abaixo */}
              <div className="daw-shade top" aria-hidden="true" />
              <div className="daw-shade bottom" aria-hidden="true" />
              </div>
            </div>
            {showChords && (
              <div className="chords-panel">
                <div className="chords-head">
                  <span className="chords-title">Acordes</span>
                  <span className="chords-sync">
                    {analysisKey ? (shiftedKey && pitch !== 0 ? shiftedKey : analysisKey) : ''}
                    {bpm ? ` · ${Math.round(bpm)} BPM` : ''}
                  </span>
                  <button className="btn-close" onClick={() => setShowChords(false)} aria-label="Fechar">×</button>
                </div>
                {chords === 'loading' && (
                  <div className="chords-empty">
                    <div className="studio-spinner small" />
                    {/* Com a nuvem ligada o trabalho NÃO é nesta máquina — dizer
                        "6 min nesta máquina" enquanto a nuvem processa é mentira
                        que faz a pessoa achar que o computador travou. */}
                    <span className="muted">
                      {naNuvem
                        ? 'Lendo a harmonia das faixas na nuvem… costuma levar menos de 1 min, mas se a máquina de lá estiver fria pode passar de 5. É só na primeira vez. Pode deixar tocando ou fechar o painel — continua por baixo.'
                        : `Lendo a harmonia das faixas… leva mais ou menos${session?.duration ? ` ${Math.max(2, Math.round((session.duration * 1.6) / 60))} min` : ' o tempo da música e meio'} nesta máquina, e só na primeira vez. Pode deixar tocando ou fechar o painel — continua por baixo.`}
                    </span>
                  </div>
                )}
                {chords?.error && <div className="chords-empty muted">⚠ {chords.error}</div>}
                {chords?.list && (chords.list.length === 0 ? (
                  <div className="chords-empty muted">Não consegui firmar acordes nessa música.</div>
                ) : (
                  <div className="chords-grid" ref={chordsGridRef}>
                    {chords.list.map((c, i) => (
                      <button
                        key={i}
                        className={`chord-card ${i === activeChordIdx ? 'on' : ''}`}
                        onClick={() => seekTo(c.t + 0.01)}
                        title={`força ${Math.round((c.strength || 0) * 100)}%`}
                      >
                        <span className="chord-name">{transposeChord(c.label, pitch)}</span>
                        <span className="chord-ts">{fmtTime(c.t)}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {showLyrics && (
              <div className="chords-panel lyrics-panel">
                <div className="chords-head">
                  <span className="chords-title">Letra</span>
                  <span className="chords-sync">{lyrics?.edited ? 'CORRIGIDA' : 'AUTOMÁTICA'}</span>
                  {lyrics?.segments?.length > 0 && (
                    <button
                      className="btn-secondary btn-small"
                      onClick={copiarLetra}
                      data-hint="COPIAR — a letra inteira, em estrofes, pra colar onde quiser e mandar pra quem quiser."
                    >{copiado ? 'copiada ✓' : 'copiar'}</button>
                  )}
                  {lyrics?.segments?.length > 0 && (
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => { setPasteText(''); setPasteOpen(true) }}
                      data-hint="COLAR — cola a letra oficial por cima. O texto vira o seu e a sincronização continua a calculada."
                    >colar</button>
                  )}
                  <button className="btn-close" onClick={() => setShowLyrics(false)} aria-label="Fechar">×</button>
                </div>
                {lyrics === 'loading' && (
                  <div className="chords-empty">
                    <div className="studio-spinner small" />
                    <span className="muted">
                      Escutando a voz isolada aqui no seu PC — nada sai da máquina.
                      Leva alguns minutos nesta primeira vez; depois abre na hora.
                    </span>
                    {lyricsPct > 0 && (
                      <>
                        <div className="progress-bar alive" style={{ width: '100%' }}>
                          <div className="progress-fill" style={{ width: `${lyricsPct}%` }} />
                        </div>
                        <span className="hud-num">{lyricsPct}%</span>
                      </>
                    )}
                  </div>
                )}
                {lyrics?.error && <div className="chords-empty muted">⚠ {lyrics.error}</div>}
                {editAviso && (
                  <div className={`lyr-recado-moldura${avisoSaindo ? ' saindo' : ''}`}>
                    <div className="lyr-recado">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span>{editAviso}</span>
                    </div>
                  </div>
                )}
                {lyrics?.segments && (lyrics.segments.length === 0 ? (
                  <div className="chords-empty muted">Não ouvi versos cantados na faixa de voz.</div>
                ) : (
                  <div className="lyrics-list" ref={lyricsListRef}>
                    {lyrics.segments.map((s, i) => {
                      const st = i === activeLyrIdx ? 'now' : pos >= s.t1 ? 'past' : 'fut'
                      const verseChords = (chords?.list || []).filter((c) => c.t >= s.t0 - 0.5 && c.t < s.t1)
                      return (
                        <div
                          key={i}
                          className={`lyr-block lyr-${st}${s.estrofe ? ' lyr-estrofe' : ''}`}
                          onClick={() => seekTo(s.t0 + 0.01)}
                        >
                          {verseChords.length > 0 && (
                            <div className="lyr-chords">
                              {verseChords.map((c, k) => (
                                <span
                                  key={k}
                                  className="lyr-chord"
                                  style={{ left: `${Math.min(88, Math.max(0, ((c.t - s.t0) / Math.max(0.5, s.t1 - s.t0)) * 100))}%` }}
                                >
                                  {transposeChord(c.label, pitch)}
                                </span>
                              ))}
                            </div>
                          )}
                          {editIdx === i ? (
                            <div className="lyr-edicao" onClick={(e) => e.stopPropagation()}>
                              <div className="lyr-input-moldura">
                                <input
                                  className="lyr-input"
                                  value={editTxt}
                                  autoFocus
                                  onChange={(e) => setEditTxt(e.target.value)}
                                  onKeyDown={teclaEdicao}
                                  onBlur={gravarEdicao}
                                />
                              </div>
                              {podeVoltar(i) && (
                                <button
                                  className="lyr-voltar"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => desfazerVerso(i)}
                                  data-hint={`VOLTAR AO QUE O SISTEMA ESCREVEU — devolve pra "${textoDoSistema(i)}". O tempo das palavras volta junto, o medido.${irmaosDoVerso(i).length ? ` Desfaz nas ${irmaosDoVerso(i).length + 1} voltas dessa frase.` : ''} (Esc só descarta o que você digitou; o ↻ grava a volta.)`}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                                    <path d="M3 4v5h5" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="lyr-text">
                              {st === 'now' ? (
                                // KARAOKÊ: cada palavra leva uma cópia lima por
                                // cima, revelada da esquerda pra direita no
                                // ritmo do canto (enche por dentro, sílaba a
                                // sílaba, em vez de trocar de palavra seco)
                                (s.words?.length ? s.words : [{ t0: s.t0, t1: s.t1, text: s.text }]).map((w, k) => (
                                  <span className="kw" key={k}>
                                    <span className="kw-base">{w.text}</span>
                                    <span
                                      className="kw-fill"
                                      aria-hidden="true"
                                      ref={(el) => { wordFillsRef.current[k] = el }}
                                    >{w.text}</span>
                                    <span className="kw-gap"> </span>
                                  </span>
                                ))
                              ) : s.words?.length
                                ? s.words.map((w, k) => <span key={k} className="lyr-w">{w.text} </span>)
                                : s.text}
                            </div>
                          )}
                          {editIdx !== i && (
                            <button
                              className="lyr-edit"
                              onClick={(e) => { e.stopPropagation(); abrirEdicao(i) }}
                              data-hint="CORRIGIR — troca o texto do verso. O tempo de cada palavra continua o que foi medido."
                              aria-label="Corrigir esse verso"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                                <path d="M15 5l4 4" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
            {/* CONFISSÃO — fora do painel Extrair de propósito: prestar contas do
                som que o sistema não conseguiu nomear é obrigação, não detalhe
                escondido atrás de um painel que nasce fechado. Aparece também
                com a nuvem desligada: o registro é da música, não da conexão. */}
            {!autoJob && (session?.autoHarvest?.semDono?.length || 0) > 0 && (() => {
              // Duas dívidas diferentes, ditas com palavras diferentes: "ninguém
              // reivindicou" é veredito; "faltou perguntar" é trabalho por fazer.
              // Misturar as duas numa frase só faria o usuário achar que o motor
              // já desistiu de um trecho que ele ainda vai reabrir.
              const lista = session.autoHarvest.semDono
              const orfas = lista.filter((r) => !r.pendente)
              const pendentes = lista.filter((r) => r.pendente)
              // confissão da revista aponta pra DENTRO de uma faixa — dizer só o
              // tempo mandaria o ouvido procurar na música inteira
              const faixa = (r) => `${fmtTime(r.ini)}–${fmtTime(r.fim)}${r.fonte ? ` dentro de ${STEM_META[r.fonte]?.label || r.fonte}` : ''}`
              return (
                <>
                  {orfas.length > 0 && (
                    <div className="studio-absent muted">
                      Som sem dono: {orfas
                        .map((r) => `${faixa(r)}${r.palpite ? ` (parece ${r.palpite})` : ''}`)
                        .join(' · ')} — tem som aí que eu não consegui nomear.
                    </div>
                  )}
                  {pendentes.length > 0 && (
                    <div className="studio-absent muted">
                      Faltou perguntar: {pendentes.map(faixa).join(' · ')} — tem som aí, mas
                      a nuvem derrubou perguntas minhas. Tento de novo na próxima dissecação.
                    </div>
                  )}
                </>
              )
            })()}
            {/* Painel Extrair: olheiro, lupa e arsenal moram aqui, ao lado da mesa */}
            {showExtract && (
            <aside className="chords-panel extract-panel">
            {waveSel && (
              <div className="lupa-bar">
                <span className="muted">
                  🔍 Trecho marcado: <strong>{fmtTime(waveSel.start)} – {fmtTime(waveSel.end)}</strong>
                </span>
                <button className="btn-primary btn-small" disabled={lupa === 'loading'} onClick={runLupa}>
                  {lupa === 'loading' ? 'Investigando… (~30s)' : 'Investigar trecho'}
                </button>
                <button className="btn-secondary btn-small" onClick={() => { setWaveSel(null); setLupa(null) }}>
                  ✕ limpar
                </button>
              </div>
            )}
            {lupa && lupa !== 'loading' && lupa.error && (
              <p className="muted studio-hint">⚠ {lupa.error}</p>
            )}
            {lupa && lupa !== 'loading' && !lupa.error && (
              <div className="studio-scout">
                <div className="studio-plan-section-title">
                  🔍 No trecho {fmtTime(lupa.start)}–{fmtTime(lupa.end)}, o que se destaca
                </div>
                {(lupa.items || []).length === 0 && (
                  <p className="muted studio-hint">
                    Nada do arsenal se destaca nesse trecho — pode ser um timbre que os faros
                    ainda não conhecem, ou o som está muito misturado.
                  </p>
                )}
                {(lupa.items || []).map((it) => {
                  const meta = STEM_META[it.id] || { label: it.id, icon: '🎚️' }
                  const conf = humanConf(it.stretch)
                  const soAqui = it.whole != null && it.standout > 0.12
                  return (
                    <div key={it.id} className="studio-plan-item">
                      <span className="studio-plan-item-icon">{meta.icon}</span>
                      <span className="studio-plan-item-name">
                        {meta.label}
                        <span className="studio-plan-when">
                          {soAqui ? 'se destaca SÓ nesse trecho' : 'presente no trecho'}
                        </span>
                      </span>
                      <span className={`studio-plan-conf ${conf >= 75 ? 'high' : conf >= 55 ? 'mid' : 'low'}`}>
                        {conf}%
                      </span>
                      {extractSel.has(it.id) ? (
                        <span className="muted" style={{ fontSize: '12px' }}>✓ marcado</span>
                      ) : (
                        <button
                          className="btn-secondary btn-small"
                          onClick={() => setExtractSel((s) => new Set([...s, it.id]))}
                        >➕ marcar</button>
                      )}
                    </div>
                  )
                })}
                <p className="muted studio-hint">
                  O que você marcar entra na lista de extração do painel abaixo — a faixa final
                  cobre a música inteira, como sempre.
                </p>
              </div>
            )}
            {absentStems(session).length > 0 && (
              <div className="studio-absent muted">
                Não detectados nessa música:{' '}
                {absentStems(session).map((s) => STEM_META[s]?.label || s).join(', ')}
              </div>
            )}

            {scout === 'loading' && (
              <div className="studio-scout studio-scout-loading">
                <div className="studio-spinner small" />
                <span className="muted">Procurando mais instrumentos nessa música…</span>
              </div>
            )}

            {naNuvem && autoJob && (
              <div className="studio-scout studio-scout-loading">
                <div className="studio-spinner small" />
                <span className="muted">
                  {autoJob.fase === 'pesando'
                    ? `Dissecando a música… procurando o que ainda tem som${autoJob.rodada > 1 ? ` (${autoJob.rodada}ª camada)` : ''}`
                    : autoJob.fase === 'interrogando'
                      ? `Interrogando um som em ${fmtTime(autoJob.trecho?.ini || 0)}–${fmtTime(autoJob.trecho?.fim || 0)}${autoJob.sondando ? ` — perguntando pra ${autoJob.sondando}` : '…'}`
                      : autoJob.fase === 'revistando'
                        ? `Revistando a faixa ${STEM_META[autoJob.alvoRevista]?.label || autoJob.alvoRevista} por dentro${autoJob.sondando ? ` — perguntando pra ${autoJob.sondando}` : '…'}`
                        : autoJob.fase === 'farejando'
                          ? `Procurando instrumentos nessa música… ${autoJob.rodada > 1 ? '(2ª passada, com o véu levantado)' : ''}`
                          : `Separando sozinho: ${autoJob.label || (autoJob.alvos || []).join(', ') || '…'}`}
                </span>
                {/* A dissecação continua mesmo se você sair da música, então
                    precisa existir um jeito de mandar parar. Sem isso, o único
                    freio seria o teto de gasto. */}
                <button
                  className="btn-secondary btn-small"
                  onClick={async () => {
                    await window.mptrix.studio.cancel(autoJob.id)
                    setAutoJob(null)
                    autoJobRef.current = null
                    setExportMsg('Dissecação parada. O que já foi perguntado está guardado — continua quando você abrir a música de novo.')
                  }}
                >parar</button>
              </div>
            )}
            {naNuvem && !autoJob && (session?.autoHarvest?.done === false) && (
              <div className="studio-scout">
                <span className="muted">
                  Essa música ainda tem trecho pra investigar — continuo na próxima vez que você abrir.
                </span>
              </div>
            )}
            {!naNuvem && scout && scout !== 'loading' && !extractJob && (() => {
              const isGp = (inst) => inst === 'guitar' || inst === 'piano'
              const gpData = scout.gp || null
              const missingGp = session.model === 'quick'
                ? []
                : ['guitar', 'piano'].filter((s) => !session.stems.includes(s))
              const gpOffers = missingGp
                .filter((s) => !gpData || (gpData[s]?.score || 0) >= (s === 'guitar' ? 0.2 : 0.15))
                .map((s) => ({ instrument: s, score: gpData?.[s]?.score ?? null, at: null }))
              const items = [...gpOffers, ...(scout.detections || [])]
              // Edição rápida não tem faixas separadas — extração não se aplica
              if (session.model === 'quick') return null
              const gpMin = naNuvem
                ? Math.max(1, Math.ceil((session.duration / 60) * NUVEM_GP))
                : Math.max(2, Math.ceil((session.duration / 60) * 1.2))
              const itemMinutes = (inst) =>
                isGp(inst)
                  ? gpMin
                  : naNuvem
                    ? Math.max(1, Math.ceil((session.duration / 60) * NUVEM_ESP))
                    : Math.max(5, Math.ceil((session.duration / 60) * PROC_FACTOR))
              const gpSelCount = [...extractSel].filter(isGp).length
              const totalMin = (gpSelCount ? gpMin : 0) +
                [...extractSel].filter((i) => !isGp(i)).reduce((acc, i) => acc + itemMinutes(i), 0)
              return (
                <div className="studio-scout">
                  <div className="studio-plan-section-title">🔍 Dá pra extrair mais dessa música</div>
                  {items.map((d) => {
                    const meta = STEM_META[d.instrument] || { label: d.instrument, icon: '🎚️' }
                    const conf = humanConf(d.score)
                    return (
                      <label
                        key={d.instrument}
                        className={`studio-plan-item ${extractSel.has(d.instrument) ? 'on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={extractSel.has(d.instrument)}
                          onChange={() => toggleExtractSel(d.instrument)}
                        />
                        <span className="studio-plan-item-icon">{meta.icon}</span>
                        <span className="studio-plan-item-name">
                          {meta.label}
                          {(d.at != null || d.coverage != null) && (
                            <span className="studio-plan-when">
                              {d.at != null && <>toca perto de <strong>{fmtTime(d.at)}</strong></>}
                              {d.at != null && d.coverage != null && ' · '}
                              {d.coverage != null && (
                                <>ocupa <strong>{(d.coverage * session.duration) / 60 < 0.75
                                  ? 'menos de 1 min'
                                  : `~${Math.round((d.coverage * session.duration) / 60)} min`}</strong> da música</>
                              )}
                            </span>
                          )}
                        </span>
                        {conf != null ? (
                          <span className={`studio-plan-conf ${conf >= 75 ? 'high' : conf >= 55 ? 'mid' : 'low'}`}>
                            {conf}%
                          </span>
                        ) : <span />}
                        <span className="studio-plan-min">+{itemMinutes(d.instrument)} min</span>
                      </label>
                    )
                  })}
                  <button
                    className="btn-secondary btn-small"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={async () => {
                      if (!showArsenal && !arsenal.length) {
                        try { setArsenal((await window.mptrix.studio.catalog()) || []) } catch {}
                      }
                      setShowArsenal((v) => !v)
                    }}
                  >
                    {showArsenal ? '▾' : '▸'} Arsenal completo — buscar qualquer instrumento
                  </button>
                  {showArsenal && (() => {
                    const offered = new Set(items.map((d) => d.instrument))
                    const presenceOf = scout.arsenal || null
                    const rest = arsenal
                      .filter((c) => !offered.has(c.id) && !session.stems.includes(c.id))
                      .sort((a, b) => (presenceOf?.[b.id]?.score || 0) - (presenceOf?.[a.id]?.score || 0))
                    if (!rest.length) {
                      return <p className="muted studio-hint">Tudo do arsenal já está na música ou na lista acima.</p>
                    }
                    return (
                      <>
                        <p className="muted studio-hint" style={{ margin: 0 }}>
                          {presenceOf
                            ? 'Nível de presença de cada um segundo o faro — a decisão é sua: a busca cobre a música inteira e custa o mesmo tempo.'
                            : 'Essa música foi farejada antes dos faros novos — clica em "Farejar de novo" pra medir a presença de cada instrumento.'}
                        </p>
                        <button className="btn-secondary btn-small" style={{ alignSelf: 'flex-start' }} onClick={rescout}>
                          🔄 Farejar de novo (~2-3 min)
                        </button>
                        {rest.map((c) => {
                          const meta = STEM_META[c.id] || { label: c.label, icon: '🎚️' }
                          const pres = presenceOf?.[c.id] || null
                          const conf = pres ? humanConf(pres.score) : null
                          return (
                            <label
                              key={c.id}
                              className={`studio-plan-item ${extractSel.has(c.id) ? 'on' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={extractSel.has(c.id)}
                                onChange={() => toggleExtractSel(c.id)}
                              />
                              <span className="studio-plan-item-icon">{meta.icon}</span>
                              <span className="studio-plan-item-name">
                                {meta.label}
                                {conf != null && (
                                  <span className="studio-plan-when">
                                    {conf >= 75 ? 'parece ter mesmo' : conf >= 55 ? 'pode ter' : conf >= 40 ? 'sinal fraco' : 'faro quase não sentiu'}
                                    {conf >= 55 && pres.at != null && <> · perto de <strong>{fmtTime(pres.at)}</strong></>}
                                  </span>
                                )}
                              </span>
                              {conf != null ? (
                                <span className={`studio-plan-conf ${conf >= 75 ? 'high' : conf >= 55 ? 'mid' : 'low'}`}>
                                  {conf}%
                                </span>
                              ) : <span />}
                              <span className="studio-plan-min">+{itemMinutes(c.id)} min</span>
                            </label>
                          )
                        })}
                      </>
                    )
                  })()}
                  {[...extractSel].filter((i) => !isGp(i)).length >= 2 && (
                    <p className="muted studio-hint" style={{ margin: 0 }}>
                      ⚠️ Faros parecidos podem estar cheirando o <strong>mesmo som</strong> (ex.:
                      violino + cordas farejando um único véu). Duplicata de verdade não acontece —
                      quem extrai primeiro leva o som, e o seguinte sai quase vazio e se esconde
                      sozinho — mas os minutos dele são gastos do mesmo jeito. Na dúvida: extrai
                      um, re-fareja, e aí decide o próximo.
                    </p>
                  )}
                  <div className="studio-plan-footer2">
                    <div className="studio-plan-total">
                      <span className="studio-plan-total-value">
                        {extractSel.size > 0 ? `~${totalMin} min` : '—'}
                      </span>
                      <span className="studio-plan-total-label">
                        {extractSel.size > 0 ? 'tempo estimado · o app segue usável' : 'marque o que quiser extrair'}
                      </span>
                    </div>
                    <button
                      className="btn-primary btn-small"
                      disabled={!extractSel.size}
                      onClick={startExtraction}
                    >
                      Extrair {extractSel.size === 1 ? 'selecionado' : `${extractSel.size} selecionados`}
                    </button>
                  </div>
                </div>
              )
            })()}

            {extractJob && (
              <div className="studio-scout">
                <div className="studio-scout-title">
                  ⛏️ {extractJob.stage === 'downloading-model'
                    ? `Baixando o especialista de ${extractJob.label || 'instrumento'}…`
                    : extractJob.stage === 'preparing'
                      ? 'Preparando a música…'
                      : extractJob.stage === 'converting'
                        ? `Montando a faixa de ${extractJob.label || 'instrumento'}…`
                        : `Extraindo ${extractJob.label || 'instrumento'}… ${Math.round(extractMeter.display)}%`}
                </div>
                <div className="progress-bar alive">
                  <div className="progress-fill" style={{ width: `${extractMeter.display}%` }} />
                </div>
                <div className="muted studio-live-hint">
                  {extractMeter.eta != null && extractMeter.eta > 0 && extractMeter.display > 1
                    ? extractMeter.eta < 75
                      ? '🎵 A música fica pronta em menos de 1 min'
                      : `🎵 A música fica pronta em ~${Math.round(extractMeter.eta / 60)} min`
                    : 'medindo a velocidade da máquina…'}
                </div>
                <p className="muted studio-hint">
                  Pode continuar tocando e usando o app — as faixas novas entram sozinhas quando ficarem prontas.
                </p>
              </div>
            )}
            </aside>
            )}
            </div>
            {/* Prateleira: faixas guardadas (evidência fraca ou decisão do dono) */}
            {shelvedStems(session).length > 0 && (
              <div className={`shelf-frame ${shelfOpen ? 'open' : ''}`}>
              <div className={`shelf ${shelfOpen ? 'open' : ''}`}>
                {(() => {
                  const list = shelvedStems(session)
                  // triagem por presença: quem vale ouvir, quem é só aparição, quem é fiapo
                  let top = null
                  let strong = 0
                  let mid = 0
                  let weak = 0
                  for (const s of list) {
                    const c = trackStats(s).coverage
                    if (c == null) continue
                    if (!top || c > top.c) top = { s, c }
                    if (c >= 10) strong++
                    else if (c >= 3) mid++
                    else weak++
                  }
                  return (
                    <button className="shelf-toggle" onClick={() => setShelfOpen((v) => !v)}>
                      <span className={`shelf-caret ${shelfOpen ? 'open' : ''}`}>▸</span>
                      <span className="hex-badge" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <path d="M5 4.5h14l-5.2 7.5L19 19.5H5l5.2-7.5z" fill="#0b0c0f" />
                        </svg>
                      </span>
                      <div className="shelf-titlewrap">
                        <span className="shelf-title">GUARDADAS</span>
                        <span className="shelf-sub">
                          {list.length} achado{list.length !== 1 ? 's' : ''} de evidência fraca
                          {top ? ` · maior presença: ${STEM_META[top.s]?.label || top.s} (${top.c}%)` : ''}
                        </span>
                      </div>
                      {/* leitura de status, não botões: número mono + rótulo,
                          separados por finos traços — vocabulário de painel */}
                      <span className="hud">
                        <span className="hud-cell">
                          <span className="hud-num">{list.length}</span>
                          <span className="hud-cap">guardadas</span>
                        </span>
                        {strong > 0 && (
                          <span className="hud-cell on">
                            <span className="hud-num">{strong}</span>
                            <span className="hud-cap">vale{strong !== 1 ? 'm' : ''} ouvir</span>
                          </span>
                        )}
                        {mid > 0 && (
                          <span className="hud-cell">
                            <span className="hud-num">{mid}</span>
                            <span className="hud-cap">aparição{mid !== 1 ? 'ões' : ''} curta{mid !== 1 ? 's' : ''}</span>
                          </span>
                        )}
                        {weak > 0 && (
                          <span className="hud-cell dim">
                            <span className="hud-num">{weak}</span>
                            <span className="hud-cap">fiapo{weak !== 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })()}
                {/* corpo sempre montado: quem anima é a altura (0fr → 1fr) */}
                <div className={`shelf-body ${shelfOpen ? 'open' : ''} ${shelfSettled ? 'settled' : ''}`}>
                  <div className="shelf-inner">
                    <div className="shelf-head">
                      <span className="shelf-head-name">INSTRUMENTO</span>
                      <span className="shelf-head-wave">ONDE TOCA NA MÚSICA</span>
                      <span className="shelf-head-acts">PRESENÇA · OUVIR · PROMOVER · FICHA</span>
                    </div>
                    {shelvedStems(session).map((stem) => {
                      const smeta = STEM_META[stem] || { label: stem, icon: '🎚️' }
                      const scol = stemColor(stem, session.stems.indexOf(stem))
                      const st = trackStats(stem)
                      const isSolo = solo.has(stem)
                      return (
                        <div className="shelf-row" key={stem}>
                          <div className="shelf-id">
                            <span
                              className="studio-stem-bar"
                              style={{ background: scol, boxShadow: `0 0 10px ${scol}99` }}
                            />
                            <span
                              className="shelf-name"
                              style={{ color: scol, textShadow: `0 0 16px ${scol}66` }}
                              title={smeta.label}
                            >
                              {smeta.icon} {smeta.label}
                            </span>
                          </div>
                          <MiniWave
                            peaks={peaksMap[stem]}
                            duration={playDuration}
                            color={scol}
                            onSeek={seekTo}
                            onNodes={(kind, el) => {
                              const m = laneNodesRef.current
                              const key = `shelf:${stem}`
                              if (!m[key]) m[key] = {}
                              m[key][kind] = el
                            }}
                          />
                          <div className="shelf-acts">
                          <span
                            className={`pres ${st.coverage >= 10 ? 'hi' : st.coverage >= 3 ? 'mid' : 'lo'}`}
                            data-hint={
                              st.coverage != null
                                ? `PRESENÇA — quanto do tempo da música esse instrumento realmente toca. Aqui: ${st.coverage}%` +
                                  (playDuration ? `, ou seja umas ${fmtTime((st.coverage / 100) * playDuration)} de ${fmtTime(playDuration)}` : '') +
                                  (st.coverage < 3
                                    ? '. Quase nada — provável respingo de outro instrumento parecido.'
                                    : st.coverage < 10
                                      ? '. Aparições curtas, tipo um solo ou uma virada.'
                                      : '. Presença de verdade — vale ouvir e talvez promover pra mesa.')
                                : 'PRESENÇA — ainda calculando a onda dessa faixa…'
                            }
                          >
                            <span className="pres-num">{st.coverage != null ? `${st.coverage}%` : '—'}</span>
                            <span className="pres-meter" aria-hidden="true">
                              {[0, 1, 2, 3, 4].map((i) => (
                                <i
                                  key={i}
                                  className={i < Math.min(5, Math.ceil((st.coverage || 0) / 4)) ? 'on' : ''}
                                />
                              ))}
                            </span>
                          </span>
                          {/* ouvir: hexágono só com o símbolo, apartado dos outros */}
                          <button
                            className={`solo-hex ${isSolo ? 'on' : ''}`}
                            onClick={() => toggleSolo(stem)}
                            data-hint={`OUVIR SÓ — isola ${smeta.label} e silencia o resto, pra você julgar de ouvido antes de decidir.`}
                            aria-pressed={isSolo}
                            aria-label={`Ouvir só ${smeta.label}`}
                          >
                            <span className="solo-glyph">{isSolo ? '■' : '▶'}</span>
                          </button>
                          {/* promover: o protagonista, no meio, em placa escura */}
                          <button
                            className="btn-promote"
                            onClick={() => setStemShelf(stem, false)}
                            data-hint="PROMOVER — sobe essa faixa pra mesa junto com as principais. Dá pra guardar de volta a qualquer momento pela ficha."
                          >
                            <span className="promote-arrow">▲</span> promover
                          </button>
                          {/* ficha: discreta, na ponta */}
                          <button
                            className="btn-dots"
                            onClick={() => setTrackInfo(stem)}
                            data-hint="FICHA TÉCNICA — origem, volume, pico, presença e o veredito de existência (se o sistema acha que esse instrumento é real na música)."
                            aria-label="Ficha técnica"
                          >⋮</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>

          <div className="studio-transport">
            {/* Barra única do protótipo: controles · timer lima · seek · duração · velocidade */}
            <div className="studio-controls-row tr-bar">
              <button
                className="tr-btn"
                onClick={() => seekTo(Math.max(0, (playerRef.current?.position() || 0) - 10))}
                title="Voltar 10 segundos"
              >
                <IconBack10 />
              </button>
              <button
                className="studio-play-btn"
                onClick={() => (playing ? pause() : play())}
                title={playing ? 'Pausar' : 'Tocar'}
              >
                {playing ? <IconPause /> : <IconPlay />}
              </button>
              <button
                className="tr-btn"
                onClick={() => seekTo(Math.min(playDuration || 0, (playerRef.current?.position() || 0) + 10))}
                title="Avançar 10 segundos"
              >
                <IconFwd10 />
              </button>
              <button
                className={`tr-btn ${loopOn ? 'on' : ''}`}
                onClick={() => setLoopOn((v) => !v)}
                title={waveSel ? 'Loop: repete o trecho marcado' : 'Loop: repete a música inteira'}
              >
                <IconLoop />
              </button>
              {loopOn && (
                <span className="loop-label">LOOP<br />{waveSel ? 'TRECHO' : 'MÚSICA'}</span>
              )}

              {/* timer vivo: textContent escrito por frame (ref), lima */}
              <span className="studio-time studio-time-live" ref={timerElRef}>{fmtTime(pos)}</span>
              <input
                type="range"
                className="studio-seek"
                min="0"
                max={playDuration || 1}
                step="0.1"
                defaultValue={Math.min(pos, playDuration || 0)}
                ref={seekElRef}
                onPointerDown={() => { draggingRef.current = true }}
                onPointerUp={() => { draggingRef.current = false }}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
              />
              <span className="studio-time studio-time-total">{fmtTime(playDuration)}</span>

              <span className="topbar-divider" />
              <button
                className={`btn-secondary btn-small panel-toggle ${showChords ? 'on' : ''}`}
                onClick={toggleChords}
                title="Acordes da música, detectados das faixas separadas"
              >
                🎼 Acordes
              </button>
              <button
                className={`btn-secondary btn-small panel-toggle ${showLyrics ? 'on' : ''}`}
                onClick={toggleLyrics}
                title="Letra transcrita da voz isolada, com os acordes em cima dos versos"
              >
                📜 Letra
              </button>
              <select
                className="filter-select tr-speed"
                value={tempo}
                onChange={(e) => changeTempo(parseInt(e.target.value, 10))}
                title="Velocidade de reprodução"
              >
                {SPEED_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}%</option>
                ))}
              </select>

              {altered && (
                <button className="link-btn" onClick={resetPitchTempo}>voltar ao original</button>
              )}

              {/* lupinha vive aqui dentro no estúdio (fora, ela atropelava as faixas) */}
              {window.mptrix.ui && (
                <span className="tr-zoom" data-hint="TAMANHO DA TELA — atalhos: Ctrl+= aproxima, Ctrl+− afasta, Ctrl+0 volta ao normal.">
                  <button className="act" onClick={() => window.mptrix.ui.zoom(-1)} aria-label="Diminuir">−</button>
                  <button className="act" onClick={() => window.mptrix.ui.zoom(0)}>{Math.round(uiZoom * 100)}%</button>
                  <button className="act" onClick={() => window.mptrix.ui.zoom(1)} aria-label="Aumentar">+</button>
                </span>
              )}

              {pitch !== 0 && hq?.state === 'rendering' && (
                <span className="muted studio-rendering" title="O tom já mudou — em segundo plano estou preparando a versão com qualidade de estúdio">
                  ✨ {hq.pct || 0}%
                </span>
              )}
              {pitch !== 0 && hq?.state === 'done' && (
                <span className="studio-hq-done" title="Esta mudança de tom está na qualidade máxima">✨</span>
              )}
            </div>

            {exportMsg && (
              <div className="studio-export-msg" onClick={() => setExportMsg(null)}>{exportMsg}</div>
            )}
          </div>

          {trackInfo && (() => {
            const meta = STEM_META[trackInfo] || { label: trackInfo, icon: '🎚️' }
            const col = stemColor(trackInfo, presentStems(session).indexOf(trackInfo))
            const st = trackStats(trackInfo)
            const vol = st.info.mean == null ? null
              : st.info.mean > -25 ? 'forte'
                : st.info.mean > -40 ? 'normal'
                  : st.info.mean > -55 ? 'discreto'
                    : 'quase mudo'
            return (
              <div className="modal-overlay" onClick={() => setTrackInfo(null)}>
                <div className="modal modal-small tinfo-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="tinfo-head">
                    <span className="tinfo-disc" style={{ background: col }}>{meta.icon}</span>
                    <div className="tinfo-head-text">
                      <div className="tinfo-name">{meta.label}</div>
                      <div className="tinfo-sub">
                        {(session.extracted || []).includes(trackInfo) ? 'EXTRAÍDA POR ESPECIALISTA' : 'BANDA-BASE DA SEPARAÇÃO'}
                        {st.info.present === false ? ' · ESCONDIDA (QUASE MUDA)' : ''}
                      </div>
                    </div>
                    <button className="btn-close" onClick={() => setTrackInfo(null)} aria-label="Fechar">×</button>
                  </div>
                  {(() => {
                    // VEREDITO DE EXISTÊNCIA: faro (cheiro no original) + perito (extração)
                    const isBase = !(session.extracted || []).includes(trackInfo)
                    const smell = scout?.arsenal?.[trackInfo]?.score ?? scout?.gp?.[trackInfo]?.score ?? null
                    const smellConf = smell != null ? humanConf(smell) : null
                    let exist = null
                    let existPct = null
                    if (isBase) {
                      exist = 'existe — é da banda-base'
                      existPct = 97
                    } else if (st.info.mean != null) {
                      const mx = st.info.max ?? -99
                      if (st.info.mean > -40) { existPct = 92; exist = 'existe com certeza' }
                      else if (mx > -20) { existPct = 70; exist = 'existe em doses (solos e trechos)' }
                      else if (mx > -35) { existPct = smellConf != null && smellConf >= 55 ? 45 : 30; exist = 'provável imitação de outro timbre' }
                      else { existPct = 10; exist = 'não existe de verdade' }
                    }
                    if (exist == null) return null
                    return (
                      <div className="tinfo-exist">
                        <div className="tinfo-exist-main">
                          <span className="tinfo-exist-pct" style={{ color: existPct >= 60 ? col : 'var(--muted)' }}>{existPct}%</span>
                          <div className="tinfo-exist-text">
                            <span className="tinfo-cap">O SISTEMA ACHA QUE ESSE INSTRUMENTO…</span>
                            <strong>{exist}</strong>
                          </div>
                        </div>
                        <div className="tinfo-exist-votes">
                          {smellConf != null && <span>👃 faro na música original: {smellConf}%</span>}
                          {!isBase && st.info.mean != null && (
                            <span>🔬 perito: {st.info.mean > -40 ? 'achou material firme' : (st.info.max ?? -99) > -20 ? 'achou solos/trechos reais' : (st.info.max ?? -99) > -35 ? 'achou só vestígios' : 'não achou quase nada'}</span>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                  <div className="tinfo-tiles">
                    <div className="tinfo-tile">
                      <span className="tinfo-big">{vol ?? '—'}</span>
                      <span className="tinfo-cap">VOLUME{st.info.mean != null ? ` · ${st.info.mean} dB` : ''}</span>
                    </div>
                    <div className="tinfo-tile">
                      <span className="tinfo-big">{st.info.max != null ? `${st.info.max} dB` : '—'}</span>
                      <span className="tinfo-cap">PICO</span>
                    </div>
                    <div className="tinfo-tile">
                      <span className="tinfo-big" style={{ color: col }}>{st.coverage != null ? `${st.coverage}%` : '—'}</span>
                      <span className="tinfo-cap">TEMPO EM QUE TOCA</span>
                    </div>
                  </div>
                  {st.coverage != null && (
                    <div className="tinfo-presbar">
                      <div style={{ width: `${st.coverage}%`, background: col }} />
                    </div>
                  )}
                  {st.ranges.length > 0 && (
                    <div className="tinfo-sec">
                      <div className="tinfo-cap">ONDE ELA TOCA — CLIQUE PRA IR</div>
                      <div className="tinfo-ranges">
                        {st.ranges.map((r, i) => (
                          <button
                            key={i}
                            className="tinfo-range"
                            style={{ borderColor: `${col}55` }}
                            onClick={() => { seekTo(r.a + 0.01); setTrackInfo(null) }}
                          >
                            ▸ {fmtTime(r.a)}–{fmtTime(r.b)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {(session.extracted || []).includes(trackInfo) && (
                    <div className="confirm-actions">
                      {session.stemInfo?.[trackInfo]?.shelved ? (
                        <button
                          className="btn-primary btn-small"
                          onClick={() => { setStemShelf(trackInfo, false); setTrackInfo(null) }}
                        >▲ Promover pra mesa</button>
                      ) : (
                        <button
                          className="btn-secondary btn-small"
                          onClick={() => { setStemShelf(trackInfo, true); setTrackInfo(null) }}
                        >📦 Guardar na prateleira</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {pasteOpen && (
            <div className="modal-overlay" onClick={() => setPasteOpen(false)}>
              <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
                <div className="confirm-body">
                  <h3 className="confirm-title">Colar a letra inteira</h3>
                  <p className="confirm-message">
                    Uma linha por verso. O texto passa a ser o seu — a sincronização com a
                    música continua a que foi calculada pela voz.
                  </p>
                  <textarea
                    className="lyr-paste"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={12}
                    placeholder="Cola a letra aqui…"
                  />
                  <div className="confirm-actions">
                    <button className="btn-secondary" onClick={() => setPasteOpen(false)}>Cancelar</button>
                    <button className="btn-primary" onClick={applyPaste}>Aplicar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {hint && (
        <div
          className={`hint-pop ${hint.below ? 'below' : ''}`}
          style={{ left: hint.x, top: hint.y }}
        >{hint.text}</div>
      )}
    </div>
  )
}
