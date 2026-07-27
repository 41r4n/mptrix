import { spawn } from 'child_process'
import { randomUUID } from 'crypto'

export const PRESETS = {
  music: {
    id: 'music',
    name: 'Música única (MP3)',
    description: 'Uma música em MP3 com qualidade máxima e capa do vídeo.',
    outputExt: 'mp3',
    needsQualityChoice: false,
    args: () => [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--embed-thumbnail',
      '--embed-metadata',
      '--no-playlist'
    ]
  },
  playlist: {
    id: 'playlist',
    name: 'Playlist (MP3)',
    description: 'Baixa todas as músicas de uma playlist em MP3.',
    outputExt: 'mp3',
    needsQualityChoice: false,
    args: () => [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--embed-metadata',
      '--yes-playlist',
      '--no-overwrites'
    ]
  },
  fast: {
    id: 'fast',
    name: 'Rápido (MP3)',
    description: 'MP3 com qualidade média, sem capa — mais rápido e leve.',
    outputExt: 'mp3',
    needsQualityChoice: false,
    args: () => [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '5',
      '--no-playlist'
    ]
  },
  audio_m4a: {
    id: 'audio_m4a',
    name: 'M4A (sem reconverter)',
    description: 'Áudio em M4A na qualidade nativa do YouTube. Não reconverte — mais rápido e sem perda.',
    outputExt: 'm4a',
    needsQualityChoice: false,
    args: () => [
      '-x',
      '--audio-format', 'm4a',
      '--audio-quality', '0',
      '--embed-thumbnail',
      '--embed-metadata',
      '--no-playlist'
    ]
  },
  audio_wav: {
    id: 'audio_wav',
    name: 'WAV (sem compressão)',
    description: 'Áudio em WAV — sem compressão. Arquivo grande, ideal pra editar.',
    outputExt: 'wav',
    needsQualityChoice: false,
    args: () => [
      '-x',
      '--audio-format', 'wav',
      '--audio-quality', '0',
      '--embed-metadata',
      '--no-playlist'
    ]
  },
  video: {
    id: 'video',
    name: 'Vídeo',
    description: 'Baixa o vídeo na qualidade que você escolher (até 8K).',
    outputExt: 'mp4',
    needsQualityChoice: true,
    args: ({ qualityHeight } = {}) => {
      const h = Number(qualityHeight) || 1080
      if (h <= 1080) {
        return [
          '-f',
          `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/b[height<=${h}][ext=mp4]/b[height<=${h}]`,
          '--merge-output-format', 'mp4',
          '--embed-metadata',
          '--no-playlist'
        ]
      }
      return [
        '-f',
        `bv*[height<=${h}]+ba/b[height<=${h}]`,
        '--merge-output-format', 'mkv',
        '--embed-metadata',
        '--no-playlist'
      ]
    }
  }
}

const FILE_RE = /\[MPTRIX_FILE\](.+?)\[\/MPTRIX_FILE\]/g

function parseProgressLine(line) {
  if (!/^\[download\]\s/.test(line)) return null
  const pctMatch = line.match(/(\d+(?:\.\d+)?)\s*%/)
  if (!pctMatch) return null
  const speedMatch = line.match(/at\s+(\S+(?:\s+\S+)?)\s+ETA/i) || line.match(/at\s+(Unknown\s+speed)/i)
  const etaMatch = line.match(/ETA\s+(\S+)/i)
  const sizeMatch = line.match(/of\s+~?\s*(\S+)/i)
  const percent = parseFloat(pctMatch[1])
  return {
    percent,
    percentStr: `${pctMatch[1]}%`,
    speed: speedMatch ? speedMatch[1].trim() : '',
    eta: etaMatch ? etaMatch[1] : '',
    totalSize: sizeMatch ? sizeMatch[1] : ''
  }
}

function detectStage(line) {
  const l = line.trim()
  if (!l) return null

  if (/^\[(youtube|generic|extractor|youtube:tab|youtube:playlist|hls|dash)/i.test(l)) {
    return { id: 'extracting', label: 'Pegando informações do vídeo', icon: '🔍' }
  }
  if (/^\[info\]/i.test(l)) {
    return { id: 'preparing', label: 'Escolhendo a melhor qualidade', icon: '📋' }
  }
  if (/^\[download\]\s+destination:/i.test(l)) {
    const isAudio = /\.(m4a|webm|opus|mp3|aac)$/i.test(l)
    if (isAudio) return { id: 'downloading_audio', label: 'Baixando faixa de áudio', icon: '🎧' }
    return { id: 'downloading', label: 'Baixando vídeo', icon: '⬇️' }
  }
  if (/^\[download\]\s+resuming/i.test(l)) {
    return { id: 'downloading', label: 'Continuando download', icon: '⬇️' }
  }
  if (/^\[download\]\s+\d+(\.\d+)?%/i.test(l)) {
    return { id: 'downloading', label: 'Baixando arquivo', icon: '⬇️' }
  }
  if (/^\[merger\]/i.test(l)) {
    return { id: 'merging', label: 'Juntando vídeo e áudio', icon: '🔀' }
  }
  if (/^\[extractaudio\]/i.test(l)) {
    return { id: 'extracting_audio', label: 'Convertendo pra MP3', icon: '🎵' }
  }
  if (/^\[embedthumbnail\]/i.test(l)) {
    return { id: 'embedding_thumbnail', label: 'Adicionando capa do álbum', icon: '🖼️' }
  }
  if (/^\[metadata\]/i.test(l)) {
    return { id: 'embedding_metadata', label: 'Adicionando informações', icon: '🏷️' }
  }
  if (/^\[fixup/i.test(l)) {
    return { id: 'fixing', label: 'Ajustando arquivo', icon: '🔧' }
  }
  if (/^\[(videoconvertor|videoremuxer|videoconverter)/i.test(l)) {
    return { id: 'converting', label: 'Convertendo formato', icon: '🎞️' }
  }
  if (/^\[debug\]/i.test(l)) return null
  if (/^\[/.test(l)) {
    return { id: 'working', label: 'Processando…', icon: '⚙️' }
  }
  return null
}

function isNoiseLine(line) {
  const l = line.trim()
  if (!l) return true
  if (l.startsWith('[MPTRIX_')) return true
  if (l.startsWith('[debug]')) return true
  if (/^WARNING/i.test(l)) return true
  if (/^\[download\]\s+\d+(\.\d+)?%/.test(l)) return true
  return false
}

function detectIssue(line) {
  const l = (line || '').trim()
  if (!l) return null
  const lc = l.toLowerCase()

  // Guard: ignore WARNING lines (transient yt-dlp noise) and anything that isn't
  // an ERROR, fatal, or the reliable "Sign in to confirm" bot-check signal.
  if (/^warning/i.test(l)) return null
  const hasError = /error/i.test(l)
  const hasFatal = /fatal/i.test(l)
  const hasSignIn = lc.includes('sign in to confirm')
  if (!hasError && !hasFatal && !hasSignIn) return null

  if (
    hasError &&
    (
      lc.includes('issues/14198') ||
      lc.includes('failed to extract any player response') ||
      lc.includes('unable to extract initial player response') ||
      lc.includes('player api response') ||
      /extractor.*?(broken|outdated|not\s+working)/i.test(l) ||
      /extractor\s+failed/i.test(l)
    )
  ) {
    return {
      kind: 'extractor_outdated',
      title: 'O YouTube atualizou alguma coisa',
      message:
        'Seu yt-dlp não está conseguindo ler esse vídeo porque o YouTube mudou algo. ' +
        'Atualizar o yt-dlp pra versão mais recente quase sempre resolve.',
      suggestedAction: 'update'
    }
  }

  if (hasSignIn || lc.includes('not a bot') || lc.includes("you're a bot")) {
    return {
      kind: 'bot_check',
      title: 'YouTube pedindo verificação anti-bot',
      message:
        'O YouTube está pedindo confirmação humana pra esse vídeo. Versões novas do yt-dlp ' +
        'às vezes têm workarounds — vale a pena atualizar e tentar de novo.',
      suggestedAction: 'update'
    }
  }

  if (hasError && /http\s+error\s+(403|429)/i.test(l)) {
    return {
      kind: 'rate_limited',
      title: 'YouTube bloqueando temporariamente',
      message:
        'O YouTube está limitando os acessos (erro 403/429). Aguarde alguns minutos antes ' +
        'de tentar de novo. Atualizar o yt-dlp também pode ajudar.',
      suggestedAction: 'update'
    }
  }

  return null
}

function classifyError(stderr, code) {
  const text = (stderr || '').toLowerCase()
  if (!text && code !== 0) return 'O download falhou. Tente novamente.'
  if (text.includes('is not a valid url') || text.includes('unsupported url')) return 'Link inválido. Cole um link do YouTube.'
  if (text.includes('video unavailable') || text.includes('this video is unavailable')) return 'Vídeo indisponível.'
  if (text.includes('private video') || text.includes('sign in')) return 'Vídeo privado ou requer login.'
  if (text.includes('age') && text.includes('restrict')) return 'Vídeo com restrição de idade.'
  if (text.includes('http error 4')) return 'Vídeo não encontrado (erro 4xx).'
  if (text.includes('getaddrinfo') || text.includes('failed to resolve') || text.includes('network')) return 'Sem conexão com a internet.'
  if (text.includes('copyright')) return 'Bloqueado por direitos autorais.'
  if (text.includes('ffmpeg')) return 'Erro no ffmpeg. Verifique se ffmpeg.exe está em resources/bin.'
  const firstErrLine = (stderr || '').split('\n').find((l) => l.toLowerCase().includes('error'))
  return firstErrLine ? firstErrLine.replace(/^error:\s*/i, '').trim() : `Falha (código ${code})`
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`
}

export function qualityLabel(h) {
  if (h >= 4320) return '8K'
  if (h >= 2160) return '4K'
  if (h >= 1440) return '2K (1440p)'
  if (h >= 1080) return '1080p (Full HD)'
  if (h >= 720) return '720p (HD)'
  return `${h}p`
}

export function probePlaylist({ ytDlpPath, url, timeoutMs = 45000 }) {
  return new Promise((resolve, reject) => {
    const trimmedUrl = (url || '').trim()
    if (!trimmedUrl) return reject(new Error('Cole um link primeiro.'))

    const args = [
      '--flat-playlist',
      '--dump-single-json',
      '--no-warnings',
      '--no-call-home',
      '--yes-playlist',
      '--encoding', 'utf-8',
      trimmedUrl
    ]

    const child = spawn(ytDlpPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let finished = false

    const timer = setTimeout(() => {
      if (finished) return
      finished = true
      try { child.kill() } catch {}
      reject(new Error('Tempo esgotado ao buscar a playlist.'))
    }, timeoutMs)

    child.stdout.on('data', (c) => { stdout += c.toString('utf8') })
    child.stderr.on('data', (c) => { stderr += c.toString('utf8') })

    child.on('error', (err) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      reject(new Error(`Falha ao executar yt-dlp: ${err.message}`))
    })

    child.on('close', (code) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (code !== 0) {
        return reject(new Error(classifyError(stderr, code)))
      }
      try {
        const info = JSON.parse(stdout)
        const entries = Array.isArray(info.entries) ? info.entries : []
        if (entries.length === 0) {
          return reject(new Error('Esse link não parece ser uma playlist (nenhum vídeo dentro).'))
        }
        resolve({
          title: info.title || 'Playlist sem nome',
          uploader: info.uploader || info.channel || null,
          totalCount: info.playlist_count || entries.length,
          entries: entries.map((e) => ({
            id: e.id || null,
            title: e.title || '(sem título)',
            duration: e.duration || null,
            url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null),
            thumbnail: (Array.isArray(e.thumbnails) && e.thumbnails.length > 0)
              ? e.thumbnails[e.thumbnails.length - 1].url
              : (e.thumbnail || null)
          })).filter((e) => e.url)
        })
      } catch (err) {
        reject(new Error('Resposta inesperada do yt-dlp.'))
      }
    })
  })
}

export function probeVideo({ ytDlpPath, url, timeoutMs = 25000 }) {
  return new Promise((resolve, reject) => {
    const trimmedUrl = (url || '').trim()
    if (!trimmedUrl) return reject(new Error('Cole um link primeiro.'))

    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--no-call-home',
      '--no-playlist',
      '--encoding', 'utf-8',
      trimmedUrl
    ]

    const child = spawn(ytDlpPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let finished = false

    const timer = setTimeout(() => {
      if (finished) return
      finished = true
      try { child.kill() } catch {}
      reject(new Error('Tempo esgotado ao buscar informações do vídeo.'))
    }, timeoutMs)

    child.stdout.on('data', (c) => { stdout += c.toString('utf8') })
    child.stderr.on('data', (c) => { stderr += c.toString('utf8') })

    child.on('error', (err) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      reject(new Error(`Falha ao executar yt-dlp: ${err.message}`))
    })

    child.on('close', (code) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (code !== 0) {
        return reject(new Error(classifyError(stderr, code)))
      }
      try {
        const info = JSON.parse(stdout)
        resolve(summarizeFormats(info))
      } catch (err) {
        reject(new Error('Resposta inesperada do yt-dlp.'))
      }
    })
  })
}

export function probeVideoMaxHeight({ ytDlpPath, url, timeoutMs = 20000 }) {
  return new Promise((resolve) => {
    const trimmedUrl = (url || '').trim()
    if (!trimmedUrl) return resolve(null)

    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--no-call-home',
      '--no-playlist',
      '--encoding', 'utf-8',
      trimmedUrl
    ]

    const child = spawn(ytDlpPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let finished = false

    const timer = setTimeout(() => {
      if (finished) return
      finished = true
      try { child.kill() } catch {}
      resolve(null)
    }, timeoutMs)

    child.stdout.on('data', (c) => { stdout += c.toString('utf8') })
    child.stderr.on('data', () => {})

    child.on('error', () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve(null)
    })

    child.on('close', (code) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (code !== 0) return resolve(null)
      try {
        const info = JSON.parse(stdout)
        const formats = Array.isArray(info.formats) ? info.formats : []
        const heights = formats
          .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
          .map((f) => f.height)
        if (heights.length === 0) return resolve(null)
        resolve(Math.max(...heights))
      } catch {
        resolve(null)
      }
    })
  })
}

function summarizeFormats(info) {
  const formats = Array.isArray(info.formats) ? info.formats : []

  const audios = formats
    .filter((f) => f.vcodec === 'none' && f.acodec && f.acodec !== 'none')
    .map((f) => ({ ...f, _size: f.filesize || f.filesize_approx || 0 }))
    .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))

  const bestAudioMp4 = audios.find((f) => f.ext === 'm4a') || audios[0] || null
  const bestAudioAny = audios[0] || null

  const videosByHeight = new Map()
  for (const f of formats) {
    if (!f.height) continue
    if (f.vcodec === 'none') continue
    const cur = videosByHeight.get(f.height)
    const score = (f.tbr || 0) + (f.fps || 0) / 10
    const curScore = cur ? (cur.tbr || 0) + (cur.fps || 0) / 10 : -1
    if (!cur || score > curScore) {
      videosByHeight.set(f.height, f)
    }
  }

  const STANDARD = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320]
  const qualities = []

  for (const target of STANDARD) {
    let best = null
    for (const [h, v] of videosByHeight) {
      if (h <= target && (!best || h > best.height)) best = v
    }
    if (!best) continue
    if (qualities.some((q) => q.height === best.height)) continue

    const prefersMp4 = target <= 1080
    const isMp4Video = best.ext === 'mp4'
    const audio = prefersMp4 && isMp4Video ? (bestAudioMp4 || bestAudioAny) : bestAudioAny

    const videoSize = best.filesize || best.filesize_approx || 0
    const audioSize = audio ? (audio.filesize || audio.filesize_approx || 0) : 0
    const totalBytes = videoSize + audioSize

    let container = 'MKV'
    if (prefersMp4 && isMp4Video && audio?.ext === 'm4a') container = 'MP4'
    else if (best.ext === 'webm' && (audio?.ext === 'webm' || audio?.ext === 'opus')) container = 'WebM'

    qualities.push({
      height: best.height,
      label: qualityLabel(best.height),
      container,
      fps: best.fps || null,
      sizeBytes: totalBytes || null,
      sizeLabel: formatBytes(totalBytes),
      isMp4Native: container === 'MP4'
    })
  }

  qualities.sort((a, b) => b.height - a.height)

  return {
    title: info.title || '(sem título)',
    duration: info.duration || null,
    thumbnail: info.thumbnail || null,
    uploader: info.uploader || info.channel || null,
    qualities
  }
}

export function startDownload({
  ytDlpPath,
  ffmpegPath,
  url,
  presetId,
  outputDir,
  qualityHeight,
  onProgress,
  onStatus,
  onFile,
  onStage,
  onLog,
  onIssue
}) {
  const preset = PRESETS[presetId]
  if (!preset) throw new Error(`Preset desconhecido: ${presetId}`)

  const id = randomUUID()
  const trimmedUrl = (url || '').trim()
  if (!trimmedUrl) {
    onStatus({ id, state: 'error', message: 'Cole um link primeiro.' })
    return { id, cancel: () => {} }
  }

  const presetArgs = typeof preset.args === 'function'
    ? preset.args({ qualityHeight })
    : preset.args

  const args = [
    '--ffmpeg-location', ffmpegPath,
    '--newline',
    '--no-colors',
    '--no-warnings',
    '--no-call-home',
    '--encoding', 'utf-8',
    '--no-mtime',
    '-P', outputDir,
    '-o', '%(title).200B [%(id)s].%(ext)s',
    '--print', 'after_move:[MPTRIX_FILE]%(filepath)s[/MPTRIX_FILE]',
    ...presetArgs,
    trimmedUrl
  ]

  const child = spawn(ytDlpPath, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let stderrBuffer = ''
  let stdoutLeftover = ''
  let stderrLeftover = ''
  const files = []
  let cancelled = false
  let lastStageId = null
  let downloadStartedCount = 0

  const processLine = (line, isStderr = false) => {
    const prog = parseProgressLine(line)
    if (prog) {
      onProgress({ id, ...prog })
    }
    let fileMatch
    while ((fileMatch = FILE_RE.exec(line)) !== null) {
      const filepath = fileMatch[1].trim()
      files.push(filepath)
      onFile?.({ id, filepath })
    }

    const stage = detectStage(line)
    if (stage && onStage) {
      let next = stage
      if (stage.id === 'downloading' || stage.id === 'downloading_audio') {
        downloadStartedCount += 1
        if (downloadStartedCount === 2 && stage.id === 'downloading') {
          next = { ...stage, label: 'Baixando faixa de áudio', icon: '🎧', id: 'downloading_audio' }
        } else if (downloadStartedCount === 1 && stage.id === 'downloading_audio') {
          next = { ...stage, label: 'Baixando vídeo', icon: '⬇️', id: 'downloading' }
        }
      }
      if (next.id !== lastStageId) {
        lastStageId = next.id
        onStage({ id, ...next })
      }
    }

    if (onLog && !isNoiseLine(line)) {
      const clean = line.trim().slice(0, 280)
      if (clean) onLog({ id, line: clean })
    }

    if (onIssue) {
      const hasExplicitError = /ERROR:/.test(line)
      if (isStderr || hasExplicitError) {
        const issue = detectIssue(line)
        if (issue) onIssue({ id, ...issue })
      }
    }
  }

  child.stdout.on('data', (chunk) => {
    const text = stdoutLeftover + chunk.toString('utf8')
    const lines = text.split(/\r?\n/)
    stdoutLeftover = lines.pop() ?? ''
    for (const line of lines) processLine(line, false)
  })

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8')
    stderrBuffer += text
    const lines = (stderrLeftover + text).split(/\r?\n/)
    stderrLeftover = lines.pop() ?? ''
    for (const line of lines) processLine(line, true)
  })

  child.on('error', (err) => {
    onStatus({ id, state: 'error', message: `Falha ao executar yt-dlp: ${err.message}` })
  })

  child.on('close', (code) => {
    if (stdoutLeftover) processLine(stdoutLeftover, false)
    if (stderrLeftover) processLine(stderrLeftover, true)
    if (cancelled) {
      onStatus({ id, state: 'cancelled', message: 'Download cancelado.' })
      return
    }
    if (code === 0) {
      onStatus({ id, state: 'done', files, primaryFile: files[0] ?? null })
    } else {
      onStatus({ id, state: 'error', message: classifyError(stderrBuffer, code) })
    }
  })

  const cancel = () => {
    if (cancelled) return
    cancelled = true
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'])
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      child.kill()
    }
  }

  return { id, cancel }
}
