import { app } from 'electron'
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
    variants: Object.keys(meta.variants || {})
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

  const target = existsSync(join(dir, 'base', 'other_orig.flac'))
    ? join(dir, 'base', 'other_orig.flac')
    : join(dir, 'base', 'other.flac')
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
    gp: out.gp || null
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
        await run(ffmpegPath, ['-i', join(dir, 'base', `${instId}.flac`), '-af', 'volumedetect', '-f', 'null', '-'], state, (line) => {
          const mm = line.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)/)
          if (mm) meanVol = parseFloat(mm[1])
        })

        const m = readMeta(dir)
        const stems = stemsOf(m).filter((s) => s !== instId && s !== 'other')
        stems.push(instId, 'other')
        m.stems = stems
        m.stemInfo = m.stemInfo || {}
        m.stemInfo[instId] = { present: meanVol > -48, mean: meanVol }
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
