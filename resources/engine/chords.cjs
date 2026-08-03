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
//
// O VOCABULÁRIO É CURTO DE PROPÓSITO. A distribuição real da música gravada
// (McFee & Bello, sobre Isophonics+Billboard+RWC+USPOP) é: maior/menor 69,9%,
// sétimas 21,3%, TODO o resto 8,8%. Cinco qualidades cobrem ~86% da música que
// existe; cada qualidade a mais compra menos de 1% de cobertura e paga com
// dezenas de falsos positivos. Foi o que aconteceu aqui: com sus2/sus4/+/6/m6
// no páreo o detector devolvia 43 FORMAS DISTINTAS numa música que usa 8.
//
// Pior: vários desses são GÊMEOS ENÁRMONICOS de acordes comuns (F6 tem as
// mesmas notas de Dm7; Csus2 as mesmas de Gsus4) — nenhuma croma consegue
// separar, então eles só roubam voto. E + e ° são simétricos: nem raiz têm.
//
// BONUS = prior de complexidade. Com croma ruidosa, template de 4 notas quase
// sempre "explica" melhor o quadro do que a tríade — o bônus compensa isso,
// exigindo evidência extra pra escolher acorde mais raro.
const SHAPES = [
  { suf: '', t: [1, 0, 0, 0, 0.85, 0, 0, 0.9, 0, 0, 0, 0], bonus: 0.035 },
  { suf: 'm', t: [1, 0, 0, 0.85, 0, 0, 0, 0.9, 0, 0, 0, 0], bonus: 0.035 },
  { suf: '7', t: [1, 0, 0, 0, 0.8, 0, 0, 0.7, 0, 0, 0.75, 0], bonus: 0.01 },
  { suf: 'm7', t: [1, 0, 0, 0.8, 0, 0, 0, 0.7, 0, 0, 0.75, 0], bonus: 0.01 },
  { suf: '7M', t: [1, 0, 0, 0, 0.8, 0, 0, 0.7, 0, 0, 0, 0.75], bonus: 0.01 },
  // dim e meio-dim são raros, mas são FUNÇÃO de verdade em MPB (o C#° da Azul
  // é um deles) — ficam, pagando um preço pra não aparecer à toa
  { suf: '°', t: [1, 0, 0, 0.85, 0, 0, 0.85, 0, 0, 0.6, 0, 0], bonus: -0.02 },
  { suf: 'm7(b5)', t: [1, 0, 0, 0.8, 0, 0, 0.8, 0, 0, 0, 0.7, 0], bonus: -0.02 }
]

// ---------- TONALIDADE ----------
// O detector sabia o tom e não usava pra nada. Num Dm, um C#+ ou um Csus2
// deveriam ter que PAGAR pra serem escolhidos; antes vinham de graça.
const ESC_MAIOR = [0, 2, 4, 5, 7, 9, 11]
const ESC_MENOR = [0, 2, 3, 5, 7, 8, 10]
let tomPc = null
let tomEscala = null
let tomNome = null
try {
  const kvec = essentia.arrayToVector(harm)
  const kx = essentia.KeyExtractor(kvec)
  kvec.delete()
  const i = NOTES.indexOf(String(kx.key).replace('b', '#'))
  if (i >= 0) {
    // grafia com bemol quando o tom pede (Bb, não A#): pra quem lê cifra,
    // A#7M num tom de Dm é ruído, mesmo sendo a mesma nota
    tomPc = String(kx.key).includes('b') ? (NOTES.indexOf(String(kx.key)[0]) + 11) % 12 : i
    tomEscala = String(kx.scale).toLowerCase().startsWith('min') ? 'minor' : 'major'
    tomNome = kx.key + (tomEscala === 'minor' ? 'm' : '')
  }
} catch {}
// notas do campo harmônico. No menor entram a sétima natural E a maior
// (harmônica), porque o V7 e o vii° do menor vivem dela — é exatamente o
// caso do C#° e do A7 da Azul, que ficariam "fora do tom" sem isso
const NO_TOM = new Array(12).fill(true)
if (tomPc != null) {
  NO_TOM.fill(false)
  const esc = tomEscala === 'minor' ? ESC_MENOR : ESC_MAIOR
  for (const g of esc) NO_TOM[(tomPc + g) % 12] = true
  if (tomEscala === 'minor') NO_TOM[(tomPc + 11) % 12] = true
}
const KEY_W = 0.06

function rotate(t, k) {
  const out = new Array(12)
  for (let i = 0; i < 12; i++) out[(i + k) % 12] = t[i]
  return out
}
const TEMPLATES = []
for (let r = 0; r < 12; r++) {
  for (const sh of SHAPES) {
    const t = rotate(sh.t, r)
    let dentro = 0
    let notas = 0
    for (let i = 0; i < 12; i++) if (t[i] > 0) { notas++; if (NO_TOM[i]) dentro++ }
    // bônus proporcional a quanto do acorde cabe no tom detectado
    const noTom = KEY_W * (dentro / Math.max(1, notas))
    TEMPLATES.push({ label: NOTES[r] + sh.suf, root: r, t, bonus: sh.bonus + noTom })
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

// ---------- Passo 1: CROMA por NNLS (log-frequência, com afinação corrigida) ----
// Antes isso era HPCP em cima de picos espectrais. A literatura mede a
// diferença e ela é grande: no mesmo conjunto de 55 músicas dos Beatles,
// HPCP+template dá 59% e a mesma cadeia trocando só a croma por NNLS sobe pra
// ~70%. É o maior ganho isolado que existe sem treinar modelo nenhum — e o
// essentia que já vem embarcado aqui tem o algoritmo pronto.
//
// A cadeia é a do Chordino: janela Hann de 16384 (sem normalizar) -> Spectrum
// -> LogSpectrum (que JÁ estima a afinação do disco e corrige) -> NNLSChroma.
// Sai croma de 12 bins E croma de BAIXO separada, de graça.
//
// SEM SOBREPOSIÇÃO (hop = janela): medido, o LogSpectrum do essentia.js custa
// 425ms POR CHAMADA — 99,6% do tempo todo — porque a ponte JS/WASM reconstrói o
// algoritmo a cada quadro. Com sobreposição de 8x davam 40 minutos por música.
// Sem sobreposição são ~700 quadros de 371ms, que ainda é resolução de sobra pra
// acorde (a decisão acontece por BATIDA, não por quadro).
//
// useNNLS fica FALSE: medido nesta build, o solver NNLS devolve croma toda zero
// (207 de 207 quadros vazios). Com ele desligado a cadeia entrega croma cheia e
// musicalmente correta — conferido à mão num trecho da Azul, deu A#/G/D com
// baixo em G bem onde a cifra diz Gm7.
const NNLS_FRAME = 16384
const NNLS_HOP = 16384
const frames = [] // {t, chroma, rms}
const bassPcs = [] // {t, pc} quando o baixo canta com confiança
{
  const mat = new (require('./essentia-wasm.umd.js').VectorVectorFloat)()
  const locais = []
  let meanT = null
  const n = Math.floor((harm.length - NNLS_FRAME) / NNLS_HOP)
  const rmsPorQuadro = new Float64Array(Math.max(0, n))
  for (let i = 0; i < n; i++) {
    const ini2 = i * NNLS_HOP
    const quadro = harm.subarray(ini2, ini2 + NNLS_FRAME)
    let rms = 0
    for (let k = 0; k < quadro.length; k += 8) rms += quadro[k] * quadro[k]
    rmsPorQuadro[i] = Math.sqrt(rms / (quadro.length / 8))
    const v = essentia.arrayToVector(quadro)
    const w = essentia.Windowing(v, false, NNLS_FRAME, 'hann')
    const sp = essentia.Spectrum(w.frame, NNLS_FRAME)
    const ls = essentia.LogSpectrum(sp.spectrum, 3, NNLS_FRAME, 0.01, SR)
    mat.push_back(ls.logFreqSpectrum)
    locais.push(ls.localTuning)
    meanT = essentia.vectorToArray(ls.meanTuning)
    v.delete(); w.frame.delete(); sp.spectrum.delete()
  }
  if (n > 0) {
    const nn = essentia.NNLSChroma(
      mat, essentia.arrayToVector(meanT), essentia.arrayToVector(locais),
      'none', NNLS_FRAME, SR, 0.7, 1.0, 'global', false
    )
    for (let i = 0; i < nn.chromagram.size(); i++) {
      const c = essentia.vectorToArray(nn.chromagram.get(i))
      // a croma do NNLS começa em Lá (A); aqui tudo trabalha com C=0
      const chroma = new Array(12)
      let soma = 0
      for (let k = 0; k < 12; k++) { chroma[(k + 9) % 12] = c[k]; soma += c[k] }
      frames.push({
        t: (i * NNLS_HOP) / SR,
        chroma: soma > 1e-6 ? chroma : null,
        rms: rmsPorQuadro[i] || 0
      })
    }
  }
}

// O baixo isolado continua vindo do PitchYin: ele dá a NOTA cantada, não a
// energia por classe — é o que decide inversão e desempata gêmeo enârmonico
if (bass) {
  const BHOP = Math.round(SR * 0.125)
  const nb = Math.floor((bass.length - BASS_FRAME) / BHOP)
  for (let i = 0; i < nb; i++) {
    const ini2 = i * BHOP
    const bframe = bass.subarray(ini2, ini2 + BASS_FRAME)
    let brms = 0
    for (let k = 0; k < bframe.length; k += 4) brms += bframe[k] * bframe[k]
    brms = Math.sqrt(brms / (bframe.length / 4))
    if (brms <= 0.004) continue
    const bvec = essentia.arrayToVector(bframe)
    try {
      const py = essentia.PitchYin(bvec, BASS_FRAME, true, 400, 30, SR, 0.15)
      if (py.pitchConfidence > 0.75 && py.pitch > 0) {
        bassPcs.push({ t: ini2 / SR, pc: (((Math.round(12 * Math.log2(py.pitch / 440)) + 69) % 12) + 12) % 12 })
      }
    } catch {}
    bvec.delete()
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
  // Soma simples dos quadros da batida. TENTEI mediana numa janela de duas
  // batidas (a literatura mede +6,6 pontos com janela larga) e MEDIU PIOR aqui:
  // 74,6% -> 73,1%. A causa e local: com a croma a 371ms e acorde trocando a
  // cada 1-2 batidas nesta musica, a janela de duas batidas atravessa a troca e
  // borra as duas harmonias numa so.
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

// GRAFIA CONFORME O TOM. A nota e a mesma, mas pra quem le cifra "A#7M" num
// tom de Dm e ruido: escreve-se Bb7M. Tons com bemol na armadura passam a
// mostrar bemol; os com sustenido continuam com sustenido.
const BEMOIS = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' }
const TONS_COM_BEMOL = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'])
if (tomNome && TONS_COM_BEMOL.has(tomNome.replace('#', '#'))) {
  // ...com uma exceção que todo músico escreve assim: o diminuto SENSÍVEL (meio
  // tom abaixo da tônica) fica em sustenido mesmo em tom bemol, porque ele
  // funciona como nota que PUXA pra tônica. Num Dm é C#°, nunca Db° — e é
  // exatamente assim que a cifra oficial da Azul escreve.
  const sensivel = tomPc != null ? NOTES[(tomPc + 11) % 12] : null
  const trocar = (l) => {
    const str = String(l)
    const raiz = (str.match(/^[A-G]#?/) || [''])[0]
    const eSensivelDim = sensivel && raiz === sensivel && /°/.test(str)
    return str.replace(/([A-G]#)/g, (m2, _p, pos) => (eSensivelDim && pos === 0 ? m2 : (BEMOIS[m2] || m2)))
  }
  for (const c of merged) c.label = trocar(c.label)
}
console.log(JSON.stringify({ chords: merged, beats: ticks.length, key: tomNome }))
