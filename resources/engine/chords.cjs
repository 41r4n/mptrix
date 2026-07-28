// Detecta os ACORDES de uma música lendo os stems separados — a vantagem do
// MPTRIX: o baixo isolado entrega a raiz de cada acorde, e a harmonia limpa
// (sem bateria/voz) entrega o tipo (maior/menor). Vocabulário humilde de
// propósito: melhor um Am certo que um Am7(9/11) chutado.
// Roda como processo Node separado (ELECTRON_RUN_AS_NODE).
// Uso: chords.cjs <ffmpeg> <bassFile|-> <harm1> [harm2 ...]
// Saída: uma linha JSON: { chords: [{t, end, label, strength}], hops }
'use strict'

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ffmpegPath = process.argv[2]
const bassFile = process.argv[3]
const harmFiles = process.argv.slice(4)

if (!ffmpegPath || !harmFiles.length) {
  console.error('uso: chords.cjs <ffmpeg> <bass|-> <harm1> [harm2...]')
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

const EssentiaWASM = require('./essentia-wasm.umd.js')
const Essentia = require('./essentia.js-core.umd.js')
const essentia = new Essentia(EssentiaWASM)

// Gabaritos: maior e menor com pesos (raiz forte, quinta média, terça define)
const TPL_MAJ = [1, 0, 0, 0, 0.85, 0, 0, 0.9, 0, 0, 0, 0]
const TPL_MIN = [1, 0, 0, 0.85, 0, 0, 0, 0.9, 0, 0, 0, 0]
function rotate(t, k) {
  const out = new Array(12)
  for (let i = 0; i < 12; i++) out[(i + k) % 12] = t[i]
  return out
}
const TEMPLATES = []
for (let r = 0; r < 12; r++) {
  TEMPLATES.push({ label: NOTES[r], root: r, t: rotate(TPL_MAJ, r) })
  TEMPLATES.push({ label: NOTES[r] + 'm', root: r, t: rotate(TPL_MIN, r) })
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

const nHops = Math.floor((harm.length - FRAME) / HOP)
const labels = []
const scores = []

for (let hIdx = 0; hIdx < nHops; hIdx++) {
  const start = hIdx * HOP
  const frame = harm.subarray(start, start + FRAME)

  // silêncio harmônico = sem acorde
  let rms = 0
  for (let s = 0; s < frame.length; s += 4) rms += frame[s] * frame[s]
  rms = Math.sqrt(rms / (frame.length / 4))
  if (rms < 0.004) {
    labels.push(null)
    scores.push(0)
    continue
  }

  const vec = essentia.arrayToVector(frame)
  const win = essentia.Windowing(vec, true, FRAME, 'blackmanharris62')
  const spec = essentia.Spectrum(win.frame, FRAME)
  const peaks = essentia.SpectralPeaks(spec.spectrum, 0, 4500, 60, 40, 'magnitude', SR)
  const hp = essentia.HPCP(peaks.frequencies, peaks.magnitudes)
  const hpcp = essentia.vectorToArray(hp.hpcp)
  vec.delete(); win.frame.delete(); spec.spectrum.delete()
  peaks.frequencies.delete(); peaks.magnitudes.delete(); hp.hpcp.delete()

  // HPCP vem com 12 bins começando em Lá (A) — rotaciona pra C=0
  const chroma = new Array(12)
  for (let i = 0; i < 12; i++) chroma[(i + 9) % 12] = hpcp[i]

  // raiz pelo baixo isolado (quando existe e o baixo está tocando)
  let bassPc = null
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
          bassPc = ((Math.round(12 * Math.log2(py.pitch / 440)) + 69) % 12 + 12) % 12
        }
      } catch {}
      bvec.delete()
    }
  }

  let best = null
  let bestScore = -1
  for (const tpl of TEMPLATES) {
    let sc = cosine(chroma, tpl.t)
    if (bassPc != null) {
      if (tpl.root === bassPc) sc += 0.08 // baixo tocando a raiz
      else if ((tpl.root + 7) % 12 === bassPc) sc += 0.03 // ou a quinta
    }
    if (sc > bestScore) {
      bestScore = sc
      best = tpl
    }
  }
  if (bestScore < 0.55) {
    labels.push(null)
    scores.push(0)
  } else {
    labels.push(best.label)
    scores.push(bestScore)
  }
}

// Suavização: voto da maioria em janela de 5 hops (1.25s)
const smooth = []
for (let i = 0; i < labels.length; i++) {
  const votes = {}
  for (let k = Math.max(0, i - 2); k <= Math.min(labels.length - 1, i + 2); k++) {
    const l = labels[k]
    if (l) votes[l] = (votes[l] || 0) + 1
  }
  let top = null
  let topN = 0
  for (const [l, n] of Object.entries(votes)) if (n > topN) { top = l; topN = n }
  smooth.push(topN >= 3 ? top : null)
}

// Junta hops iguais em trechos; trecho curto demais (<0.75s) é absorvido
const spans = []
for (let i = 0; i < smooth.length; i++) {
  const t = (i * HOP) / SR
  const l = smooth[i]
  if (spans.length && spans[spans.length - 1].label === l) {
    spans[spans.length - 1].end = t + HOP / SR
    spans[spans.length - 1].n++
    spans[spans.length - 1].s += scores[i]
  } else {
    spans.push({ t, end: t + HOP / SR, label: l, n: 1, s: scores[i] })
  }
}
const chords = []
for (const sp of spans) {
  if (!sp.label) continue
  if (sp.end - sp.t < 0.75 && chords.length && chords[chords.length - 1].end >= sp.t - 0.3) {
    chords[chords.length - 1].end = sp.end
    continue
  }
  chords.push({
    t: Math.round(sp.t * 10) / 10,
    end: Math.round(sp.end * 10) / 10,
    label: sp.label,
    strength: Math.round((sp.s / sp.n) * 100) / 100
  })
}

console.log(JSON.stringify({ chords, hops: nHops }))
