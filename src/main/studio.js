import { app } from 'electron'
import { carregarLexico, corrigirVersos } from './lexico.js'
import { usarNuvem, lerChaveNuvem, somarGastoNuvem, getNuvem, estimativaCentavos, gastoCentavos } from './store.js'
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
  appendFileSync,
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

function limpaVazamentoPath() {
  if (app.isPackaged) return join(process.resourcesPath, 'engine', 'limpa_vazamento.cjs')
  return join(__dirname, '../../resources/engine/limpa_vazamento.cjs')
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

/**
 * Apaga uma pasta de rascunho sem nunca derrubar quem chamou.
 *
 * No Windows, o arquivo que um processo filho acabou de ler continua preso por
 * um instante depois que ele morre — o ffmpeg sai, o `unlink` vem logo atrás e
 * leva EBUSY. Aconteceu de verdade: a separação da Girlfriend terminou inteira
 * e o app mostrou "algo deu errado" porque não conseguiu apagar um rascunho.
 *
 * `maxRetries` é do próprio Node e existe exatamente pra isso. E o try/catch
 * fecha a regra: lixo que não sai não é motivo pra perder trabalho pronto.
 */
// Diário da dissecação: registro do que o motor DECIDIU, não só do que fez.
// Sem isso, entender por que um trecho não virou confissão vira adivinhação —
// e adivinhar em cima do dinheiro do usuário não é aceitável.
function diario(dir, linha) {
  try {
    appendFileSync(join(dir, 'dissec.log'), `${new Date().toISOString()} ${linha}\n`)
  } catch { /* diário não pode derrubar trabalho */ }
}

function apagarPasta(p) {
  try {
    rmSync(p, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 })
    return true
  } catch {
    return false
  }
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
    extracted: meta.extracted || [],
    // A dissecação presta contas: inclusive dos sons que não conseguiu nomear
    autoHarvest: meta.autoHarvest || null
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
  'congas', 'triangle', 'glockenspiel',
  // solistas de MELODIA não opinam sobre harmonia — nota de passagem
  // vira tempero errado no acorde (a flauta poluía a leitura da Azul)
  'flute', 'harmonica', 'saxophone', 'violin', 'viola', 'cello',
  'trumpet', 'trombone', 'french-horn', 'tuba', 'clarinet', 'oboe',
  'bassoon', 'double-bass', 'dobro'
])
// Sobe quando o detector muda. Cifra guardada com versão antiga se refaz
// sozinha na primeira abertura — senão a pessoa continuaria vendo o resultado
// velho sem saber, que é pior do que esperar.
// v3: votação entre repetições. Sobe a versão pra que quem já tem música
// processada receba a cifra melhor sem reimportar nada.
const CHORDS_V = 3

export async function detectChords({ key, ffmpegPath, force = false }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  if (meta.chords && !force && meta.chords.v === CHORDS_V) return meta.chords

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

  // CROMA NA NUVEM. É 300 dos 450 segundos do detector, e o custo não é conta:
  // é a ponte JS/WASM reconstruindo a tabela do LogSpectrum a cada quadro. A
  // lógica dos acordes NÃO muda de lugar -- só os números que alimentam ela.
  // Medido nas duas músicas de referência, com o detector inteiro: a cifra sai
  // igual ou melhor (Azul 53,7%->54,4%, Vaso 45,0%->46,3%) em 42s no lugar de
  // 669s. Falhando, faz local mesmo: são minutos, não os 47 da extração, e
  // ficar sem cifra é pior que esperar.
  let cromaPronta = null
  if (usarNuvem()) {
    const mixHarm = join(dir, 'croma_mix.wav')
    const destino = join(dir, 'croma_nuvem.json')
    try {
      const { cromaNaNuvem } = await import('./nuvem.js')
      // o chords.cjs soma as faixas harmônicas internamente; pra subir uma só,
      // a soma é feita aqui com o mesmo amix, sem normalizar
      const args = ['-y', '-loglevel', 'error']
      for (const h of harm) args.push('-i', h)
      args.push(...(harm.length > 1 ? ['-filter_complex', `amix=inputs=${harm.length}:normalize=0`] : []),
        '-ac', '1', '-ar', '44100', mixHarm)
      await run(ffmpegPath, args, state)
      const rc = await cromaNaNuvem({
        chave: lerChaveNuvem(),
        harmonia: mixHarm,
        baixo: existsSync(bassP) ? bassP : null,
        destino,
        state
      })
      somarGastoNuvem(rc.segundos, { maquina: 'cpu' })
      cromaPronta = destino
    } catch (err) {
      if (state.cancelled) throw err
    } finally {
      rmSync(mixHarm, { force: true })
    }
  }

  const out = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [chordsScriptPath(), ffmpegPath, existsSync(bassP) ? bassP : '-', existsSync(drumsP) ? drumsP : '-', ...harm],
      {
        windowsHide: true,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          ...(cromaPronta ? { MPTRIX_CROMA: cromaPronta } : {})
        }
      }
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

  if (cromaPronta) rmSync(cromaPronta, { force: true })

  const m2 = readMeta(dir)
  m2.chords = { at: new Date().toISOString(), v: CHORDS_V, list: out.chords || [], key: out.key || null }
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
// v8: transcricao e alinhamento na nuvem (WhisperX). Sobe a versao pra quem ja
// tem musica pronta receber o alinhamento melhor sem pedir nada.
const LYRICS_V = 8

export async function transcribeLyrics({ key, ffmpegPath, force = false, onProgress }) {
  const dir = join(STEMS_DIR, key)
  const meta = readMeta(dir)
  if (!meta) throw new Error('Sessão não encontrada.')
  // letra corrigida à mão é do usuário: nunca se refaz por cima dela
  if (meta.lyrics && !force && (meta.lyrics.edited || meta.lyrics.v === LYRICS_V)) return meta.lyrics
  const vocals = join(dir, 'base', 'vocals.flac')
  if (!existsSync(vocals)) throw new Error('Faixa de voz não encontrada nessa sessão.')

  // NUVEM PRIMEIRO. Medido na Azul: 12 segundos contra varios minutos, com
  // alinhamento MELHOR (100% das palavras caem dentro de regiao de voz, contra
  // 94,5% do local) e mais limpo -- a nuvem descarta a contagem de entrada e o
  // "obrigado" pra plateia, que o local transcrevia como se fossem verso.
  let words = null
  if (usarNuvem()) {
    try {
      const { transcreverNaNuvem } = await import('./nuvem.js')
      onProgress?.({ percent: 5, nuvem: true })
      const r = await transcreverNaNuvem({
        chave: lerChaveNuvem(),
        arquivo: vocals,
        state: {},
        onProgress: (pr) => onProgress?.({ ...pr, nuvem: true })
      })
      words = r.words
      somarGastoNuvem(r.segundos, { maquina: 'a100' })
    } catch (err) {
      if (err?.segundosGastos) somarGastoNuvem(err.segundosGastos, { maquina: 'a100' }) // GPU queimada antes de morrer tambem e dinheiro
      // Mesma regra da separacao: nao faz minutos de processador escondido
      // quando a pessoa pediu nuvem. Falhar aqui custa um clique.
      throw new Error(
        `A nuvem nao conseguiu transcrever: ${err.message}. Nada foi perdido — ` +
        'da pra tentar de novo. Se preferir fazer neste computador, troque para ' +
        '"Neste computador" na Separacao na nuvem.'
      )
    }
  }

  // Só o caminho LOCAL precisa de arquivo temporário; com a nuvem as palavras
  // já chegaram prontas e não há wav nem json pra limpar depois.
  let wav = null
  let outBase = null
  try {
    if (!words) {
    const { exe, model } = await ensureWhisper()
    wav = join(dir, 'lyrics_in.wav')
    await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', vocals, '-ac', '1', '-ar', '16000', wav], {})
    outBase = join(dir, 'lyrics_out')
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
    words = []
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

    } // fim do caminho local

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
    if (wav) rmSync(wav, { force: true })
    if (outBase) rmSync(`${outBase}.json`, { force: true })
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

      // NUVEM (opcional). Só entra se o usuário ligou, pôs a chave e o modelo
      // é de separação de verdade. Qualquer tropeço cai na separação local:
      // ninguém pode ficar sem a música porque a internet caiu ou o crédito
      // acabou. Por isso o `catch` não propaga — ele avisa e segue.
      let feitoNaNuvem = false
      // Teto queimado com a nuvem LIGADA: a separação ainda acontece aqui (o
      // usuário não pode ficar sem a música), mas não pode ser em silêncio —
      // ele escolheu nuvem e vai esperar minutos em vez de segundos.
      if (model !== 'quick' && !usarNuvem() && getNuvem().ligada && getNuvem().temChave) {
        onStatus({
          id, state: 'running', nuvem: 'teto',
          aviso: 'Teto de gasto da nuvem atingido — separando neste computador (mais devagar). Dá pra aumentar o teto nas configurações.'
        })
      }
      if (model !== 'quick' && usarNuvem()) {
        try {
          const { separarNaNuvem } = await import('./nuvem.js')
          mkdirSync(workDir, { recursive: true })
          onStatus({ id, state: 'running', nuvem: 'começando' })
          const r = await separarNaNuvem({
            chave: lerChaveNuvem(),
            model,
            srcWav,
            inputFile,
            workDir,
            ffmpegPath,
            state,
            run,
            onProgress: (p) => onProgress({ id, ...p, nuvem: true })
          })
          Object.assign(rawPaths, r.rawPaths)
          // única chamada que conta como "música feita" no placar: é a
          // separação da música em si. O resto (sondas, especialistas, letra,
          // cifra) soma segundos mas não inventa músicas.
          somarGastoNuvem(r.segundos, { contaMusica: true, maquina: 'a100' })
          feitoNaNuvem = true
        } catch (err) {
          if (err?.segundosGastos) somarGastoNuvem(err.segundosGastos, { maquina: 'a100' }) // GPU queimada antes de morrer tambem e dinheiro
          if (state.cancelled) throw err
          onStatus({ id, state: 'running', nuvem: 'falhou', aviso: `Nuvem: ${err.message}. Separando aqui mesmo.` })
        }
      }

      if (feitoNaNuvem) {
        // pula a separação local — as faixas já estão em rawPaths
      } else if (model === 'quick') {
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
      // Tirar o lixo NUNCA pode derrubar o trabalho pronto. No Windows o
      // arquivo que o ffmpeg acabou de ler fica preso por um instante depois
      // que o processo morre (EBUSY), e apagar a bancada estourava — jogando
      // fora uma separação que tinha dado certo. Agora insiste um pouco e, se
      // mesmo assim não der, segue em frente: sobra uma pasta de rascunho, que
      // a próxima separação da mesma música limpa.
      apagarPasta(workDir)
      try { rmSync(srcWav, { force: true }) } catch { /* rascunho, não trabalho */ }

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
  harpsichord: { label: 'Cravo', file: 'harpsichord' },
  // Percussão melódica e efeitos
  marimba: { label: 'Marimba/Xilofone', file: 'marimba' },
  glockenspiel: { label: 'Glockenspiel (sinos)', file: 'glockenspiel' },
  timpani: { label: 'Tímpanos', file: 'timpani' },
  tambourine: { label: 'Pandeirola', file: 'tambourine' },
  triangle: { label: 'Triângulo', file: 'triangle' },
  congas: { label: 'Congas', file: 'congas' }
}

// O QUE FUNCIONA DE VERDADE — e são DUAS peneiras, não uma.
//
// Um nome só separa som quando passa nas duas:
//   1) está na lista de entradas que o nosso modelo da nuvem aceita (55 nomes);
//   2) tem PESO publicado no repositório dos 53 stems no HuggingFace.
//
// Elas não batem, e foi aí que eu me enganei duas vezes no mesmo dia:
//   - 'keys', 'digital-piano', 'bells', 'wind-chimes' TÊM peso, mas o nosso
//     modelo recusa o nome na entrada ("não está no catálogo"). 17 chamadas
//     pagas terminaram assim.
//   - 'clavinet', 'steel-guitar', 'vibraphone', 'xylophone' o modelo ACEITA,
//     mas não existe peso pra baixar: a máquina liga e morre em 404. Eu tinha
//     acabado de acrescentar esses quatro achando que estava consertando —
//     estava cavando o mesmo buraco pelo outro lado.
// Nos dois casos o prejuízo é igual: dinheiro gasto, resposta nenhuma, e o
// trecho fica marcado como pergunta perdida (que NÃO confessa, e emudece).
//
// A lista abaixo é o CRUZAMENTO das duas — os 44 que realmente separam,
// conferidos contra a API do HuggingFace e contra a recusa do próprio modelo.
// O laço embaixo não é decoração: nome fora daqui sai do arsenal na carga, com
// aviso, em vez de virar cobrança silenciosa meses depois.
//
// (Os 9 que têm peso e o modelo recusa — keys, bells, digital-piano,
// wind-chimes, back-vocal, lead-vocal, hh, wind, vocal — são som de verdade que
// a gente está deixando na mesa. Recuperá-los é republicar o modelo na nuvem
// com a lista de entrada certa, não mexer aqui.)
const CATALOGO_NUVEM = new Set([
  'accordion', 'acoustic-guitar', 'banjo', 'bass', 'bassoon', 'bowed_strings',
  'brass', 'cello', 'clarinet', 'congas', 'dobro', 'double-bass', 'drums',
  'electric-guitar', 'flute', 'french-horn', 'glockenspiel', 'guitar',
  'harmonica', 'harp', 'harpsichord', 'kick', 'mandolin', 'marimba', 'oboe',
  'organ', 'percussion', 'piano', 'saxophone', 'sitar', 'snare', 'strings',
  'synth', 'tambourine', 'timpani', 'toms', 'triangle', 'trombone', 'trumpet',
  'tuba', 'ukulele', 'viola', 'violin', 'woodwind'
])
for (const [id, s] of Object.entries(SPECIALISTS)) {
  if (CATALOGO_NUVEM.has(s.file)) continue
  console.warn(`[arsenal] "${id}" pede "${s.file}", que a nuvem não tem — fora do arsenal pra não gastar à toa`)
  delete SPECIALISTS[id]
}

// Nomes que o olheiro ainda usa e o arsenal não tem mais. Sino de orquestra e
// carrilhão são a mesma família metálica do glockenspiel, que existe de verdade.
const APELIDOS_FARO = { bells: 'glockenspiel', 'wind-chimes': 'glockenspiel' }

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
      apagarPasta(work)
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

      // 3. Separação base SÓ das amostras (~2 min no processador)
      onProgress({ id, stage: 'separating', percent: 0 })

      // Na nuvem são segundos. Aqui, ao contrário da extração de instrumento,
      // a queda pro local É aceitável: são 2 minutos limitados, não 47, e esta
      // é a PRIMEIRA tela — travar aqui deixaria a pessoa sem nem saber o que
      // tem na música dela. Custo limitado vale mais que bloqueio total.
      let stemDoPlano = null
      if (usarNuvem()) {
        try {
          const { separarNaNuvem } = await import('./nuvem.js')
          mkdirSync(join(work, 'sep'), { recursive: true })
          const rn = await separarNaNuvem({
            chave: lerChaveNuvem(),
            model: 'htdemucs',
            srcWav: sampleWav,
            inputFile: sampleWav,
            workDir: join(work, 'sep'),
            ffmpegPath,
            state,
            run,
            onProgress: (pr) => onProgress({ id, ...pr, nuvem: true })
          })
          somarGastoNuvem(rn.segundos, { maquina: 'a100' })
          stemDoPlano = rn.rawPaths
        } catch (err) {
          if (err?.segundosGastos) somarGastoNuvem(err.segundosGastos, { maquina: 'a100' }) // GPU queimada antes de morrer tambem e dinheiro
          if (state.cancelled) throw err
          onStatus({ id, state: 'running', nuvem: 'falhou', aviso: `Nuvem: ${err.message}. Farejando aqui mesmo (uns 2 minutos).` })
        }
      }

      if (!stemDoPlano) await run(
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
      const faixaDo = (stem) => stemDoPlano?.[stem] || join(sepDir, `${stem}.wav`)
      const baseInfo = {}
      for (const stem of ['vocals', 'drums', 'bass', 'other']) {
        let mean = -99
        await run(ffmpegPath, ['-i', faixaDo(stem), '-af', 'volumedetect', '-f', 'null', '-'], state, (line) => {
          const m = line.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)/)
          if (m) mean = parseFloat(m[1])
        })
        baseInfo[stem] = { present: mean > -48, mean }
      }

      // 5. Olheiro escuta o "outros" das amostras
      onProgress({ id, stage: 'scouting', percent: 95 })
      const scoutOut = await runScoutScript(faixaDo('other'), state)

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
      apagarPasta(work)
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
  // CANCELADOR MEDIDO, não subtração cega. A gaita foi extraída do MIX
  // inteiro, mas o "outros" só continha PARTE dela (o resto o separador de voz
  // tinha levado). Subtrair 1,0x de quem só tem 0,5x INSERE o instrumento
  // invertido — e invertido soa igualzinho. Era por isso que a gaita
  // continuava "limpinha" dentro do Outros. O cancelador mede quanto de cada
  // faixa extraída existe DENTRO do outros, janela a janela, e subtrai só isso.
  const tmp = join(dir, 'base', 'other_limpo_tmp.flac')
  await run(
    process.execPath,
    [limpaVazamentoPath(), ffmpegPath, orig, tmp, ...extracted.map((inst) => join(dir, 'base', `${inst}.flac`))],
    state, null,
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
  )
  rmSync(join(dir, 'base', 'other.flac'), { force: true })
  renameSync(tmp, join(dir, 'base', 'other.flac'))
  const m2 = readMeta(dir)
  m2.otherCleanFor = extracted.slice().sort().join(',')
  writeMeta(dir, m2)
}

// FISCAL DE ABERTURA: se o app caiu antes do desconto (queda de energia no meio
// de uma fila), a sessão abre inconsistente — aqui ela se conserta sozinha.
// Versão da limpeza de vazamento. Subiu pra 1 quando a subtração cega virou
// cancelador medido: sessão marcada com menos que isso foi construída com a
// matemática velha (que INSERIA instrumento invertido no "outros" e deixava a
// voz suja) e se conserta sozinha na abertura — os _orig guardados garantem
// que refazer nunca degrada. É o mesmo contrato das versões de letra e cifra:
// melhoria de motor alcança TODA música já processada, sem reimportar nada.
const LIMPEZA_V = 1

// AUTOCURA: faixa que está no disco e o registro não conhece.
//
// Extrair um especialista são DOIS fatos separados — o arquivo em `base/` e a
// linha no registro da música. Entre um e outro cabe queda de luz, app fechado
// à força, processo morto. Quando cai nessa fresta, o som existe e o app não
// sabe: a faixa não aparece na mesa, e — o que dói mais — a próxima dissecação
// COMPRA TUDO DE NOVO, porque o motor decide quem interrogar olhando o
// registro, nunca a pasta.
//
// Aconteceu na Oceano: seis faixas pagas, inteiras, nenhuma registrada.
//
// Aqui a PASTA manda. Todo .flac de especialista que o registro não cita é
// adotado com a MESMA balança da extração — inclusive a prateleira, senão faixa
// quase-muda entra na mesa se passando por instrumento.
async function adotarOrfaos(dir, ffmpegPath) {
  const meta = readMeta(dir)
  if (!meta) return 0
  const conhecidas = new Set([...stemsOf(meta), ...(meta.extracted || [])])
  let orfas
  try {
    orfas = readdirSync(join(dir, 'base'))
      .filter((n) => n.endsWith('.flac'))
      .map((n) => n.slice(0, -5))
      .filter((id) => SPECIALISTS[id] && !conhecidas.has(id))
  } catch { return 0 }
  if (!orfas.length) return 0

  let adotadas = 0
  for (const id of orfas) {
    let mean = -99
    let max = -99
    try {
      await run(ffmpegPath, ['-i', join(dir, 'base', `${id}.flac`), '-af', 'volumedetect', '-f', 'null', '-'], {}, (linha) => {
        const mm = linha.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)/)
        if (mm) mean = parseFloat(mm[1])
        const mx = linha.match(/max_volume:\s*(-?\d+(?:\.\d+)?)/)
        if (mx) max = parseFloat(mx[1])
      })
    } catch { continue } // não deu pra medir agora: continua órfã e tenta na próxima abertura
    const m = readMeta(dir)
    if (!m) return adotadas
    const stems = stemsOf(m).filter((s) => s !== id && s !== 'other')
    stems.push(id, 'other')
    m.stems = stems
    m.stemInfo = m.stemInfo || {}
    // MESMA régua da extração (não uma parecida): presente por média audível OU
    // por pico real, e prateleira pra evidência fraca
    const present = mean > -48 || max > -35
    m.stemInfo[id] = { present, mean, max, shelved: present && mean <= -42 }
    m.extracted = [...new Set([...(m.extracted || []), id])]
    writeMeta(dir, m)
    diario(dir, `adotei faixa órfã: ${id} (média ${mean} dB, pico ${max} dB)`)
    adotadas++
  }
  // quem desconta do "outros" é o fiscal aqui embaixo: com a faixa registrada,
  // a assinatura de limpeza muda sozinha e a reconstrução acontece
  return adotadas
}

export async function repairSession({ key, ffmpegPath }) {
  const dir = join(STEMS_DIR, key)
  const adotadas = await adotarOrfaos(dir, ffmpegPath)
  const meta = readMeta(dir)
  if (!meta?.extracted?.length) return adotadas > 0
  const want = meta.extracted
    .filter((i) => existsSync(join(dir, 'base', `${i}.flac`)))
    .sort().join(',')
  const desatualizada = (meta.limpezaV || 0) < LIMPEZA_V
  if (!want || (meta.otherCleanFor === want && !desatualizada)) return adotadas > 0
  await rebuildOther(dir, ffmpegPath, {})
  await cleanVocalsBleed(dir, ffmpegPath, {})
  const m2 = readMeta(dir)
  m2.limpezaV = LIMPEZA_V
  writeMeta(dir, m2)
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
      if (f.startsWith(`${instrument}_p`)) apagarPasta(join(workRoot, f))
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
// `nuvemObrigatoria`: trabalho que o USUÁRIO não pediu (a dissecação automática)
// nunca pode cair no processador local. Checar o teto só na largada do lote não
// bastava: cada instrumento extraído na nuvem soma gasto, então o teto podia
// estourar DENTRO do lote e o instrumento nº 2 ia pra CPU — 47 minutos que
// ninguém pediu, sem botão de parar. Aqui a regra é por instrumento: sem nuvem,
// pula e avisa.
export function startExtractJob({ key, instruments, ffmpegPath, onProgress, onStatus, nuvemObrigatoria = false }) {
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


      const falhasNuvem = []
      for (const instId of wanted) {
        const spec = SPECIALISTS[instId]

        // Atualiza o material de trabalho: mix menos o que já foi reivindicado
        await subtractInto(meta.sourceFile, mixWav)

        const defs = pieceDefsFor[instId]
        let outPieces = []

        // NUVEM PRIMEIRO. Aqui está o grosso da espera: no processador cada
        // instrumento custa ~47 minutos, e numa música com gaita, dobro e
        // órgão isso vira 141 dos 166 minutos totais. Na GPU o mesmo trabalho
        // leva menos de 2. Vem antes do `ensureSpecialist` de propósito: se vai
        // rodar na nuvem, não faz sentido baixar 77MB de modelo pra cá.
        let naNuvem = false
        if (usarNuvem()) {
          try {
            const { extrairInstrumentoNaNuvem } = await import('./nuvem.js')
            const alvo = join(workRoot, `${instId}_nuvem.wav`)
            onProgress({ id, stage: 'extracting', instrument: instId, label: spec.label, nuvem: true, percent: Math.round((step / totalSteps) * 100) })
            const r = await extrairInstrumentoNaNuvem({
              chave: lerChaveNuvem(),
              instrumento: spec.file,
              arquivo: mixWav,
              destino: alvo,
              state,
              ffmpegPath,
              run,
              workDir: workRoot,
              onProgress: (pct) => onProgress({
                id, stage: 'extracting', instrument: instId, label: spec.label, nuvem: true,
                percent: Math.round(((step + pct / 100) / totalSteps) * 100)
              })
            })
            somarGastoNuvem(r.segundos, { maquina: 'gpu' })
            outPieces = [{ file: alvo, start: 0 }]
            step += defs.length
            naNuvem = true
          } catch (err) {
            if (err?.segundosGastos) somarGastoNuvem(err.segundosGastos, { maquina: 'gpu' }) // GPU queimada antes de morrer tambem e dinheiro
            if (state.cancelled) throw err
            // NÃO cai pro processador escondido (47 min travariam a máquina —
            // já travaram), e um instrumento falhando NÃO derruba os outros:
            // um soluço de API num deles cancelava o lote inteiro de quatro.
            // Falhou, anota, avisa e segue pro próximo. O que faltou continua
            // na lista pra tentar de novo com um clique.
            falhasNuvem.push(spec.label)
            onStatus({
              id, state: 'running', nuvem: 'falhou',
              aviso: `Nuvem: ${spec.label} falhou (${err.message}). Seguindo com os próximos — dá pra tentar esse de novo depois.`
            })
            step += defs.length
            continue
          }
        } else if (nuvemObrigatoria) {
          // teto estourou no meio do próprio lote (ou a chave sumiu): pular é a
          // única saída honesta — o caminho local aqui seria sequestro da máquina
          falhasNuvem.push(spec.label)
          onStatus({
            id, state: 'running', nuvem: 'falhou',
            aviso: `Nuvem indisponível (teto de gasto ou chave): ${spec.label} ficou pra depois.`
          })
          step += defs.length
          continue
        }

        if (naNuvem) {
          // faixa pronta, pula o caminho local inteiro
        } else {
        onProgress({ id, stage: 'downloading-model', instrument: instId, label: spec.label, percent: Math.round((step / totalSteps) * 100) })
        const { ckpt, cfg } = await ensureSpecialist(instId)

        // Processa só os pedaços onde o instrumento toca (ou tudo, se ele
        // estiver presente na música inteira) — cada pedaço num processo novo
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
          apagarPasta(segIn)
          apagarPasta(segOut)
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
          apagarPasta(segIn)
          apagarPasta(segOut)
          outPieces.push({ file: piece, start: Math.round(pd.start) })
          step++
        }
        }

        // Monta a faixa completa (pedaços no lugar certo, silêncio no resto)
        onProgress({ id, stage: 'converting', instrument: instId, label: spec.label, percent: Math.round((step / totalSteps) * 100) })
        await assembleWithSilence(ffmpegPath, outPieces, duration, join(dir, 'base', `${instId}.flac`), state)
        for (let pi = 0; pi < defs.length; pi++) {
          rmSync(join(workRoot, `${instId}_p${pi}.wav`), { force: true })
        }
        // O workRoot não é limpo de propósito (pedaço pronto é reaproveitado se
        // a extração for interrompida), mas o arquivo da nuvem já virou FLAC —
        // são 87MB por instrumento que não servem mais pra nada
        rmSync(join(workRoot, `${instId}_nuvem.wav`), { force: true })
        rmSync(join(workRoot, `envio_${spec.file}.flac`), { force: true })

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
        let gpStemDir = join(workRoot, 'gp_out', 'htdemucs_6s', 'other')
        let gpOk = true
        if (usarNuvem()) {
          // O ÚLTIMO passo pesado que ainda rodava aqui: um Demucs local de
          // ~3GB que estourou a memória da máquina de 6GB no meio de um lote e
          // derrubou o que faltava. Mesma regra dos especialistas: a nuvem
          // falhou? anota, avisa e segue — nada de Demucs local escondido.
          try {
            const { gpNaNuvem } = await import('./nuvem.js')
            const alvoDir = join(workRoot, 'gp_nuvem')
            mkdirSync(alvoDir, { recursive: true })
            const rg = await gpNaNuvem({
              chave: lerChaveNuvem(),
              arquivo: gpWav,
              quais: gpWanted,
              destinoDir: alvoDir,
              ffmpegPath,
              run,
              workDir: workRoot,
              state,
              onProgress: (pct) => onProgress({
                id, stage: 'extracting', instrument: gpWanted[0], label: gpLabel, nuvem: true,
                percent: Math.round(pctBase + (pct * pctSpan) / 100)
              })
            })
            somarGastoNuvem(rg.segundos, { maquina: 'a100' })
            gpStemDir = alvoDir
          } catch (err) {
            if (err?.segundosGastos) somarGastoNuvem(err.segundosGastos, { maquina: 'a100' }) // GPU queimada antes de morrer tambem e dinheiro
            if (state.cancelled) throw err
            gpOk = false
            falhasNuvem.push(gpLabel)
            onStatus({ id, state: 'running', nuvem: 'falhou', aviso: `Nuvem: ${gpLabel} falhou (${err.message}). Dá pra tentar de novo depois.` })
          }
        } else if (nuvemObrigatoria) {
          // o Demucs local de ~3GB já derrubou a máquina de 6GB uma vez; sem
          // nuvem esse passo espera, não sequestra o computador
          gpOk = false
          falhasNuvem.push(gpLabel)
          onStatus({
            id, state: 'running', nuvem: 'falhou',
            aviso: `Nuvem indisponível (teto de gasto ou chave): ${gpLabel} ficou pra depois.`
          })
        } else {
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
        }
        if (gpOk) {
        onProgress({ id, stage: 'converting', instrument: gpWanted[0], label: gpLabel, percent: Math.round(((step + gpUnits) / totalSteps) * 100) })
        const m2 = readMeta(dir)
        const arr = stemsOf(m2).filter((s) => !['other', ...gpWanted].includes(s))
        const bi = arr.indexOf('bass')
        for (const s of gpWanted) {
          await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', join(gpStemDir, `${s}.wav`), '-compression_level', '5', join(dir, 'base', `${s}.flac`)], state)
          m2.stemInfo = m2.stemInfo || {}
          // Mesma balança dos especialistas: antes era present:true na fé, e
          // música sem teclado ganhava uma pista muda
          let gpMean = -99
          let gpMax = -99
          await run(ffmpegPath, ['-i', join(dir, 'base', `${s}.flac`), '-af', 'volumedetect', '-f', 'null', '-'], state, (line) => {
            const mm = line.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)/)
            if (mm) gpMean = parseFloat(mm[1])
            const mx = line.match(/max_volume:\s*(-?\d+(?:\.\d+)?)/)
            if (mx) gpMax = parseFloat(mx[1])
          })
          m2.stemInfo[s] = { present: gpMean > -48 || gpMax > -35, mean: gpMean, max: gpMax }
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
        }
        step += gpUnits
      }

      // 4. Fechamento: garante o "outros" limpo (cobre também guitarra/piano)
      await rebuildOther(dir, ffmpegPath, state)

      // E a VOZ também é vítima de reivindicação: o separador de voz puxa pra
      // dentro dela o que soa parecido — gaita entra com correlação de até
      // 0,99 (medido na Samurai; é o instrumento mais "voz" que existe). O
      // cancelador subtrai de vocals só a fração medida de cada faixa
      // extraída; onde α dá zero, a voz passa intocada. Sempre a partir do
      // original guardado, então rodar de novo nunca degrada.
      await cleanVocalsBleed(dir, ffmpegPath, state)
      {
        const mLv = readMeta(dir)
        mLv.limpezaV = LIMPEZA_V
        writeMeta(dir, mLv)
      }

      apagarPasta(workRoot)
      touchSession(dir)
      onStatus({
        id, state: 'done', session: sessionPayload(key, readMeta(dir)),
        // o resumo do que a nuvem não entregou — os que saíram JÁ estão na
        // música; os que faltaram continuam na lista pra tentar de novo
        ...(falhasNuvem.length ? { aviso: `A nuvem falhou em: ${falhasNuvem.join(', ')}. O resto foi feito — marca de novo só o que faltou.` } : {})
      })
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

// ---------- DISSECAÇÃO COMPLETA: o separador presta contas da música toda ----
// Decisão de produto do dono (2026-08-05): "o separador é separador — ele vai
// na música e disseca POR COMPLETO. Achar TODAS as faixas é responsabilidade
// do sistema, não do usuário. Nome é o que menos importa."
//
// O detector NÃO decide mais o que existe. A flauta da Samurai é o caso de
// estudo do porquê: o faro cheirou "órgão 0.46", o especialista de órgão veio
// vazio e o motor antigo declarou "fantasma" — era uma flauta fantasiada de
// órgão, achada pelo OUVIDO DO DONO. O erro não foi cheirar errado (máquina
// nomeia mal, sempre nomeou); foi MORRER NO PRIMEIRO NOME.
//
// O motor novo: o cheiro é só a LANTERNA (aponta onde olhar e quem chamar
// primeiro). Quem decide é a BALANÇA: corta-se o trecho suspeito, especialistas
// sondam o clipe (centavos, segundos) — o suspeito e os primos de timbre dele,
// um por um, até alguém reivindicar de verdade. Quem reivindica extrai a
// música INTEIRA. E o que ninguém reivindicar é CONFESSADO na tela com o
// horário — som que existe nunca mais é engolido em silêncio.
//
// Só roda com a nuvem ligada: no processador cada sonda custaria 47 minutos.
// Versão do motor: subiu = música antiga refaz a dissecação ao abrir.
// 3: sintetizador virou primo de cordas (o pad disfarçado da Samurai) e as
//    sondas de um trecho passaram a ser feitas em paralelo.
// 4: energia do "outros" também abre interrogatório. Antes só o cheiro abria,
//    e som que o faro não reconhece sumia sem faixa E sem confissão — buraco
//    que contradizia a doutrina inteira. Medido na Girlfriend: som concentrado
//    em 1:01–1:21 que nunca tinha sido perguntado.
const DISSEC_V = 4
// A partir desta versão o registro de sondas tem a forma {inst, ini, fim}. Ele
// SOBREVIVE à subida do motor de propósito: "já perguntei pro violino às 1:22"
// continua verdade, e o parentesco novo (sintetizador) entra na fila sem
// repagar as perguntas velhas.
const SONDAS_V = 2

// Seção engole os solistas: Metais extraído deixa eco de trombone/trompete no
// faro — interrogar isso seria pagar pra colher resíduo. Regra conquistada a suor.
const FAMILIAS = {
  brass: ['trumpet', 'trombone', 'french-horn', 'tuba', 'saxophone'],
  strings: ['violin', 'viola', 'cello', 'double-bass'],
  woodwind: ['flute', 'clarinet', 'oboe', 'bassoon']
}

// Primos de timbre: quem confunde com quem. É o antídoto do "morre no primeiro
// nome" — órgão que testa vazio manda sondar o resto do grupo dos sustentados
// (foi exatamente o caminho que teria achado a flauta sozinho).
const TIMBRES = [
  ['organ', 'synth', 'accordion', 'flute', 'harmonica', 'harpsichord'],
  ['brass', 'trumpet', 'trombone', 'french-horn', 'tuba', 'saxophone'],
  // synth/keys entram nas CORDAS por MEDIÇÃO, não por teoria: na Samurai a
  // dissecação confessou som forte (-26,7 dB) em 1:22 e 3:32 que o faro chamou
  // de "violino"; os cinco especialistas de corda vieram vazios e o de
  // SINTETIZADOR arrancou o grosso (sobrou -35,8 dB). Pad de sintetizador
  // imitando cordas é o disfarce mais comum que existe em música gravada.
  // Só aqui — espalhar o sintetizador por todos os grupos faria um cheiro dele
  // virar região de 26 candidatos, e aí a conta de centavos explode por teoria.
  ['strings', 'violin', 'viola', 'cello', 'double-bass', 'synth'],
  ['clarinet', 'oboe', 'bassoon', 'woodwind', 'flute'],
  ['acoustic-guitar', 'banjo', 'mandolin', 'ukulele', 'dobro', 'harp', 'harpsichord', 'sitar'],
  ['glockenspiel', 'marimba'],
  ['percussion', 'timpani', 'congas', 'tambourine', 'triangle']
]
const grupoDeTimbre = (inst) => TIMBRES.filter((g) => g.includes(inst)).flat()

const CHEIRO_MIN = 0.12      // lanterna, não juiz: acima disso o trecho merece interrogatório
const SPOTS_POR_RODADA = 4   // trechos interrogados por rodada, mais cheirosos primeiro
const SONDAS_POR_SPOT = 6    // teto de centavos por interrogatório
const DISSEC_RODADAS = 3     // tirar um som levanta o véu do de baixo
const ORFAOS_POR_RODADA = 2  // trechos com som mas SEM cheiro, por rodada
const CLIPE_S = 40           // tamanho do pedaço que vai pra sonda
const SEGUNDOS_POR_SONDA = 45 // medido: sonda de clipe de 40s custa 27–46s de GPU

// ONDE AINDA TEM SOM SEM DONO — a pergunta que não depende de nomear nada.
//
// O gatilho do interrogatório era só o CHEIRO do farejador. Isso deixava um
// buraco que contradiz a doutrina inteira: som que o faro não cheira nunca é
// interrogado, então não vira faixa NEM confissão — some calado. Medido na
// Girlfriend: três concentrações de som no "outros", e a de 1:01–1:21 nunca
// tinha sido perguntada porque nada cheirou lá.
//
// Aqui a pergunta é outra, e não precisa de nome nenhum: onde o som se
// CONCENTRA acima da linha de base da própria música? Vazamento e sobra são
// finos e espalhados; instrumento de verdade faz corcova. A régua é relativa
// (cada música tem seu próprio piso) com um chão absoluto pra não caçar
// silêncio.
const DESTAQUE_DB = 4      // quanto a região precisa subir acima da base da música
const CHAO_DB = -45        // abaixo disso é sussurro, não vale os centavos
const REGIAO_MIN_S = 6     // corcova curta demais é batida, não instrumento
const REGIAO_BURACO_S = 3  // respiro dentro da mesma frase não parte a região

async function regioesComSom(ffmpegPath, arquivo, workDir, state) {
  const canal = await decodificarMono(ffmpegPath, arquivo, workDir, 'perfil', state)
  const SR = 44100
  const porSeg = []
  for (let s = 0; s * SR < canal.length; s++) {
    let e = 0
    const ini = s * SR
    const fim = Math.min(canal.length, ini + SR)
    for (let i = ini; i < fim; i++) e += canal[i] * canal[i]
    porSeg.push(20 * Math.log10(Math.sqrt(e / Math.max(1, fim - ini)) + 1e-12))
  }
  if (porSeg.length < REGIAO_MIN_S) return []
  const ordenado = [...porSeg].sort((a, b) => a - b)
  const base = ordenado[Math.floor(ordenado.length / 2)]
  const alvo = Math.max(base + DESTAQUE_DB, CHAO_DB)

  const regs = []
  let ini = -1
  let buraco = 0
  for (let i = 0; i <= porSeg.length; i++) {
    const alto = i < porSeg.length && porSeg[i] >= alvo
    if (alto) { if (ini < 0) ini = i; buraco = 0; continue }
    if (ini < 0) continue
    buraco++
    if (buraco > REGIAO_BURACO_S || i >= porSeg.length) {
      const fim = i - buraco
      if (fim - ini + 1 >= REGIAO_MIN_S) {
        let soma = 0
        for (let k = ini; k <= fim; k++) soma += porSeg[k]
        regs.push({ ini, fim, db: soma / (fim - ini + 1) })
      }
      ini = -1
      buraco = 0
    }
  }
  return regs.sort((a, b) => b.db - a.db)
}

// Decodifica pra mono f32 (mesma régua do limpa_vazamento) pra pesar e comparar
async function decodificarMono(ffmpegPath, audio, workDir, tag, state) {
  const tmp = join(workDir, `mono_${tag}.pcm`)
  await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', audio, '-ac', '1', '-ar', '44100', '-f', 'f32le', tmp], state)
  const buf = readFileSync(tmp)
  rmSync(tmp, { force: true })
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
}

// Balança da sonda: segundos com som de verdade e pico. Vazio não reivindica.
function pesarCanal(canal) {
  const SR = 44100
  let vivos = 0
  let pico = -99
  for (let s = 0; s * SR < canal.length; s++) {
    let e = 0
    const ini = s * SR
    const fim = Math.min(canal.length, ini + SR)
    for (let i = ini; i < fim; i++) e += canal[i] * canal[i]
    const db = 20 * Math.log10(Math.sqrt(e / (fim - ini)) + 1e-12)
    if (db > -45) vivos++
    if (db > pico) pico = db
  }
  return { vivos, pico }
}

// O especialista TIROU alguma coisa do clipe, ou só devolveu o que recebeu?
// Passagem direta soa como reivindicação perfeita — muito som, correlação alta —
// mas não separou nada: seria uma faixa idêntica ao "outros". A prova é o
// resíduo: clipe menos o que ele levou. Se sobrou quase silêncio, ele levou
// tudo, e "tudo" não é instrumento nenhum.
function sobrouAlgo(clipe, extraido, margemDb = 20) {
  const n = Math.min(clipe.length, extraido.length)
  let ec = 0
  let ee = 0
  let ce = 0
  let er = 0
  for (let i = 0; i < n; i++) {
    ec += clipe[i] * clipe[i]
    ee += extraido[i] * extraido[i]
    ce += clipe[i] * extraido[i]
    const d = clipe[i] - extraido[i]
    er += d * d
  }
  if (ec <= 0) return false
  // Sósia com o volume mexido também é passagem direta: devolver o clipe a 70%
  // deixa resíduo de -10 dB e escaparia da conta de energia. A forma de onda
  // entrega — cópia escalada tem correlação ~1 com a entrada. O limiar é alto
  // (0,995) de propósito: instrumento que domina 95% do trecho já dá ~0,975, e
  // esse é legítimo.
  const corr = ce / (Math.sqrt(ec * ee) + 1e-20)
  if (corr > 0.995) return false
  const db = 10 * Math.log10((er + 1e-20) / ec)
  return db > -margemDb
}

// Guarda anti-eco: fração das janelas (onde a sonda tem som) que são iguais a
// uma faixa que JÁ existe. Sonda de flauta no mix cru "achava" a gaita (66%) —
// eco não é descoberta, é a mesma faixa com outro nome.
function fracaoEco(sonda, faixa) {
  const J = 4096
  const n = Math.min(sonda.length, faixa.length)
  let comSom = 0
  let ecos = 0
  for (let ini = 0; ini + J <= n; ini += J) {
    let aa = 0
    let bb = 0
    let ab = 0
    for (let i = ini; i < ini + J; i++) { aa += sonda[i] * sonda[i]; bb += faixa[i] * faixa[i]; ab += sonda[i] * faixa[i] }
    if (Math.sqrt(aa / J) < 1e-4) continue
    comSom++
    if (ab / (Math.sqrt(aa * bb) + 1e-12) > 0.5) ecos++
  }
  return comSom ? ecos / comSom : 0
}

// Sonda paga é resposta guardada — MAS SÓ PRA AQUELE PEDAÇO DA MÚSICA. Veto
// global era o "morre no primeiro nome" renascendo: flauta sondada vazia em
// 0:40 (onde ela não toca) calaria o cheiro real dela em 3:00, e o trecho nem
// viraria confissão. Cada sonda vale só dentro da janela onde foi feita.
// `span` existe porque o cheiro do farejador não é um instante: é uma janela de
// 10s começando em `t`. Só vale como respondido o cheiro coberto por INTEIRO —
// mas a janela é aparada pelo FIM DA MÚSICA. Sem essa aparagem, cheiro nos
// últimos 10 segundos era impossível de responder (o clipe termina junto com a
// música, então `t+10 <= fim` nunca fechava): as mesmas sondas eram repagas a
// cada rodada e a cada abertura, pra sempre, e a música nunca convergia.
const jaSondou = (sondas, inst, t, span = 0, dur = Infinity) =>
  sondas.some((s) => s.inst === inst && t >= s.ini && Math.min(t + span, dur) <= s.fim)

// Um cheiro só morre quando NÃO SOBROU NINGUÉM pra chamar naquele pedaço. Se o
// interrogatório de lá foi cortado no meio (teto, cancelamento, falha de API),
// os candidatos que não chegaram a ser sondados ainda merecem a vez — antes,
// bastava o instrumento do cheiro ter sido sondado pra região inteira calar.
function regiaoEsgotada(sondas, inst, at, ja, dur) {
  return [...new Set([inst, ...grupoDeTimbre(inst)])]
    .filter((i) => SPECIALISTS[i] && !ja.has(i))
    .every((i) => jaSondou(sondas, i, at, 10, dur))
}

// Interrogatório de um trecho: sondas baratas no clipe até alguém reivindicar.
// Devolve o dono (ou null), quem foi sondado e o melhor palpite pra confissão.
async function interrogarTrecho({ dir, workRoot, ffmpegPath, trecho, at, dur, suspeitos, semPrimos, sondas, jaDonos, notas, state, aoSondar }) {
  const meta = readMeta(dir)
  const ja = new Set([...stemsOf(meta), ...(meta?.extracted || []), ...(jaDonos || [])])
  // MESMA RÉGUA do portão lá fora (regiaoEsgotada): ali o cheiro é medido em
  // `at` com janela de 10s. Medir aqui pelo meio do clipe fazia o spot passar no
  // portão e chegar vazio — trecho interrogado sem ninguém pra chamar, e o som
  // sumia sem virar faixa nem confissão.
  // Trecho aberto por CHEIRO começa num nome e puxa os primos de timbre (é o
  // antídoto do "morre no primeiro nome"). Trecho aberto por ENERGIA não tem
  // nome nenhum: a lista já chega pronta e ordenada, e puxar primos só
  // encheria a fila de gente pior colocada.
  const candidatos = (semPrimos ? [...new Set(suspeitos)] : [...new Set([...suspeitos, ...suspeitos.flatMap(grupoDeTimbre)])])
    .filter((i) => SPECIALISTS[i] && !ja.has(i) && !jaSondou(sondas, i, at, 10, dur))
  if (!candidatos.length) return { dono: null, sondados: [], palpite: null, vazio: true, truncado: true }

  // A ordem da fila vem do faro que a RODADA já fez na música inteira. Farejar
  // cada clipe de novo custava até 12 processos de rede neural na máquina do
  // usuário por abertura (um deles simultâneo ao olheiro da tela, no mesmo
  // arquivo) — carga local pesada pra decidir só quem pergunta primeiro.
  const nota = (i) => notas?.[i] || 0
  // `total` é lido ANTES de qualquer aparagem: sort() ordena no MESMO array, e
  // encolher a cópia encolhia o original — o sinal de "ficou pergunta sem
  // fazer" se apagava sozinho, e o trecho cortado por falta de dinheiro virava
  // confissão como se tivesse sido interrogado até o fim (e carimbava a música
  // de dissecada pra sempre). Era o pesadelo do sintetizador voltando pela
  // porta do teto de gasto.
  // (a contagem total nao decide mais nada: o teto de perguntas e desenho, nao interrupcao)
  const ordenados = [...candidatos].sort((a, b) => nota(b) - nota(a))
  // O lote inteiro sai de uma vez, então o teto de gasto é conferido ANTES pro
  // lote INTEIRO — em série ele era reavaliado a cada sonda e parava na hora
  // exata. Sem isso, um lote de 6 podia passar do teto por 5 sondas. E vem
  // antes de cortar o clipe: sem dinheiro pra perguntar, nem o ffmpeg roda.
  const nv = getNuvem()
  let cortadoPorDinheiro = false
  if (nv.tetoCentavos > 0) {
    const sobra = nv.tetoCentavos - gastoCentavos()
    const cabem = Math.floor(sobra / estimativaCentavos(SEGUNDOS_POR_SONDA))
    if (cabem <= 0) return { dono: null, sondados: [], palpite: null, truncado: true, semTeto: true }
    if (cabem < Math.min(ordenados.length, SONDAS_POR_SPOT)) cortadoPorDinheiro = true
    ordenados.length = Math.min(ordenados.length, cabem)
  }
  const fila = ordenados.slice(0, SONDAS_POR_SPOT)
  const palpite = fila[0] || suspeitos[0] || null

  const outros = join(dir, 'base', 'other.flac')
  const clipe = join(workRoot, `trecho_${trecho.ini}.flac`)
  const durClipe = trecho.fim - trecho.ini
  await run(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', String(trecho.ini), '-t', String(durClipe), '-i', outros, clipe], state)

  // Faixas existentes no mesmo trecho, pro teste do eco. Preguiçoso de
  // propósito: só decodifica quando uma sonda traz som de verdade — a maioria
  // volta vazia e não precisa de comparação nenhuma.
  let vizinhos = null
  const carregarVizinhos = async () => {
    if (vizinhos) return vizinhos
    vizinhos = []
    for (const s of stemsOf(meta)) {
      if (s === 'other') continue
      const f = join(dir, 'base', `${s}.flac`)
      if (!existsSync(f)) continue
      const cl = join(workRoot, `viz_${s}.flac`)
      await run(ffmpegPath, ['-y', '-loglevel', 'error', '-ss', String(trecho.ini), '-t', String(durClipe), '-i', f, cl], state)
      vizinhos.push(await decodificarMono(ffmpegPath, cl, workRoot, `viz_${s}`, state))
      try { rmSync(cl, { force: true }) } catch { /* preso pelo ffmpeg que acabou de sair; some com a bancada */ }
    }
    return vizinhos
  }

  const sondados = []
  // Interrogatório cortado no meio (teto, cancelamento) não é o mesmo que
  // interrogatório concluído sem culpado: no primeiro caso ninguém pode
  // confessar "não tem dono" — a pergunta nem chegou a ser feita até o fim.
  // TRUNCADO = a pergunta foi CORTADA por algo de fora (dinheiro acabou,
  // usuário cancelou, a nuvem falhou). O teto de 6 perguntas por trecho NÃO é
  // interrupção, é o desenho: pergunto aos 6 mais prováveis e, se ninguém
  // reivindicar, isso É a resposta — confesso e fecho o trecho.
  //
  // Tratar o teto como interrupção custou caro de verdade: na Girlfriend o
  // motor fez 32 perguntas em dois trechos, nenhum deles fechou, NENHUMA
  // confissão foi gravada, e o trecho de 1:01 nunca chegou a ser perguntado
  // porque os dois trechos abertos ocupavam as vagas todas as rodadas.
  let truncado = cortadoPorDinheiro
  try {
    if (state.cancelled || !usarNuvem()) return { dono: null, sondados, palpite, truncado: true }
    aoSondar?.(fila)

    // TODAS AS PERGUNTAS DE UMA VEZ. A regra do dono — "não faz tudo junto,
    // compromete a qualidade" — vale pra EXTRAÇÃO, onde cada instrumento
    // precisa ser descontado antes do próximo. Aqui é o contrário: as sondas
    // leem o MESMO clipe congelado e nenhuma depende da outra, então perguntar
    // em paralelo não muda resposta nenhuma. Em série eram ~5 minutos por
    // trecho; juntas, ~45 segundos, pelos mesmos centavos.
    const perguntar = async (inst) => {
      // Cada sonda com seu próprio slot de subprocesso: `state.child` é um só,
      // e com 6 ffmpeg ao mesmo tempo o cancelar alcançava só o último. Os
      // subprocessos vão pra um conjunto no estado do pai, senão o cancelar
      // deixa de alcançar TODOS (era um, virou nenhum).
      const est = {
        _c: null,
        get cancelled() { return state.cancelled },
        get child() { return this._c },
        set child(c) {
          this._c = c
          if (c) { (state.netos = state.netos || new Set()).add(c); c.on?.('close', () => state.netos?.delete(c)) }
        }
      }
      const saida = join(workRoot, `sonda_${inst}.flac`)
      try {
        const { extrairInstrumentoNaNuvem } = await import('./nuvem.js')
        const r = await extrairInstrumentoNaNuvem({
          chave: lerChaveNuvem(),
          instrumento: SPECIALISTS[inst].file,
          arquivo: clipe,
          destino: saida,
          state: est,
          ffmpegPath,
          run,
          workDir: workRoot
        })
        somarGastoNuvem(r.segundos, { maquina: 'gpu' }) // segundos contam pro teto; "música" não
      } catch (e) {
        // GPU queimada por uma sonda que morreu no meio ainda é dinheiro gasto
        if (e?.segundosGastos) somarGastoNuvem(e.segundosGastos, { maquina: 'gpu' })
        // Sonda que não completou NÃO vira veto: quem não foi ouvido continua
        // na fila. Uma falhar não derruba as outras — elas já estão em voo.
        // O MOTIVO viaja junto: sem ele, "sondados=2 de 6" no diário não dizia
        // nada e a causa da perda ficava fora do alcance de qualquer conserto.
        return { inst, falhou: true, erro: e?.message || 'morreu sem dizer por quê' }
      }
      try {
        // decodifica com estado NEUTRO de propósito: a sonda já foi paga e
        // baixada, e um cancelamento pegando essa janela de ~1 segundo jogaria
        // a resposta fora — na próxima abertura ela seria comprada de novo
        const canal = await decodificarMono(ffmpegPath, saida, workRoot, `p_${inst}`, { cancelled: false, child: null })
        const { vivos, pico } = pesarCanal(canal)
        return { inst, canal, vivos, pico }
      } catch {
        return { inst, falhou: true, erro: 'o arquivo da resposta não abriu' }
      } finally {
        try { rmSync(saida, { force: true }) } catch { /* some no fim junto com a bancada */ }
      }
    }

    let respostas = await Promise.all(fila.map(perguntar))

    // SEGUNDA CHAMADA. Pergunta perdida no caminho não é resposta nenhuma: ela
    // marca o trecho como interrompido, e trecho interrompido NÃO CONFESSA —
    // o motor fica mudo sobre um som que ele mesmo ouviu. Foi o que aconteceu
    // na Girlfriend: saíam 6 perguntas, voltavam 2, e 0:53–1:33 nunca virou
    // aviso nenhum. Pior, as 4 perdidas voltam pra fila e se perdem de novo na
    // rodada seguinte — a lista de suspeitos andava de 2 em 2 (24, 22, 20) e a
    // música não fechava nunca. Insistir uma vez custa uma sonda e devolve o
    // trecho pro caminho normal.
    const perdidas = respostas.filter((r) => r.falhou)
    if (perdidas.length) {
      for (const r of perdidas) diario(dir, `    perdi ${r.inst}: ${r.erro}`)
      // não insiste sem dinheiro nem depois do cancelar — e dá um respiro, que
      // o palpite mais provável é engasgo de nuvem recebendo 6 pedidos juntos
      if (!state.cancelled && usarNuvem()) {
        await new Promise((s) => setTimeout(s, 5000))
        aoSondar?.(perdidas.map((r) => r.inst)) // a tela mostra quem está sendo refeito
        const segunda = await Promise.all(perdidas.map((r) => perguntar(r.inst)))
        const porInst = new Map(segunda.map((r) => [r.inst, r]))
        respostas = respostas.map((r) => (r.falhou && porInst.has(r.inst) ? porInst.get(r.inst) : r))
        for (const r of segunda) {
          diario(dir, r.falhou ? `    perdi de novo ${r.inst}: ${r.erro}` : `    ${r.inst} respondeu na segunda`)
        }
      }
    }

    const responderam = respostas.filter((r) => !r.falhou)
    // quem se perdeu DE VEZ: é isso que impede a confissão, e é isso que o
    // trecho pendente mostra pro usuário em vez de silêncio
    const sumiram = respostas.filter((r) => r.falhou).map((r) => r.inst)
    if (sumiram.length) truncado = true
    sondados.push(...responderam.map((r) => r.inst))
    // A balança separa quem trouxe som de quem veio vazio
    const comSom = responderam.filter((r) => r.vivos >= 3 && r.pico > -35)

    // O QUE VIRA VETO, exatamente: só quem deu uma resposta DEFINITIVA de que
    // não há instrumento novo ali — veio vazio, veio eco de faixa que já existe,
    // ou veio passando o clipe adiante sem separar nada. Quem reivindicou de
    // verdade e só perdeu a vez pra outro NÃO é vetado: na rodada seguinte, com
    // o vencedor já extraído, é a vez dele.
    //
    // Não registrar os reprovados era laço de dinheiro: o cheiro daquele pedaço
    // nunca morria, o trecho ocupava uma vaga pra sempre, a música nunca
    // convergia e a MESMA sonda era comprada de novo em toda rodada e em toda
    // abertura.
    const registrar = (lista) => {
      for (const r of lista) sondas.push({ inst: r.inst, ini: trecho.ini, fim: trecho.fim })
    }
    const negaram = responderam.filter((r) => !comSom.includes(r))

    // registro ANTES de desistir por cancelamento: sonda paga é resposta paga,
    // e o lote agora é 6x maior do que era em série
    if (state.cancelled) { registrar(negaram); throw new Error('cancelado') }
    if (!comSom.length) { registrar(negaram); return { dono: null, sondados, palpite, truncado, sumiram } }

    // Eco de faixa que já existe não é descoberta, é a mesma coisa com outro nome
    const viz = await carregarVizinhos()
    // GUARDA ANTI-PASSAGEM: modelo que devolve o clipe quase inteiro não separou
    // nada — só passou o som adiante. Isso venceria qualquer disputa por
    // "quantidade de som", e o teste de eco não pega porque ele compara com as
    // faixas existentes e o "outros" (de onde o clipe saiu) fica de fora de
    // propósito. Aqui a pergunta é outra: o que ele TIROU do clipe?
    const doClipe = await decodificarMono(ffmpegPath, clipe, workRoot, 'clipe', state)
    const validos = comSom.filter((r) =>
      !viz.some((v) => fracaoEco(r.canal, v) > 0.4) && sobrouAlgo(doClipe, r.canal))
    const reprovados = comSom.filter((r) => !validos.includes(r))
    registrar([...negaram, ...reprovados])
    if (!validos.length) return { dono: null, sondados, palpite, truncado, sumiram }

    // Entre os que reivindicaram, quem manda é a ORDEM DA LANTERNA — não o
    // tamanho. Ordenar por "mais segundos de som" elegia sempre o modelo de
    // seção (que por construção cobre mais tempo que qualquer solista dela).
    validos.sort((a, b) => fila.indexOf(a.inst) - fila.indexOf(b.inst))
    // o vencedor também é registrado: se a extração dele falhar, quem desfaz o
    // registro é o rollback lá em cima, que sabe distinguir os dois casos
    registrar([validos[0]])
    return { dono: validos[0].inst, sondados, palpite, truncado: false }
  } finally {
    try { rmSync(clipe, { force: true }) } catch { /* bancada some no fim de qualquer jeito */ }
  }
}

// Confissão é uma afirmação sobre a música DE AGORA: "tem som aqui e eu não
// sei de quem é". Quando uma extração posterior leva esse som (o sintetizador
// da Samurai levou o de 1:22, que caiu de -26,7 para -33,2 dB no "outros"), a
// confissão venceu — deixá-la na tela é apontar pra um som que já tem dono.
// Roda a cada abertura, inclusive nas músicas já dissecadas.
// A pergunta certa não é "esse trecho é alto?" e sim "o som saiu daqui?". Corte
// fixo em -32 dB reprovava injustamente confissão de som fraco mas real: a
// Girlfriend confessa em -38 dB, e o app apagaria o próprio aviso na abertura
// seguinte. O que denuncia som que ganhou dono é a QUEDA — a Samurai caiu de
// -26,7 pra -33,2 quando o sintetizador levou o dela.
const CONFISSAO_QUEDA_DB = 4   // caiu mais que isso = alguém levou o som
const CONFISSAO_CHAO_DB = -50  // abaixo disso não sobrou nada audível

async function revalidarConfissoes(dir, ffmpegPath, semDono, state) {
  if (!semDono?.length) return []
  const outros = join(dir, 'base', 'other.flac')
  if (!existsSync(outros)) return semDono
  const vivas = []
  for (const c of semDono) {
    let mean = -99
    try {
      await run(
        ffmpegPath,
        ['-ss', String(c.ini), '-t', String(Math.max(1, c.fim - c.ini)), '-i', outros, '-af', 'volumedetect', '-f', 'null', '-'],
        state,
        (linha) => {
          const mm = linha.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)/)
          if (mm) mean = parseFloat(mm[1])
        }
      )
    } catch { vivas.push(c); continue } // não deu pra medir: na dúvida, mantém
    if (mean <= CONFISSAO_CHAO_DB) continue // virou silêncio
    // registro velho não tem a medida de origem: cai na régua absoluta antiga
    if (c.db == null) { if (mean > -32) vivas.push({ ...c, db: mean }); continue }
    if (mean > c.db - CONFISSAO_QUEDA_DB) vivas.push({ ...c, db: mean })
  }
  return vivas
}

// Vacina anti-gêmeo da dissecação — a mesma doutrina do activeExtracts, mas
// aqui o motivo é DINHEIRO: fechar e reabrir a música durante o interrogatório
// largava duas dissecações pagando sondas pros MESMOS instrumentos, e as duas
// escrevendo nos mesmos arquivos da bancada (balança lida de arquivo pela
// metade = reivindicação errada = extração inteira no alvo errado).
const activeAutos = new Map()

export function startAutoExtract({ key, ffmpegPath, onProgress, onStatus }) {
  const gemeo = activeAutos.get(key)
  // gêmeo só é adotado enquanto está VIVO: adotar um job nos estertores faria a
  // tela esperar por um status que já passou, e a dissecação de verdade seria
  // pulada em silêncio
  if (gemeo?.vivo) return { ...gemeo, twin: true }

  const id = randomUUID()
  const state = { cancelled: false, child: null }
  // Só a extração que ESTA dissecação começou morre junto com ela. Cancelar
  // "qualquer extração dessa música" matava também a que o usuário pediu no
  // botão ↻ — fechar a tela não pode derrubar trabalho que ele mandou fazer.
  const filha = { atual: null }
  const handle = {
    id,
    vivo: true,
    cancel: () => {
      state.cancelled = true
      // some da adoção NA HORA: o job pode levar segundos pra desenrolar (poll
      // da nuvem de 3s), e reabrir a música nessa janela adotava um moribundo —
      // a música ficava sem dissecação nenhuma, em silêncio
      handle.vivo = false
      try { state.child?.kill() } catch {}
      for (const n of state.netos || []) { try { n.kill() } catch {} } // ffmpeg das sondas paralelas
      try { filha.atual?.cancel?.() } catch {}
    }
  }
  activeAutos.set(key, handle)

  ;(async () => {
    // Respiro: sem ele os retornos curtos (música já dissecada, edição rápida)
    // emitem o "done" ANTES de o invoke devolver o id — a tela então marcava a
    // dissecação como viva depois de ela ter acabado, e o rodinha ficava
    // girando pra sempre. Mesmo truque do startExtractJob.
    await new Promise((r) => setTimeout(r, 250))
    const dir = join(STEMS_DIR, key)
    const workRoot = join(dir, 'dissec_work')
    // Estado do progresso: escrito no fim, seja qual for a saída. `done` só
    // vira true quando a dissecação CONVERGE (nada mais cheira / rodadas
    // esgotadas). Parar por teto, erro ou cancelamento grava done:false com o
    // que já foi sondado — a próxima abertura retoma sem re-pagar as sondas.
    // Carregado ANTES do try: um erro logo no começo não pode fazer o gravar()
    // do catch apagar sondas já pagas em tentativas anteriores.
    const metaInicial = readMeta(dir)
    const anterior = (metaInicial?.autoHarvest?.v || 0) >= SONDAS_V ? metaInicial.autoHarvest : null
    const progresso = {
      procurados: [...(anterior?.procurados || [])],
      semDono: [...(anterior?.semDono || [])],
      sondas: [...(anterior?.sondas || [])]
    }
    let convergiu = false
    let motivoParada = null
    const gravar = () => {
      const m = readMeta(dir)
      if (!m) return null
      m.autoHarvest = {
        done: convergiu, v: DISSEC_V, at: new Date().toISOString(),
        ...(motivoParada ? { parou: motivoParada } : {}),
        procurados: [...new Set(progresso.procurados)],
        semDono: progresso.semDono,
        sondas: progresso.sondas
      }
      writeMeta(dir, m)
      return m
    }
    // Um job emite UM status final. Sem essa trava, um tropeço dentro do
    // fechar() (disco travado no writeMeta) caía no catch e a tela recebia dois
    // finais — ou nenhum, se o tropeço fosse antes do onStatus.
    let fechado = false
    const fechar = (extra = {}) => {
      if (fechado) return
      fechado = true
      try { rmSync(workRoot, { recursive: true, force: true }) } catch { /* lixo de bancada não derruba o aviso */ }
      let m = null
      try { m = gravar() } catch { /* o aviso sai mesmo se o disco recusar */ }
      onStatus({
        id, state: state.cancelled ? 'cancelled' : 'done', auto: true,
        ...(m ? { session: sessionPayload(key, m) } : {}),
        // `completo` é a diferença entre "acabei" e "parei aqui": sem isso a
        // tela dizia "✓ Dissequei a música" pra uma dissecação que vai refazer
        // trabalho na próxima abertura
        completo: convergiu,
        procurados: [...new Set(progresso.procurados)], semDono: progresso.semDono,
        ...(motivoParada ? { parou: motivoParada } : {}), ...extra
      })
    }

    try {
      const meta0 = metaInicial
      if (!meta0) throw new Error('Sessão não encontrada.')
      // Idempotente POR VERSÃO: música dissecada pelo motor atual não repete a
      // cada abertura; motor melhorou (DISSEC_V subiu) = o acervo inteiro
      // re-disseca sozinho na abertura — mesmo contrato da letra e da cifra.
      if (meta0.autoHarvest?.done && (meta0.autoHarvest.v || 1) >= DISSEC_V) {
        // Música já dissecada ainda precisa de uma coisa: conferir se as
        // confissões continuam de pé. Um som confessado numa rodada pode ter
        // ganhado dono numa extração posterior — aí o aviso tem que sair.
        const vivas = await revalidarConfissoes(dir, ffmpegPath, progresso.semDono, state)
        if (vivas.length !== progresso.semDono.length) {
          progresso.semDono = vivas
          convergiu = true
          const m = gravar()
          onStatus({
            id, state: 'done', auto: true, jaColhida: true, completo: true,
            ...(m ? { session: sessionPayload(key, m) } : {}), semDono: vivas
          })
          return
        }
        onStatus({ id, state: 'done', auto: true, jaColhida: true }); return
      }
      if (!usarNuvem()) { onStatus({ id, state: 'done', auto: true, pulado: 'nuvem desligada' }); return }
      if (meta0.model === 'quick') { onStatus({ id, state: 'done', auto: true, pulado: 'edição rápida' }); return }

      mkdirSync(workRoot, { recursive: true })
      // Retomada: sonda já paga numa tentativa anterior não se repete — mas o
      // registro guarda ONDE ela foi feita, então o mesmo instrumento pode (e
      // deve) ser sondado noutro trecho da música.
      const sondas = progresso.sondas

      // Uma extração só vai pro startExtractJob com a nuvem VIVA — e lá dentro
      // `nuvemObrigatoria` repete a checagem INSTRUMENTO A INSTRUMENTO. Checar
      // só na largada do lote não bastava: cada extração soma gasto, então o
      // teto podia estourar no meio e o instrumento seguinte ia pra CPU (47 min
      // que ninguém pediu, sem botão de parar).
      const esperarExtracao = (alvos) => new Promise((res) => {
        if (state.cancelled) return res({ state: 'cancelled' })
        if (!usarNuvem()) return res({ state: 'sem-nuvem' })
        const h = startExtractJob({
          key,
          instruments: alvos,
          ffmpegPath,
          nuvemObrigatoria: true,
          onProgress: (p) => onProgress?.({ ...p, auto: true, autoId: id }),
          onStatus: (st) => {
            if (st.state !== 'running') {
              filha.atual = null
              // Repassa o final SEM a marca `auto`: quem espera por esse id na
              // tela (um ↻ Refazer que foi adotado como gêmeo, ou o reconector
              // que traz as faixas novas) precisa ver o fim. Engolir isso
              // deixava a rodinha do usuário girando pra sempre.
              onStatus?.({ ...st })
              res(st)
            } else onStatus?.({ ...st, auto: true, autoId: id })
          }
        })
        // já existe extração rodando pra essa música: o handle gêmeo volta na
        // hora e NUNCA emite status — sem isso o laço esperaria pra sempre
        if (h?.twin) res({ state: 'twin' })
        else filha.atual = h
      })

      // O que a extração REALMENTE entregou. A nuvem pode falhar num
      // instrumento e o trabalho ainda terminar 'done' com aviso — perguntar ao
      // disco é a única resposta honesta.
      const entregues = (alvos) => {
        const m = readMeta(dir)
        const tem = new Set([...stemsOf(m), ...(m?.extracted || [])])
        return alvos.filter((a) => !tem.has(a))
      }
      const rotuloParada = (st) => st.state === 'sem-nuvem' ? 'nuvem-indisponivel'
        : st.state === 'twin' ? 'outra extração estava rodando'
          : st.state === 'cancelled' ? 'cancelado' : (st.error || 'a extração falhou')

      // Guitarra/teclado saem SEMPRE que faltam: uma passada custa centavos e a
      // balança esconde o que vier vazio. Faro decidindo "se tem guitarra" era
      // o detector mandando — e detector não manda mais.
      const faltamGp = ['guitar', 'piano'].filter((s) => !stemsOf(meta0).includes(s))
      if (faltamGp.length) {
        onStatus({ id, state: 'running', auto: true, fase: 'separando', alvos: faltamGp })
        const fim = await esperarExtracao(faltamGp)
        if (fim.state !== 'done') {
          // inclusive 'twin': seguir daqui seria sondar clipes de um "outros"
          // que a outra extração está reescrevendo debaixo do nosso pé
          motivoParada = rotuloParada(fim)
          fechar(); return
        }
        const faltaramGp = entregues(faltamGp)
        if (faltaramGp.length) {
          // 'done' com aviso: a nuvem não entregou. Sem isso a música saía
          // carimbada de "dissecada por completo" sem guitarra nem teclado.
          motivoParada = fim.aviso || `a nuvem não entregou: ${faltaramGp.join(', ')}`
          fechar(); return
        }
        progresso.procurados.push(...faltamGp)
      }

      for (let rodada = 1; rodada <= DISSEC_RODADAS; rodada++) {
        if (state.cancelled) { motivoParada = 'cancelado'; break }
        if (!usarNuvem()) { motivoParada = 'nuvem-indisponivel'; break }
        onStatus({ id, state: 'running', auto: true, rodada, fase: 'pesando' })
        const outros = join(dir, 'base', 'other.flac')
        if (!existsSync(outros)) { motivoParada = 'sem faixa "outros"'; break }

        // A lanterna varre o "outros" limpo da rodada: cada cheiro (mesmo
        // fraco — 0.12, não 0.35) vira um TRECHO a interrogar. O véu levantado
        // pela rodada anterior é o que deixa a camada de baixo aparecer.
        let faro = null
        try { faro = await runScoutScript(outros, state) } catch (e) { motivoParada = `o farejador falhou (${e.message})`; break }
        const meta = readMeta(dir)
        if (!meta) { motivoParada = 'sessão sumiu do disco'; break }
        const dur = Math.round(meta.duration || 300)
        const ja = new Set([...stemsOf(meta), ...(meta.extracted || [])])
        let cheiros = Object.entries(faro?.arsenal || {})
          // O olheiro é um script instalado à parte e ainda cheira dois nomes que
          // saíram do arsenal por não existirem na nuvem. Descartar o cheiro seria
          // jogar fora informação boa por causa de um nome; traduzir pro parente
          // vivo mantém o sino sendo sino. (O gatilho de energia abriria a região
          // de qualquer jeito, mas aí sem palpite nenhum pra ordenar a fila.)
          .map(([inst, v]) => [APELIDOS_FARO[inst] || inst, v])
          .map(([inst, v]) => ({ inst, score: v?.score ?? v ?? 0, at: v?.at ?? 0 }))
          // o cheiro só morre quando NÃO SOBROU NINGUÉM pra chamar naquele
          // pedaço — interrogatório cortado no meio deixa candidatos na fila
          .filter((c) => c.score >= CHEIRO_MIN && SPECIALISTS[c.inst] && !ja.has(c.inst)
            && !regiaoEsgotada(sondas, c.inst, c.at, ja, dur)
            // trecho já confessado não reabre: a pergunta foi feita e a
            // resposta foi "tem som, não sei de quem". Reabrir era moer o
            // catálogo inteiro no mesmo pedaço, 6 especialistas por rodada.
            // PENDÊNCIA é o oposto disso — ali a pergunta NÃO foi feita até o
            // fim, então o trecho tem que reabrir. Fechar por causa dela seria
            // transformar uma falha de rede em veredito permanente.
            && !progresso.semDono.some((s) => !s.pendente && c.at >= s.ini - 8 && c.at <= s.fim))
        // Seção JÁ EXTRAÍDA E COM SOM silencia o eco dos solistas dela. Se a
        // seção saiu MUDA, ela não engoliu ninguém — calar os solistas ali era
        // apagar o cheiro de um som que continua na música, sem nem confessar.
        const notas = Object.fromEntries(cheiros.map((c) => [c.inst, c.score]))
        for (const [secao, membros] of Object.entries(FAMILIAS)) {
          const info = meta.stemInfo?.[secao]
          if (ja.has(secao) && info?.present !== false) cheiros = cheiros.filter((c) => !membros.includes(c.inst))
        }
        cheiros.sort((a, b) => b.score - a.score)

        // Cheiros vizinhos no tempo são o MESMO som com nomes diferentes: viram
        // um interrogatório só, com todos como suspeitos. A janela de junção é
        // ASSIMÉTRICA porque o clipe é [âncora-8, âncora+32] e o cheiro marca o
        // INÍCIO de uma janela de 10s — juntar alguém 20s ATRÁS da âncora o
        // sondaria num clipe onde o som dele nem toca (sonda vazia = veto
        // injusto, o "morre no primeiro nome" voltando pela porta dos fundos).
        const spots = []
        let orfaos = 0 // cheiros que não couberam no teto da rodada
        let truncouAlgoNaMedicao = false
        for (const c of cheiros) {
          const perto = spots.find((s) => c.at >= s.at - 8 && c.at + 10 <= s.at + 32)
          if (perto) { perto.suspeitos.push(c.inst); continue }
          if (spots.length < SPOTS_POR_RODADA) spots.push({ at: c.at, suspeitos: [c.inst] })
          else orfaos++
        }

        // SOM SEM CHEIRO TAMBÉM É PERGUNTA. Até aqui só o faro abria
        // interrogatório, e som que ele não reconhece sumia calado — sem faixa
        // e sem confissão. Agora a energia do "outros" também abre: onde o som
        // se concentra acima da linha de base da música, alguém vai ser
        // perguntado, mesmo que nada cheire ali.
        let semCheiro = 0
        let mediuEnergia = false
        try {
          const regs = await regioesComSom(ffmpegPath, outros, workRoot, state)
          mediuEnergia = true
          // Região MAIOR que o clipe vira vários pedaços com âncora própria. Sem
          // isso, uma corcova de 110s era perguntada só nos 40s do começo: os
          // outros 70s não viravam faixa nem confissão (o buraco renascendo
          // dentro do conserto), e o motor nunca convergia porque a região
          // continuava aparecendo pra sempre.
          const pedacos = []
          for (const r of regs) {
            for (let ini = r.ini; ini <= r.fim; ini += CLIPE_S) {
              pedacos.push({ at: ini, db: r.db, fimReg: r.fim })
              if (r.fim - ini <= CLIPE_S) break
            }
          }
          for (const p of pedacos) {
            // já coberto por um cheiro? é o mesmo trecho com outro nome
            if (spots.some((s) => p.at >= s.at - 8 && p.at <= s.at + 32)) continue
            // já confessado? a pergunta foi feita e a resposta foi "não sei
            // quem é". Insistir aqui era o que fazia UMA música comer 466 dos
            // 500 centavos do teto: o mesmo trecho moendo o catálogo inteiro,
            // 6 especialistas por rodada, pro mesmo desfecho.
            // (pendência não conta: lá a pergunta ficou pela metade, então o
            // trecho continua na fila até ser perguntado até o fim)
            if (progresso.semDono.some((c) => !c.pendente && p.at >= c.ini - 8 && p.at <= c.fim)) continue
            // MESMA CHAVE do portão de dentro (`at` com janela de 10s): medir
            // aqui pelo meio da região e lá pelo início fazia os dois discordarem
            const candidatos = Object.keys(SPECIALISTS)
              .filter((i) => !ja.has(i) && !jaSondou(sondas, i, p.at, 10, dur))
            if (!candidatos.length) continue
            if (semCheiro >= ORFAOS_POR_RODADA) { orfaos++; continue }
            // Sem nome pra começar, quem ordena a fila é o faro da música toda:
            // palpite fraco continua melhor que ordem alfabética. A lista vai
            // INTEIRA — quem corta em SONDAS_POR_SPOT é o interrogatório, que
            // precisa saber quantos ficaram de fora pra marcar "truncado".
            let fila = candidatos.sort((a, b) => (notas[b] || 0) - (notas[a] || 0))
            // seção já extraída e com som engole os solistas dela também aqui:
            // sem isso a fila abria com o eco do naipe que já saiu
            for (const [secao, membros] of Object.entries(FAMILIAS)) {
              const info = meta.stemInfo?.[secao]
              if (ja.has(secao) && info?.present !== false) fila = fila.filter((i) => !membros.includes(i))
            }
            if (!fila.length) continue
            spots.push({ at: p.at, suspeitos: fila, semCheiro: true, db: p.db })
            semCheiro++
          }
        } catch { /* medição falhou — tratado abaixo */ }
        // Falhar em medir NÃO pode virar "dissequei por completo": sem a
        // medição, não dá pra afirmar que não sobrou som sem dono.
        if (!mediuEnergia) truncouAlgoNaMedicao = true

        diario(dir, `rodada ${rodada}: cheiros=${cheiros.length} spots=${spots.length} (semCheiro=${semCheiro}) orfaos=${orfaos} mediuEnergia=${mediuEnergia}`)
        for (const s of spots) diario(dir, `  spot at=${s.at} semCheiro=${!!s.semCheiro} suspeitos=${s.suspeitos.length}`)
        // Só é fim quando não cheira NEM sobra som concentrado sem dono
        if (!spots.length && !truncouAlgoNaMedicao) { convergiu = true; break }
        if (!spots.length) break

        const donos = []
        const trechosDoDono = {}
        // Interrogatório que não foi até o fim (teto no meio, fila maior que o
        // limite de sondas, região já esgotada) impede declarar convergência:
        // ficou pergunta sem fazer, e som sem resposta não pode virar silêncio.
        let truncouAlgo = truncouAlgoNaMedicao
        for (const spot of spots) {
          if (state.cancelled) { motivoParada = 'cancelado'; break }
          if (!usarNuvem()) { motivoParada = 'nuvem-indisponivel'; break }
          // música curta: o clipe é a música toda, nunca um começo negativo
          const ini = Math.max(0, Math.min(Math.round(spot.at) - 8, Math.max(0, dur - 40)))
          const trecho = { ini, fim: Math.min(dur, ini + 40) }
          onStatus({ id, state: 'running', auto: true, rodada, fase: 'interrogando', trecho })
          const r = await interrogarTrecho({
            dir, workRoot, ffmpegPath, trecho, at: spot.at, dur,
            suspeitos: spot.suspeitos, semPrimos: !!spot.semCheiro, sondas, jaDonos: donos, notas, state,
            aoSondar: (lista) => onStatus({
              id, state: 'running', auto: true, rodada, fase: 'interrogando', trecho,
              sondando: lista.map((i) => SPECIALISTS[i]?.label || i).join(', ')
            })
          })
          progresso.procurados.push(...r.sondados)
          diario(dir, `  interroguei ${trecho.ini}-${trecho.fim}: sondados=${r.sondados.length} perdi=${r.sumiram?.length || 0} dono=${r.dono || '-'} truncado=${r.truncado} vazio=${!!r.vazio} semTeto=${!!r.semTeto}`)
          if (r.truncado) truncouAlgo = true
          // sem dinheiro nem pra UMA pergunta: parar aqui e dizer por quê. Sem
          // isso a dissecação seguia varrendo trechos e rodadas em falso,
          // rodando o farejador três vezes por abertura pra nada.
          if (r.semTeto) { motivoParada = 'nuvem-indisponivel'; break }
          // sonda paga vai pro disco AGORA: fechar o app (ou faltar luz) no meio
          // da dissecação não pode jogar fora o que já foi pago.
          // Falhar aqui EM SILÊNCIO era o pior dos mundos: o motor seguia
          // comprando sondas achando que estava guardando, e no fim do dia o
          // registro voltava vazio sem ninguém saber por quê. Se o disco recusar,
          // fica escrito.
          try { gravar() } catch (e) { diario(dir, `  NAO CONSEGUI GRAVAR o progresso: ${e?.message || e}`) }
          if (r.dono) {
            if (!donos.includes(r.dono)) donos.push(r.dono)
            // um mesmo instrumento pode reivindicar em dois trechos da rodada;
            // guardar só o último faria o desfazer soltar o trecho errado
            ;(trechosDoDono[r.dono] = trechosDoDono[r.dono] || []).push(trecho)
            // achou dono aqui: confissão desse pedaço perde a validade
            progresso.semDono = progresso.semDono.filter((s) => s.fim <= trecho.ini || s.ini >= trecho.fim)
          } else if (r.sumiram?.length || (r.sondados.length && !r.truncado)) {
            // Dois registros diferentes, e os DOIS aparecem pro usuário:
            //
            // CONFISSÃO — interroguei ATÉ O FIM e ninguém reivindicou. O som
            // existe; o usuário fica sabendo ONDE, com o palpite de quem seria.
            //
            // PENDÊNCIA — perguntas se perderam mesmo depois da segunda chamada.
            // Não é a mesma afirmação ("ninguém quis" é conclusão; "não consegui
            // perguntar" é dívida), por isso o texto é outro e o trecho continua
            // sendo reaberto nas próximas rodadas. Mas CALAR não é opção: o motor
            // ouviu som ali. Era assim que a Girlfriend ficava muda em 0:53–1:33
            // — o único jeito de o usuário descobrir era pelo próprio ouvido.
            const pendente = !!r.sumiram?.length
            // dívida velha do mesmo trecho sai da frente: ou virou confissão de
            // verdade agora, ou é a mesma dívida com contagem nova
            progresso.semDono = progresso.semDono.filter((s) => !(s.pendente && s.ini === trecho.ini))
            if (!progresso.semDono.some((s) => s.ini === trecho.ini)) {
              // guarda a medida do trecho: é ela que permite conferir depois se
              // a confissão ainda vale ou se o som já ganhou dono
              let db = -99
              try {
                await run(ffmpegPath, [
                  '-ss', String(trecho.ini), '-t', String(trecho.fim - trecho.ini),
                  '-i', join(dir, 'base', 'other.flac'), '-af', 'volumedetect', '-f', 'null', '-'
                ], state, (linha) => {
                  const mm = linha.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)/)
                  if (mm) db = parseFloat(mm[1])
                })
              } catch { /* sem medida, a confissão ainda vale */ }
              progresso.semDono.push({
                ini: trecho.ini, fim: trecho.fim, db,
                ...(pendente ? { pendente: true, faltou: r.sumiram.length } : {}),
                // Trecho aberto por CHEIRO tem palpite de verdade: o faro
                // apontou alguém ali. Trecho aberto por ENERGIA não tem — a
                // fila veio da nota geral da música, então dizer "parece
                // Metais" seria inventar evidência que não existe. Melhor
                // admitir que não faço ideia do que é.
                palpite: (!spot.semCheiro && r.palpite) ? (SPECIALISTS[r.palpite]?.label || r.palpite) : null
              })
            }
          }
        }

        if (!donos.length) {
          // Rodada sem dono só é convergência se ela foi INTEIRA: nenhum
          // interrogatório cortado no meio e nenhum cheiro deixado fora do teto.
          // Sobrando qualquer um dos dois, ainda há pergunta a fazer — a próxima
          // rodada os promove (os já sondados estão vetados na região).
          if (motivoParada) break
          if ((orfaos || truncouAlgo) && rodada < DISSEC_RODADAS) continue
          if (!orfaos && !truncouAlgo) convergiu = true
          break
        }
        onStatus({ id, state: 'running', auto: true, rodada, fase: 'separando', alvos: donos })
        const fim = await esperarExtracao(donos)
        // Instrumento COMPROVADO pela sonda que não virou faixa não pode sumir:
        // a sonda dele já foi paga, então o registro DAQUELE TRECHO é apagado e
        // a próxima rodada/abertura tenta de novo. Vale pro erro inteiro E pro
        // sucesso PARCIAL — a nuvem pode falhar num instrumento e o job ainda
        // terminar 'done' com aviso; sem isso o dono provado sumia em silêncio
        // com a música carimbada de "dissecada por completo".
        const faltaram = entregues(donos)
        for (const d of faltaram) {
          const inicios = new Set((trechosDoDono[d] || []).map((t) => t.ini))
          for (let i = sondas.length - 1; i >= 0; i--) {
            if (sondas[i].inst === d && inicios.has(sondas[i].ini)) sondas.splice(i, 1)
          }
        }
        if (fim.state !== 'done') { motivoParada = rotuloParada(fim); break }
        if (faltaram.length) {
          motivoParada = fim.aviso || `a nuvem não entregou: ${faltaram.map((d) => SPECIALISTS[d]?.label || d).join(', ')}`
          break
        }
        // Dono provado pela sonda que a extração devolveu MUDO: a sonda OUVIU o
        // som naquele trecho, mas o especialista não conseguiu isolá-lo na
        // música inteira e a balança escondeu a faixa. Isso não pode virar
        // "não tinha nada" — o som existe, então vira confissão.
        {
          const mDep = readMeta(dir)
          for (const d of donos) {
            if (mDep?.stemInfo?.[d]?.present !== false) continue
            for (const t of trechosDoDono[d] || []) {
              if (!progresso.semDono.some((s) => s.ini === t.ini)) {
                progresso.semDono.push({ ini: t.ini, fim: t.fim, palpite: SPECIALISTS[d]?.label || d })
              }
            }
          }
        }
        // A faixa nova saiu do "outros": confissão que apontava justamente esse
        // som perdeu a validade e some da tela.
        progresso.semDono = await revalidarConfissoes(dir, ffmpegPath, progresso.semDono, state)
        // Extraiu nesta rodada = o véu levantou e a camada de baixo ainda não
        // foi farejada. Nunca é fim: a música fica done:false e a próxima
        // abertura continua de onde parou (sem repagar as sondas já feitas).
      }

      fechar()
    } catch (err) {
      try { rmSync(workRoot, { recursive: true, force: true }) } catch { /* lixo de bancada não engole o aviso */ }
      // grava o que já foi pago mesmo quando dá erro — done:false, pra retomar
      motivoParada = motivoParada || (state.cancelled ? 'cancelado' : err.message)
      try { gravar() } catch (e) { diario(dir, `NAO CONSEGUI GRAVAR na saída: ${e?.message || e}`) }
      if (state.cancelled) onStatus({ id, state: 'cancelled', auto: true })
      else onStatus({ id, state: 'error', auto: true, error: err.message })
    } finally {
      handle.vivo = false
      activeAutos.delete(key)
    }
  })()
  return handle
}

async function cleanVocalsBleed(dir, ffmpegPath, state) {
  const meta = readMeta(dir)
  const voc = join(dir, 'base', 'vocals.flac')
  if (!meta || !existsSync(voc)) return
  const claims = (meta.extracted || [])
    .map((s2) => join(dir, 'base', `${s2}.flac`))
    .filter((p2) => existsSync(p2))
  const orig = join(dir, 'base', 'vocals_orig.flac')
  if (!claims.length) {
    if (existsSync(orig)) copyFileSync(orig, voc)
    return
  }
  if (!existsSync(orig)) copyFileSync(voc, orig)
  const tmp = join(dir, 'base', 'vocals_limpa_tmp.flac')
  await run(
    process.execPath,
    [limpaVazamentoPath(), ffmpegPath, orig, tmp, ...claims],
    state, null,
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
  )
  rmSync(voc, { force: true })
  renameSync(tmp, voc)
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
        apagarPasta(segIn)
        apagarPasta(segOut)
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
      apagarPasta(workRoot)
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
    apagarPasta(work)
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
