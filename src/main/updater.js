import { spawn } from 'child_process'
import { createWriteStream, existsSync, renameSync, unlinkSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join, dirname, basename } from 'path'
import { sabeAtualizarYtDlp, NAO_SABE_ATUALIZAR } from './plataforma.js'

const STABLE_API = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'
const NIGHTLY_API = 'https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest'
const STABLE_DOWNLOAD = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
const NIGHTLY_DOWNLOAD = 'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe'
const UA = 'MPTRIX-Updater/0.1'

export function getYtDlpVersion(ytDlpPath) {
  return new Promise((resolve) => {
    if (!ytDlpPath || !existsSync(ytDlpPath)) return resolve(null)
    const child = spawn(ytDlpPath, ['--version'], { windowsHide: true })
    let out = ''
    child.stdout.on('data', (c) => { out += c.toString('utf8') })
    child.on('error', () => resolve(null))
    child.on('close', () => resolve(out.trim() || null))
  })
}

export function getFfmpegVersion(ffmpegPath) {
  return new Promise((resolve) => {
    if (!ffmpegPath || !existsSync(ffmpegPath)) return resolve(null)
    const child = spawn(ffmpegPath, ['-version'], { windowsHide: true })
    let out = ''
    child.stdout.on('data', (c) => { out += c.toString('utf8') })
    child.on('error', () => resolve(null))
    child.on('close', () => {
      const m = out.match(/ffmpeg version ([^\s]+)/i)
      resolve(m ? m[1] : null)
    })
  })
}

async function fetchRelease(apiUrl) {
  const res = await fetch(apiUrl, {
    cache: 'no-store',
    headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`)
  const data = await res.json()
  return {
    version: (data.tag_name || '').replace(/^v/, ''),
    publishedAt: data.published_at || null,
    htmlUrl: data.html_url || null,
    notes: typeof data.body === 'string' ? data.body.slice(0, 4000) : null
  }
}

export async function getLatestRelease() {
  try {
    const [stableRes, nightlyRes] = await Promise.allSettled([
      fetchRelease(STABLE_API),
      fetchRelease(NIGHTLY_API)
    ])

    const stable = stableRes.status === 'fulfilled' ? stableRes.value : null
    const nightly = nightlyRes.status === 'fulfilled' ? nightlyRes.value : null

    if (!stable && !nightly) {
      const err = stableRes.status === 'rejected' ? stableRes.reason : nightlyRes.reason
      throw new Error(err && err.message ? err.message : 'Falha ao consultar releases')
    }

    let winner
    let channel
    if (stable && nightly) {
      const stableTime = stable.publishedAt || ''
      const nightlyTime = nightly.publishedAt || ''
      if (nightlyTime > stableTime) {
        winner = nightly
        channel = 'nightly'
      } else {
        winner = stable
        channel = 'stable'
      }
    } else if (stable) {
      winner = stable
      channel = 'stable'
    } else {
      winner = nightly
      channel = 'nightly'
    }

    return {
      version: winner.version,
      publishedAt: winner.publishedAt,
      htmlUrl: winner.htmlUrl,
      notes: winner.notes,
      channel,
      downloadUrl: channel === 'nightly' ? NIGHTLY_DOWNLOAD : STABLE_DOWNLOAD,
      stableVersion: stable ? stable.version : null,
      stablePublishedAt: stable ? stable.publishedAt : null
    }
  } catch (err) {
    throw new Error(`Sem conexão com o GitHub: ${err.message}`)
  }
}

function compareVersions(a, b) {
  if (!a || !b) return 0
  const ap = a.split('.').map((n) => parseInt(n, 10) || 0)
  const bp = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(ap.length, bp.length)
  for (let i = 0; i < len; i++) {
    const x = ap[i] || 0
    const y = bp[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

export function hasUpdate(current, latest) {
  if (!current || !latest) return false
  return compareVersions(current, latest) < 0
}

export function isAheadOfStable(current, stableVersion) {
  if (!current || !stableVersion) return false
  return compareVersions(current, stableVersion) > 0
}

export async function downloadAndReplace(ytDlpPath, downloadUrl, onProgress) {
  // A PORTA ESTREITA: é por aqui que o arquivo bom é trocado pelo baixado. Se
  // o endereço for de outro sistema, a troca ESTRAGA o que funcionava — então
  // a recusa fica aqui, e não só na tela, que é onde ninguém garante que passa.
  if (!sabeAtualizarYtDlp()) throw new Error(NAO_SABE_ATUALIZAR)
  const dir = dirname(ytDlpPath)
  const tmpPath = join(tmpdir(), `mptrix-ytdlp-${Date.now()}.exe`)
  const backupPath = `${ytDlpPath}.old`

  const res = await fetch(downloadUrl, {
    cache: 'no-store',
    redirect: 'follow',
    headers: { 'User-Agent': UA }
  })
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status}`)

  const total = parseInt(res.headers.get('content-length') || '0', 10)
  let received = 0

  await new Promise((resolve, reject) => {
    const fileStream = createWriteStream(tmpPath)
    fileStream.on('error', reject)
    fileStream.on('finish', resolve)

    const reader = res.body.getReader()
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) { fileStream.end(); return }
          received += value.length
          fileStream.write(Buffer.from(value))
          if (onProgress) {
            const percent = total > 0 ? (received / total) * 100 : 0
            onProgress({ received, total, percent })
          }
        }
      } catch (err) {
        fileStream.destroy()
        reject(err)
      }
    }
    pump()
  })

  const stats = statSync(tmpPath)
  if (stats.size < 100000) {
    try { unlinkSync(tmpPath) } catch {}
    throw new Error('Arquivo baixado parece estar corrompido (muito pequeno).')
  }

  if (existsSync(backupPath)) {
    try { unlinkSync(backupPath) } catch {}
  }

  if (existsSync(ytDlpPath)) {
    try {
      renameSync(ytDlpPath, backupPath)
    } catch (err) {
      try { unlinkSync(tmpPath) } catch {}
      throw new Error(`Não consegui substituir o arquivo (talvez esteja em uso): ${err.message}`)
    }
  }

  try {
    renameSync(tmpPath, ytDlpPath)
  } catch (err) {
    if (existsSync(backupPath)) {
      try { renameSync(backupPath, ytDlpPath) } catch {}
    }
    throw new Error(`Não consegui mover o novo arquivo: ${err.message}`)
  }

  try { unlinkSync(backupPath) } catch {}

  return { path: ytDlpPath, size: stats.size }
}
