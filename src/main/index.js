import { app, BrowserWindow, ipcMain, shell, dialog, Menu, clipboard, protocol, powerSaveBlocker } from 'electron'
import { spawn } from 'child_process'
import { join, basename, extname, dirname } from 'path'
import { Readable } from 'stream'
import { existsSync, mkdirSync, statSync, renameSync, createReadStream, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { randomUUID, createHash } from 'crypto'
import { PRESETS, startDownload, probeVideo, probePlaylist, probeVideoMaxHeight, formatBytes, qualityLabel } from './downloader.js'
import { resolverYtDlp } from './binpath.js'
import { ligarCelular, desligarCelular, infoCelular, pedidosRecentes } from './celular.js'
import { paginaCelular } from './celular-pagina.js'
import {
  prepararAtualizacaoDoApp,
  estadoDaAtualizacao,
  procurarAtualizacao,
  baixarAtualizacao,
  instalarAtualizacao
} from './appupdate.js'
import {
  MODELS as STUDIO_MODELS,
  getEngineStatus,
  getCachedSession,
  startStudioJob,
  startExtractJob,
  startAutoExtract,
  startPlanJob,
  startPolishJob,
  unpolishStem,
  getCachedPlan,
  scoutSession,
  renderVariant,
  exportStems,
  exportSong,
  stemsRoot,
  freeMemMB,
  removeCachesForFile,
  repairSession,
  specialistCatalog,
  redoStem,
  setShelved,
  setDentroDeOutros,
  stemPeaks,
  detectChords,
  transcribeLyrics,
  gruposDeRepeticao,
  saveLyrics
} from './studio.js'
import {
  getYtDlpVersion,
  getFfmpegVersion,
  getLatestRelease,
  hasUpdate,
  isAheadOfStable,
  downloadAndReplace
} from './updater.js'

function attachContextMenu(window) {
  window.webContents.on('context-menu', (_event, params) => {
    const template = []
    const hasSelection = !!(params.selectionText && params.selectionText.trim())
    const isEditable = params.isEditable
    const flags = params.editFlags || {}

    if (params.linkURL) {
      template.push({
        label: 'Copiar link',
        click: () => clipboard.writeText(params.linkURL)
      })
      template.push({
        label: 'Abrir link no navegador',
        click: () => shell.openExternal(params.linkURL)
      })
      template.push({ type: 'separator' })
    }

    if (params.hasImageContents) {
      template.push({
        label: 'Copiar imagem',
        click: () => window.webContents.copyImageAt(params.x, params.y)
      })
      if (params.srcURL) {
        template.push({
          label: 'Copiar endereço da imagem',
          click: () => clipboard.writeText(params.srcURL)
        })
      }
      template.push({ type: 'separator' })
    }

    if (isEditable) {
      template.push({ label: 'Recortar', role: 'cut', enabled: hasSelection && flags.canCut })
      template.push({ label: 'Copiar', role: 'copy', enabled: hasSelection && flags.canCopy })
      template.push({ label: 'Colar', role: 'paste', enabled: flags.canPaste })
      template.push({ type: 'separator' })
      template.push({ label: 'Selecionar tudo', role: 'selectAll', enabled: flags.canSelectAll })
    } else if (hasSelection) {
      template.push({ label: 'Copiar', role: 'copy' })
      template.push({ type: 'separator' })
      template.push({ label: 'Selecionar tudo', role: 'selectAll', enabled: flags.canSelectAll })
    } else if (template.length === 0) {
      template.push({ label: 'Selecionar tudo', role: 'selectAll', enabled: flags.canSelectAll })
    }

    if (template.length === 0) return
    Menu.buildFromTemplate(template).popup({ window })
  })
}
import {
  getNuvem,
  podeGuardarChave,
  setChaveNuvem,
  lerChaveNuvem,
  setNuvemLigada,
  setTetoNuvem,
  informarCredito,
  somarCredito,
  apagarDadosNuvem,
  apagarLinhasDoLivro,
  simularGasto,
  zerarGastoNuvem,
  getSettings,
  setDownloadDir,
  getHistory,
  addHistoryEntry,
  updateHistoryEntry,
  removeHistoryEntry,
  clearHistory,
  getUpdateCache,
  setUpdateCache,
  setUiZoom
,
  lerAjuste,
  guardarAjuste
} from './store.js'

const UPDATE_CHECK_TTL_MS = 4 * 60 * 60 * 1000
let updateRunning = false

function simplifyName(filename) {
  if (!filename) return ''
  let name = filename
  name = name.replace(/\.[a-z0-9]{2,5}$/i, '')
  name = name.replace(/\s*\[[a-zA-Z0-9_-]{9,15}\]\s*$/, '')
  name = name.replace(/\s+/g, ' ').trim()
  return name || filename
}

function sanitizeForFs(name) {
  return (name || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .replace(/\s+$/, '')
    .replace(/^\s+/, '')
    .slice(0, 180)
}

function renameToCleanName(currentPath, desiredBaseName) {
  if (!currentPath || !existsSync(currentPath)) {
    return { newPath: currentPath, renamed: false }
  }
  const dir = dirname(currentPath)
  const ext = extname(currentPath)
  const safeBase = sanitizeForFs(desiredBaseName) || basename(currentPath, ext)

  let candidate = join(dir, `${safeBase}${ext}`)
  if (candidate === currentPath) {
    return { newPath: currentPath, renamed: false }
  }
  let i = 2
  while (existsSync(candidate)) {
    candidate = join(dir, `${safeBase} (${i})${ext}`)
    i++
    if (i > 999) return { newPath: currentPath, renamed: false, error: 'muitos arquivos com o mesmo nome' }
  }
  try {
    renameSync(currentPath, candidate)
    return { newPath: candidate, renamed: true }
  } catch (err) {
    return { newPath: currentPath, renamed: false, error: err.message }
  }
}

function getBinPath(name) {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', name)
  }
  return join(__dirname, '../../resources/bin', name)
}

// Onde mora o yt-dlp: a decisão inteira, com o porquê, está em binpath.js —
// ela vive lá fora pra poder ser medida sem subir o app.
const ondeYtDlp = resolverYtDlp({
  noPacote: getBinPath('yt-dlp.exe'),
  pastaDeDados: app.getPath('userData'),
  empacotado: app.isPackaged
})
if (ondeYtDlp.erro) console.error('[yt-dlp] pasta gravável falhou:', ondeYtDlp.erro)
const YT_DLP_PATH = ondeYtDlp.caminho
const FFMPEG_PATH = getBinPath('ffmpeg.exe')

let mainWindow = null
const activeJobs = new Map()
const jobMetadata = new Map()
const activeBatches = new Map()
const activeQualityProbes = new Map() // probeId -> { cancelled }
const activeStudioJobs = new Map()

// Guarda-sono: enquanto houver trabalho pesado rodando, o computador NÃO dorme
// (a tela pode apagar normalmente — o processamento continua por baixo)
let sleepBlockerId = null
let heavyJobCount = 0
function heavyJobStart() {
  heavyJobCount++
  if (sleepBlockerId === null) {
    sleepBlockerId = powerSaveBlocker.start('prevent-app-suspension')
  }
}
function heavyJobEnd() {
  heavyJobCount = Math.max(0, heavyJobCount - 1)
  if (heavyJobCount === 0 && sleepBlockerId !== null) {
    try { powerSaveBlocker.stop(sleepBlockerId) } catch {}
    sleepBlockerId = null
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'stems',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
])

// ██████ VIGIA DA ÁREA DE TRANSFERÊNCIA ██████
//
// O caminho normal era: a pessoa copia o link no navegador, volta pro MPTRIX,
// abre BAIXAR, escolhe o formato, cola o link. O passo de colar é trabalho
// que o computador podia fazer sozinho — ele já sabe o que está na área de
// transferência.
//
// Não existe evento de "a área de transferência mudou" no Electron, então é
// vigia mesmo: olha de segundo em segundo. É barato (uma leitura de texto) e
// precisa rodar mesmo com o app atrás do navegador — justamente aí é que a
// pessoa copia.
//
// Só avisa uma vez por link: sem isso o aviso voltaria a cada segundo pro
// mesmo link, e um aviso que não some vira poluição, não ajuda.
const HOSTS_CONHECIDOS = /(youtube\.com|youtu\.be|soundcloud\.com|bandcamp\.com|vimeo\.com|dailymotion\.com|twitch\.tv|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com)$/i

function lerLinkDaArea() {
  let texto = ''
  try { texto = (clipboard.readText() || '').trim() } catch { return null }
  // link tem que caber numa linha: texto colado com quebra é outra coisa
  if (!texto || texto.length > 2048 || /\s/.test(texto)) return null
  let u
  try { u = new URL(texto) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const host = u.hostname.replace(/^www\./, '')
  if (!HOSTS_CONHECIDOS.test(host)) return null
  return {
    url: texto,
    host,
    // playlist muda o formato sugerido: baixar 40 músicas uma a uma seria
    // castigo, e o preset de playlist existe exatamente pra isso
    playlist: u.searchParams.has('list') || /\/playlist|\/sets\//.test(u.pathname)
  }
}

let ultimoLinkVisto = null
// O ACHADO FICA GUARDADO, e não é detalhe: a marca só existe na tela do
// estúdio, então quem copia um link estando no acervo não tem ninguém
// escutando. Como o aviso é disparado UMA vez por link, ele se perdia no ar e
// a marca ficava parada pra sempre com um link válido na área. Guardado aqui,
// a tela pergunta "tem algo?" toda vez que nasce e recupera o que perdeu.
let linhaGuardada = null
let vigiaArea = null

function ligarVigiaDaArea() {
  if (vigiaArea) return
  vigiaArea = setInterval(() => {
    const achado = lerLinkDaArea()
    const chave = achado?.url || null
    if (chave === ultimoLinkVisto) return
    ultimoLinkVisto = chave
    linhaGuardada = achado
    if (achado) send('clipboard:link', achado)
  }, 1000)
}

function desligarVigiaDaArea() {
  if (vigiaArea) clearInterval(vigiaArea)
  vigiaArea = null
}

const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// Degraus da lupinha (zoom da interface)
const ZOOMS = [0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6]
function zoomStep(dir) {
  if (!mainWindow || mainWindow.isDestroyed()) return 1
  const wc = mainWindow.webContents
  let z
  if (dir === 0) {
    z = 1
  } else {
    const cur = wc.getZoomFactor()
    let i = 0
    for (let k = 1; k < ZOOMS.length; k++) {
      if (Math.abs(ZOOMS[k] - cur) < Math.abs(ZOOMS[i] - cur)) i = k
    }
    i = Math.max(0, Math.min(ZOOMS.length - 1, i + dir))
    z = ZOOMS[i]
  }
  wc.setZoomFactor(z)
  setUiZoom(z)
  send('ui:zoom-changed', z)
  return z
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    icon: app.isPackaged ? undefined : join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // O app se atualizando: só OLHA sozinho — baixar e instalar são por clique.
  // Os 6 segundos são pra não disputar rede com a abertura do app; quem chega
  // quer ver o acervo, não uma verificação.
  prepararAtualizacaoDoApp({
    janelaPrincipal: mainWindow,
    empacotado: app.isPackaged,
    versao: app.getVersion()
  })
  setTimeout(() => { procurarAtualizacao() }, 6000)

  // Se a tela travar (ex.: falta de memória), recarrega em vez de ficar preta
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload()
    }
  })

  // LUPINHA: zoom da interface com memória — o Chromium guarda zoom sozinho
  // por origem, então sempre impomos o valor salvo (senão um Ctrl+rodinha
  // acidental encolhe o app pra sempre, sem caminho de volta)
  const applyZoom = () => {
    const z = getSettings()?.uiZoom
    mainWindow.webContents.setZoomFactor(typeof z === 'number' ? z : 1)
  }
  mainWindow.webContents.on('did-finish-load', applyZoom)
  // Atalhos clássicos (o app não tem menu, então registramos na mão):
  // Ctrl+= aproxima, Ctrl+- afasta, Ctrl+0 volta ao normal
  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown' || !input.control) return
    if (input.key === '=' || input.key === '+') { zoomStep(1); e.preventDefault() }
    else if (input.key === '-') { zoomStep(-1); e.preventDefault() }
    else if (input.key === '0') { zoomStep(0); e.preventDefault() }
  })
  // Ctrl+rodinha do mouse também passa pela lupinha (e fica salvo direito)
  mainWindow.webContents.on('zoom-changed', (_e, dir) => {
    zoomStep(dir === 'in' ? 1 : -1)
  })

  attachContextMenu(mainWindow)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    if (process.env.MPTRIX_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function presetMetaList() {
  return Object.values(PRESETS).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    outputExt: p.outputExt,
    needsQualityChoice: p.needsQualityChoice === true
  }))
}

function resolveDownloadDir() {
  const saved = getSettings().downloadDir
  if (saved && typeof saved === 'string') return saved
  return app.getPath('downloads')
}

app.whenReady().then(() => {
  ipcMain.handle('app:getEnvironment', () => ({
    platform: process.platform,
    appVersion: app.getVersion(),
    binPaths: { ytDlp: YT_DLP_PATH, ffmpeg: FFMPEG_PATH },
    binariesPresent: {
      ytDlp: existsSync(YT_DLP_PATH),
      ffmpeg: existsSync(FFMPEG_PATH)
    },
    presets: presetMetaList(),
    settings: { downloadDir: resolveDownloadDir() },
    history: getHistory()
  }))

  ipcMain.handle('settings:pickDir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Escolher pasta de destino',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: resolveDownloadDir()
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const dir = result.filePaths[0]
    setDownloadDir(dir)
    return dir
  })

  ipcMain.handle('settings:setDownloadDir', (_e, dir) => setDownloadDir(dir))

  // ------------------------------------------------------------- NUVEM ----
  // A chave NUNCA volta pra interface — nem mascarada. A tela só sabe se
  // existe uma chave guardada, não qual é.
  ipcMain.handle('nuvem:estado', () => ({ ...getNuvem(), podeGuardar: podeGuardarChave() }))

  ipcMain.handle('nuvem:testar', async (_e, chave) => {
    const { testarChave } = await import('./nuvem.js')
    // sem chave nova = testa a que já está guardada
    return testarChave(chave || lerChaveNuvem())
  })

  ipcMain.handle('nuvem:salvarChave', async (_e, chave) => {
    const { testarChave } = await import('./nuvem.js')
    const teste = await testarChave(chave)
    if (!teste.ok) return teste
    const r = setChaveNuvem(chave)
    if (!r.ok) return r
    // Liga aqui, não numa segunda chamada da tela: quem se deu ao trabalho de
    // colar a chave quer usar a nuvem, e um "ligar" separado é um passo a mais
    // pra dar errado no meio. Desligar continua a um clique.
    setNuvemLigada(true)
    return { ok: true, conta: teste.conta, estado: getNuvem() }
  })

  ipcMain.handle('nuvem:apagarChave', () => {
    setChaveNuvem(null)
    return getNuvem()
  })

  ipcMain.handle('nuvem:ligar', (_e, v) => setNuvemLigada(v))
  ipcMain.handle('nuvem:teto', (_e, centavos) => setTetoNuvem(centavos))
  ipcMain.handle('nuvem:credito', (_e, centavos) => informarCredito(centavos))
  ipcMain.handle('nuvem:somarCredito', (_e, centavos) => somarCredito(centavos))
  ipcMain.handle('nuvem:apagarDados', (_e, o) => apagarDadosNuvem(o || {}))
  ipcMain.handle('nuvem:apagarLinhas', (_e, ids) => apagarLinhasDoLivro(ids))
  ipcMain.handle('nuvem:simular', (_e, centavos) => simularGasto(centavos))
  ipcMain.handle('nuvem:zerarGasto', () => zerarGastoNuvem())

  ipcMain.handle('history:get', () => getHistory())

  ipcMain.handle('history:remove', async (_e, payload) => {
    const id = typeof payload === 'string' ? payload : payload?.id
    const deleteFile = typeof payload === 'object' && payload?.deleteFile === true
    if (deleteFile) {
      const entry = getHistory().find((e) => e.id === id)
      const files = [...new Set([entry?.primaryFile, ...(entry?.files || [])].filter(Boolean))]
      for (const f of files) {
        try { removeCachesForFile(f) } catch {}
        try {
          if (existsSync(f)) await shell.trashItem(f)
        } catch {}
      }
    }
    const updated = removeHistoryEntry(id)
    send('history:changed', updated)
    return updated
  })

  ipcMain.handle('history:clear', () => {
    const updated = clearHistory()
    send('history:changed', updated)
    return updated
  })

  ipcMain.handle('history:rename', (_e, { id, newName }) => {
    const list = getHistory()
    const entry = list.find((e) => e.id === id)
    if (!entry) return { error: 'Item não encontrado no histórico.' }

    const trimmed = (newName || '').trim()
    if (!trimmed) return { error: 'O nome não pode ficar vazio.' }

    const sanitized = sanitizeForFs(trimmed)
    if (!sanitized) return { error: 'Esse nome não é válido pra arquivo.' }

    const patch = { customName: trimmed }

    if (entry.primaryFile && existsSync(entry.primaryFile)) {
      const result = renameToCleanName(entry.primaryFile, sanitized)
      if (result.error) {
        return { error: `Não foi possível renomear o arquivo: ${result.error}` }
      }
      if (result.renamed) {
        patch.primaryFile = result.newPath
        if (Array.isArray(entry.files)) {
          patch.files = entry.files.map((f) => (f === entry.primaryFile ? result.newPath : f))
        }
      }
    }

    const updated = updateHistoryEntry(id, patch)
    send('history:changed', updated)
    return { updated }
  })

  // FAVORITO — so um sinal no registro, nenhum arquivo e tocado. O acervo
  // cresce sozinho (99 itens hoje) e sem marcacao a unica forma de reachar
  // uma musica e lembrar do nome dela. E marca do dono, entao ela sobrevive
  // a renomear, a reordenar e a filtrar.
  ipcMain.handle('history:favorite', (_e, { id, favorito }) => {
    const list = getHistory()
    const entry = list.find((e) => e.id === id)
    if (!entry) return { error: 'Item não encontrado no histórico.' }
    const alvo = typeof favorito === 'boolean' ? favorito : !entry.favorito
    const updated = updateHistoryEntry(id, { favorito: alvo })
    send('history:changed', updated)
    return { updated, favorito: alvo }
  })

  // a tela pergunta isto ao nascer: ver o quadro atual em vez de so escutar o
  // proximo e o que faz a marca sobreviver a troca de aba
  ipcMain.handle('clipboard:atual', () => linhaGuardada)

  ipcMain.handle('video:probe', async (_e, url) => {
    if (!existsSync(YT_DLP_PATH)) {
      return { error: 'yt-dlp.exe não encontrado em resources/bin.' }
    }
    try {
      const info = await probeVideo({ ytDlpPath: YT_DLP_PATH, url })
      return { info }
    } catch (err) {
      return { error: err.message || 'Falha ao buscar informações do vídeo.' }
    }
  })

  ipcMain.handle('playlist:probe', async (_e, url) => {
    if (!existsSync(YT_DLP_PATH)) {
      return { error: 'yt-dlp.exe não encontrado em resources/bin.' }
    }
    try {
      const info = await probePlaylist({ ytDlpPath: YT_DLP_PATH, url })
      return { info }
    } catch (err) {
      return { error: err.message || 'Falha ao buscar a playlist.' }
    }
  })

  ipcMain.handle('playlist:startBatch', async (_e, { items, outputDir }) => {
    if (!Array.isArray(items) || items.length === 0) {
      return { error: 'Nenhum vídeo selecionado.' }
    }
    if (!existsSync(YT_DLP_PATH)) return { error: 'yt-dlp.exe não encontrado.' }
    if (!existsSync(FFMPEG_PATH)) return { error: 'ffmpeg.exe não encontrado.' }
    const dir = outputDir || resolveDownloadDir()
    try { mkdirSync(dir, { recursive: true }) } catch (err) {
      return { error: `Pasta inválida: ${err.message}` }
    }

    const batchId = randomUUID()
    const state = {
      items,
      total: items.length,
      currentIndex: -1,
      currentJobId: null,
      results: [],
      cancelled: false
    }
    activeBatches.set(batchId, state)

    const runNext = () => {
      if (state.cancelled) {
        send('playlist:end', { batchId, completed: state.results.filter((r) => r.success).length, failed: state.results.filter((r) => !r.success).length, cancelled: true })
        activeBatches.delete(batchId)
        return
      }
      state.currentIndex += 1
      if (state.currentIndex >= state.items.length) {
        send('playlist:end', { batchId, completed: state.results.filter((r) => r.success).length, failed: state.results.filter((r) => !r.success).length, cancelled: false })
        activeBatches.delete(batchId)
        return
      }
      const item = state.items[state.currentIndex]
      const preset = PRESETS[item.presetId]
      const collectedFiles = []
      const { id: jobId, cancel } = startDownload({
        ytDlpPath: YT_DLP_PATH,
        ffmpegPath: FFMPEG_PATH,
        url: item.url,
        presetId: item.presetId,
        outputDir: dir,
        qualityHeight: item.qualityHeight,
        onProgress: (p) => send('download:progress', p),
        onStatus: (s) => {
          send('download:status', s)
          if (s.state === 'done') {
            const rawFiles = s.files && s.files.length ? s.files : collectedFiles
            const rawPrimary = s.primaryFile || rawFiles[0] || null
            const rawTitle = rawPrimary ? basename(rawPrimary) : '(sem nome)'
            const cleanBase = simplifyName(rawTitle)
            let primaryFile = rawPrimary
            let files = [...rawFiles]
            if (rawPrimary && cleanBase) {
              const result = renameToCleanName(rawPrimary, cleanBase)
              if (result.renamed) {
                primaryFile = result.newPath
                files = files.map((f) => (f === rawPrimary ? result.newPath : f))
              }
            }
            let fileSize = 0
            let ext = ''
            if (primaryFile && existsSync(primaryFile)) {
              try { fileSize = statSync(primaryFile).size } catch {}
              ext = extname(primaryFile).replace(/^\./, '').toLowerCase()
            }
            const qHeight = item.qualityHeight ? Number(item.qualityHeight) : null
            const entry = {
              id: randomUUID(),
              timestamp: new Date().toISOString(),
              presetId: item.presetId,
              presetName: preset?.name || item.presetId,
              url: item.url,
              outputDir: dir,
              qualityHeight: qHeight,
              qualityLabel: qHeight ? qualityLabel(qHeight) : null,
              ext,
              fileSize,
              fileSizeLabel: formatBytes(fileSize),
              files,
              primaryFile,
              title: rawTitle,
              displayName: cleanBase,
              customName: null,
              playlistBatchId: batchId
            }
            const updated = addHistoryEntry(entry)
            send('history:changed', updated)
            state.results.push({ success: true, item, files, primaryFile })
            send('playlist:itemEnd', { batchId, index: state.currentIndex, success: true, title: item.title })
          }
          if (s.state === 'error' || s.state === 'cancelled') {
            state.results.push({ success: false, item, error: s.message || s.state })
            send('playlist:itemEnd', { batchId, index: state.currentIndex, success: false, title: item.title, error: s.message })
          }
          if (s.state !== 'running') {
            activeJobs.delete(s.id)
            jobMetadata.delete(s.id)
            state.currentJobId = null
            setTimeout(runNext, 200)
          }
        },
        onFile: (f) => {
          collectedFiles.push(f.filepath)
          send('download:file', f)
        },
        onStage: (st) => send('download:stage', st),
        onLog: (lg) => send('download:log', lg),
        onIssue: (iss) => send('download:issue', iss)
      })
      state.currentJobId = jobId
      activeJobs.set(jobId, cancel)
      jobMetadata.set(jobId, { url: item.url, presetId: item.presetId, outputDir: dir, qualityHeight: item.qualityHeight })
      send('playlist:itemStart', { batchId, index: state.currentIndex, total: state.total, jobId, title: item.title, url: item.url })
    }

    runNext()
    return { batchId, total: state.total }
  })

  ipcMain.handle('playlist:probeQualities', async (_e, { entries, concurrency = 2 }) => {
    if (!existsSync(YT_DLP_PATH)) return { error: 'yt-dlp.exe não encontrado.' }
    if (!Array.isArray(entries) || entries.length === 0) return { error: 'Lista vazia.' }
    const probeId = randomUUID()
    const state = { cancelled: false, consecutiveNulls: 0, rateLimited: false }
    activeQualityProbes.set(probeId, state)
    const total = entries.length
    let done = 0

    const worker = async (index, url) => {
      if (state.cancelled || state.rateLimited) return
      let maxHeight = null
      try {
        maxHeight = await probeVideoMaxHeight({ ytDlpPath: YT_DLP_PATH, url })
      } catch {}
      if (state.cancelled) return
      done += 1
      if (maxHeight === null) {
        state.consecutiveNulls += 1
        if (state.consecutiveNulls >= 5) state.rateLimited = true
      } else {
        state.consecutiveNulls = 0
      }
      send('playlist:itemQuality', { probeId, index, maxHeight, done, total })
    }

    let next = 0
    const runners = []
    for (let i = 0; i < Math.min(concurrency, entries.length); i++) {
      runners.push((async () => {
        while (!state.cancelled && !state.rateLimited && next < entries.length) {
          const idx = next++
          const entry = entries[idx]
          if (entry?.url) await worker(idx, entry.url)
          const jitter = 200 + Math.floor(Math["random"]() * 200)
          await new Promise((r) => setTimeout(r, jitter))
        }
      })())
    }
    Promise.all(runners).then(() => {
      activeQualityProbes.delete(probeId)
      if (!state.cancelled) {
        send('playlist:qualitiesDone', {
          probeId,
          total,
          rateLimited: state.rateLimited
        })
      }
    })
    return { probeId, total }
  })

  ipcMain.handle('playlist:cancelQualityProbe', (_e, probeId) => {
    const state = activeQualityProbes.get(probeId)
    if (state) { state.cancelled = true; activeQualityProbes.delete(probeId); return true }
    return false
  })

  ipcMain.handle('playlist:cancelBatch', (_e, batchId) => {
    const state = activeBatches.get(batchId)
    if (!state) return false
    state.cancelled = true
    if (state.currentJobId) {
      const cancel = activeJobs.get(state.currentJobId)
      if (cancel) cancel()
    }
    return true
  })

  ipcMain.handle('shell:showInFolder', (_e, filePath) => {
    if (filePath && existsSync(filePath)) {
      shell.showItemInFolder(filePath)
      return true
    }
    return false
  })

  ipcMain.handle('shell:openPath', async (_e, filePath) => {
    if (!filePath || !existsSync(filePath)) return false
    const err = await shell.openPath(filePath)
    return err === ''
  })

  // COPIAR TEXTO pela ponte, e não pelo navigator.clipboard: no app empacotado
  // a tela não roda em contexto seguro, e lá aquilo simplesmente não existe —
  // funcionaria em desenvolvimento e falharia calado no computador de quem usa.
  ipcMain.handle('clipboard:copiarTexto', (_e, texto) => {
    const t = String(texto || '')
    if (!t) return false
    clipboard.writeText(t)
    // A VIGIA PRECISA SABER. Ela fica olhando a área de transferência pra
    // acender a ampulheta quando aparece um link de música. Se o próprio app
    // copia um link e não avisa, a roda começa a pulsar oferecendo "baixar" —
    // o app se assustando com a própria mão.
    ultimoLinkVisto = t
    return true
  })

  ipcMain.handle('shell:openExternal', (_e, url) => {
    shell.openExternal(url)
    return true
  })

  ipcMain.handle('shell:copyFilesToClipboard', async (_e, paths) => {
    if (!Array.isArray(paths) || paths.length === 0) {
      return { error: 'Nenhum arquivo selecionado.' }
    }
    const existing = paths.filter((p) => p && existsSync(p))
    if (existing.length === 0) {
      return { error: 'Nenhum arquivo encontrado no disco.' }
    }
    if (process.platform !== 'win32') {
      return { error: 'Copiar arquivos só funciona no Windows por enquanto.' }
    }
    const escaped = existing.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ')
    const script = `Set-Clipboard -Path ${escaped}`
    return await new Promise((resolve) => {
      const child = spawn(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { windowsHide: true }
      )
      let stderr = ''
      child.stderr.on('data', (c) => { stderr += c.toString('utf8') })
      child.on('error', (err) => resolve({ error: err.message }))
      child.on('close', (code) => {
        if (code === 0) resolve({ count: existing.length })
        else resolve({ error: stderr.trim() || `PowerShell saiu com código ${code}` })
      })
    })
  })

  // Quando o app está empacotado não existe pasta src — aí não há como saber se
  // o código andou, e a tela simplesmente não fala do assunto. Palpite sobre
  // atualidade é pior do que silêncio.
  const mtimeDoCodigo = () => {
    const raiz = join(__dirname, '..', '..', 'src')
    if (!existsSync(raiz)) return null
    let novo = 0
    const andar = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) andar(p)
        else { const t = statSync(p).mtimeMs; if (t > novo) novo = t }
      }
    }
    try { andar(raiz) } catch { return null }
    return novo || null
  }

  ipcMain.handle('app:findInstaller', async () => {
    const candidates = [
      join(__dirname, '..', '..', 'release'),
      join(process.cwd(), 'release')
    ]
    for (const dir of candidates) {
      if (!existsSync(dir)) continue
      try {
        const files = readdirSync(dir)
          .filter((f) => /^MPTRIX-Setup-.*\.exe$/i.test(f))
          .map((f) => {
            const p = join(dir, f)
            const stat = statSync(p)
            return { path: p, name: f, size: stat.size, mtime: stat.mtimeMs }
          })
          .sort((a, b) => b.mtime - a.mtime)
        if (files.length > 0) {
          const f = files[0]
          // A DATA VAI JUNTO, e com ela a pergunta que importa: o código andou
          // desde que este instalador foi feito? Um instalador de duas semanas
          // atrás não é "o app" — é o app de duas semanas atrás, e quem receber
          // não tem como saber disso. Mandar em silêncio é o app mentindo pelo
          // dono.
          return { path: f.path, name: f.name, size: f.size, feitoEm: f.mtime, codigoEm: mtimeDoCodigo() }
        }
      } catch {}
    }
    return null
  })

  ipcMain.handle('shell:zipFile', async (_e, filePath) => {
    if (!filePath || !existsSync(filePath)) return { error: 'Arquivo não encontrado.' }
    if (process.platform !== 'win32') return { error: 'Só funciona no Windows por enquanto.' }
    const zipPath = filePath.replace(/\.exe$/i, '.zip')
    const escapedFile = filePath.replace(/'/g, "''")
    const escapedZip = zipPath.replace(/'/g, "''")
    const script = `Compress-Archive -Path '${escapedFile}' -DestinationPath '${escapedZip}' -Force`
    return await new Promise((resolve) => {
      const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true })
      let stderr = ''
      child.stderr.on('data', (c) => { stderr += c.toString('utf8') })
      child.on('error', (err) => resolve({ error: err.message }))
      child.on('close', (code) => {
        if (code === 0 && existsSync(zipPath)) {
          try { const size = statSync(zipPath).size; resolve({ zipPath, size }) } catch (e) { resolve({ error: e.message }) }
        } else {
          resolve({ error: stderr.trim() || `PowerShell saiu com código ${code}` })
        }
      })
    })
  })

  ipcMain.handle('system:estimateBandwidth', async () => {
    const BYTES = 2 * 1024 * 1024
    const URL = `https://speed.cloudflare.com/__down?bytes=${BYTES}`
    try {
      const start = Date.now()
      const res = await fetch(URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      const elapsedSec = Math.max(0.1, (Date.now() - start) / 1000)
      const bytesPerSec = buf.byteLength / elapsedSec
      return { bytesPerSec, elapsedSec, sampleBytes: buf.byteLength }
    } catch (err) {
      return { error: err.message, bytesPerSec: 3 * 1024 * 1024 }
    }
  })

  // ▸ O ESTÚDIO NO CELULAR. Sai desligado: é o dono que decide quando abrir
  // uma porta na rede da casa, mesmo sendo a rede dele.
  ipcMain.handle('celular:estado', () => infoCelular())
  ipcMain.handle('celular:ligar', () => ligarCelular({
    stemsDir: join(process.env.LOCALAPPDATA || app.getPath('userData'), 'MPTRIX', 'stems'),
    paginaHtml: paginaCelular,
    ffmpegPath: FFMPEG_PATH,
    // a senha fica guardada: o que o celular levou pro ensaio está preso ao
    // endereço, e endereço novo a cada abertura viraria música inalcançável
    senhaSalva: lerAjuste('celular.senha'),
    guardarSenha: (s) => guardarAjuste('celular.senha', s),
    // as músicas apenas baixadas também aparecem no celular: nem sempre o dono
    // quer separar — às vezes ele quer só a música inteira, com o estúdio
    // rápido, pra tocar junto no ensaio
    historico: () => getHistory(),
    // a porta é METADE do endereço: mudar ela é mudar o endereço, e o que o
    // celular levou pro ensaio fica guardado POR endereço
    portaSalva: lerAjuste('celular.porta', 8788),
    guardarPorta: (n) => guardarAjuste('celular.porta', n),
    // BAIXAR PELO CELULAR. Quem trabalha é este computador — o mesmo caminho
    // que a tela daqui usa, com o mesmo yt-dlp, a mesma pasta de destino e o
    // mesmo registro no acervo. Um segundo caminho paralelo seria um segundo
    // lugar pra dar defeito, e a música baixada pelo celular não apareceria
    // aqui.
    baixar: ({ url, presetId, onProgress, onStatus }) => {
      if (!existsSync(YT_DLP_PATH) || !existsSync(FFMPEG_PATH)) {
        onStatus({ state: 'error', message: 'faltam os programas de download no computador' })
        return
      }
      const dir = resolveDownloadDir()
      try { mkdirSync(dir, { recursive: true }) } catch {}
      startDownload({
        ytDlpPath: YT_DLP_PATH,
        ffmpegPath: FFMPEG_PATH,
        url,
        presetId,
        outputDir: dir,
        onProgress,
        onStatus: (st) => {
          onStatus(st)
          // o acervo do computador tem que enxergar o que o celular mandou
          // baixar, senão a música existe no disco e some do app
          if (st.state === 'done') {
            const arquivos = st.files && st.files.length ? st.files : []
            const principal = st.primaryFile || arquivos[0] || null
            if (principal && existsSync(principal)) {
              const nome = basename(principal)
              addHistoryEntry({
                url,
                presetId,
                presetName: (PRESETS[presetId] && PRESETS[presetId].name) || presetId,
                outputDir: dir,
                ext: extname(principal).replace(/^\./, '').toLowerCase(),
                fileSize: (() => { try { return statSync(principal).size } catch { return 0 } })(),
                files: arquivos.length ? arquivos : [principal],
                primaryFile: principal,
                title: nome,
                displayName: simplifyName(nome) || nome
              })
              send('history:changed')
            }
          }
        }
      })
    }
  }))
  ipcMain.handle('celular:desligar', () => desligarCelular())
  // O QUE O CELULAR PEDIU E O QUE EU RESPONDI. Sem isto, quando não funciona a
  // única informação que existe é "não consegui falar com o computador" — que
  // é justamente a que não diz nada. Aqui o dono vê do lado de cá se o pedido
  // chegou e o que foi respondido.
  ipcMain.handle('celular:pedidos', () => pedidosRecentes())

  // ▸ o MPTRIX se atualizando (o app inteiro, não o motor de baixar)
  ipcMain.handle('app-update:estado', () => estadoDaAtualizacao())
  ipcMain.handle('app-update:procurar', () => procurarAtualizacao())
  ipcMain.handle('app-update:baixar', () => baixarAtualizacao())
  ipcMain.handle('app-update:instalar', () => instalarAtualizacao())

  ipcMain.handle('updates:getVersions', async () => {
    const [ytDlp, ffmpeg] = await Promise.all([
      getYtDlpVersion(YT_DLP_PATH),
      getFfmpegVersion(FFMPEG_PATH)
    ])
    return { ytDlp, ffmpeg, cache: getUpdateCache() }
  })

  ipcMain.handle('updates:check', async (_e, { force } = {}) => {
    const cache = getUpdateCache()
    const fresh = cache.lastCheckAt && (Date.now() - cache.lastCheckAt < UPDATE_CHECK_TTL_MS)
    if (!force && fresh && cache.latestVersion) {
      const current = await getYtDlpVersion(YT_DLP_PATH)
      return {
        current,
        latest: cache.latestVersion,
        publishedAt: cache.latestPublishedAt,
        channel: cache.latestChannel || null,
        hasUpdate: hasUpdate(current, cache.latestVersion),
        aheadOfStable: isAheadOfStable(current, cache.latestStableVersion),
        dismissed: cache.dismissedVersion === cache.latestVersion,
        cached: true
      }
    }
    try {
      const [latest, current] = await Promise.all([
        getLatestRelease(),
        getYtDlpVersion(YT_DLP_PATH)
      ])
      const updated = setUpdateCache({
        lastCheckAt: Date.now(),
        latestVersion: latest.version,
        latestPublishedAt: latest.publishedAt,
        latestChannel: latest.channel,
        latestDownloadUrl: latest.downloadUrl,
        latestStableVersion: latest.stableVersion
      })
      return {
        current,
        latest: latest.version,
        publishedAt: latest.publishedAt,
        channel: latest.channel,
        hasUpdate: hasUpdate(current, latest.version),
        aheadOfStable: isAheadOfStable(current, latest.stableVersion),
        dismissed: updated.dismissedVersion === latest.version,
        cached: false
      }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('updates:dismiss', (_e, version) => {
    setUpdateCache({ dismissedVersion: version })
    return true
  })

  ipcMain.handle('updates:run', async () => {
    if (updateRunning) return { error: 'Já tem uma atualização rodando.' }
    if (!existsSync(YT_DLP_PATH)) return { error: 'yt-dlp.exe não encontrado.' }

    if (activeJobs.size > 0) {
      return { error: 'Há downloads em andamento. Espere terminarem antes de atualizar.' }
    }

    updateRunning = true
    send('updates:status', { state: 'starting' })
    try {
      let cache = getUpdateCache()
      let downloadUrl = cache.latestDownloadUrl
      if (!downloadUrl) {
        const latest = await getLatestRelease()
        cache = setUpdateCache({
          lastCheckAt: Date.now(),
          latestVersion: latest.version,
          latestPublishedAt: latest.publishedAt,
          latestChannel: latest.channel,
          latestDownloadUrl: latest.downloadUrl,
          latestStableVersion: latest.stableVersion
        })
        downloadUrl = cache.latestDownloadUrl
      }
      await downloadAndReplace(YT_DLP_PATH, downloadUrl, (p) => send('updates:progress', p))
      const newVersion = await getYtDlpVersion(YT_DLP_PATH)
      setUpdateCache({
        lastCheckAt: Date.now(),
        latestVersion: newVersion,
        dismissedVersion: null
      })
      send('updates:status', { state: 'done', version: newVersion })
      return { ok: true, version: newVersion }
    } catch (err) {
      send('updates:status', { state: 'error', message: err.message })
      return { error: err.message }
    } finally {
      updateRunning = false
    }
  })

  ipcMain.handle('download:start', (_e, { url, presetId, outputDir, qualityHeight }) => {
    if (!existsSync(YT_DLP_PATH)) {
      return { error: 'yt-dlp.exe não encontrado em resources/bin.' }
    }
    if (!existsSync(FFMPEG_PATH)) {
      return { error: 'ffmpeg.exe não encontrado em resources/bin.' }
    }
    const dir = outputDir || resolveDownloadDir()
    try {
      mkdirSync(dir, { recursive: true })
    } catch (err) {
      return { error: `Pasta inválida: ${err.message}` }
    }

    const preset = PRESETS[presetId]
    const collectedFiles = []

    const { id, cancel } = startDownload({
      ytDlpPath: YT_DLP_PATH,
      ffmpegPath: FFMPEG_PATH,
      url,
      presetId,
      outputDir: dir,
      qualityHeight,
      onProgress: (p) => send('download:progress', p),
      onStatus: (s) => {
        send('download:status', s)
        if (s.state === 'done') {
          const meta = jobMetadata.get(s.id) || {}
          const rawFiles = s.files && s.files.length ? s.files : collectedFiles
          const rawPrimary = s.primaryFile || rawFiles[0] || null
          const rawTitle = rawPrimary ? basename(rawPrimary) : '(sem nome)'
          const cleanBase = simplifyName(rawTitle)

          let primaryFile = rawPrimary
          let files = [...rawFiles]
          if (rawPrimary && cleanBase) {
            const { newPath, renamed } = renameToCleanName(rawPrimary, cleanBase)
            if (renamed) {
              primaryFile = newPath
              files = files.map((f) => (f === rawPrimary ? newPath : f))
            }
          }

          let fileSize = 0
          let ext = ''
          if (primaryFile && existsSync(primaryFile)) {
            try { fileSize = statSync(primaryFile).size } catch {}
            ext = extname(primaryFile).replace(/^\./, '').toLowerCase()
          }
          const qHeight = meta.qualityHeight ? Number(meta.qualityHeight) : null
          const entry = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            presetId: meta.presetId,
            presetName: preset?.name || meta.presetId,
            url: meta.url,
            outputDir: meta.outputDir,
            qualityHeight: qHeight,
            qualityLabel: qHeight ? qualityLabel(qHeight) : null,
            ext,
            fileSize,
            fileSizeLabel: formatBytes(fileSize),
            files,
            primaryFile,
            title: rawTitle,
            displayName: cleanBase,
            customName: null
          }
          const updated = addHistoryEntry(entry)
          send('history:changed', updated)
        }
        if (s.state !== 'running') {
          activeJobs.delete(s.id)
          jobMetadata.delete(s.id)
        }
      },
      onFile: (f) => {
        collectedFiles.push(f.filepath)
        send('download:file', f)
      },
      onStage: (st) => send('download:stage', st),
      onLog: (lg) => send('download:log', lg),
      onIssue: (iss) => send('download:issue', iss)
    })
    activeJobs.set(id, cancel)
    jobMetadata.set(id, { url, presetId, outputDir: dir, qualityHeight })
    return { id }
  })

  ipcMain.handle('download:cancel', (_e, id) => {
    const cancel = activeJobs.get(id)
    if (cancel) {
      cancel()
      return true
    }
    return false
  })

  // ---------- Estúdio (separação de instrumentos) ----------
  // Serve os stems com suporte a Range (206) — sem isso o player não consegue
  // navegar livremente pela música (voltava pro início ao pular pra frente).
  protocol.handle('stems', async (request) => {
    try {
      const u = new URL(request.url)
      const parts = decodeURIComponent(u.pathname).split('/').filter(Boolean)
      if (u.hostname !== 's' || parts.length !== 3 || parts.some((p) => p.includes('..'))) {
        return new Response('não permitido', { status: 403 })
      }
      const full = join(stemsRoot(), ...parts)
      if (!existsSync(full)) return new Response('não encontrado', { status: 404 })
      const size = statSync(full).size
      // capa de item do acervo entra por aqui tambem (mesma porta, mesma
      // checagem de caminho) — por isso o tipo agora cobre imagem
      const type = full.endsWith('.flac') ? 'audio/flac'
        : full.endsWith('.wav') ? 'audio/wav'
          : full.endsWith('.jpg') || full.endsWith('.jpeg') ? 'image/jpeg'
            : full.endsWith('.png') ? 'image/png'
              : 'application/octet-stream'
      const baseHeaders = {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      }
      const range = request.headers.get('Range')
      const m = range && range.match(/bytes=(\d+)-(\d*)/)
      if (m) {
        const start = Number(m[1])
        const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
        if (start >= size || start > end) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
        }
        return new Response(Readable.toWeb(createReadStream(full, { start, end })), {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(end - start + 1)
          }
        })
      }
      return new Response(Readable.toWeb(createReadStream(full)), {
        status: 200,
        headers: { ...baseHeaders, 'Content-Length': String(size) }
      })
    } catch (err) {
      return new Response(`erro: ${err.message}`, { status: 500 })
    }
  })

  ipcMain.handle('studio:engineStatus', () => getEngineStatus())

  ipcMain.handle('studio:models', () =>
    Object.values(STUDIO_MODELS).map((m) => ({ id: m.id, name: m.name, stems: m.stems }))
  )

  // Arsenal completo dos especialistas — pra busca manual na tela
  ipcMain.handle('studio:catalog', () => specialistCatalog())

  // Prateleira: guardar/promover faixa (nada é apagado)
  // CAPA DO ITEM DO ACERVO. O MP3 baixado com capa traz a miniatura do video
  // embutida; aqui ela e extraida uma vez e guardada em cache, e devolvida como
  // endereco `stems://` (a mesma porta que ja serve as faixas, com a mesma
  // checagem de caminho). Arquivo sem capa embutida devolve null e a tela cai
  // no desenho de reserva — nunca em cor sorteada.
  // CAPA DO ITEM DO ACERVO.
  //
  // Música traz a miniatura embutida no arquivo, então é só extrair. Vídeo
  // não tem miniatura embutida: a capa precisa ser um QUADRO da imagem — e
  // aí mora o problema que eu tinha criado. Pegar o primeiro quadro devolve
  // preto na maioria dos vídeos, porque quase todos abrem em fade-in ou com
  // uma vinheta escura. Dos 88 vídeos do acervo, 39 tinham vindo pretos.
  //
  // Agora o vídeo entra pelo filtro "thumbnail" do ffmpeg, que analisa um
  // lote de quadros e escolhe o mais representativo em vez do primeiro, e
  // começando alguns segundos adiante pra pular a vinheta. Se der ruim, ele
  // desce a escada de tentativas até a mais burra.
  //
  // A versão entra na chave do cache: mudar o jeito de extrair sem trocar a
  // chave deixaria as capas pretas antigas guardadas pra sempre.
  const CAPA_V = 2
  const EXT_VIDEO = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'])

  ipcMain.handle('history:capa', async (_e, { file }) => {
    try {
      if (!file || !existsSync(file)) return null
      const st = statSync(file)
      const chave = createHash('sha1')
        .update(`${file}|${st.size}|${st.mtimeMs}|v${CAPA_V}`).digest('hex').slice(0, 16)
      const dir = join(stemsRoot(), '_capas', 'img')
      const alvo = join(dir, `${chave}.jpg`)
      const url = `stems://s/_capas/img/${chave}.jpg`
      if (existsSync(alvo)) return statSync(alvo).size > 0 ? url : null
      mkdirSync(dir, { recursive: true })

      const rodar = (args) => new Promise((resolve) => {
        const c = spawn(FFMPEG_PATH, ['-y', '-v', 'quiet', ...args, alvo], { windowsHide: true })
        c.on('error', () => resolve(false))
        c.on('close', (code) => resolve(code === 0))
      })

      const ehVideo = EXT_VIDEO.has(extname(file).toLowerCase())
      // cada degrau vem com o tamanho mínimo que aceita: quadro preto sai em
      // menos de 1,5 KB depois de comprimido, então tamanho é o jeito barato
      // de perguntar "isto aqui é imagem ou é uma chapa escura?"
      const tentativas = ehVideo
        ? [
            { args: ['-ss', '12', '-i', file, '-an', '-vf', 'thumbnail,scale=480:-1', '-frames:v', '1'], minimo: 2500 },
            { args: ['-ss', '45', '-i', file, '-an', '-vf', 'thumbnail,scale=480:-1', '-frames:v', '1'], minimo: 2500 },
            { args: ['-i', file, '-an', '-vf', 'thumbnail,scale=480:-1', '-frames:v', '1'], minimo: 1200 },
            { args: ['-i', file, '-an', '-frames:v', '1', '-vf', 'scale=480:-1'], minimo: 1 }
          ]
        : [{ args: ['-i', file, '-an', '-frames:v', '1', '-vf', 'scale=480:-1'], minimo: 1 }]

      for (const t of tentativas) {
        const ok = await rodar(t.args)
        if (ok && existsSync(alvo) && statSync(alvo).size >= t.minimo) return url
      }

      // marca o "nao tem capa" com arquivo vazio: sem isso o ffmpeg seria
      // chamado de novo a cada abertura pra todo arquivo sem capa
      try { writeFileSync(alvo, '') } catch { /* segue sem cache */ }
      return null
    } catch {
      return null
    }
  })

  ipcMain.handle('studio:shelve', (_e, { key, stem, shelved }) => {
    try {
      return { session: setShelved({ key, stem, shelved }) }
    } catch (err) {
      return { error: err.message }
    }
  })

  // Guardar a faixa DENTRO do "outros" (e tirar de lá). Só marca — nenhum
  // áudio é tocado, então a volta é exata e instantânea.
  ipcMain.handle('studio:fold', (_e, { key, stem, dentro }) => {
    try {
      return { session: setDentroDeOutros({ key, stem, dentro }) }
    } catch (err) {
      return { error: err.message }
    }
  })

  // Acordes: detecta (ou devolve do cache) os acordes da sessão
  ipcMain.handle('studio:chords', async (_e, { key, force }) => {
    try {
      return await detectChords({ key, ffmpegPath: FFMPEG_PATH, force: !!force })
    } catch (err) {
      return { error: err.message }
    }
  })

  // Letra: transcreve a faixa de voz localmente (demora minutos na 1ª vez —
  // guarda-sono ligado pra máquina não dormir no meio)
  ipcMain.handle('studio:lyrics', async (_e, { key, force }) => {
    heavyJobStart()
    try {
      return await transcribeLyrics({
        key,
        ffmpegPath: FFMPEG_PATH,
        force: !!force,
        onProgress: (p) => send('studio:lyricsProgress', p)
      })
    } catch (err) {
      return { error: err.message }
    } finally {
      heavyJobEnd()
    }
  })

  // Quais versos são a mesma frase voltando — é o que autoriza propagar uma
  // correção sem sair trocando texto parecido pela música afora
  ipcMain.handle('studio:lyricsGroups', (_e, { segments }) => {
    try {
      return { grupos: gruposDeRepeticao(segments || []) }
    } catch {
      return { grupos: [] }
    }
  })

  ipcMain.handle('studio:lyricsSave', (_e, { key, segments }) => {
    try {
      return saveLyrics({ key, segments })
    } catch (err) {
      return { error: err.message }
    }
  })

  // Lupinha: zoom da interface (dir: 1 aproxima, -1 afasta, 0 reseta)
  ipcMain.handle('ui:zoom', (_e, dir) => zoomStep(dir))
  ipcMain.handle('ui:zoomGet', () =>
    mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getZoomFactor() : 1
  )

  // Forma de onda de uma faixa (com cache em disco)
  ipcMain.handle('studio:peaks', async (_e, { key, stem }) => {
    try {
      return await stemPeaks({ key, stem, ffmpegPath: FFMPEG_PATH })
    } catch {
      return null
    }
  })

  // Lupa de trecho: fareja só o pedaço marcado e ranqueia o que se destaca
  ipcMain.handle('studio:open', (_e, { path: inputFile, model, title }) => {
    if (!inputFile || !existsSync(inputFile)) {
      return { error: 'Arquivo não encontrado no disco.' }
    }
    if (!existsSync(FFMPEG_PATH)) {
      return { error: 'ffmpeg.exe não encontrado em resources/bin.' }
    }
    const cached = getCachedSession(inputFile, model || 'htdemucs')
    if (cached) {
      // FISCAL DE ABERTURA: conserta o que ficou pela metade (faixa no disco
      // sem registro, "outros" sem o desconto, análise de ritmo velha).
      //
      // Ele roda ANTES da sessão aparecer, e isso é de propósito: ele reescreve
      // other.flac e vocals.flac, e mexer nesses arquivos com o tocador já
      // lendo eles quebra a reprodução. O preço é a espera — que o dono levou
      // na cara como "travou, não entrou", porque a tela não dizia nada.
      //
      // Agora ela diz. O aviso sai antes de cada etapa pesada, e some quando
      // termina. Esperar sabendo o que está acontecendo é outra coisa.
      send('studio:status', { state: 'consertando', key: cached.key })
      return repairSession({
        key: cached.key,
        ffmpegPath: FFMPEG_PATH,
        onEtapa: (etapa) => send('studio:status', { state: 'consertando', key: cached.key, etapa })
      })
        .catch(() => false)
        .then((repaired) => {
          send('studio:status', { state: 'consertado', key: cached.key })
          return {
            session: repaired ? getCachedSession(inputFile, model || 'htdemucs') : cached,
            repaired
          }
        })
    }
    heavyJobStart()
    const { id, cancel } = startStudioJob({
      inputFile,
      model: model || 'htdemucs',
      title,
      ffmpegPath: FFMPEG_PATH,
      onProgress: (p) => send('studio:progress', p),
      onStatus: (s) => {
        send('studio:status', s)
        if (s.state !== 'running') {
          activeStudioJobs.delete(s.id)
          heavyJobEnd()
        }
      }
    })
    activeStudioJobs.set(id, cancel)
    return { id }
  })

  ipcMain.handle('studio:cancel', (_e, id) => {
    const cancel = activeStudioJobs.get(id)
    if (cancel) {
      cancel()
      return true
    }
    return false
  })

  ipcMain.handle('studio:render', async (_e, { key, pitch, tempo, fine }) => {
    try {
      return await renderVariant({
        key,
        pitch,
        tempo,
        fine,
        ffmpegPath: FFMPEG_PATH,
        onProgress: (p) => send('studio:progress', { id: `render:${key}`, stage: 'rendering', percent: p.percent })
      })
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('studio:exportStems', async (_e, { key, labels }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Escolher pasta pra exportar as faixas',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: resolveDownloadDir()
    })
    if (result.canceled || result.filePaths.length === 0) return { cancelled: true }
    try {
      const files = await exportStems({
        key,
        targetDir: result.filePaths[0],
        ffmpegPath: FFMPEG_PATH,
        labels
      })
      return { dir: result.filePaths[0], files }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('studio:exportSong', async (_e, { key, pitch, tempo }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Escolher pasta pra exportar a música',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: resolveDownloadDir()
    })
    if (result.canceled || result.filePaths.length === 0) return { cancelled: true }
    try {
      const file = await exportSong({
        key,
        pitch,
        tempo,
        targetDir: result.filePaths[0],
        ffmpegPath: FFMPEG_PATH
      })
      return { file }
    } catch (err) {
      return { error: err.message }
    }
  })

  // Fiscal de memória: mede a RAM livre e aponta os programas que mais consomem
  const HOG_FRIENDLY = {
    msedgewebview2: 'WhatsApp e apps com navegador embutido',
    'whatsapp.root': 'WhatsApp',
    whatsapp: 'WhatsApp',
    msedge: 'Microsoft Edge',
    chrome: 'Google Chrome',
    firefox: 'Firefox',
    opera: 'Opera',
    operagx: 'Opera GX',
    discord: 'Discord',
    spotify: 'Spotify',
    code: 'VS Code (editor de código)',
    steam: 'Steam',
    roblox: 'Roblox',
    telegram: 'Telegram'
  }
  const HOG_IGNORE = new Set([
    'svchost', 'system', 'registry', 'memory compression', 'msmpeng', 'explorer', 'dwm',
    'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'fontdrvhost', 'runtimebroker',
    'searchhost', 'shellexperiencehost', 'startmenuexperiencehost', 'textinputhost',
    'sihost', 'taskhostw', 'audiodg', 'spoolsv', 'powershell', 'pwsh', 'cmd', 'conhost',
    'electron', 'mptrix', 'node', 'python', 'ffmpeg', 'claude', 'wmiprvse', 'dllhost',
    'securityhealthservice', 'ctfmon', 'smss', 'idle'
  ])

  ipcMain.handle('studio:memory', async (_e, { needMB = 2500, withHogs = false } = {}) => {
    const freeMB = freeMemMB()
    const result = { freeMB, needMB, ok: freeMB >= needMB, hogs: [] }
    if (!withHogs || result.ok) return result
    try {
      const out = await new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', [
          '-NoProfile', '-Command',
          "Get-Process | Group-Object ProcessName | ForEach-Object { '{0}|{1}' -f $_.Name, [math]::Round((($_.Group | Measure-Object WorkingSet64 -Sum).Sum)/1MB) }"
        ], { windowsHide: true })
        let buf = ''
        child.stdout.on('data', (d) => { buf += d })
        child.on('error', reject)
        child.on('close', () => resolve(buf))
      })
      const raw = out.split(/\r?\n/)
        .map((l) => l.split('|'))
        .filter((p) => p.length === 2)
        .map(([name, mb]) => ({ name: name.trim(), ramMB: Number(mb) }))
        .filter((h) => h.ramMB >= 150 && !HOG_IGNORE.has(h.name.toLowerCase()))
        .sort((a, b) => b.ramMB - a.ramMB)
        .slice(0, 5)
      // Agrupa por rótulo amigável (ex.: WhatsApp + WhatsApp.Root viram uma linha só)
      const grouped = new Map()
      for (const h of raw) {
        const lower = h.name.toLowerCase()
        const label = HOG_FRIENDLY[lower] || h.name
        let procs = [h.name]
        if (lower === 'whatsapp' || lower === 'whatsapp.root') procs = ['WhatsApp', 'WhatsApp.Root']
        const cur = grouped.get(label) || { label, ramMB: 0, procs: [] }
        cur.ramMB += h.ramMB
        cur.procs = [...new Set([...cur.procs, ...procs])]
        grouped.set(label, cur)
      }
      result.hogs = [...grouped.values()].sort((a, b) => b.ramMB - a.ramMB).slice(0, 4)
    } catch {}
    return result
  })

  // Fecha programas escolhidos pelo usuário (com dupla confirmação na tela).
  // Trava de segurança: só aceita nomes simples e recusa processos do sistema.
  ipcMain.handle('studio:closeApps', async (_e, { procs }) => {
    const list = (Array.isArray(procs) ? procs : [])
      .filter((p) => typeof p === 'string' && /^[\w.-]{2,40}$/.test(p))
      .filter((p) => !HOG_IGNORE.has(p.toLowerCase()))
      .filter((p) => !/^(electron|mptrix)$/i.test(p))
    const results = []
    for (const name of list) {
      await new Promise((resolve) => {
        const child = spawn('taskkill', ['/IM', `${name}.exe`, '/F', '/T'], { windowsHide: true })
        child.on('error', () => { results.push({ name, ok: false }); resolve() })
        child.on('close', (code) => { results.push({ name, ok: code === 0 }); resolve() })
      })
    }
    return { results, freeMB: freeMemMB() }
  })

  // O MESMO fiscal do studio:open. Este atalho é a porta de TODA reabertura de
  // música já separada — e era a porta sem fiscal: faixa órfã no disco (app
  // morto entre extrair e registrar) nunca era adotada porque a adoção só
  // morava no caminho que as reaberturas não usam. O fiscal é barato quando não
  // há nada a fazer (uma listagem de pasta e uma leitura de registro), então
  // pode rodar até nas consultas de 3s do cão de guarda.
  ipcMain.handle('studio:cached', async (_e, { path: inputFile, model }) => {
    if (!inputFile || !existsSync(inputFile)) return null
    const cached = getCachedSession(inputFile, model || 'htdemucs')
    if (!cached) return null
    try {
      const repaired = await repairSession({ key: cached.key, ffmpegPath: FFMPEG_PATH })
      if (repaired) return getCachedSession(inputFile, model || 'htdemucs')
    } catch { /* sessão utilizável mesmo sem o conserto — melhor abrir que travar */ }
    return cached
  })

  ipcMain.handle('studio:plan', (_e, { path: inputFile, cachedOnly }) => {
    if (!inputFile || !existsSync(inputFile)) return { error: 'Arquivo não encontrado no disco.' }
    if (!existsSync(FFMPEG_PATH)) return { error: 'ffmpeg.exe não encontrado em resources/bin.' }
    const cachedPlan = getCachedPlan(inputFile)
    if (cachedPlan) return { plan: cachedPlan }
    if (cachedOnly) return { plan: null }
    heavyJobStart()
    const { id, cancel } = startPlanJob({
      inputFile,
      ffmpegPath: FFMPEG_PATH,
      onProgress: (p) => send('studio:progress', p),
      onStatus: (s) => {
        send('studio:status', s)
        if (s.state !== 'running') {
          activeStudioJobs.delete(s.id)
          heavyJobEnd()
        }
      }
    })
    activeStudioJobs.set(id, cancel)
    return { id }
  })

  ipcMain.handle('studio:scout', async (_e, { key, force }) => {
    try {
      return await scoutSession({ key, force: !!force })
    } catch (err) {
      return { error: err.message }
    }
  })

  // Refazer faixa: apaga a extraída, devolve o som pra "outros" e a tela
  // dispara a extração de novo do zero
  ipcMain.handle('studio:redoStem', async (_e, { key, instrument }) => {
    try {
      return { session: await redoStem({ key, instrument, ffmpegPath: FFMPEG_PATH }) }
    } catch (err) {
      return { error: err.message }
    }
  })

  // Dissecação completa: acha e separa todo som da música, sem cardápio
  ipcMain.handle('studio:autoExtract', (_e, { key }) => {
    heavyJobStart()
    const job = startAutoExtract({
      key,
      ffmpegPath: FFMPEG_PATH,
      onProgress: (p) => send('studio:progress', p),
      onStatus: (s) => {
        send('studio:status', s)
        if (s.state !== 'running') {
          activeStudioJobs.delete(s.id)
          heavyJobEnd()
        }
      }
    })
    if (job.twin) {
      // Vacina anti-gêmeo: essa música já está sendo dissecada — a tela adota
      // a que está rodando em vez de pagar sondas em dobro
      heavyJobEnd()
      return { id: job.id }
    }
    // registrado pra que fechar a música (studio:cancel) pare de gastar
    activeStudioJobs.set(job.id, job.cancel)
    return { id: job.id }
  })

  ipcMain.handle('studio:extract', (_e, { key, instruments }) => {
    heavyJobStart()
    const job = startExtractJob({
      key,
      instruments,
      ffmpegPath: FFMPEG_PATH,
      onProgress: (p) => send('studio:progress', p),
      onStatus: (s) => {
        send('studio:status', s)
        if (s.state !== 'running') {
          activeStudioJobs.delete(s.id)
          heavyJobEnd()
        }
      }
    })
    if (job.twin) {
      // Vacina anti-gêmeo: já existe extração nessa música — a tela adota a
      // que está rodando em vez de criar uma concorrente
      heavyJobEnd()
      return { id: job.id }
    }
    activeStudioJobs.set(job.id, job.cancel)
    return { id: job.id }
  })

  ipcMain.handle('studio:polish', (_e, { key, stem }) => {
    heavyJobStart()
    const { id, cancel } = startPolishJob({
      key,
      stem,
      ffmpegPath: FFMPEG_PATH,
      onProgress: (p) => send('studio:progress', p),
      onStatus: (s) => {
        send('studio:status', s)
        if (s.state !== 'running') {
          activeStudioJobs.delete(s.id)
          heavyJobEnd()
        }
      }
    })
    activeStudioJobs.set(id, cancel)
    return { id }
  })

  ipcMain.handle('studio:unpolish', (_e, { key, stem }) => {
    try {
      return { session: unpolishStem({ key, stem }) }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('studio:pickAudio', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Escolher música do computador',
      properties: ['openFile'],
      filters: [
        {
          name: 'Áudio e vídeo',
          extensions: ['mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus', 'aac', 'wma', 'mp4', 'webm', 'mkv']
        }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // VARREDURA DAS CAPAS ÓRFÃS.
  //
  // A chave da capa é feita do caminho + tamanho + data do arquivo + versão do
  // extrator. Qualquer um dos quatro mudando gera chave nova — e a capa antiga
  // fica no disco pra sempre, sem ninguém pra pedir por ela. Isso acontece
  // sozinho, na rotina normal: item apagado do acervo, arquivo renomeado, e
  // toda vez que eu melhoro o jeito de extrair (a mudança pro filtro
  // "thumbnail" sozinha deixou 99 arquivos órfãos).
  //
  // Como a conta é a mesma que gera as chaves boas, o que sobra é lixo por
  // definição — e o que for apagado por engano volta na primeira vez que o
  // acervo pedir. Por isso a varredura pode ser burra e barata: roda uma vez
  // na abertura e não pergunta nada.
  const limparCapasOrfas = () => {
    try {
      const dir = join(stemsRoot(), '_capas', 'img')
      if (!existsSync(dir)) return
      const lista = getHistory()
      // acervo vazio não é "tudo é órfão": pode ser registro ainda não lido
      if (!lista.length) return

      const vivas = new Set()
      for (const e of lista) {
        const f = e.primaryFile
        if (!f || !existsSync(f)) continue
        const st = statSync(f)
        const chave = createHash('sha1')
          .update(`${f}|${st.size}|${st.mtimeMs}|v${CAPA_V}`).digest('hex').slice(0, 16)
        vivas.add(`${chave}.jpg`)
      }

      let apagadas = 0
      let bytes = 0
      for (const nome of readdirSync(dir)) {
        if (vivas.has(nome)) continue
        try {
          bytes += statSync(join(dir, nome)).size
          unlinkSync(join(dir, nome))
          apagadas++
        } catch { /* arquivo em uso: fica pra proxima abertura */ }
      }
      if (apagadas) console.log(`[capas] ${apagadas} orfas apagadas (${Math.round(bytes / 1024)} KB)`)
    } catch {
      /* limpeza e conforto, nunca obrigacao: jamais pode impedir o app de abrir */
    }
  }
  limparCapasOrfas()

  createWindow()
  ligarVigiaDaArea()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  desligarVigiaDaArea()
  for (const cancel of activeJobs.values()) {
    try { cancel() } catch {}
  }
  for (const cancel of activeStudioJobs.values()) {
    try { cancel() } catch {}
  }
  activeJobs.clear()
  activeStudioJobs.clear()
  jobMetadata.clear()
  if (process.platform !== 'darwin') app.quit()
})
