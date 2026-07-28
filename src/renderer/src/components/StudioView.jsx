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
  keys: { label: 'Teclados (geral)', icon: '🎹' },
  'digital-piano': { label: 'Piano digital', icon: '🎹' },
  harpsichord: { label: 'Cravo', icon: '🎹' },
  marimba: { label: 'Marimba/Xilofone', icon: '🎶' },
  glockenspiel: { label: 'Glockenspiel', icon: '✨' },
  timpani: { label: 'Tímpanos', icon: '🥁' },
  bells: { label: 'Sinos', icon: '🔔' },
  'wind-chimes': { label: 'Carrilhão de vento', icon: '🎐' },
  tambourine: { label: 'Pandeirola', icon: '🪘' },
  triangle: { label: 'Triângulo', icon: '🔺' },
  congas: { label: 'Congas', icon: '🪘' },
  instrumental: { label: 'Resto da música', icon: '🎵' },
  song: { label: 'Música completa', icon: '🎵' }
}

// Minutos de processamento por minuto de música (medido nesta máquina)
const PROC_FACTOR = 9.7

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
  const m = /^([A-G]#?)(.*)$/.exec(label || '')
  if (!m) return label
  const i = CHORD_NOTES.indexOf(m[1])
  if (i < 0) return label
  const root = CHORD_NOTES[(((i + semi) % 12) + 12) % 12]
  return (FLAT_SHOW[root] || root) + m[2]
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
function presentStems(sess) {
  if (!sess?.stemInfo) return sess?.stems || []
  return sess.stems.filter((s) => sess.stemInfo[s]?.present !== false)
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
        el.onerror = () => reject(new Error(`Não consegui carregar a faixa "${stem}"`))
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

export default function StudioView({ source, onClose }) {
  const [phase, setPhase] = useState('starting')
  const [stage, setStage] = useState(null)
  const [percent, setPercent] = useState(null)
  const [passInfo, setPassInfo] = useState(null)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(null)
  const [model, setModel] = useState(source.model || 'htdemucs')

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
  const [showLyrics, setShowLyrics] = useState(false)
  const [showExtract, setShowExtract] = useState(false) // painel Extrair (olheiro/lupa/arsenal)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const lyricsListRef = useRef(null)
  // Nós do DOM escritos por frame (playhead/tint por pista, ruler, timer, seek)
  const laneNodesRef = useRef({})
  const rulerNodesRef = useRef({})
  const timerElRef = useRef(null)
  const seekElRef = useRef(null)
  const [extractJob, setExtractJob] = useState(null) // {id, label, stage, percent}
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

  const stemUrl = useCallback((sessKey, variant, format) =>
    (stem) => `stems://s/${sessKey}/${variant}/${stem}.${format}`, [])

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
        let t = p.position()
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
        if (!draggingRef.current) {
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
          if (seekElRef.current) seekElRef.current.value = String(t)
          if (p.playing && ts - lastState > 250) {
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
        await p.load(presentStems(session), stemUrl(session.key, variant, format), targetPitch)
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
      await p.load(presentStems(sess), stemUrl(sess.key, 'base', 'flac'), 0)
      const m = mixerRef.current
      p.applyGains({ ...m.volumes }, m.muted, m.solo)
      p.seek(pos)
      if (wasPlaying && aliveRef.current) await p.play(pos)
    } catch {}
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
      const r = await window.mptrix.studio.lyrics({ key: session.key })
      setLyrics(r?.error ? { error: r.error } : r)
      if (!chords) {
        const c = await window.mptrix.studio.chords({ key: session.key })
        if (!c?.error) setChords(c)
      }
    }
  }

  const editVerse = async (i) => {
    const cur = lyrics?.segments?.[i]
    if (!cur) return
    const txt = window.prompt('Corrigir verso:', cur.text)
    if (txt == null || txt === cur.text) return
    const segs = lyrics.segments.map((s, k) => (k === i ? { ...s, text: txt } : s))
    setLyrics({ ...lyrics, segments: segs, edited: true })
    await window.mptrix.studio.lyricsSave({ key: session.key, segments: segs })
  }

  const applyPaste = async () => {
    const lines = pasteText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length || !lyrics?.segments) {
      setPasteOpen(false)
      return
    }
    const segs = lyrics.segments.map((s, i) => (i < lines.length ? { ...s, text: lines[i] } : s))
    setLyrics({ ...lyrics, segments: segs, edited: true })
    setPasteOpen(false)
    await window.mptrix.studio.lyricsSave({ key: session.key, segments: segs })
  }

  // Verso ativo + rolagem suave acompanhando a música
  const activeLyrIdx = lyrics?.segments ? lyrics.segments.findIndex((s) => pos >= s.t0 && pos < s.t1) : -1
  useEffect(() => {
    if (activeLyrIdx < 0 || !lyricsListRef.current) return
    const el = lyricsListRef.current.children[activeLyrIdx]
    if (el) lyricsListRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 150), behavior: 'smooth' })
  }, [activeLyrIdx])

  // Auto-scroll do painel pro acorde ativo (sempre scrollTo, nunca scrollIntoView)
  const activeChordIdx = chords?.list ? chords.list.findIndex((c) => pos >= c.t && pos < c.end) : -1
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
      for (const stem of presentStems(session)) {
        const p = await window.mptrix.studio.peaks({ key: session.key, stem })
        if (!alive) return
        if (p) setPeaksMap((m) => ({ ...m, [stem]: p }))
      }
    })()
    return () => { alive = false }
  }, [phase, session]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Olheiro: depois que a sessão abre, procura instrumentos raros no "outros"
  useEffect(() => {
    if (phase !== 'ready' || !session || scout !== null) return
    if (!session.stems.includes('other')) return
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
        setExportMsg('✓ Faixas novas adicionadas à música!')
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
    const meta = STEM_META[stem] || { label: stem }
    const min = Math.max(5, Math.ceil((session.duration / 60) * PROC_FACTOR))
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
      const active = presentStems(sess)
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
      if (choices?.length && aliveRef.current) {
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
        const baseMin = Math.max(4, Math.ceil((plan.duration / 60) * 3.8))
        const gpMin = Math.max(2, Math.ceil((plan.duration / 60) * 1.2))
        const isGp = (inst) => inst === 'guitar' || inst === 'piano'
        const itemMinutes = (inst) =>
          isGp(inst) ? gpMin : Math.max(5, Math.ceil((plan.duration / 60) * PROC_FACTOR))
        const gpSelCount = [...planSel].filter(isGp).length
        // guitarra e teclado saem do mesmo passo: o tempo deles conta UMA vez
        const totalMin = baseMin + (gpSelCount ? gpMin : 0) +
          [...planSel].filter((i) => !isGp(i)).reduce((acc, i) => acc + itemMinutes(i), 0)
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
                  <span className="studio-plan-total-label">tempo total estimado</span>
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
            <div className="daw">
              <div className="daw-row daw-head-row">
                <div className="daw-rail daw-rail-head">
                  <span className="daw-cap">PISTAS</span>
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
              {presentStems(session).map((stem, stemIdx) => {
                const meta = STEM_META[stem] || { label: stem, icon: '🎚️' }
                const col = stemColor(stem, stemIdx)
                const isMuted = muted.has(stem)
                const isSolo = solo.has(stem)
                const effectivelyOff = isMuted || (solo.size > 0 && !isSolo)
                return (
                  <div key={stem} className={`daw-row ${effectivelyOff ? 'off' : ''}`}>
                    <div className="daw-rail">
                      <div className="daw-rail-top">
                        <span className="studio-stem-bar" style={{ background: col }} />
                        <span className="daw-name" style={{ color: col }} title={meta.label}>{meta.label}</span>
                        <span className="daw-rail-flex" />
                        <button
                          className={`studio-mini-btn ${isMuted ? 'active-mute' : ''}`}
                          onClick={() => toggleMute(stem)}
                          title={`Silenciar ${meta.label}`}
                          aria-pressed={isMuted}
                        >M</button>
                        <button
                          className={`studio-mini-btn ${isSolo ? 'active-solo' : ''}`}
                          onClick={() => toggleSolo(stem)}
                          title={`Solo de ${meta.label}`}
                          aria-pressed={isSolo}
                        >S</button>
                        {(session.extracted || []).includes(stem) && !extractJob && (
                          <button
                            className="studio-mini-btn"
                            onClick={() => redoTrack(stem)}
                            title="Refazer essa faixa do zero (apaga e extrai de novo)"
                          >↻</button>
                        )}
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
                          title={`Volume: ${Math.round((volumes[stem] ?? 1) * 100)}%`}
                        />
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
                    <span className="muted">Lendo a harmonia das faixas… (~1 min, só na primeira vez)</span>
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
                      onClick={() => { setPasteText(''); setPasteOpen(true) }}
                      title="Cola a letra oficial — o texto vira o seu, a sincronização continua"
                    >colar</button>
                  )}
                  <button className="btn-close" onClick={() => setShowLyrics(false)} aria-label="Fechar">×</button>
                </div>
                {lyrics === 'loading' && (
                  <div className="chords-empty">
                    <div className="studio-spinner small" />
                    <span className="muted">
                      Transcrevendo a voz isolada aqui no seu PC… Na primeira vez o app
                      também baixa a IA de fala (~470MB) — pode levar vários minutos.
                      Acontece uma vez só; depois abre na hora.
                    </span>
                  </div>
                )}
                {lyrics?.error && <div className="chords-empty muted">⚠ {lyrics.error}</div>}
                {lyrics?.segments && (lyrics.segments.length === 0 ? (
                  <div className="chords-empty muted">Não ouvi versos cantados na faixa de voz.</div>
                ) : (
                  <div className="lyrics-list" ref={lyricsListRef}>
                    {lyrics.segments.map((s, i) => {
                      const st = i === activeLyrIdx ? 'now' : pos >= s.t1 ? 'past' : 'fut'
                      const verseChords = (chords?.list || []).filter((c) => c.t >= s.t0 - 0.5 && c.t < s.t1)
                      return (
                        <div key={i} className={`lyr-block lyr-${st}`} onClick={() => seekTo(s.t0 + 0.01)}>
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
                          <div className="lyr-text">{s.text}</div>
                          <button
                            className="lyr-edit"
                            onClick={(e) => { e.stopPropagation(); editVerse(i) }}
                            title="Corrigir esse verso"
                          >✎</button>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
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

            {scout && scout !== 'loading' && !extractJob && (() => {
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
              const gpMin = Math.max(2, Math.ceil((session.duration / 60) * 1.2))
              const itemMinutes = (inst) =>
                isGp(inst) ? gpMin : Math.max(5, Math.ceil((session.duration / 60) * PROC_FACTOR))
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
    </div>
  )
}
