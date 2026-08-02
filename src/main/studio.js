import { app } from 'electron'
import { carregarLexico, corrigirVersos } from './lexico.js'
import { freemem } from 'os'
import { spawn } from 'child_process'
import { createHash, randomUUID } from 'crypto'
import { join, basename } from 'path'
import {
  existsSync,
  mkdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  renameSync,
  copyFileSync,
  openSync,
  readSync,
  closeSync
} from 'fs'

export const MODELS = {
  htdemucs: {
    id: 'htdemucs',
    name: '4 faixas (rápido)',
    stems: ['vocals', 'drums', 'bass', 'other']
  },
  htdemucs_ft: {
    id: 'htdemucs_ft',
    name: '4 faixas refinadas (muito mais lento, separação mais limpa)',
    stems: ['vocals', 'drums', 'bass', 'other'],
    // "bag of models": roda 4 IAs em sequência, cada uma com sua própria barra 0→100
    bag: 4
  },
  htdemucs_6s: {
    id: 'htdemucs_6s',
    name: '6 faixas em cascata (guitarra e piano separados)',
    stems: ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']
  },
  quick: {
    id: 'quick',
    name: 'Música inteira (sem separar — pronta em ~1 min)',
    stems: ['song']
  }
}

const MAX_CACHE_BYTES = 4 * 1024 * 1024 * 1024

const LOCAL_DIR = join(process.env.LOCALAPPDATA || app.getPath('userData'), 'MPTRIX')
const ENGINE_DIR = join(LOCAL_DIR, 'engine')
const STEMS_DIR = join(LOCAL_DIR, 'stems')
const PYTHON_PATH = join(ENGINE_DIR, 'venv', 'Scripts', 'python.exe')
const RUBBERBAND_PATH = join(ENGINE_DIR, 'rubberband', 'rubberband.exe')

function analyzeScriptPath() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'engine', 'analyze.cjs')
  }
  return join(__dirname, '../../resources/engine/analyze.cjs')
}

function chordsScriptPath() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'engine', 'chords.cjs')
  }
  return join(__dirname, '../../resources/engine/chords.cjs')
}

export function stemsRoot() {
  return STEMS_DIR
}

export function freeMemMB() {
  return Math.round(freemem() / 1048576)
}

// Apaga todos os caches (separações + plano) ligados a um arquivo de música.
// Precisa rodar ANTES de excluir o arquivo (a chave vem do conteúdo dele).
export function removeCachesForFile(filePath) {
  let fp = null
  try {
    fp = contentFingerprint(filePath)
  } catch {
    return
  }
  for (const model of ['htdemucs', 'htdemucs_ft', 'htdemucs_6s', 'quick']) {
    const modelTag = model === 'htdemucs_6s' ? `${model}|cascade1` : model
    const key = createHash('sha1').update(`${fp}|${modelTag}`).digest('hex').slice(0, 16)
    try { rmSync(join(STEMS_DIR, key), { recursive: true, force: true }) } catch {}
  }
  try { rmSync(join(STEMS_DIR, '_plans', `${fp.slice(0, 16)}_v3.json`), { force: true }) } catch {}
}

export function getEngineStatus() {
  const python = existsSync(PYTHON_PATH)
  const rubberband = existsSync(RUBBERBAND_PATH)
  const analyzer = existsSync(analyzeScriptPath())
  return { python, rubberband, analyzer, ok: python && rubberband, engineDir: ENGINE_DIR }
}

// Identifica a música pelo CONTEÚDO (início + fim + tamanho do arquivo), não pelo
// caminho — assim cópias do mesmo arquivo em pastas diferentes usam o mesmo cache.
function contentFingerprint(filePath) {
  const st = statSync(filePath)
  const h = createHash('sha1')
  h.update(String(st.size))
  const CHUNK = 1024 * 1024
  const fd = openSync(filePath, 'r')
  try {
    const buf = Buffer.alloc(CHUNK)
    let n = readSync(fd, buf, 0, CHUNK, 0)
    h.update(buf.subarray(0, n))
    if (st.size > CHUNK * 2) {
      n = readSync(fd, buf, 0, CHUNK, st.size - CHUNK)
      h.update(buf.subarray(0, n))
    }
  } finally {
    closeSync(fd)
  }
  return h.digest('hex')
}

function sessionKeyFor(filePath, model) {
  // 'cascade1' versiona o pipeline de 6 faixas (cascata) — separações antigas
  // do modelo 6s puro não servem mais como cache
  const modelTag = model === 'htdemucs_6s' ? `${model}|cascade1` : model
  try {
    return createHash('sha1').update(`${contentFingerprint(filePath)}|${modelTag}`).digest('hex').slice(0, 16)
  } catch {
    return createHash('sha1').update(`${filePath}|missing|${modelTag}`).digest('hex').slice(0, 16)
  }
}

// Chave do formato antigo (caminho+data) — usada só pra migrar caches existentes
function legacySessionKeyFor(filePath, model) {
  let st = null
  try { st = statSync(filePath) } catch {}
  const raw = `${filePath}|${st ? st.size : 0}|${st ? Math.round(st.mtimeMs) : 0}|${model}`
  return createHash('sha1').update(raw).digest('hex').slice(0, 16)
}

function metaPathOf(dir) {
  return join(dir, 'meta.json')
}

function readMeta(dir) {
  try {
    return JSON.parse(readFileSync(metaPathOf(dir), 'utf8'))
  } catch {
    return null
  }
}

function writeMeta(dir, meta) {
  writeFileSync(metaPathOf(dir), JSON.stringify(meta, null, 2))
}

function touchSession(dir) {
  const meta = readMeta(dir)
  if (meta) {
    meta.lastUsedAt = new Date().toISOString()
    writeMeta(dir, meta)
  }
}

// Lista de faixas da sessão: se o meta declarar (fluxo adaptativo/especialistas),
// vale o meta; senão, o padrão do modelo
function stemsOf(meta) {
  if (Array.isArray(meta?.stems) && meta.stems.length) return meta.stems
  return MODELS[meta?.model]?.stems || []
}

function sessionPayload(key, meta) {
  return {
    key,
    title: meta.title,
    model: meta.model,
    stems: stemsOf(meta),
    stemInfo: meta.stemInfo || null,
    duration: meta.duration,
    analysis: meta.analysis || null,
    polished: meta.polished || {},
    variants: Object.keys(meta.variants || {}),
    // Faixas que nasceram de extração — são as que podem ser refeitas
    extracted: meta.extracted || []
  }
}

function sessionComplete(dir, meta) {
  const stems = stemsOf(meta)
  return stems.length > 0 && stems.every((s) => existsSync(join(dir, 'base', `${s}.flac`)))
}

export function findSession(filePath, model) {
  const key = sessionKeyFor(filePath, model)
  const dir = join(STEMS_DIR, key)
  const meta0 = readMeta(dir)
  if (meta0 && sessionComplete(dir, meta0)) {
    return { key, dir, meta: meta0 }
  }
  // Migra sessões criadas com a chave antiga (baseada em caminho+data).
  // Exceto pro 6 faixas: o pipeline mudou (cascata) e o resultado antigo é inferior.
  if (model === 'htdemucs_6s') return null
  const legacyKey = legacySessionKeyFor(filePath, model)
  const legacyDir = join(STEMS_DIR, legacyKey)
  const legacyMeta = readMeta(legacyDir)
  if (legacyKey !== key && legacyMeta && sessionComplete(legacyDir, legacyMeta)) {
    try {
      renameSync(legacyDir, dir)
      const meta = readMeta(dir)
      meta.key = key
      writeMeta(dir, meta)
      return { key, dir, meta }
    } catch {
      return { key: legacyKey, dir: legacyDir, meta: readMeta(legacyDir) }
    }
  }
  return null
}

function dirSize(dir) {
  let total = 0
  try {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, name.name)
      if (name.isDirectory()) total += dirSize(p)
      else {
        try { total += statSync(p).size } catch {}
      }
    }
  } catch {}
  return total
}

function evictOldSessions(keepKey) {
  let sessions = []
  try {
    sessions = readdirSync(STEMS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const dir = join(STEMS_DIR, d.name)
        const meta = readMeta(dir)
        return { key: d.name, dir, lastUsedAt: meta?.lastUsedAt || '1970', size: dirSize(dir) }
      })
  } catch {
    return
  }
  let total = sessions.reduce((acc, s) => acc + s.size, 0)
  const byOldest = sessions
    .filter((s) => s.key !== keepKey)
    .sort((a, b) => a.lastUsedAt.localeCompare(b.lastUsedAt))
  for (const s of byOldest) {
    if (total <= MAX_CACHE_BYTES) break
    try {
      rmSync(s.dir, { recursive: true, force: true })
      total -= s.size
    } catch {}
  }
}

function run(exe, args, state, onLine, opts = {}) {
  return new Promise((resolve, reject) => {
    if (state.cancelled) return reject(new Error('cancelado'))
    const child = spawn(exe, args, { windowsHide: true, env: opts.env || process.env })
    state.child = child
    let pending = ''
    const feed = (chunk) => {
      pending += chunk.toString()
      const lines = pending.split(/[\r\n]+/)
      pending = lines.pop() || ''
      if (onLine) for (const line of lines) if (line.trim()) onLine(line)
    }
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    child.on('error', reject)
    child.on('close', (code) => {
      state.child = null
      if (pending.trim() && onLine) onLine(pending)
      if (state.cancelled) reject(new Error('cancelado'))
      else if (code === 0) resolve()
      else reject(new Error(`${basename(exe)} saiu com código ${code}`))
    })
  })
}

function runAnalyzer(wavFile, ffmpegPath, state) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [analyzeScriptPath(), ffmpegPath, wavFile], {
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    })
    state.child = child
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    child.on('error', reject)
    child.on('close', (code) => {
      state.child = null
      if (code !== 0) return reject(new Error(err.slice(0, 300) || `analisador saiu com código ${code}`))
      try {
        const lines = out.trim().split('\n')
        resolve(JSON.parse(lines[lines.length - 1]))
      } catch (e) {
        reject(e)
      }
    })
  })
}

// ACORDES: detecta lendo os stems separados — o baixo isolado dá a raiz,
// a harmonia limpa (sem bateria/voz) dá o tipo. Resultado cacheado no meta.
const NON_HARMONIC = new Set([
  'vocals', 'drums', 'bass', 'percussion', 'timpani', 'tambourine',
  'congas', 'triangle', 'bells', 'wind-chimes', 'glockenspiel',
  // solistas de MELODIA não opinam sobre harmonia — nota de passagem
  // vira tempero errado no acorde (a flauta poluía a leitura da Azul)
  'flute', 'harmonica', 'saxophone', 'violin', 'viola', 'cello',
  'trumpet', 'trombone', 'french-horn', 'tuba', 'clarinet', 'oboe',
  'bassoon', 'double-bass', 'dobro'
])
export async function detectChords({ key, ffmpegPath, force = false }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  if (meta.chords && !force) return meta.chords

  const harm = stemsOf(meta)
    .filter((s) => !NON_HARMONIC.has(s))
    .filter((s) => meta.stemInfo?.[s]?.present !== false)
    .map((s) => join(dir, 'base', `${s}.flac`))
    .filter((p) => existsSync(p))
  if (!harm.length) throw new Error('Sem faixas harmônicas nessa sessão.')
  const bassP = join(dir, 'base', 'bass.flac')
  // grade de batidas: a bateria isolada é a referência perfeita
  const drumsP = join(dir, 'base', 'drums.flac')

  const state = {}
  const out = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [chordsScriptPath(), ffmpegPath, existsSync(bassP) ? bassP : '-', existsSync(drumsP) ? drumsP : '-', ...harm],
      { windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
    )
    state.child = child
    let o = ''
    let e = ''
    child.stdout.on('data', (d) => { o += d })
    child.stderr.on('data', (d) => { e += d })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(e.slice(0, 300) || `detector de acordes saiu com código ${code}`))
      try {
        const lines = o.trim().split('\n')
        resolve(JSON.parse(lines[lines.length - 1]))
      } catch (err) {
        reject(err)
      }
    })
  })

  const m2 = readMeta(dir)
  m2.chords = { at: new Date().toISOString(), list: out.chords || [] }
  writeMeta(dir, m2)
  return m2.chords
}

// LETRA: transcrição LOCAL da faixa de voz isolada (whisper.cpp) — o texto
// pode sair com erros de canto; o usuário corrige verso a verso ou cola a
// letra inteira por cima mantendo a sincronização. Zero internet no uso
// (os downloads do binário e do modelo acontecem uma única vez).
const WHISPER_DIR = join(ENGINE_DIR, 'whisper')
const WHISPER_ZIP_URL = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.9.1/whisper-blas-bin-x64.zip'
// large-v3 COMPLETO, quantizado: 1031MB. O turbo (547MB) tem o MESMO encoder —
// o mesmo "ouvido" — mas com o decoder podado de 32 para 4 camadas, e é
// justamente o decoder que resolve som ambíguo. Por isso o turbo errava sempre
// igual: "Batifica pé a" no lugar de "Beatifica-me a", "o maio" no lugar de
// "o mar e o". Medido contra a letra oficial da Azul, cruzada em 6 fontes:
// turbo 82,6% de acerto de palavra, large-v3 86,0%. Custa 1,7x o tempo e
// 2,0 GB de RAM (medido). O modelo antigo é apagado do disco sozinho.
const WHISPER_MODEL = 'ggml-large-v3-q5_0.bin'
const WHISPER_MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${WHISPER_MODEL}`
// o preset do -dtw TEM que casar com o modelo (grafia com ponto)
const WHISPER_DTW = 'large.v3'
// modelos de versões anteriores do MPTrix — apagados pra não ocupar disco à toa
const WHISPER_MODELOS_VELHOS = ['ggml-small.bin', 'ggml-large-v3-turbo-q5_0.bin']

function findWhisperExe() {
  if (!existsSync(WHISPER_DIR)) return null
  // ATENÇÃO: nas versões novas o "main.exe" é só um aviso de aposentadoria que
  // sai com erro — o binário de verdade é o whisper-cli.exe. Procura ele
  // primeiro; main.exe fica só como socorro pra pacotes antigos.
  const scan = (d, name) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name)
      if (f.isDirectory()) {
        const r = scan(p, name)
        if (r) return r
      } else if (f.name.toLowerCase() === name) {
        return p
      }
    }
    return null
  }
  return scan(WHISPER_DIR, 'whisper-cli.exe') || scan(WHISPER_DIR, 'main.exe')
}

async function ensureWhisper() {
  mkdirSync(WHISPER_DIR, { recursive: true })
  let exe = findWhisperExe()
  if (!exe) {
    const zip = join(WHISPER_DIR, 'whisper.zip')
    await downloadFile(WHISPER_ZIP_URL, zip)
    await new Promise((resolve, reject) => {
      // o tar do Windows 10+ descompacta zip — sem dependência nova
      const c = spawn('tar', ['-xf', zip, '-C', WHISPER_DIR], { windowsHide: true })
      c.on('error', reject)
      c.on('close', (code) => (code === 0 ? resolve() : reject(new Error('extração do whisper falhou'))))
    })
    rmSync(zip, { force: true })
    exe = findWhisperExe()
    if (!exe) throw new Error('Binário do whisper não encontrado após a extração.')
  }
  const model = join(WHISPER_DIR, WHISPER_MODEL)
  if (!existsSync(model)) {
    await downloadFile(WHISPER_MODEL_URL, model)
  }
  // modelo antigo só ocupa disco depois que o novo chegou inteiro
  for (const velho of WHISPER_MODELOS_VELHOS) {
    const p = join(WHISPER_DIR, velho)
    if (existsSync(p)) { try { rmSync(p, { force: true }) } catch {} }
  }
  return { exe, model }
}

// Envelope fino da voz (RMS a cada 25ms) — é a régua pra saber onde tem canto.
// Normaliza pelo percentil 95, não pelo pico: um grito solto no refrão não pode
// achatar a música inteira e derrubar os limiares.
async function vocalEnvelope(flac, ffmpegPath, hop = 0.025) {
  const SR = 8000
  const raw = await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-v', 'quiet', '-i', flac, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { windowsHide: true })
    const chunks = []
    child.stdout.on('data', (d) => chunks.push(d))
    child.on('error', reject)
    child.on('close', () => resolve(Buffer.concat(chunks)))
  })
  const n = Math.floor(raw.length / 2)
  const per = Math.max(1, Math.round(SR * hop))
  const data = []
  for (let s = 0; s + per <= n; s += per) {
    let sum = 0
    let c = 0
    for (let k = 0; k < per; k++) {
      const v = raw.readInt16LE((s + k) * 2) / 32768
      sum += v * v
      c++
    }
    data.push(Math.sqrt(sum / Math.max(1, c)))
  }
  if (!data.length) return { hop, data }
  const sorted = [...data].sort((a, b) => a - b)
  const ref = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1] || 1
  return { hop, data: data.map((v) => Math.min(1.5, v / ref)) }
}

// Onde tem voz de verdade: histerese (entra alto, só sai quando cai bem) e
// junta o que estiver separado por menos de 120ms — respiro no meio da frase
// não é fim de frase.
function voiceRegions(data, hop, HI = 0.18, LO = 0.07, MIN = 0.12) {
  const out = []
  let on = false
  let start = 0
  for (let i = 0; i < data.length; i++) {
    if (!on && data[i] >= HI) {
      on = true
      let j = i
      while (j > 0 && data[j - 1] >= LO) j--
      start = j
    } else if (on && data[i] < LO) {
      on = false
      if ((i - start) * hop >= MIN) out.push([start * hop, i * hop])
    }
  }
  if (on) out.push([start * hop, data.length * hop])
  const merged = []
  for (const r of out) {
    const last = merged[merged.length - 1]
    if (last && r[0] - last[1] < 0.12) last[1] = r[1]
    else merged.push([r[0], r[1]])
  }
  return merged
}

// O dicionário pt-BR (VERO, LGPL/MPL) fica embarcado — o app é 100% offline.
// Carrega uma vez só: são 312 mil radicais e leva meio segundo.
let LEXICO = undefined
function carregarLexicoUmaVez() {
  if (LEXICO !== undefined) return LEXICO
  try {
    const base = app.isPackaged
      ? join(process.resourcesPath, 'lexico')
      : join(__dirname, '../../resources/lexico')
    LEXICO = existsSync(join(base, 'pt-BR.dic')) ? carregarLexico(base) : null
  } catch {
    LEXICO = null
  }
  return LEXICO
}

// Sobe quando o encaixe muda. Letra gravada com versão antiga se refaz sozinha
// na primeira abertura — o usuário não tem que pedir nem saber que existiu.
const LYRICS_V = 7

export async function transcribeLyrics({ key, ffmpegPath, force = false, onProgress }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  // letra corrigida à mão é do usuário: nunca se refaz por cima dela
  if (meta.lyrics && !force && (meta.lyrics.edited || meta.lyrics.v === LYRICS_V)) return meta.lyrics
  const vocals = join(dir, 'base', 'vocals.flac')
  if (!existsSync(vocals)) throw new Error('Faixa de voz não encontrada nessa sessão.')

  const { exe, model } = await ensureWhisper()
  const wav = join(dir, 'lyrics_in.wav')
  await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', vocals, '-ac', '1', '-ar', '16000', wav], {})
  const outBase = join(dir, 'lyrics_out')
  try {
    await new Promise((resolve, reject) => {
      const threads = freeMemMB() > 3072 ? '6' : '4'
      const child = spawn(
        exe,
        // -ojf: JSON completo com o tempo de CADA palavra — é daqui que sai o
        // karaokê.
        // -dtw small + -nfa: alinhamento DTW de verdade (casa o token com o
        // áudio pela atenção do modelo, não por heurística). O -nfa é
        // OBRIGATÓRIO: o flash attention vem ligado por padrão e o próprio
        // whisper avisa "dtw_token_timestamps is not supported with flash_attn
        // - disabling" — era por isso que t_dtw voltava -1 em todos os tokens.
        // Medido: palavras erradas por mais de 300ms caem de 11% para 5%.
        // -mc 0: NÃO carrega o texto de um bloco pro seguinte. Numa faixa de voz
        // isolada os 30s iniciais costumam ser instrumental; com contexto o
        // modelo se prende ao próprio erro e transcreve a música inteira como
        // "[silêncio]" (aconteceu de verdade num teste). -sns cala os tokens de
        // não-fala pelo mesmo motivo.
        ['-m', model, '-l', 'pt', '-f', wav, '-oj', '-ojf', '-dtw', WHISPER_DTW, '-nfa',
          '-mc', '0', '-sns', '-of', outBase, '-t', threads, '-pp'],
        { windowsHide: true }
      )
      let err = ''
      // o whisper imprime o progresso no stderr — vira barra na tela
      child.stderr.on('data', (d) => {
        const s = String(d)
        err += s
        const m = s.match(/progress\s*=\s*(\d+)%/)
        if (m) onProgress?.({ percent: Number(m[1]) })
      })
      child.on('error', reject)
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300) || `whisper saiu com código ${code}`))))
    })
    const j = JSON.parse(readFileSync(`${outBase}.json`, 'utf8'))

    // O whisper entrega "versos" que na verdade são blocões de 15 a 25 segundos
    // (várias frases grudadas), mas o tempo de cada PALAVRA dentro deles é bom —
    // medido: 84% já cai em cima da voz, erro médio de 85ms. Cada palavra guarda
    // de qual SEGMENTO do whisper ela veio — com o modelo large-v3-turbo esses
    // segmentos já são os versos da letra, um por linha.
    const words = []
    let iSeg = -1
    for (const s of j.transcription || []) {
      iSeg++
      let cur = null
      for (const tk of s.tokens || []) {
        const raw = tk.text || ''
        // [_BEG_] e afins são marcas internas do modelo, não letra
        if (!raw.trim() || /^\[.*\]$/.test(raw.trim())) continue
        // t_dtw vem em CENTÉSIMOS de segundo (offsets vêm em milésimos) e vale
        // -1 quando o alinhamento não fechou naquele token — aí cai no offset.
        const wt1 = (tk.offsets?.to ?? 0) / 1000
        const wt0 = tk.t_dtw >= 0 ? tk.t_dtw / 100 : (tk.offsets?.from ?? 0) / 1000
        // a confiança do modelo em cada palavra é o que decide, mais adiante,
        // qual versão vale quando a mesma frase é cantada de novo
        const pp = typeof tk.p === 'number' ? tk.p : 0.5
        if (cur && !raw.startsWith(' ')) {
          cur.text += raw
          cur.t1 = wt1
          cur.ps += pp
          cur.pn++
        } else {
          cur = { t0: wt0, t1: wt1, text: raw.trim(), ps: pp, pn: 1, seg: iSeg }
          words.push(cur)
        }
      }
    }
    // quando o modelo trava repetindo uma sílaba ("Tudududu...") os pedaços vêm
    // sem espaço e viram uma "palavra" de centenas de letras — isso não é letra
    for (let i = words.length - 1; i >= 0; i--) if (words[i].text.length > 28) words.splice(i, 1)
    // anotações tipo [MÚSICA DE FUNDO] chegam partidas em várias palavras —
    // varre pra frente e só apaga quando o par abre/fecha realmente existe
    for (let i = 0; i < words.length; i++) {
      if (!/^\[/.test(words[i].text)) continue
      let fim = -1
      for (let k = i; k < Math.min(words.length, i + 8); k++) {
        if (/\]$/.test(words[k].text)) { fim = k; break }
      }
      if (fim < 0) continue
      words.splice(i, fim - i + 1)
      i--
    }

    // ENCAIXE POR FRASE: a voz isolada diz exatamente onde tem canto e onde tem
    // silêncio. Cada palavra é atribuída à frase cantada mais próxima, na ordem.
    // Frase cujas palavras já caíram todas em cima da voz não é tocada — o tempo
    // do whisper ali é melhor que qualquer chute meu. Só quando ele amontoa
    // palavras no instrumental (o clássico "a letra entra antes do cantor") é
    // que a frase inteira é reencaixada, preservando o espaçamento relativo.
    let env = null
    let frases = []
    try {
      env = await vocalEnvelope(vocals, ffmpegPath)
      const regions = env?.data?.length ? voiceRegions(env.data, env.hop) : []
      // frase cantada = região de voz; respiro de até 280ms não parte a frase.
      // É ISSO que vira verso lá embaixo — a frase que o cantor canta.
      for (const r of regions) {
        const last = frases[frases.length - 1]
        if (last && r[0] - last[1] < 0.28) last[1] = r[1]
        else frases.push([r[0], r[1]])
      }
      if (frases.length >= 2 && words.length) {
        const distF = (t, [a, b]) => (t < a ? a - t : t > b ? t - b : 0)
        const distVoz = (t) => {
          let bd = Infinity
          for (const f of frases) { const d = distF(t, f); if (d < bd) bd = d }
          return bd
        }
        // ALUCINAÇÃO: em solo instrumental longo a faixa de voz fica muda e o
        // whisper "preenche" repetindo o refrão. Uma palavra solta longe da voz
        // é só atraso da IA; uma FILA de palavras no vazio é invenção — some.
        const lixo = []
        for (let i = 0; i < words.length; i++) {
          if (distVoz(words[i].t0) <= 2.5) continue
          let j = i
          while (j + 1 < words.length && distVoz(words[j + 1].t0) > 2.5) j++
          if (j - i + 1 >= 3 || words[j].t0 - words[i].t0 >= 3) {
            for (let k = i; k <= j; k++) lixo.push(k)
          }
          i = j
        }
        // se "sobrar" quase nada, quem está errado é a régua e não a letra
        if (lixo.length && lixo.length < words.length * 0.5) {
          for (let k = lixo.length - 1; k >= 0; k--) words.splice(lixo[k], 1)
        }
        const dono = words.map((w) => {
          let best = 0
          let bd = Infinity
          for (let k = 0; k < frases.length; k++) {
            const d = distF(w.t0, frases[k])
            if (d < bd) { bd = d; best = k }
          }
          return bd > 8 ? -1 : best
        })
        // ordem: uma palavra nunca volta pra uma frase anterior à da vizinha
        let ult = -1
        for (let i = 0; i < dono.length; i++) {
          if (dono[i] < 0) continue
          if (dono[i] < ult) dono[i] = ult
          else ult = dono[i]
        }
        let i = 0
        while (i < words.length) {
          const f = dono[i]
          if (f < 0) { i++; continue }
          let j = i
          while (j + 1 < words.length && dono[j + 1] === f) j++
          const [a, b] = frases[f]
          const grupo = words.slice(i, j + 1)
          const fora = grupo.some((w) => w.t0 < a - 0.15 || w.t0 > b + 0.15)
          if (fora) {
            const p0 = grupo[0].t0
            const span = Math.max(0.001, grupo[grupo.length - 1].t0 - p0)
            // guarda um pedaço do fim da frase pra última palavra respirar
            const util = Math.max(0.2, (b - a) * 0.85)
            for (const w of grupo) {
              const novo = a + ((w.t0 - p0) / span) * util
              w.t1 += novo - w.t0
              w.t0 = novo
            }
          }
          i = j + 1
        }
      }
    } catch {}
    for (let i = 1; i < words.length; i++) {
      if (words[i].t0 < words[i - 1].t0 + 0.04) words[i].t0 = words[i - 1].t0 + 0.04
    }

    // VERSOS: o large-v3-turbo já entrega UM VERSO POR SEGMENTO — a máquina de
    // corte que existia aqui foi construída pro modelo small, que devolvia
    // blocões de 25 segundos com várias frases grudadas. Agora o corte do
    // próprio modelo é melhor que qualquer regra minha, então ele manda; o que
    // sobrou é conserto de borda: verso comprido demais quebra, caco de uma
    // palavra gruda no vizinho.
    const MAXC = 46
    const MAXDUR = 6.5
    const MAIUSC = (t) => /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(t)
    const PONTO = (t) => /[.,;:!?]$/.test(t)
    const semPonto = (t) => t.replace(/[.,;:!?]+$/, '')
    const LIGACAO = new Set(['me', 'te', 'se', 'lhe', 'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das',
      'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'que', 'com', 'por', 'pro', 'pra', 'para', 'ao', 'à',
      'meu', 'teu', 'seu', 'minha', 'tua', 'sua', 'mais', 'muito', 'já', 'ó', 'num', 'numa'])

    let grupos = []
    for (const w of words) {
      const ult = grupos[grupos.length - 1]
      if (ult && ult[0].seg === w.seg) ult.push(w)
      else grupos.push([w])
    }

    // verso comprido (o modelo emendou duas frases) quebra no vale de energia
    const quebrar = (g) => {
      const txt = g.map((w) => w.text).join(' ')
      const dur = g[g.length - 1].t0 - g[0].t0
      if ((txt.length <= MAXC && dur <= MAXDUR) || g.length < 4) return [g]
      const meio = g.length / 2
      let best = -1
      let bestP = -Infinity
      for (let k = 1; k <= g.length - 1; k++) {
        let pz = 0
        if (MAIUSC(g[k].text)) pz += 2
        if (PONTO(g[k - 1].text)) pz += 2
        if (env?.data?.length) {
          const a = Math.round(g[k - 1].t0 / env.hop)
          const b = Math.round(g[k].t0 / env.hop)
          let vale = 1
          for (let x = a; x <= b && x < env.data.length; x++) vale = Math.min(vale, env.data[x])
          pz += (1 - Math.min(1, vale / 0.2)) * 2
        }
        pz -= Math.abs(k - meio) / g.length
        if (k === 1 || k === g.length - 1) pz -= 1.2
        if (LIGACAO.has(semPonto(g[k - 1].text).toLowerCase())) pz -= 2.5
        if (pz > bestP) { bestP = pz; best = k }
      }
      if (best < 1) return [g]
      return [...quebrar(g.slice(0, best)), ...quebrar(g.slice(best))]
    }
    grupos = grupos.flatMap(quebrar)

    // caco de uma palavra gruda no vizinho mais perto
    for (let g = 0; g < grupos.length; g++) {
      if (grupos[g].length > 1) continue
      const cabe = (x) => x && x.map((w) => w.text).join(' ').length + grupos[g][0].text.length + 1 <= MAXC + 6
      const antes = grupos[g - 1]
      const depois = grupos[g + 1]
      const dAntes = antes ? grupos[g][0].t0 - antes[antes.length - 1].t0 : Infinity
      const dDepois = depois ? depois[0].t0 - grupos[g][0].t0 : Infinity
      if (dAntes <= dDepois && cabe(antes)) { antes.push(...grupos.splice(g, 1)[0]); g-- }
      else if (depois && cabe(depois)) { depois.unshift(...grupos.splice(g, 1)[0]); g-- }
    }

    const segments = grupos
      .filter((g) => g.length)
      .map((g) => ({ t0: g[0].t0, t1: g[g.length - 1].t1, text: g.map((w) => w.text).join(' '), words: g }))
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]
      const nx = segments[i + 1]
      const last = s.words[s.words.length - 1]
      s.t1 = Math.max(last.t1 || last.t0 + 0.3, last.t0 + 0.3)
      if (nx && s.t1 > nx.t0) s.t1 = nx.t0
      // a palavra fica acesa até a próxima entrar — canto segurado não apaga.
      // A ÚLTIMA apaga quando a voz para: o verso continua na tela durante o
      // instrumental, mas ninguém fica brilhando sem estar sendo cantado.
      let fimDaVoz = s.t1
      for (const [a, b] of frases) if (last.t0 >= a - 0.15 && last.t0 <= b + 0.15) { fimDaVoz = b; break }
      for (let k = 0; k < s.words.length; k++) {
        const w = s.words[k]
        const wn = s.words[k + 1]
        w.t1 = wn ? wn.t0 : Math.min(s.t1, Math.max(fimDaVoz, w.t0 + 0.25))
        if (w.t1 <= w.t0) w.t1 = w.t0 + 0.15
      }
    }

    // O modelo foi treinado em vídeo legendado e às vezes inventa crédito de
    // legendador ou pedido de inscrição no canal. Não é letra, e numa letra
    // que a pessoa vai copiar e mandar pro amigo isso é constrangedor.
    const LIXO = [
      /legenda(s|do)?\s+(por|pela|pelo)/i, /amara\.org/i, /subtitle|subtitulo|caption/i,
      /inscreva-se/i, /obrigado por (assistir|ver)/i, /www\.|https?:/i,
      /^\s*(legendas?|tradu(ç|c)(ã|a)o)\s*[:\-]/i
    ]
    for (let i = segments.length - 1; i >= 0; i--) {
      if (LIXO.some((r) => r.test(segments[i].text))) segments.splice(i, 1)
    }

    unificarRepeticoes(segments)
    // CORRETOR DE PALAVRA INEXISTENTE: só toca no que NÃO é português. Medido
    // em 3 músicas: das 1065 palavras, 7 não existiam no dicionário e 3 foram
    // trocadas — 2 melhoraram ("Batifica" → "Beatifica"), 1 neutra, nenhuma
    // piorou. Prêmio pequeno de propósito: palavra que existe não se toca.
    try {
      const lex = carregarLexicoUmaVez()
      if (lex) {
        const r = corrigirVersos(segments, lex)
        segments.length = 0
        segments.push(...r.segments)
      }
    } catch {}
    marcarEstrofes(segments)
    for (const s of segments) {
      // ponto no meio do verso seguido de minúscula ("azulzinho. sim") é sobra
      // da junção de duas voltas — em letra pra ler, isso fica feio
      for (let k = 0; k < s.words.length - 1; k++) {
        if (/[.!?]$/.test(s.words[k].text) && /^[a-zà-ÿ]/.test(s.words[k + 1].text)) {
          s.words[k].text = s.words[k].text.replace(/[.!?]+$/, '')
        }
      }
      // letra é texto pra ler: cada verso começa com maiúscula
      const w0 = s.words[0]
      if (w0?.text) w0.text = w0.text.charAt(0).toUpperCase() + w0.text.slice(1)
      s.text = s.words.map((w) => w.text).join(' ')
      for (const w of s.words) { delete w.ps; delete w.pn; delete w.seg }
    }

    const m2 = readMeta(dir)
    m2.lyrics = { at: new Date().toISOString(), v: LYRICS_V, segments, edited: false }
    writeMeta(dir, m2)
    return m2.lyrics
  } finally {
    rmSync(wav, { force: true })
    rmSync(`${outBase}.json`, { force: true })
  }
}

// REPETIÇÃO: cada bloco de 30s é transcrito do zero (sem contexto, senão o
// modelo entra em loop no instrumental), então o refrão sai escrito diferente a
// cada volta. Aqui as voltas são reconhecidas e todas adotam a mesma versão.
//
// O reconhecimento é por SEÇÃO, não por linha: duas linhas parecidas soltas não
// provam nada (a música tem versos vizinhos parecidos de propósito — "Do céu
// ficar azul" e "Do céu ferver o azul"), mas uma SEQUÊNCIA de linhas parecidas
// na mesma ordem só pode ser o refrão voltando.
const repNorm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function repDistancia(a, b) {
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    ant = cur
  }
  return ant[b.length]
}

function repParecido(t1, t2) {
  const a = repNorm(t1).split(' ')
  const b = repNorm(t2).split(' ')
  return 1 - repDistancia(a, b) / Math.max(1, Math.max(a.length, b.length))
}

// Quais versos são A MESMA FRASE voltando. Devolve, pra cada verso, o número do
// seu grupo (ou -1 se ele não se repete). É a peça que permite corrigir um verso
// e o conserto valer nas outras voltas SEM sair trocando texto igual pela
// música — que é onde estaria o perigo de destruir um verso que só PARECE igual.
export function gruposDeRepeticao(segments) {
  const n = segments.length
  const solto = new Array(n).fill(-1)
  if (n < 6) return solto
  const LIM = 0.34   // parecença mínima entre duas linhas
  const CORRIDA = 3  // linhas seguidas parecidas pra valer como seção repetida
  const T = segments.map((s) => s.text)
  const pai = Array.from({ length: n }, (_, i) => i)
  const acha = (x) => (pai[x] === x ? x : (pai[x] = acha(pai[x])))
  for (let d = 2; d < n; d++) {
    let i = 0
    while (i + d < n) {
      if (repParecido(T[i], T[i + d]) < LIM) { i++; continue }
      let j = i
      while (j + 1 + d < n && repParecido(T[j + 1], T[j + 1 + d]) >= LIM) j++
      if (j - i + 1 >= CORRIDA) for (let k = i; k <= j; k++) pai[acha(k)] = acha(k + d)
      i = j + 1
    }
  }
  const conta = new Map()
  for (let i = 0; i < n; i++) {
    const r = acha(i)
    conta.set(r, (conta.get(r) || 0) + 1)
  }
  const numero = new Map()
  for (let i = 0; i < n; i++) {
    const r = acha(i)
    if (conta.get(r) < 2) continue
    if (!numero.has(r)) numero.set(r, numero.size)
    solto[i] = numero.get(r)
  }
  return solto
}

export function unificarRepeticoes(segments) {
  const n = segments.length
  if (n < 6) return segments
  const marca = gruposDeRepeticao(segments)
  const grupos = new Map()
  for (let i = 0; i < n; i++) {
    if (marca[i] < 0) continue
    if (!grupos.has(marca[i])) grupos.set(marca[i], [])
    grupos.get(marca[i]).push(i)
  }
  for (const g of grupos.values()) {
    if (g.length < 2) continue
    // com 3 voltas ou mais dá pra ter MAIORIA de verdade palavra a palavra.
    // Com duas, voto nenhum decide nada: aí vale a linha inteira que o modelo
    // ouviu melhor — e, em empate técnico, a mais completa.
    const textos = g.length >= 3
      ? votarPalavras(g.map((i) => segments[i].words))
      : melhorLinha(g.map((i) => segments[i].words))
    for (const i of g) {
      segments[i].words = repalavrar(segments[i], textos)
      segments[i].text = segments[i].words.map((w) => w.text).join(' ')
    }
  }
  return segments
}

function melhorLinha(versoes) {
  const media = (ws) => ws.reduce((a, w) => a + (w.pn ? w.ps / w.pn : 0.5), 0) / Math.max(1, ws.length)
  const conf = versoes.map(media)
  const topo = Math.max(...conf)
  let melhor = versoes[0]
  let nota = -1
  for (let k = 0; k < versoes.length; k++) {
    if (conf[k] < topo - 0.08) continue
    const n = versoes[k].length * 100 + conf[k]
    if (n > nota) { nota = n; melhor = versoes[k] }
  }
  return melhor.map((w) => w.text)
}

// VOTO PALAVRA A PALAVRA entre as voltas. Escolher a melhor LINHA inteira joga
// fora o acerto das outras: se o refrão foi ouvido 4 vezes e 3 delas trazem
// "dizer", a maioria tem que ganhar mesmo que a 4ª ("descer") seja a linha em
// que o modelo estava mais confiante no geral.
function votarPalavras(versoes) {
  const conf = (w) => (w.pn ? w.ps / w.pn : 0.5)
  // molde = a volta mais completa; as outras são alinhadas contra ela
  let molde = versoes[0]
  for (const v of versoes) if (v.length > molde.length) molde = v
  const chave = (ws) => ws.map((w) => repNorm(w.text))
  const km = chave(molde)
  const urnas = molde.map(() => new Map())
  // a urna agrupa pela palavra "nua" (sem acento, sem pontuação, sem maiúscula)
  // e guarda as grafias exatas — assim "cedinho" e "cedinho," não brigam entre
  // si, e no fim sai a grafia que mais apareceu
  const votar = (urna, w) => {
    const k = repNorm(w.text)
    const u = urna.get(k) || { n: 0, c: 0, grafias: new Map() }
    u.n++
    u.c += conf(w)
    u.grafias.set(w.text, (u.grafias.get(w.text) || 0) + 1)
    urna.set(k, u)
  }
  for (const v of versoes) {
    if (v === molde) { molde.forEach((w, i) => votar(urnas[i], w)); continue }
    for (const [im, iv] of alinharPalavras(km, chave(v))) {
      if (im != null && iv != null) votar(urnas[im], v[iv])
    }
  }
  // palavra que só apareceu na minoria das voltas não é letra — é sobra de uma
  // passagem só (foi assim que um "Obrigado!" do fim do show entrou no refrão)
  const minimo = Math.ceil(versoes.length / 2)
  const saida = []
  for (let i = 0; i < urnas.length; i++) {
    let melhor = null
    let total = 0
    for (const u of urnas[i].values()) {
      total += u.n
      if (!melhor || u.n > melhor.n || (u.n === melhor.n && u.c > melhor.c)) melhor = u
    }
    if (!melhor || total < minimo) continue
    let grafia = molde[i].text
    let g = -1
    for (const [texto, n] of melhor.grafias) if (n > g) { g = n; grafia = texto }
    saida.push(grafia)
  }
  return saida.length ? saida : molde.map((w) => w.text)
}

// Alinhamento de duas sequências de palavras (Needleman-Wunsch) — devolve os
// pares de índices que se correspondem, tolerando palavra a mais ou a menos.
function alinharPalavras(a, b) {
  const n = a.length
  const m = b.length
  const BURACO = -1
  const IGUAL = 1
  const DIF = -0.6
  const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  for (let i = 1; i <= n; i++) S[i][0] = i * BURACO
  for (let j = 1; j <= m; j++) S[0][j] = j * BURACO
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const par = a[i - 1] === b[j - 1] ? IGUAL : DIF
      S[i][j] = Math.max(S[i - 1][j - 1] + par, S[i - 1][j] + BURACO, S[i][j - 1] + BURACO)
    }
  }
  const out = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const par = i > 0 && j > 0 ? (a[i - 1] === b[j - 1] ? IGUAL : DIF) : 0
    if (i > 0 && j > 0 && S[i][j] === S[i - 1][j - 1] + par) { out.push([i - 1, j - 1]); i--; j-- }
    else if (i > 0 && S[i][j] === S[i - 1][j] + BURACO) { out.push([i - 1, null]); i-- }
    else { out.push([null, j - 1]); j-- }
  }
  return out.reverse()
}

// Troca o texto de um verso mantendo os instantes medidos. Se o número de
// palavras bate, é troca seca (tempo intacto); se não, as palavras novas são
// espalhadas pelas entradas de voz que já existiam.
function repalavrar(seg, textos) {
  const velhas = seg.words
  if (textos.length === velhas.length) {
    velhas.forEach((w, i) => { w.text = textos[i] })
    return velhas
  }
  const t0 = velhas[0].t0
  const t1 = Math.max(seg.t1, t0 + 0.4)
  const novas = textos.map((text, i) => {
    let inicio
    if (velhas.length >= 2 && textos.length >= 2) {
      inicio = velhas[Math.round((i * (velhas.length - 1)) / (textos.length - 1))].t0
    } else if (velhas.length === 1 && i === 0) {
      inicio = velhas[0].t0
    } else {
      inicio = t0 + ((t1 - t0) * i) / textos.length
    }
    return { t0: inicio, t1: inicio, text, ps: 0.5, pn: 1 }
  })
  for (let i = 1; i < novas.length; i++) {
    if (novas[i].t0 < novas[i - 1].t0 + 0.08) novas[i].t0 = novas[i - 1].t0 + 0.08
  }
  for (let i = 0; i < novas.length; i++) {
    novas[i].t1 = i + 1 < novas.length ? novas[i + 1].t0 : Math.max(t1, novas[i].t0 + 0.2)
  }
  return novas
}

// ESTROFES: bloco de versos separado por respiro musical. É o que transforma a
// pilha de linhas em letra de encarte — e é a quebra que vai pro texto copiado.
export function marcarEstrofes(segments) {
  const vaos = []
  for (let i = 1; i < segments.length; i++) {
    const v = segments[i].t0 - segments[i - 1].t1
    if (v > 0) vaos.push(v)
  }
  vaos.sort((a, b) => a - b)
  const med = vaos[Math.floor(vaos.length / 2)] || 0.5
  const LIM = Math.max(1.4, med * 2.4)
  for (let i = 1; i < segments.length; i++) {
    segments[i].estrofe = segments[i].t0 - segments[i - 1].t1 >= LIM
  }
  if (segments.length) segments[0].estrofe = false
  return segments
}

// Correções do usuário (verso editado ou letra colada) — o texto é dele,
// a sincronização continua a calculada
export function saveLyrics({ key, segments }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  // Na PRIMEIRA correção, guarda a letra como o sistema entregou. É o que
  // permite voltar atrás depois — sem isso a correção é via de mão única, e
  // uma troca infeliz vira perda definitiva do que a máquina tinha acertado.
  // guarda o estado ANTERIOR a esta gravação; na primeira vez isso é
  // exatamente a letra automática, que é o ponto de retorno que interessa
  const original = meta.lyrics?.original || meta.lyrics?.segments
  // se a pessoa desfez tudo, o rótulo volta a ser AUTOMÁTICA
  const igual = original && JSON.stringify(original) === JSON.stringify(segments)
  meta.lyrics = {
    ...(meta.lyrics || {}),
    segments,
    original: original || undefined,
    edited: !igual,
    at: new Date().toISOString()
  }
  writeMeta(dir, meta)
  return meta.lyrics
}

// Retorna a sessão pronta do cache (ou null) — resposta síncrona, sem corrida de eventos
export function getCachedSession(filePath, model = 'htdemucs') {
  const found = findSession(filePath, model)
  if (!found) return null
  touchSession(found.dir)
  return sessionPayload(found.key, readMeta(found.dir))
}

export function startStudioJob({ inputFile, model = 'htdemucs', title, ffmpegPath, onProgress, onStatus }) {
  const id = randomUUID()
  const state = { cancelled: false, child: null }

  ;(async () => {
    await new Promise((r) => setTimeout(r, 250))
    try {
      if (!MODELS[model]) throw new Error(`Modelo desconhecido: ${model}`)
      const engine = getEngineStatus()
      if (!engine.ok) {
        onStatus({ id, state: 'error', error: 'engine-missing', engine })
        return
      }

      const cached = findSession(inputFile, model)
      if (cached) {
        touchSession(cached.dir)
        onStatus({ id, state: 'done', session: sessionPayload(cached.key, readMeta(cached.dir)) })
        return
      }

      const key = sessionKeyFor(inputFile, model)
      const dir = join(STEMS_DIR, key)
      mkdirSync(join(dir, 'base'), { recursive: true })

      // 1. Normaliza a entrada pra WAV 44.1kHz estéreo (aceita qualquer formato que o ffmpeg leia)
      onProgress({ id, stage: 'preparing', percent: null })
      const srcWav = join(dir, `${key}.wav`)
      let duration = 0
      await run(ffmpegPath, ['-y', '-loglevel', 'info', '-i', inputFile, '-vn', '-ac', '2', '-ar', '44100', srcWav], state, (line) => {
        const m = line.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/)
        if (m) duration = Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3])
      })

      // 2. Tom e BPM (rápido, roda antes da separação pra não competir por memória)
      onProgress({ id, stage: 'analyzing', percent: null })
      let analysis = null
      try {
        analysis = await runAnalyzer(srcWav, ffmpegPath, state)
      } catch (err) {
        if (state.cancelled) throw err
        analysis = null
      }

      // 3. Separação com Demucs
      // --segment menor + menos threads = pico de RAM bem mais baixo (máquinas de 6-8GB)
      const workDir = join(dir, 'work')
      // Com memória sobrando usa todos os núcleos; apertada, segura em 4 threads
      const threads = freemem() > 3 * 1024 * 1024 * 1024 ? '6' : '4'
      const demucsEnv = { env: { ...process.env, OMP_NUM_THREADS: threads, MKL_NUM_THREADS: threads } }
      const runDemucs = (modelName, inputWav, pctBase, pctSpan) => {
        // htdemucs_ft é um "saco" de 4 IAs em sequência — cada uma imprime sua
        // própria barra 0→100. Sem contar as passadas, o placar chega em 99%
        // na 1ª IA e congela lá enquanto as outras 3 ainda trabalham.
        const passes = MODELS[modelName]?.bag || 1
        let passDone = 0
        let lastRaw = 0
        return run(
          PYTHON_PATH,
          ['-m', 'demucs', '-n', modelName, '-d', 'cpu', '--segment', '6', '-o', workDir, inputWav],
          state,
          (line) => {
            const isDownload = /[0-9.]+\s*[kMG]?B\/s/i.test(line)
            const m = line.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/)
            if (!m) return
            const raw = Math.max(0, Math.min(100, (parseFloat(m[1]) / parseFloat(m[2])) * 100))
            if (isDownload) {
              // Download dos modelos: barra própria, não conta como passada
              onProgress({ id, stage: 'downloading-model', percent: Math.round(pctBase + (raw * pctSpan) / 100) })
              return
            }
            // Barra despencou = a IA anterior acabou e a próxima começou do zero
            if (raw < lastRaw - 50) passDone = Math.min(passDone + 1, passes - 1)
            lastRaw = raw
            const percent = Math.round(pctBase + (((passDone + raw / 100) / passes) * pctSpan))
            onProgress({
              id,
              stage: 'separating',
              percent,
              pass: passes > 1 ? { current: passDone + 1, total: passes } : undefined
            })
          },
          demucsEnv
        )
      }

      onProgress({ id, stage: 'separating', percent: 0 })
      const rawPaths = {}
      if (model === 'quick') {
        // Edição rápida: sem separação — a música inteira vira uma faixa única
        rawPaths.song = srcWav
      } else if (model === 'htdemucs_6s') {
        // Modo cascata: voz/bateria/baixo vêm do modelo de 4 faixas (mais limpo);
        // o stem "outros" passa pelo modelo de 6 só pra extrair guitarra e piano.
        await runDemucs('htdemucs', srcWav, 0, 50)
        const p1 = join(workDir, 'htdemucs', key)
        await runDemucs('htdemucs_6s', join(p1, 'other.wav'), 50, 50)
        const p2 = join(workDir, 'htdemucs_6s', 'other')
        // O que a 2ª passada "vazou" pra voz/bateria/baixo volta pro "outros",
        // pra nenhum som da música se perder
        const mergedOther = join(workDir, 'other_merged.wav')
        await run(ffmpegPath, [
          '-y', '-loglevel', 'error',
          '-i', join(p2, 'other.wav'),
          '-i', join(p2, 'vocals.wav'),
          '-i', join(p2, 'drums.wav'),
          '-i', join(p2, 'bass.wav'),
          '-filter_complex', 'amix=inputs=4:normalize=0',
          '-ar', '44100', mergedOther
        ], state)
        rawPaths.vocals = join(p1, 'vocals.wav')
        rawPaths.drums = join(p1, 'drums.wav')
        rawPaths.bass = join(p1, 'bass.wav')
        rawPaths.guitar = join(p2, 'guitar.wav')
        rawPaths.piano = join(p2, 'piano.wav')
        rawPaths.other = mergedOther
      } else {
        await runDemucs(model, srcWav, 0, 100)
        const p1 = join(workDir, model, key)
        for (const stem of MODELS[model].stems) {
          rawPaths[stem] = join(p1, `${stem}.wav`)
        }
      }

      // 4. Converte os stems pra FLAC e mede o nível de cada um — faixa
      //    praticamente silenciosa = instrumento não existe nessa música
      onProgress({ id, stage: 'converting', percent: null })
      const stemInfo = {}
      for (const stem of MODELS[model].stems) {
        const flacPath = join(dir, 'base', `${stem}.flac`)
        await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', rawPaths[stem], '-compression_level', '5', flacPath], state)
        let mean = null
        let max = null
        await run(ffmpegPath, ['-i', flacPath, '-af', 'volumedetect', '-f', 'null', '-'], state, (line) => {
          let m = line.match(/mean_volume:\s*(-?[\d.]+)\s*dB/)
          if (m) mean = parseFloat(m[1])
          m = line.match(/max_volume:\s*(-?[\d.]+)\s*dB/)
          if (m) max = parseFloat(m[1])
        })
        const present = mean == null || mean > -48 || (max != null && max > -20)
        stemInfo[stem] = { mean, max, present }
      }
      rmSync(workDir, { recursive: true, force: true })
      rmSync(srcWav, { force: true })

      const meta = {
        key,
        sourceFile: inputFile,
        title: title || basename(inputFile).replace(/\.[a-z0-9]{2,5}$/i, ''),
        model,
        duration,
        analysis,
        stemInfo,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        variants: {}
      }
      writeMeta(dir, meta)
      evictOldSessions(key)
      onStatus({ id, state: 'done', session: sessionPayload(key, meta) })
    } catch (err) {
      try { rmSync(join(STEMS_DIR, sessionKeyFor(inputFile, model), 'work'), { recursive: true, force: true }) } catch {}
      if (state.cancelled) {
        onStatus({ id, state: 'cancelled' })
      } else {
        let message = err.message
        // 3221225477 = 0xC0000005 (violação de acesso) e 3221225495 = 0xC0000017 — quase sempre falta de memória
        if (/3221225477|3221225495|1455/.test(message)) {
          message = 'Faltou memória durante a separação. Feche outros programas (navegador, editores, jogos) e tente de novo.'
        }
        onStatus({ id, state: 'error', error: message })
      }
    }
  })()

  return {
    id,
    cancel: () => {
      state.cancelled = true
      try { state.child?.kill() } catch {}
    }
  }
}

// ---------- Busca profunda: olheiro + especialistas ----------

// Arsenal completo dos 53 especialistas (doutrina do TODOS: nenhum instrumento
// de fora). Cada modelo baixa sob demanda (~78MB) na primeira vez que é usado.
const SPECIALISTS = {
  // Grupos (seções)
  brass: { label: 'Metais', file: 'brass' },
  strings: { label: 'Cordas (seção)', file: 'bowed_strings' },
  woodwind: { label: 'Madeiras (grupo)', file: 'woodwind' },
  percussion: { label: 'Percussão', file: 'percussion' },
  // Sopros
  saxophone: { label: 'Sax', file: 'saxophone' },
  flute: { label: 'Flauta', file: 'flute' },
  clarinet: { label: 'Clarinete', file: 'clarinet' },
  oboe: { label: 'Oboé', file: 'oboe' },
  bassoon: { label: 'Fagote', file: 'bassoon' },
  trumpet: { label: 'Trompete', file: 'trumpet' },
  trombone: { label: 'Trombone', file: 'trombone' },
  'french-horn': { label: 'Trompa', file: 'french-horn' },
  tuba: { label: 'Tuba', file: 'tuba' },
  harmonica: { label: 'Gaita', file: 'harmonica' },
  // Cordas
  violin: { label: 'Violino', file: 'violin' },
  viola: { label: 'Viola de orquestra', file: 'viola' },
  cello: { label: 'Violoncelo', file: 'cello' },
  'double-bass': { label: 'Contrabaixo acústico', file: 'double-bass' },
  harp: { label: 'Harpa', file: 'harp' },
  'acoustic-guitar': { label: 'Violão', file: 'acoustic-guitar' },
  banjo: { label: 'Banjo', file: 'banjo' },
  mandolin: { label: 'Bandolim', file: 'mandolin' },
  ukulele: { label: 'Ukulele', file: 'ukulele' },
  dobro: { label: 'Dobro (slide)', file: 'dobro' },
  sitar: { label: 'Sitar', file: 'sitar' },
  // Teclas
  organ: { label: 'Órgão', file: 'organ' },
  accordion: { label: 'Acordeon', file: 'accordion' },
  synth: { label: 'Sintetizador', file: 'synth' },
  keys: { label: 'Teclados (geral)', file: 'keys' },
  'digital-piano': { label: 'Piano digital', file: 'digital-piano' },
  harpsichord: { label: 'Cravo', file: 'harpsichord' },
  // Percussão melódica e efeitos
  marimba: { label: 'Marimba/Xilofone', file: 'marimba' },
  glockenspiel: { label: 'Glockenspiel', file: 'glockenspiel' },
  timpani: { label: 'Tímpanos', file: 'timpani' },
  bells: { label: 'Sinos', file: 'bells' },
  'wind-chimes': { label: 'Carrilhão de vento', file: 'wind-chimes' },
  tambourine: { label: 'Pandeirola', file: 'tambourine' },
  triangle: { label: 'Triângulo', file: 'triangle' },
  congas: { label: 'Congas', file: 'congas' }
}

// Minutos de processamento por minuto de música, medido nesta classe de máquina
const PROC_FACTOR = 9.7
const HF_BASE = 'https://huggingface.co/noblebarkrr/BS-Roformer-MVSep-Mega-53-stems/resolve/main/v1'
const MODELS53_DIR = join(ENGINE_DIR, 'models53')
const MSST_DIR = join(ENGINE_DIR, 'msst')
const SCOUT_SCRIPT = join(ENGINE_DIR, 'scout', 'scout_json.py')

export function estimateExtractionMinutes(durationSec, count = 1) {
  return Math.ceil(((durationSec / 60) * PROC_FACTOR) * count)
}

export function specialistCatalog() {
  return Object.entries(SPECIALISTS).map(([id, s]) => ({ id, label: s.label }))
}

// Roda o olheiro no stem "outros" da sessão (onde os instrumentos raros moram)
export async function scoutSession({ key, force = false }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  if (meta.scout && !force) return meta.scout

  // Fareja o "outros" LIMPO (pós-desconto): a pergunta do painel é "o que MAIS
  // dá pra extrair" — farejar o original ressuscitava fantasmas de instrumentos
  // já extraídos (violão cheirando a dobro, metais cheirando a trompete)
  const target = join(dir, 'base', 'other.flac')
  if (!existsSync(target)) throw new Error('Stem "outros" não encontrado nessa sessão.')

  const state = {}
  const out = await new Promise((resolve, reject) => {
    const child = spawn(PYTHON_PATH, [SCOUT_SCRIPT, target], { windowsHide: true })
    state.child = child
    let buf = ''
    let err = ''
    child.stdout.on('data', (d) => { buf += d })
    child.stderr.on('data', (d) => { err += d })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(err.slice(0, 300) || `olheiro saiu com código ${code}`))
      try {
        resolve(JSON.parse(buf.trim().split('\n').pop()))
      } catch (e) {
        reject(e)
      }
    })
  })

  const scout = {
    at: new Date().toISOString(),
    detections: (out.detections || []).filter((d) => SPECIALISTS[d.instrument] && !(meta.stems || []).includes(d.instrument)),
    gp: out.gp || null,
    // Nível de presença de TODOS os instrumentos do arsenal (mesmo os fracos)
    arsenal: out.arsenal || null
  }
  meta.scout = scout
  writeMeta(dir, meta)
  return scout
}

function runScoutScript(targetAudio, state) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_PATH, [SCOUT_SCRIPT, targetAudio], { windowsHide: true })
    state.child = child
    let buf = ''
    let err = ''
    child.stdout.on('data', (d) => { buf += d })
    child.stderr.on('data', (d) => { err += d })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(err.slice(0, 300) || `olheiro saiu com código ${code}`))
      try {
        resolve(JSON.parse(buf.trim().split('\n').pop()))
      } catch (e) {
        reject(e)
      }
    })
  })
}

// Pré-análise: separa AMOSTRAS da música (5 janelas de 24s) e cataloga tudo que
// existe — ANTES de qualquer separação de verdade. O usuário escolhe tudo de
// uma vez com o catálogo completo na mão.
const PLAN_WINDOWS = 5
const PLAN_WINDOW_SEC = 24

// Plano já calculado pra esse arquivo? (resposta síncrona — sem corrida de eventos)
export function getCachedPlan(inputFile) {
  try {
    const fp = contentFingerprint(inputFile).slice(0, 16)
    const planPath = join(STEMS_DIR, '_plans', `${fp}_v3.json`)
    if (existsSync(planPath)) return JSON.parse(readFileSync(planPath, 'utf8'))
  } catch {}
  return null
}

export function startPlanJob({ inputFile, ffmpegPath, onProgress, onStatus }) {
  const id = randomUUID()
  const state = { cancelled: false, child: null }

  ;(async () => {
    // Respiro pro renderer registrar os ouvintes antes de qualquer evento
    await new Promise((r) => setTimeout(r, 250))
    const plansDir = join(STEMS_DIR, '_plans')
    let work = null
    try {
      if (!existsSync(inputFile)) throw new Error('Arquivo não encontrado no disco.')
      const fp = contentFingerprint(inputFile).slice(0, 16)
      mkdirSync(plansDir, { recursive: true })
      const planPath = join(plansDir, `${fp}_v3.json`)
      if (existsSync(planPath)) {
        try {
          onStatus({ id, state: 'done', plan: JSON.parse(readFileSync(planPath, 'utf8')) })
          return
        } catch {}
      }

      work = join(plansDir, `work_${fp}`)
      rmSync(work, { recursive: true, force: true })
      mkdirSync(work, { recursive: true })

      // 1. Duração (só o cabeçalho — rápido)
      onProgress({ id, stage: 'preparing', percent: 2 })
      let duration = 0
      await new Promise((resolve, reject) => {
        const child = spawn(ffmpegPath, ['-i', inputFile], { windowsHide: true })
        state.child = child
        let err = ''
        child.stderr.on('data', (d) => { err += d })
        child.on('error', reject)
        child.on('close', () => {
          const m = err.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/)
          if (m) duration = Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3])
          resolve()
        })
      })
      if (!duration) throw new Error('Não consegui ler a duração da música.')

      // 2. Janelas de amostra espalhadas pela música
      const positions = []
      if (duration <= PLAN_WINDOWS * PLAN_WINDOW_SEC + 20) {
        positions.push(0)
      } else {
        for (let i = 0; i < PLAN_WINDOWS; i++) {
          const frac = 0.08 + (0.84 * i) / (PLAN_WINDOWS - 1)
          positions.push(Math.min(duration - PLAN_WINDOW_SEC - 1, Math.max(0, duration * frac)))
        }
      }
      const pieces = []
      for (let i = 0; i < positions.length; i++) {
        onProgress({ id, stage: 'preparing', percent: 4 + Math.round((i / positions.length) * 12) })
        const p = join(work, `w${i}.wav`)
        const dur = positions.length === 1 ? Math.min(duration, PLAN_WINDOWS * PLAN_WINDOW_SEC) : PLAN_WINDOW_SEC
        await run(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', String(Math.round(positions[i])), '-t', String(dur), '-i', inputFile, '-vn', '-ac', '2', '-ar', '44100', p], state)
        pieces.push(p)
      }
      const listFile = join(work, 'list.txt')
      writeFileSync(listFile, pieces.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
      const sampleWav = join(work, 'amostra.wav')
      await run(ffmpegPath, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', sampleWav], state)

      // 3. Separação base SÓ das amostras (~2 min)
      onProgress({ id, stage: 'separating', percent: 0 })
      await run(
        PYTHON_PATH,
        ['-m', 'demucs', '-n', 'htdemucs', '-d', 'cpu', '--segment', '6', '-o', join(work, 'sep'), sampleWav],
        state,
        (line) => {
          const m = line.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/)
          if (m) {
            const raw = Math.max(0, Math.min(100, (parseFloat(m[1]) / parseFloat(m[2])) * 100))
            onProgress({ id, stage: 'separating', percent: Math.round(18 + raw * 0.74) })
          }
        },
        { env: { ...process.env, OMP_NUM_THREADS: '4', MKL_NUM_THREADS: '4' } }
      )

      // 4. Mede a energia de cada stem base das amostras — stem mudo = instrumento
      //    que NÃO existe nessa música (o catálogo só promete o que tem)
      onProgress({ id, stage: 'scouting', percent: 92 })
      const sepDir = join(work, 'sep', 'htdemucs', 'amostra')
      const baseInfo = {}
      for (const stem of ['vocals', 'drums', 'bass', 'other']) {
        let mean = -99
        await run(ffmpegPath, ['-i', join(sepDir, `${stem}.wav`), '-af', 'volumedetect', '-f', 'null', '-'], state, (line) => {
          const m = line.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)/)
          if (m) mean = parseFloat(m[1])
        })
        baseInfo[stem] = { present: mean > -48, mean }
      }

      // 5. Olheiro escuta o "outros" das amostras
      onProgress({ id, stage: 'scouting', percent: 95 })
      const scoutOut = await runScoutScript(join(sepDir, 'other.wav'), state)

      // Converte posição na amostra -> posição real na música
      const toReal = (atSample) => {
        const w = Math.min(positions.length - 1, Math.floor(atSample / PLAN_WINDOW_SEC))
        return Math.round(positions[w] + (atSample % PLAN_WINDOW_SEC))
      }

      const extras = []
      const gp = scoutOut.gp || {}
      if ((gp.guitar?.score || 0) >= 0.2) {
        extras.push({ instrument: 'guitar', score: gp.guitar.score, at: toReal(gp.guitar.at || 0) })
      }
      if ((gp.piano?.score || 0) >= 0.15) {
        extras.push({ instrument: 'piano', score: gp.piano.score, at: toReal(gp.piano.at || 0) })
      }
      for (const d of scoutOut.detections || []) {
        if (SPECIALISTS[d.instrument]) {
          extras.push({ instrument: d.instrument, score: d.score, at: toReal(d.at), coverage: d.coverage ?? null })
        }
      }

      const plan = {
        fingerprint: fp,
        duration,
        base: ['vocals', 'drums', 'bass', 'other'],
        baseInfo,
        extras,
        // Nível de presença de todo o arsenal (com posição convertida pro
        // tempo real da música) — alimenta a busca manual do catálogo
        arsenal: scoutOut.arsenal
          ? Object.fromEntries(Object.entries(scoutOut.arsenal).map(([k, v]) => [k, { score: v.score, at: toReal(v.at || 0) }]))
          : null,
        createdAt: new Date().toISOString()
      }
      writeFileSync(planPath, JSON.stringify(plan, null, 2))
      rmSync(work, { recursive: true, force: true })
      onStatus({ id, state: 'done', plan })
    } catch (err) {
      try { if (work) rmSync(work, { recursive: true, force: true }) } catch {}
      if (state.cancelled) onStatus({ id, state: 'cancelled' })
      else {
        let message = err.message
        if (/3221225477|3221225495|1455/.test(message)) {
          message = 'Faltou memória durante a análise. Feche outros programas e tente de novo.'
        }
        onStatus({ id, state: 'error', error: message })
      }
    }
  })()

  return {
    id,
    cancel: () => {
      state.cancelled = true
      try { state.child?.kill() } catch {}
    }
  }
}

// Constrói as regiões onde um instrumento toca a partir do mapa de janelas
// (10s cada): junta janelas próximas, adiciona margem de segurança e mescla.
function buildRegions(windows, duration) {
  if (!windows?.length) return []
  const sorted = [...windows].sort((a, b) => a - b)
  const raw = []
  let s = sorted[0]
  let e = sorted[0] + 10
  for (const w of sorted.slice(1)) {
    if (w <= e + 20) e = w + 10
    else {
      raw.push([s, e])
      s = w
      e = w + 10
    }
  }
  raw.push([s, e])
  const margined = raw.map(([a, b]) => [Math.max(0, a - 15), Math.min(duration, b + 15)])
  const merged = [margined[0]]
  for (const r of margined.slice(1)) {
    const last = merged[merged.length - 1]
    if (r[0] <= last[1] + 5) last[1] = Math.max(last[1], r[1])
    else merged.push(r)
  }
  return merged
}

// Fatia as regiões em pedaços de até 120s (limite seguro de memória)
function regionPieces(regions) {
  const pieces = []
  for (const [a, b] of regions) {
    let t = a
    while (t < b - 1) {
      const len = Math.min(120, b - t)
      pieces.push({ start: t, len })
      t += len
    }
  }
  return pieces
}

// Monta a faixa completa: silêncio do tamanho da música + cada pedaço
// processado colocado no seu lugar exato da linha do tempo.
async function assembleWithSilence(ffmpegPath, pieces, durationSec, outFlac, state) {
  const args = ['-y', '-loglevel', 'error', '-f', 'lavfi', '-t', String(durationSec), '-i', 'anullsrc=r=44100:cl=stereo']
  for (const p of pieces) args.push('-i', p.file)
  const delays = pieces.map((p, i) => {
    const ms = Math.max(0, Math.round(p.start * 1000))
    return `[${i + 1}:a]adelay=${ms}|${ms}[d${i}]`
  })
  const mixIn = ['[0:a]', ...pieces.map((_, i) => `[d${i}]`)].join('')
  args.push(
    '-filter_complex',
    `${delays.join(';')};${mixIn}amix=inputs=${pieces.length + 1}:normalize=0,atrim=0:${durationSec}[a]`,
    '-map', '[a]', '-compression_level', '5', outFlac
  )
  await run(ffmpegPath, args, state)
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const child = spawn('curl.exe', ['-sL', '--fail', '-o', dest, url], { windowsHide: true })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 && existsSync(dest)) resolve()
      else reject(new Error(`download falhou (${code}): ${url}`))
    })
  })
}

async function ensureSpecialist(instId) {
  const spec = SPECIALISTS[instId]
  if (!spec) throw new Error(`Especialista desconhecido: ${instId}`)
  mkdirSync(MODELS53_DIR, { recursive: true })
  const ckpt = join(MODELS53_DIR, `${instId}.ckpt`)
  const cfg = join(MODELS53_DIR, `${instId}_config.yaml`)
  if (existsSync(ckpt) && existsSync(cfg)) return { ckpt, cfg }

  await downloadFile(`${HF_BASE}/bs_mega_53stem_${spec.file}_mvsep.ckpt`, ckpt)
  const rawCfg = `${cfg}.raw`
  await downloadFile(`${HF_BASE}/bs_mega_53stem_${spec.file}_mvsep_config.yaml`, rawCfg)
  // Remove BOM e reduz o chunk de inferência (20s -> 10s) pra caber em pouca RAM
  let txt = readFileSync(rawCfg, 'utf8')
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1)
  txt = txt.replace(/(inference:\n(?:.*\n)*?  chunk_size: )882000/, '$1441000')
  writeFileSync(cfg, txt)
  rmSync(rawCfg, { force: true })
  return { ckpt, cfg }
}

// Recalcula "outros" = original menos tudo que foi extraído e carimba a
// consistência. É a lei que impede um instrumento de existir em dois lugares.
async function rebuildOther(dir, ffmpegPath, state) {
  const meta = readMeta(dir)
  const extracted = (meta?.extracted || []).filter((i) => existsSync(join(dir, 'base', `${i}.flac`)))
  if (!extracted.length) return
  const orig = join(dir, 'base', 'other_orig.flac')
  if (!existsSync(orig)) copyFileSync(join(dir, 'base', 'other.flac'), orig)
  const args = ['-y', '-loglevel', 'error', '-i', orig]
  const inverts = []
  extracted.forEach((inst, i) => {
    args.push('-i', join(dir, 'base', `${inst}.flac`))
    inverts.push(`[${i + 1}:a]volume=-1[i${i}]`)
  })
  const mixIn = ['[0:a]', ...extracted.map((_, i) => `[i${i}]`)].join('')
  args.push('-filter_complex', `${inverts.join(';')};${mixIn}amix=inputs=${extracted.length + 1}:normalize=0[a]`,
    '-map', '[a]', '-compression_level', '5', join(dir, 'base', 'other.flac'))
  await run(ffmpegPath, args, state)
  const m2 = readMeta(dir)
  m2.otherCleanFor = extracted.slice().sort().join(',')
  writeMeta(dir, m2)
}

// FISCAL DE ABERTURA: se o app caiu antes do desconto (queda de energia no meio
// de uma fila), a sessão abre inconsistente — aqui ela se conserta sozinha.
export async function repairSession({ key, ffmpegPath }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta?.extracted?.length) return false
  const want = meta.extracted
    .filter((i) => existsSync(join(dir, 'base', `${i}.flac`)))
    .sort().join(',')
  if (!want || meta.otherCleanFor === want) return false
  await rebuildOther(dir, ffmpegPath, {})
  return true
}

// FORMA DE ONDA: os "picos" de volume de uma faixa (as dobras sonoras da tela).
// Decodifica em 400Hz mono — leve — e guarda em cache ao lado das faixas.
export async function stemPeaks({ key, stem, ffmpegPath, buckets = 800 }) {
  const dir = join(STEMS_DIR, key)
  const flac = join(dir, 'base', `${stem}.flac`)
  if (!existsSync(flac)) throw new Error('Faixa não encontrada.')
  const cache = join(dir, `peaks2_${stem}.json`)
  if (existsSync(cache) && statSync(cache).mtimeMs >= statSync(flac).mtimeMs) {
    try { return JSON.parse(readFileSync(cache, 'utf8')) } catch {}
  }
  // 8kHz: taxa baixa o bastante pra ser leve, alta o bastante pra ENXERGAR
  // voz/guitarra/flauta (400Hz filtrava fora tudo acima dos graves)
  const raw = await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-v', 'quiet', '-i', flac, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { windowsHide: true })
    const chunks = []
    child.stdout.on('data', (d) => chunks.push(d))
    child.on('error', reject)
    child.on('close', () => resolve(Buffer.concat(chunks)))
  })
  const n = Math.floor(raw.length / 2)
  const per = Math.max(1, Math.floor(n / buckets))
  const peaks = []
  for (let b = 0; b < buckets; b++) {
    let max = 0
    const s0 = b * per
    const s1 = Math.min(n, s0 + per)
    for (let s = s0; s < s1; s++) {
      const v = Math.abs(raw.readInt16LE(s * 2))
      if (v > max) max = v
    }
    peaks.push(max / 32768)
  }
  // Cada faixa normalizada pela própria altura (faixa baixinha também mostra
  // sua forma) — mas faixa quase-muda fica plana mesmo, sem inflar ruído
  const top = Math.max(...peaks)
  const scale = top >= 0.05 ? 1 / top : 1
  const out = peaks.map((p) => Math.round(p * scale * 100) / 100)
  writeFileSync(cache, JSON.stringify(out))
  return out
}

// LUPA DE TRECHO: fareja SÓ o pedaço marcado do "outros" limpo e compara com
// as notas da música inteira — o que pontua alto aqui e baixo no resto é
// exatamente o som que se destaca no trecho (o que o ouvido notou).
export async function investigateStretch({ key, start, end, ffmpegPath }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  const src = join(dir, 'base', 'other.flac')
  if (!existsSync(src)) throw new Error('Stem "outros" não encontrado.')
  const len = Math.max(2, end - start)
  const seg = join(dir, 'lupa_seg.wav')
  await run(ffmpegPath, [
    '-y', '-loglevel', 'error', '-ss', String(Math.max(0, start)), '-t', String(Math.ceil(len)),
    '-i', src, '-ac', '2', '-ar', '44100', seg
  ], {})
  let out
  try {
    out = await runScoutScript(seg, {})
  } finally {
    rmSync(seg, { force: true })
  }
  const whole = meta.scout?.arsenal || {}
  const items = Object.entries(out.arsenal || {})
    .map(([id, v]) => ({
      id,
      stretch: v.score,
      whole: whole[id]?.score ?? null,
      // destaque = presença no trecho além da presença geral na música
      standout: v.score - (whole[id]?.score ?? 0)
    }))
    .filter((i) => SPECIALISTS[i.id] && !(meta.stems || []).includes(i.id) && i.stretch >= 0.08)
    .sort((a, b) => (b.standout + b.stretch * 0.5) - (a.standout + a.stretch * 0.5))
  return { start, end, items: items.slice(0, 8) }
}

// PRATELEIRA: guardar/promover uma faixa — nada é apagado, só muda de assento
export function setShelved({ key, stem, shelved }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  meta.stemInfo = meta.stemInfo || {}
  meta.stemInfo[stem] = { ...(meta.stemInfo[stem] || {}), shelved: !!shelved }
  writeMeta(dir, meta)
  return sessionPayload(key, readMeta(dir))
}

// REFAZER FAIXA: apaga uma faixa extraída e devolve o som dela pra "outros",
// deixando tudo pronto pra extrair de novo DO ZERO (sem reaproveitar pedaços
// possivelmente suspeitos de uma rodada problemática).
export async function redoStem({ key, instrument, ffmpegPath }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  if (!(meta.extracted || []).includes(instrument)) {
    throw new Error('Essa faixa não veio de extração — não dá pra refazer por aqui.')
  }
  const workRoot = join(dir, 'extract_work')
  if (existsSync(workRoot)) {
    for (const f of readdirSync(workRoot)) {
      if (f.startsWith(`${instrument}_p`)) rmSync(join(workRoot, f), { recursive: true, force: true })
    }
  }
  meta.extracted = meta.extracted.filter((i) => i !== instrument)
  meta.stems = (meta.stems || []).filter((s) => s !== instrument)
  if (meta.stemInfo) delete meta.stemInfo[instrument]
  writeMeta(dir, meta)
  rmSync(join(dir, 'base', `${instrument}.flac`), { force: true })
  // Devolve o som ao "outros" — nenhum pedaço da música pode se perder
  await rebuildOther(dir, ffmpegPath, {})
  touchSession(dir)
  return sessionPayload(key, readMeta(dir))
}

// VACINA ANTI-GÊMEO: nunca dois trabalhos de extração na mesma música — eles
// disputariam o processador e a bancada de arquivos (aconteceu de verdade em
// 25/07: um gêmeo refez os Metais por 3h e quase sujou a faixa de Sax).
const activeExtracts = new Map()

// Extrai instrumentos raros de uma sessão já separada. Processa a música em
// pedaços de 2 min, cada um num processo novo — à prova dos travamentos de
// memória que uma passada única causa em máquinas de 6-8GB.
export function startExtractJob({ key, instruments, ffmpegPath, onProgress, onStatus }) {
  const twin = activeExtracts.get(key)
  if (twin) return { ...twin, twin: true }

  const id = randomUUID()
  const state = { cancelled: false, child: null }

  ;(async () => {
    await new Promise((r) => setTimeout(r, 250))
    const dir = join(STEMS_DIR, key)
    const workRoot = join(dir, 'extract_work')
    try {
      const meta = readMeta(dir)
      if (!meta) throw new Error('Sessão não encontrada.')
      // 'guitar'/'piano' saem de um passo compartilhado; 'guitar-piano' é apelido dos dois
      const asked = (instruments || []).flatMap((i) => (i === 'guitar-piano' ? ['guitar', 'piano'] : [i]))
      const gpWanted = [...new Set(asked.filter((i) => (i === 'guitar' || i === 'piano') && !(meta.stems || []).includes(i)))]
      const wanted = asked.filter((i) => SPECIALISTS[i] && !(meta.stems || []).includes(i))
      if (!wanted.length && !gpWanted.length) throw new Error('Nenhum instrumento novo selecionado.')
      if (!existsSync(meta.sourceFile)) throw new Error('Arquivo original da música não encontrado no disco.')

      // NÃO limpa o workRoot: pedaços prontos de uma tentativa interrompida
      // são reaproveitados — o trabalho retoma de onde parou
      mkdirSync(workRoot, { recursive: true })
      onProgress({ id, stage: 'preparing', percent: null })

      const duration = meta.duration || 300
      // Com memória sobrando, solta mais núcleos (o fiscal já garantiu espaço)
      const threads = freeMemMB() > 3072 ? '6' : '4'
      const engEnv = { env: { ...process.env, OMP_NUM_THREADS: threads, MKL_NUM_THREADS: threads } }

      // DOUTRINA DA QUALIDADE MÁXIMA: todo instrumento cobre a MÚSICA INTEIRA.
      // Nenhum trecho fica de fora por economia — o que existe, aparece.
      const wholeSong = () => regionPieces([[0, duration]])
      const pieceDefsFor = {}
      for (const instId of wanted) {
        pieceDefsFor[instId] = wholeSong()
      }
      const gpUnits = gpWanted.length ? Math.max(1, Math.ceil(duration / 120)) : 0
      const totalSteps = gpUnits + wanted.reduce((a, i) => a + pieceDefsFor[i].length, 0)
      let step = 0

      // CADEIA DE REIVINDICAÇÃO: cada instrumento extraído é descontado do
      // material que os próximos enxergam — nada pode ser reivindicado 2 vezes.
      const mixWav = join(workRoot, 'mix_atual.wav')
      const claimedStems = () => {
        const m = readMeta(dir)
        return (m.extracted || [])
          .map((s) => join(dir, 'base', `${s}.flac`))
          .filter((p) => existsSync(p))
      }
      const subtractInto = async (baseInput, outWav) => {
        const claims = claimedStems()
        const args = ['-y', '-loglevel', 'error', '-i', baseInput]
        if (!claims.length) {
          args.push('-vn', '-ac', '2', '-ar', '44100', outWav)
        } else {
          claims.forEach((c) => args.push('-i', c))
          const inv = claims.map((_, i) => `[${i + 1}:a]volume=-1[i${i}]`)
          const mixIn = ['[0:a]', ...claims.map((_, i) => `[i${i}]`)].join('')
          args.push(
            '-filter_complex',
            `${inv.join(';')};${mixIn}amix=inputs=${claims.length + 1}:normalize=0[a]`,
            '-map', '[a]', '-ac', '2', '-ar', '44100', outWav
          )
        }
        await run(ffmpegPath, args, state)
      }


      for (const instId of wanted) {
        const spec = SPECIALISTS[instId]
        onProgress({ id, stage: 'downloading-model', instrument: instId, label: spec.label, percent: Math.round((step / totalSteps) * 100) })
        const { ckpt, cfg } = await ensureSpecialist(instId)

        // Atualiza o material de trabalho: mix menos o que já foi reivindicado
        await subtractInto(meta.sourceFile, mixWav)

        // Processa só os pedaços onde o instrumento toca (ou tudo, se ele
        // estiver presente na música inteira) — cada pedaço num processo novo
        const defs = pieceDefsFor[instId]
        const outPieces = []
        for (let pi = 0; pi < defs.length; pi++) {
          if (state.cancelled) throw new Error('cancelado')
          const pd = defs[pi]
          // Pedaço já pronto de uma tentativa anterior? Aproveita e segue
          const done = join(workRoot, `${instId}_p${pi}.wav`)
          if (existsSync(done) && statSync(done).size > 44) {
            outPieces.push({ file: done, start: Math.round(pd.start) })
            step++
            onProgress({ id, stage: 'extracting', instrument: instId, label: spec.label, percent: Math.round((step / totalSteps) * 100) })
            continue
          }
          // Bancada exclusiva por pedaço — dois trabalhos nunca dividem pasta
          const segIn = join(workRoot, `${instId}_p${pi}_in`)
          const segOut = join(workRoot, `${instId}_p${pi}_out`)
          rmSync(segIn, { recursive: true, force: true })
          rmSync(segOut, { recursive: true, force: true })
          mkdirSync(segIn, { recursive: true })
          await run(ffmpegPath, [
            '-y', '-loglevel', 'error', '-ss', String(Math.round(pd.start)), '-t', String(Math.ceil(pd.len)),
            '-i', mixWav, '-ac', '2', '-ar', '44100', join(segIn, 'seg.wav')
          ], state)

          onProgress({
            id, stage: 'extracting', instrument: instId, label: spec.label,
            percent: Math.round((step / totalSteps) * 100)
          })
          await run(PYTHON_PATH, [
            join(MSST_DIR, 'inference.py'),
            '--model_type', 'bs_roformer',
            '--config_path', cfg,
            '--start_check_point', ckpt,
            '--input_folder', segIn,
            '--store_dir', segOut,
            '--force_cpu', '--extract_instrumental'
          ], state, (line) => {
            // Placar interno da IA (tqdm de chunks): progresso DENTRO do pedaço,
            // senão a barra congela 15-20 min por pedaço
            const mm = line.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/)
            if (mm) {
              const frac = Math.max(0, Math.min(0.99, parseFloat(mm[1]) / parseFloat(mm[2])))
              onProgress({
                id, stage: 'extracting', instrument: instId, label: spec.label,
                percent: Math.round(((step + frac) / totalSteps) * 100)
              })
            }
          }, engEnv)

          // O stem extraído é o wav que não é o "instrumental"
          const outFiles = readdirSync(join(segOut, 'seg')).filter((f) => f.endsWith('.wav') && f !== 'instrumental.wav')
          if (!outFiles.length) throw new Error(`Especialista não produziu saída pro pedaço ${pi + 1}`)
          const piece = join(workRoot, `${instId}_p${pi}.wav`)
          copyFileSync(join(segOut, 'seg', outFiles[0]), piece)
          rmSync(segIn, { recursive: true, force: true })
          rmSync(segOut, { recursive: true, force: true })
          outPieces.push({ file: piece, start: Math.round(pd.start) })
          step++
        }

        // Monta a faixa completa (pedaços no lugar certo, silêncio no resto)
        onProgress({ id, stage: 'converting', instrument: instId, label: spec.label, percent: Math.round((step / totalSteps) * 100) })
        await assembleWithSilence(ffmpegPath, outPieces, duration, join(dir, 'base', `${instId}.flac`), state)
        for (let pi = 0; pi < defs.length; pi++) {
          rmSync(join(workRoot, `${instId}_p${pi}.wav`), { force: true })
        }

        // 3. Atualiza a sessão: nova faixa entra antes de "outros"
        // Mede o que o especialista realmente encontrou — faixa quase-muda
        // (instrumento que não existia de verdade) se esconde sozinha
        let meanVol = -99
        let maxVol = -99
        await run(ffmpegPath, ['-i', join(dir, 'base', `${instId}.flac`), '-af', 'volumedetect', '-f', 'null', '-'], state, (line) => {
          const mm = line.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)/)
          if (mm) meanVol = parseFloat(mm[1])
          const mx = line.match(/max_volume:\s*(-?\d+(?:\.\d+)?)/)
          if (mx) maxVol = parseFloat(mx[1])
        })

        const m = readMeta(dir)
        const stems = stemsOf(m).filter((s) => s !== instId && s !== 'other')
        stems.push(instId, 'other')
        m.stems = stems
        m.stemInfo = m.stemInfo || {}
        // presente = média audível OU pico real (solo curto numa música longa
        // tem média baixa mas pico alto — o sax da Azul foi escondido injustamente)
        const present = meanVol > -48 || maxVol > -35
        // REGRA DO RESPINGO: evidência fraca nasce na prateleira, não na mesa
        // (músico contratado não toca 3 segundos — respingo de ímã toca)
        const shelved = present && meanVol <= -42
        m.stemInfo[instId] = { present, mean: meanVol, max: maxVol, shelved }
        m.extracted = [...new Set([...(m.extracted || []), instId])]
        if (m.scout) m.scout.detections = (m.scout.detections || []).filter((d) => d.instrument !== instId)
        writeMeta(dir, m)

        // Desconto IMEDIATO: o instrumento sai de "outros" assim que fica pronto,
        // não só no fim da fila — nunca existe "instrumento em dois lugares"
        await rebuildOther(dir, ffmpegPath, state)
      }

      if (gpWanted.length) {
        // Guitarra e/ou teclado: UMA passada do modelo de 6 faixas sobre o "outros"
        // resolve os dois — só entram na música os que foram pedidos
        const gpLabel = gpWanted.map((s) => (s === 'guitar' ? 'Guitarra' : 'Piano/Teclado')).join(' e ')
        onProgress({ id, stage: 'extracting', instrument: gpWanted[0], label: gpLabel, percent: Math.round((step / totalSteps) * 100) })
        const orig = join(dir, 'base', 'other_orig.flac')
        if (!existsSync(orig)) copyFileSync(join(dir, 'base', 'other.flac'), orig)
        const gpIn = join(workRoot, 'gp_in')
        mkdirSync(gpIn, { recursive: true })
        const gpWav = join(gpIn, 'other.wav')
        // Fonte = outros original MENOS tudo que os especialistas já reivindicaram
        await subtractInto(orig, gpWav)
        const pctBase = (step / totalSteps) * 100
        const pctSpan = (gpUnits / totalSteps) * 100
        await run(
          PYTHON_PATH,
          ['-m', 'demucs', '-n', 'htdemucs_6s', '-d', 'cpu', '--segment', '6', '-o', join(workRoot, 'gp_out'), gpWav],
          state,
          (line) => {
            const m = line.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)/)
            if (m) {
              const raw = Math.max(0, Math.min(100, (parseFloat(m[1]) / parseFloat(m[2])) * 100))
              onProgress({ id, stage: 'extracting', instrument: gpWanted[0], label: gpLabel, percent: Math.round(pctBase + (raw * pctSpan) / 100) })
            }
          },
          engEnv
        )
        const gpStemDir = join(workRoot, 'gp_out', 'htdemucs_6s', 'other')
        onProgress({ id, stage: 'converting', instrument: gpWanted[0], label: gpLabel, percent: Math.round(((step + gpUnits) / totalSteps) * 100) })
        const m2 = readMeta(dir)
        const arr = stemsOf(m2).filter((s) => !['other', ...gpWanted].includes(s))
        const bi = arr.indexOf('bass')
        for (const s of gpWanted) {
          await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', join(gpStemDir, `${s}.wav`), '-compression_level', '5', join(dir, 'base', `${s}.flac`)], state)
          m2.stemInfo = m2.stemInfo || {}
          m2.stemInfo[s] = { present: true }
        }
        if (bi >= 0) arr.splice(bi + 1, 0, ...gpWanted)
        else arr.push(...gpWanted)
        arr.push('other')
        m2.stems = arr
        m2.extracted = [...new Set([...(m2.extracted || []), ...gpWanted])]
        if (m2.scout?.gp) {
          for (const s of gpWanted) delete m2.scout.gp[s === 'guitar' ? 'guitar' : 'piano']
        }
        writeMeta(dir, m2)
        step += gpUnits
      }

      // 4. Fechamento: garante o "outros" limpo (cobre também guitarra/piano)
      await rebuildOther(dir, ffmpegPath, state)

      rmSync(workRoot, { recursive: true, force: true })
      touchSession(dir)
      onStatus({ id, state: 'done', session: sessionPayload(key, readMeta(dir)) })
    } catch (err) {
      // workRoot fica no lugar: pedaços prontos permitem retomar de onde parou
      if (state.cancelled) onStatus({ id, state: 'cancelled' })
      else {
        let message = err.message
        if (/3221225477|3221225495|1455/.test(message)) {
          message = 'Faltou memória durante a extração. Feche outros programas e tente de novo.'
        }
        onStatus({ id, state: 'error', error: message })
      }
    } finally {
      activeExtracts.delete(key)
    }
  })()

  const handle = {
    id,
    cancel: () => {
      state.cancelled = true
      try { state.child?.kill() } catch {}
    }
  }
  activeExtracts.set(key, handle)
  return handle
}

// ---------- Polir faixa: remove vazamento/ruído de um stem já separado ----------

const POLISH_MODEL = {
  cfg: 'https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v.1.0.7/model_mel_band_roformer_denoise.yaml',
  ckpt: 'https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v.1.0.7/denoise_mel_band_roformer_aufr33_sdr_27.9959.ckpt',
  type: 'mel_band_roformer'
}

async function ensurePolishModel() {
  mkdirSync(MODELS53_DIR, { recursive: true })
  const ckpt = join(MODELS53_DIR, 'polish.ckpt')
  const cfg = join(MODELS53_DIR, 'polish_config.yaml')
  if (existsSync(ckpt) && existsSync(cfg)) return { ckpt, cfg }
  await downloadFile(POLISH_MODEL.ckpt, ckpt)
  const rawCfg = `${cfg}.raw`
  await downloadFile(POLISH_MODEL.cfg, rawCfg)
  let txt = readFileSync(rawCfg, 'utf8')
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1)
  txt = txt.replace(/(inference:\n(?:.*\n)*?  chunk_size: )882000/, '$1441000')
  writeFileSync(cfg, txt)
  rmSync(rawCfg, { force: true })
  return { ckpt, cfg }
}

export function startPolishJob({ key, stem, ffmpegPath, onProgress, onStatus }) {
  const id = randomUUID()
  const state = { cancelled: false, child: null }

  ;(async () => {
    await new Promise((r) => setTimeout(r, 250))
    const dir = join(STEMS_DIR, key)
    const workRoot = join(dir, 'polish_work')
    try {
      const meta = readMeta(dir)
      if (!meta) throw new Error('Sessão não encontrada.')
      const stemFlac = join(dir, 'base', `${stem}.flac`)
      if (!existsSync(stemFlac)) throw new Error('Faixa não encontrada.')
      const duration = meta.duration || 300
      const threads = freeMemMB() > 3072 ? '6' : '4'
      const engEnv = { env: { ...process.env, OMP_NUM_THREADS: threads, MKL_NUM_THREADS: threads } }

      onProgress({ id, stage: 'downloading-model', percent: null })
      const { ckpt, cfg } = await ensurePolishModel()

      mkdirSync(workRoot, { recursive: true })

      const defs = regionPieces([[0, duration]])
      const outPieces = []
      for (let pi = 0; pi < defs.length; pi++) {
        if (state.cancelled) throw new Error('cancelado')
        const pd = defs[pi]
        // Retomada: pedaço já polido numa tentativa anterior é reaproveitado
        const done = join(workRoot, `${stem}_p${pi}.wav`)
        if (existsSync(done) && statSync(done).size > 44) {
          outPieces.push({ file: done, start: Math.round(pd.start) })
          onProgress({ id, stage: 'polishing', percent: Math.round(((pi + 1) / defs.length) * 100) })
          continue
        }
        const segIn = join(workRoot, 'one_in')
        const segOut = join(workRoot, 'one_out')
        rmSync(segIn, { recursive: true, force: true })
        rmSync(segOut, { recursive: true, force: true })
        mkdirSync(segIn, { recursive: true })
        await run(ffmpegPath, [
          '-y', '-loglevel', 'error', '-ss', String(Math.round(pd.start)), '-t', String(Math.ceil(pd.len)),
          '-i', stemFlac, '-ac', '2', '-ar', '44100', join(segIn, 'seg.wav')
        ], state)

        onProgress({ id, stage: 'polishing', percent: Math.round((pi / defs.length) * 100) })
        await run(PYTHON_PATH, [
          join(MSST_DIR, 'inference.py'),
          '--model_type', POLISH_MODEL.type,
          '--config_path', cfg,
          '--start_check_point', ckpt,
          '--input_folder', segIn,
          '--store_dir', segOut,
          '--force_cpu'
        ], state, null, engEnv)

        // O resultado limpo é o wav "dry" (ou o primeiro que não for ruído)
        const outDir = join(segOut, 'seg')
        const outFiles = readdirSync(outDir).filter((f) => f.endsWith('.wav'))
        if (!outFiles.length) throw new Error(`Polimento não produziu saída no pedaço ${pi + 1}`)
        const pick = outFiles.find((f) => f.toLowerCase().startsWith('dry')) || outFiles[0]
        const piece = join(workRoot, `${stem}_p${pi}.wav`)
        copyFileSync(join(outDir, pick), piece)
        outPieces.push({ file: piece, start: Math.round(pd.start) })
      }

      onProgress({ id, stage: 'converting', percent: 98 })
      // Guarda a original pra poder desfazer, e instala a versão polida
      const rawBackup = join(dir, 'base', `${stem}_raw.flac`)
      if (!existsSync(rawBackup)) copyFileSync(stemFlac, rawBackup)
      await assembleWithSilence(ffmpegPath, outPieces, duration, stemFlac, state)

      const m2 = readMeta(dir)
      m2.polished = m2.polished || {}
      m2.polished[stem] = true
      m2.lastUsedAt = new Date().toISOString()
      writeMeta(dir, m2)
      rmSync(workRoot, { recursive: true, force: true })
      onStatus({ id, state: 'done', session: sessionPayload(key, readMeta(dir)) })
    } catch (err) {
      // workRoot fica no lugar: pedaços prontos permitem retomar de onde parou
      if (state.cancelled) onStatus({ id, state: 'cancelled' })
      else {
        let message = err.message
        if (/3221225477|3221225495|1455/.test(message)) {
          message = 'Faltou memória durante o polimento. Feche outros programas e tente de novo.'
        }
        onStatus({ id, state: 'error', error: message })
      }
    }
  })()

  return {
    id,
    cancel: () => {
      state.cancelled = true
      try { state.child?.kill() } catch {}
    }
  }
}

export function unpolishStem({ key, stem }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  const rawBackup = join(dir, 'base', `${stem}_raw.flac`)
  if (!existsSync(rawBackup)) throw new Error('Não há versão original guardada.')
  copyFileSync(rawBackup, join(dir, 'base', `${stem}.flac`))
  rmSync(rawBackup, { force: true })
  if (meta.polished) delete meta.polished[stem]
  writeMeta(dir, meta)
  return sessionPayload(key, readMeta(dir))
}

function variantName(pitch, tempo, fine) {
  const p = pitch < 0 ? `m${-pitch}` : `${pitch}`
  return `p${p}_t${tempo}${fine ? 'f' : ''}`
}

export async function renderVariant({ key, pitch = 0, tempo = 100, fine = false, ffmpegPath, onProgress }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada — separe a música de novo.')
  if (pitch === 0 && tempo === 100) return { variant: 'base', format: 'flac' }

  const vname = variantName(pitch, tempo, fine)
  const vdir = join(dir, vname)
  const stems = stemsOf(meta)
  if (stems.every((s) => existsSync(join(vdir, `${s}.wav`)))) {
    touchSession(dir)
    return { variant: vname, format: 'wav' }
  }
  mkdirSync(vdir, { recursive: true })

  let done = 0
  const state = {}
  await Promise.all(stems.map(async (stem) => {
    const tmpWav = join(vdir, `_src_${stem}.wav`)
    await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', join(dir, 'base', `${stem}.flac`), tmpWav], state)
    const args = ['-q']
    if (fine) args.push('-3')
    if (pitch !== 0) args.push('-p', String(pitch))
    if (tempo !== 100) args.push('--tempo', String(tempo / 100))
    args.push(tmpWav, join(vdir, `${stem}.wav`))
    await run(RUBBERBAND_PATH, args, state)
    rmSync(tmpWav, { force: true })
    done++
    onProgress?.({ percent: Math.round((done / stems.length) * 100) })
  }))

  meta.variants[vname] = { pitch, tempo, fine, createdAt: new Date().toISOString() }
  meta.lastUsedAt = new Date().toISOString()
  writeMeta(dir, meta)
  return { variant: vname, format: 'wav' }
}

// Exporta a MÚSICA INTEIRA em MP3, aplicando o tom/velocidade escolhidos
// (qualidade máxima: Rubber Band R3 sobre o áudio original)
export async function exportSong({ key, pitch = 0, tempo = 100, targetDir, ffmpegPath }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  const state = {}
  const work = join(dir, 'export_work')
  mkdirSync(work, { recursive: true })
  try {
    // 1. Fonte: o arquivo original (fiel); se sumiu, remonta juntando os stems
    const mixWav = join(work, 'mix.wav')
    if (meta.sourceFile && existsSync(meta.sourceFile)) {
      await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', meta.sourceFile, '-vn', '-ac', '2', '-ar', '44100', mixWav], state)
    } else {
      const stems = stemsOf(meta)
      const args = ['-y', '-loglevel', 'error']
      stems.forEach((s) => args.push('-i', join(dir, 'base', `${s}.flac`)))
      const ins = stems.map((_, i) => `[${i}:a]`).join('')
      args.push('-filter_complex', `${ins}amix=inputs=${stems.length}:normalize=0[a]`, '-map', '[a]', mixWav)
      await run(ffmpegPath, args, state)
    }

    // 2. Tom e velocidade num único passe de alta qualidade
    let outWav = mixWav
    if (pitch !== 0 || tempo !== 100) {
      const rbOut = join(work, 'rb.wav')
      const rbArgs = ['-3', '-q']
      if (pitch !== 0) rbArgs.push('-p', String(pitch))
      if (tempo !== 100) rbArgs.push('--tempo', String(tempo / 100))
      rbArgs.push(mixWav, rbOut)
      await run(RUBBERBAND_PATH, rbArgs, state)
      outWav = rbOut
    }

    // 3. MP3 320k com nome descritivo, sem sobrescrever nada
    const safeTitle = (meta.title || 'musica').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 120)
    const parts = []
    if (pitch !== 0) parts.push(`tom ${pitch > 0 ? '+' : ''}${pitch}`)
    if (tempo !== 100) parts.push(`velocidade ${tempo}%`)
    const suffix = parts.length ? ` (${parts.join(', ')})` : ''
    let target = join(targetDir, `${safeTitle}${suffix}.mp3`)
    let n = 2
    while (existsSync(target)) {
      target = join(targetDir, `${safeTitle}${suffix} (${n}).mp3`)
      n++
    }
    await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', outWav, '-b:a', '320k', target], state)
    return target
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

export async function exportStems({ key, targetDir, ffmpegPath, labels }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  const stems = stemsOf(meta)
  const state = {}
  const written = []
  const safeTitle = (meta.title || 'musica').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 120)
  for (const stem of stems) {
    const label = labels?.[stem] || stem
    const target = join(targetDir, `${safeTitle} - ${label}.wav`)
    await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', join(dir, 'base', `${stem}.flac`), target], state)
    written.push(target)
  }
  return written
}
