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

  // Posição + correção de deriva
  useEffect(() => {
    let lastDrift = 0
    const tick = (ts) => {
      const p = playerRef.current
      if (p && p.playing) {
        if (p.ended()) {
          p.pause()
          p.seek(0)
          setPlaying(false)
          setPos(0)
        } else {
          if (!draggingRef.current) setPos(p.position())
          if (ts - lastDrift > 500) {
            p.correctDrift()
            lastDrift = ts
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

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
          className="btn-secondary btn-small"
          onClick={phase === 'processing' || phase === 'planning' ? cancelJob : onClose}
        >
          ← Voltar
        </button>
        <div className="studio-title-wrap">
          <div className="studio-title" title={source.title}>{source.title || 'Estúdio'}</div>
          <div className="studio-badges">
            {analysisKey && (
              <span className="studio-badge" title={`Confiança: ${Math.round((session.analysis.strength || 0) * 100)}%`}>
                🎼 {shiftedKey && pitch !== 0 ? `${analysisKey} → ${shiftedKey}` : analysisKey}
              </span>
            )}
            {bpm && (
              <span className="studio-badge">
                ♩ {bpmHalf ? `${Math.round(bpmHalf)} / ${Math.round(bpm)}` : Math.round(bpm)} BPM
                {tempo !== 100 ? ` × ${tempo}%` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="studio-header-actions">
          {model === 'quick' && <span className="studio-badge">🎚️ Edição rápida</span>}
          <button
            className="btn-secondary btn-small"
            onClick={doExportSong}
            disabled={phase !== 'ready' || exportingSong}
            title="Salva a música inteira em MP3 com o tom e a velocidade escolhidos"
          >
            {exportingSong ? 'Exportando…' : 'Exportar música…'}
          </button>
          {session?.model !== 'quick' && (
            <button className="btn-secondary btn-small" onClick={doExport} disabled={phase !== 'ready'}>
              Exportar faixas…
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
                <div className="progress-bar alive">
                  <div className="progress-fill" style={{ width: `${mainMeter.display}%` }} />
                </div>
                <div className="studio-meter-line">
                  <strong>{Math.round(mainMeter.display)}%</strong>
                  {passInfo && <span className="muted"> · IA {passInfo.current} de {passInfo.total}</span>}
                  {fmtEta(mainMeter.eta) && <span className="muted"> · {fmtEta(mainMeter.eta)}</span>}
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
            {presentStems(session).map((stem) => {
              const meta = STEM_META[stem] || { label: stem, icon: '🎚️' }
              const isMuted = muted.has(stem)
              const isSolo = solo.has(stem)
              const effectivelyOff = isMuted || (solo.size > 0 && !isSolo)
              return (
                <div key={stem} className={`studio-track ${effectivelyOff ? 'off' : ''}`}>
                  <span className="studio-track-icon">{meta.icon}</span>
                  <span className="studio-track-name">{meta.label}</span>
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
                  <button
                    className={`studio-mini-btn ${isMuted ? 'active-mute' : ''}`}
                    onClick={() => toggleMute(stem)}
                    title="Mudo"
                  >M</button>
                  <button
                    className={`studio-mini-btn ${isSolo ? 'active-solo' : ''}`}
                    onClick={() => toggleSolo(stem)}
                    title="Solo (ouvir só essa faixa)"
                  >S</button>
                  {(session.extracted || []).includes(stem) && !extractJob && (
                    <button
                      className="studio-mini-btn"
                      onClick={() => redoTrack(stem)}
                      title="Refazer essa faixa do zero (apaga e extrai de novo)"
                    >↻</button>
                  )}
                </div>
              )
            })}
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
          </div>

          <div className="studio-transport">
            <div className="studio-seek-row">
              <span className="studio-time">{fmtTime(pos)}</span>
              <input
                type="range"
                className="studio-seek"
                min="0"
                max={playDuration || 1}
                step="0.1"
                value={Math.min(pos, playDuration || 0)}
                onPointerDown={() => { draggingRef.current = true }}
                onPointerUp={() => { draggingRef.current = false }}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
              />
              <span className="studio-time">{fmtTime(playDuration)}</span>
            </div>

            <div className="studio-controls-row">
              <button
                className="studio-play-btn"
                onClick={() => (playing ? pause() : play())}
                title={playing ? 'Pausar' : 'Tocar'}
              >
                {playing ? '⏸' : '▶'}
              </button>

              <div className="studio-param">
                <span className="studio-param-label">Tom</span>
                <div className="studio-stepper">
                  <button className="studio-mini-btn" onClick={() => changePitch(pitch - 1)}>−</button>
                  <span className="studio-param-value">{pitch > 0 ? `+${pitch}` : pitch}</span>
                  <button className="studio-mini-btn" onClick={() => changePitch(pitch + 1)}>+</button>
                </div>
              </div>

              <div className="studio-param">
                <span className="studio-param-label">Velocidade</span>
                <select
                  className="filter-select"
                  value={tempo}
                  onChange={(e) => changeTempo(parseInt(e.target.value, 10))}
                >
                  {SPEED_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}%</option>
                  ))}
                </select>
              </div>

              {altered && (
                <button className="link-btn" onClick={resetPitchTempo}>voltar ao original</button>
              )}

              {pitch !== 0 && hq?.state === 'rendering' && (
                <span className="muted studio-rendering" title="O tom já mudou — em segundo plano estou preparando a versão com qualidade de estúdio">
                  ✨ melhorando qualidade… {hq.pct || 0}%
                </span>
              )}
              {pitch !== 0 && hq?.state === 'done' && (
                <span className="studio-hq-done" title="Esta mudança de tom está na qualidade máxima">✨ qualidade máxima</span>
              )}
            </div>

            {exportMsg && (
              <div className="studio-export-msg" onClick={() => setExportMsg(null)}>{exportMsg}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
