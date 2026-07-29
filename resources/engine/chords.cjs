// Detecta os ACORDES de uma música lendo os stems separados — a vantagem do
// MPTRIX: o baixo isolado entrega a raiz de cada acorde, e a harmonia limpa
// (sem bateria/voz) entrega o tipo (maior/menor). Vocabulário humilde de
// propósito: melhor um Am certo que um Am7(9/11) chutado.
// Roda como processo Node separado (ELECTRON_RUN_AS_NODE).
// Uso: chords.cjs <ffmpeg> <bassFile|-> <beatRef|-> <harm1> [harm2 ...]
//   beatRef = faixa pra extrair a grade de batidas (bateria isolada, ideal)
// Saída: uma linha JSON: { chords: [{t, end, label, strength}], beats }
'use strict'

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ffmpegPath = process.argv[2]
const bassFile = process.argv[3]
const beatFile = process.argv[4]
const harmFiles = process.argv.slice(5)

if (!ffmpegPath || !harmFiles.length) {
  console.error('uso: chords.cjs <ffmpeg> <bass|-> <beatref|-> <harm1> [harm2...]')
  process.exit(1)
}

const SR = 44100
const HOP = Math.round(SR * 0.25) // análise a cada 250ms
const FRAME = 8192 // ~186ms de janela espectral
const BASS_FRAME = 4096
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function decodeMono(file, tag) {
  const tmp = path.join(os.tmpdir(), `mptrix-chords-${process.pid}-${tag}.pcm`)
  const dec = spawnSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', tmp], { windowsHide: true })
  if (dec.status !== 0) return null
  const buf = fs.readFileSync(tmp)
  try { fs.unlinkSync(tmp) } catch {}
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
}

// Soma os stems harmônicos num sinal só (a "harmonia limpa")
let harm = null
for (let i = 0; i < harmFiles.length; i++) {
  const a = decodeMono(harmFiles[i], `h${i}`)
  if (!a) continue
  if (!harm) {
    harm = a
  } else {
    const n = Math.max(harm.length, a.length)
    const out = new Float32Array(n)
    out.set(harm)
    for (let s = 0; s < a.length; s++) out[s] += a[s]
    harm = out
  }
}
if (!harm || harm.length < SR * 5) {
  console.log(JSON.stringify({ chords: [], hops: 0, error: 'harmonia insuficiente' }))
  process.exit(0)
}
const bass = bassFile && bassFile !== '-' ? decodeMono(bassFile, 'b') : null
const beatRef = beatFile && beatFile !== '-' ? decodeMono(beatFile, 'beat') : null

const EssentiaWASM = require('./essentia-wasm.umd.js')
const Essentia = require('./essentia.js-core.umd.js')
const essentia = new Essentia(EssentiaWASM)

// Gabaritos com pesos (raiz forte, terça define, quinta média, sétima colore).
// Vocabulário de MPB/jazz: maior, menor, 7, 7M, m7, diminuto — com um pequeno
// bônus pros simples, pra música pop não ganhar nome chique à toa.
const SHAPES = [
  { suf: '', t: [1, 0, 0, 0, 0.85, 0, 0, 0.9, 0, 0, 0, 0], bonus: 0.015 },
  { suf: 'm', t: [1, 0, 0, 0.85, 0, 0, 0, 0.9, 0, 0, 0, 0], bonus: 0.015 },
  { suf: '7', t: [1, 0, 0, 0, 0.8, 0, 0, 0.7, 0, 0, 0.75, 0], bonus: 0 },
  { suf: '7M', t: [1, 0, 0, 0, 0.8, 0, 0, 0.7, 0, 0, 0, 0.75], bonus: 0 },
  { suf: 'm7', t: [1, 0, 0, 0.8, 0, 0, 0, 0.7, 0, 0, 0.75, 0], bonus: 0 },
  { suf: '°', t: [1, 0, 0, 0.85, 0, 0, 0.85, 0, 0, 0.6, 0, 0], bonus: 0 },
  // a leva nova: aumentado, suspensos, meio-diminuto, sextas.
  // Bônus NEGATIVO de propósito: são gêmeos enarmônicos de acordes comuns
  // (F6 = Dm7, Fsus2 = Csus4...) — só vencem quando o BAIXO canta a raiz deles
  { suf: '+', t: [1, 0, 0, 0, 0.85, 0, 0, 0, 0.85, 0, 0, 0], bonus: -0.025 },
  { suf: 'sus4', t: [1, 0, 0, 0, 0, 0.85, 0, 0.9, 0, 0, 0, 0], bonus: -0.025 },
  { suf: 'sus2', t: [1, 0, 0.85, 0, 0, 0, 0, 0.9, 0, 0, 0, 0], bonus: -0.025 },
  { suf: 'm7(b5)', t: [1, 0, 0, 0.8, 0, 0, 0.8, 0, 0, 0, 0.7, 0], bonus: -0.01 },
  { suf: '6', t: [1, 0, 0, 0, 0.8, 0, 0, 0.85, 0, 0.7, 0, 0], bonus: -0.025 },
  { suf: 'm6', t: [1, 0, 0, 0.8, 0, 0, 0, 0.85, 0, 0.7, 0, 0], bonus: -0.025 }
]
function rotate(t, k) {
  const out = new Array(12)
  for (let i = 0; i < 12; i++) out[(i + k) % 12] = t[i]
  return out
}
const TEMPLATES = []
for (let r = 0; r < 12; r++) {
  for (const sh of SHAPES) {
    TEMPLATES.push({ label: NOTES[r] + sh.suf, root: r, t: rotate(sh.t, r), bonus: sh.bonus })
  }
}
function cosine(h, t) {
  let dot = 0
  let nh = 0
  let nt = 0
  for (let i = 0; i < 12; i++) {
    dot += h[i] * t[i]
    nh += h[i] * h[i]
    nt += t[i] * t[i]
  }
  return dot / (Math.sqrt(nh * nt) + 1e-9)
}

// ---------- Passo 1: chroma + baixo em quadros finos (0.125s) ----------
const FINE_HOP = Math.round(SR * 0.125)
const nFrames = Math.floor((harm.length - FRAME) / FINE_HOP)
const frames = [] // {t, chroma, rms}
const bassPcs = [] // {t, pc} quando o baixo canta com confiança

for (let fIdx = 0; fIdx < nFrames; fIdx++) {
  const start = fIdx * FINE_HOP
  const t = start / SR
  const frame = harm.subarray(start, start + FRAME)
  let rms = 0
  for (let s = 0; s < frame.length; s += 4) rms += frame[s] * frame[s]
  rms = Math.sqrt(rms / (frame.length / 4))
  if (rms < 0.004) {
    frames.push({ t, chroma: null, rms })
  } else {
    const vec = essentia.arrayToVector(frame)
    const win = essentia.Windowing(vec, true, FRAME, 'blackmanharris62')
    const spec = essentia.Spectrum(win.frame, FRAME)
    const peaks = essentia.SpectralPeaks(spec.spectrum, 0, 4500, 60, 40, 'magnitude', SR)
    const hp = essentia.HPCP(peaks.frequencies, peaks.magnitudes)
    const hpcp = essentia.vectorToArray(hp.hpcp)
    vec.delete(); win.frame.delete(); spec.spectrum.delete()
    peaks.frequencies.delete(); peaks.magnitudes.delete(); hp.hpcp.delete()
    // HPCP começa em Lá (A) — rotaciona pra C=0
    const chroma = new Array(12)
    for (let i = 0; i < 12; i++) chroma[(i + 9) % 12] = hpcp[i]
    frames.push({ t, chroma, rms })
  }
  if (bass && start + BASS_FRAME < bass.length) {
    const bframe = bass.subarray(start, start + BASS_FRAME)
    let brms = 0
    for (let s = 0; s < bframe.length; s += 4) brms += bframe[s] * bframe[s]
    brms = Math.sqrt(brms / (bframe.length / 4))
    if (brms > 0.004) {
      const bvec = essentia.arrayToVector(bframe)
      try {
        const py = essentia.PitchYin(bvec, BASS_FRAME, true, 400, 30, SR, 0.15)
        if (py.pitchConfidence > 0.75 && py.pitch > 0) {
          bassPcs.push({ t, pc: ((Math.round(12 * Math.log2(py.pitch / 440)) + 69) % 12 + 12) % 12 })
        }
      } catch {}
      bvec.delete()
    }
  }
}

// ---------- Passo 2: a grade de BATIDAS (janelas musicais, não de relógio) ----------
// O ritmo vem da bateria isolada quando existe (batida limpa); senão da harmonia
let ticks = []
try {
  const beatSig = beatRef || harm
  const bvec = essentia.arrayToVector(beatSig)
  const rr = essentia.RhythmExtractor2013(bvec, 208, 'multifeature', 40)
  ticks = essentia.vectorToArray(rr.ticks)
  bvec.delete()
} catch {}
if (!ticks || ticks.length < 8) {
  // sem grade confiável: batidas artificiais de 0.5s
  ticks = []
  for (let t = 0; t < harm.length / SR; t += 0.5) ticks.push(t)
}

// ---------- Passo 3: nota de CADA acorde em CADA batida ----------
const nBeats = ticks.length - 1
const beatMeta = [] // {t, end, silent}
const scoreMat = [] // [batida][template] = pontuação
for (let b = 0; b < nBeats; b++) {
  const t0 = ticks[b]
  const t1 = ticks[b + 1]
  const inBeat = frames.filter((f) => f.t >= t0 && f.t < t1 && f.chroma)
  if (!inBeat.length) {
    beatMeta.push({ t: t0, end: t1, silent: true })
    scoreMat.push(null)
    continue
  }
  const chroma = new Array(12).fill(0)
  for (const f of inBeat) for (let i = 0; i < 12; i++) chroma[i] += f.chroma[i]
  const bvotes = {}
  for (const bp of bassPcs) if (bp.t >= t0 && bp.t < t1) bvotes[bp.pc] = (bvotes[bp.pc] || 0) + 1
  let bassPc = null
  let bn = 0
  for (const [pc, n] of Object.entries(bvotes)) if (n > bn) { bassPc = Number(pc); bn = n }

  const row = new Array(TEMPLATES.length)
  for (let k = 0; k < TEMPLATES.length; k++) {
    const tpl = TEMPLATES[k]
    let sc = cosine(chroma, tpl.t) + tpl.bonus
    if (bassPc != null) {
      // o baixo isolado é o juiz de empate dos gêmeos enarmônicos
      if (tpl.root === bassPc) sc += 0.15
      else if ((tpl.root + 7) % 12 === bassPc) sc += 0.03
    }
    row[k] = sc
  }
  beatMeta.push({ t: t0, end: t1, silent: false })
  scoreMat.push(row)
}

// ---------- Passo 3b: INÉRCIA MUSICAL (Viterbi) ----------
// Trocar de acorde custa caro (0.22): a troca só acontece quando a evidência
// sustenta — é o que separa harmonia real de tremeliques de uma batida
const SWITCH = 0.32
const K = TEMPLATES.length
let prev = new Array(K).fill(0)
const back = []
for (let b = 0; b < nBeats; b++) {
  const row = scoreMat[b]
  const bk = new Array(K)
  const cur = new Array(K)
  if (!row) {
    for (let k = 0; k < K; k++) { cur[k] = prev[k]; bk[k] = k } // silêncio: carrega o estado
  } else {
    let bestPrev = -Infinity
    let bestIdx = 0
    for (let k = 0; k < K; k++) if (prev[k] > bestPrev) { bestPrev = prev[k]; bestIdx = k }
    for (let k = 0; k < K; k++) {
      const stay = prev[k]
      const jump = bestPrev - SWITCH
      if (stay >= jump) { cur[k] = stay + row[k]; bk[k] = k }
      else { cur[k] = jump + row[k]; bk[k] = bestIdx }
    }
  }
  back.push(bk)
  prev = cur
}
// reconstrói o caminho vencedor
let cursor = 0
for (let k = 1; k < K; k++) if (prev[k] > prev[cursor]) cursor = k
const bestPath = new Array(nBeats)
for (let b = nBeats - 1; b >= 0; b--) {
  bestPath[b] = cursor
  cursor = back[b][cursor]
}

// ---------- Passo 4: batidas viram trechos (silêncio quebra o trecho) ----------
const spans = []
for (let b = 0; b < nBeats; b++) {
  const bm = beatMeta[b]
  const row = scoreMat[b]
  const label = bm.silent ? null : (row[bestPath[b]] >= 0.55 ? TEMPLATES[bestPath[b]].label : null)
  const score = bm.silent || !row ? 0 : Math.max(0, row[bestPath[b]])
  const last = spans[spans.length - 1]
  if (last && last.label === label) {
    last.end = bm.end
    last.n++
    last.s += score
  } else {
    spans.push({ t: bm.t, end: bm.end, label, n: 1, s: score })
  }
}
const chords = []
for (const sp of spans) {
  if (!sp.label) continue
  const strength = sp.s / sp.n
  // acorde de UMA batida só precisa ser MUITO convincente — senão é fantasma
  if (sp.n === 1 && strength < 0.8) continue
  chords.push({
    t: Math.round(sp.t * 10) / 10,
    end: Math.round(sp.end * 10) / 10,
    label: sp.label,
    strength: Math.round(strength * 100) / 100
  })
}

// O MESMO acorde repetido com buraquinho no meio vira UM card só — e Dm/Dm7
// são a mesma família (a sétima entra e sai da chroma); fica o nome do trecho
// mais longo
const famOf = (l) => {
  const m = /^([A-G]#?)(.*)$/.exec(l || '')
  if (!m) return l
  const suf = m[2]
  if (suf === 'm' || suf === 'm7' || suf === 'm6') return m[1] + 'm'
  if (suf === '' || suf === '7' || suf === '7M' || suf === '6') return m[1]
  return l // °, +, sus e m7(b5) são famílias próprias
}
const merged = []
for (const c of chords) {
  const last = merged[merged.length - 1]
  if (last && famOf(last.label) === famOf(c.label) && c.t - last.end < 2.5) {
    if (c.end - c.t > last.end - last.t) last.label = c.label
    last.end = c.end
    last.strength = Math.max(last.strength, c.strength)
  } else {
    merged.push({ ...c })
  }
}

// ---------- INVERSÕES: o baixo insistindo numa nota do acorde que não é a
// raiz vira cifra com barra (C/E) — só dá pra fazer porque o baixo é isolado
const LABEL_TONES = {}
for (const tpl of TEMPLATES) {
  LABEL_TONES[tpl.label] = {
    root: tpl.root,
    tones: tpl.t.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0)
  }
}
for (const c of merged) {
  const info = LABEL_TONES[c.label]
  if (!info) continue
  const votes = {}
  let total = 0
  for (const bp of bassPcs) {
    if (bp.t >= c.t && bp.t < c.end) {
      votes[bp.pc] = (votes[bp.pc] || 0) + 1
      total++
    }
  }
  if (total < 3) continue
  let top = null
  let tn = 0
  for (const [pc, n] of Object.entries(votes)) if (n > tn) { top = Number(pc); tn = n }
  // baixo firme (60%+) numa nota do acorde que não é a raiz = inversão
  if (top == null || top === info.root || tn / total < 0.6) continue
  if (info.tones.includes(top)) c.label = `${c.label}/${NOTES[top]}`
}

console.log(JSON.stringify({ chords: merged, beats: ticks.length }))
