import { contextBridge, ipcRenderer } from 'electron'

function on(channel) {
  return (callback) => {
    const listener = (_e, payload) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

const api = {
  getEnvironment: () => ipcRenderer.invoke('app:getEnvironment'),

  app: {
    findInstaller: () => ipcRenderer.invoke('app:findInstaller')
  },

  settings: {
    pickDir: () => ipcRenderer.invoke('settings:pickDir'),
    setDownloadDir: (dir) => ipcRenderer.invoke('settings:setDownloadDir', dir)
  },

  // Separação na nuvem. Repare que não existe um "getChave": a chave entra e
  // nunca mais sai pra cá — a interface só pergunta SE existe uma.
  nuvem: {
    estado: () => ipcRenderer.invoke('nuvem:estado'),
    testar: (chave) => ipcRenderer.invoke('nuvem:testar', chave),
    salvarChave: (chave) => ipcRenderer.invoke('nuvem:salvarChave', chave),
    apagarChave: () => ipcRenderer.invoke('nuvem:apagarChave'),
    ligar: (v) => ipcRenderer.invoke('nuvem:ligar', v),
    teto: (centavos) => ipcRenderer.invoke('nuvem:teto', centavos),
    credito: (centavos) => ipcRenderer.invoke('nuvem:credito', centavos),
    apagarDados: (o) => ipcRenderer.invoke('nuvem:apagarDados', o),
    apagarLinhas: (ids) => ipcRenderer.invoke('nuvem:apagarLinhas', ids),
    simular: (centavos) => ipcRenderer.invoke('nuvem:simular', centavos),
    zerarGasto: () => ipcRenderer.invoke('nuvem:zerarGasto')
  },

  // O vigia empurra o link achado; a tela nunca lê a área de transferência
  // sozinha, pra não precisar de permissão nenhuma no processo de renderização.
  clipboard: {
    onLink: on('clipboard:link'),
    atual: () => ipcRenderer.invoke('clipboard:atual')
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('shell:showInFolder', filePath),
    copyFilesToClipboard: (paths) => ipcRenderer.invoke('shell:copyFilesToClipboard', paths),
    zipFile: (path) => ipcRenderer.invoke('shell:zipFile', path)
  },

  video: {
    probe: (url) => ipcRenderer.invoke('video:probe', url)
  },

  playlist: {
    probe: (url) => ipcRenderer.invoke('playlist:probe', url),
    startBatch: (opts) => ipcRenderer.invoke('playlist:startBatch', opts),
    cancelBatch: (batchId) => ipcRenderer.invoke('playlist:cancelBatch', batchId),
    probeQualities: (opts) => ipcRenderer.invoke('playlist:probeQualities', opts),
    cancelQualityProbe: (probeId) => ipcRenderer.invoke('playlist:cancelQualityProbe', probeId),
    onItemStart: on('playlist:itemStart'),
    onItemEnd: on('playlist:itemEnd'),
    onEnd: on('playlist:end'),
    onItemQuality: on('playlist:itemQuality'),
    onQualitiesDone: on('playlist:qualitiesDone')
  },

  system: {
    estimateBandwidth: () => ipcRenderer.invoke('system:estimateBandwidth')
  },

  download: {
    start: (opts) => ipcRenderer.invoke('download:start', opts),
    cancel: (id) => ipcRenderer.invoke('download:cancel', id),
    onProgress: on('download:progress'),
    onStatus: on('download:status'),
    onFile: on('download:file'),
    onStage: on('download:stage'),
    onLog: on('download:log'),
    onIssue: on('download:issue')
  },

  history: {
    get: () => ipcRenderer.invoke('history:get'),
    capa: (file) => ipcRenderer.invoke('history:capa', { file }),
    remove: (id, opts) => ipcRenderer.invoke('history:remove', { id, ...(opts || {}) }),
    rename: (id, newName) => ipcRenderer.invoke('history:rename', { id, newName }),
    favorite: (id, favorito) => ipcRenderer.invoke('history:favorite', { id, favorito }),
    clear: () => ipcRenderer.invoke('history:clear'),
    onChanged: on('history:changed')
  },

  updates: {
    getVersions: () => ipcRenderer.invoke('updates:getVersions'),
    check: (opts) => ipcRenderer.invoke('updates:check', opts || {}),
    dismiss: (version) => ipcRenderer.invoke('updates:dismiss', version),
    run: () => ipcRenderer.invoke('updates:run'),
    onProgress: on('updates:progress'),
    onStatus: on('updates:status')
  },

  ui: {
    zoom: (dir) => ipcRenderer.invoke('ui:zoom', dir),
    zoomGet: () => ipcRenderer.invoke('ui:zoomGet'),
    onZoom: on('ui:zoom-changed')
  },
  studio: {
    engineStatus: () => ipcRenderer.invoke('studio:engineStatus'),
    models: () => ipcRenderer.invoke('studio:models'),
    open: (opts) => ipcRenderer.invoke('studio:open', opts),
    cancel: (id) => ipcRenderer.invoke('studio:cancel', id),
    render: (opts) => ipcRenderer.invoke('studio:render', opts),
    exportStems: (opts) => ipcRenderer.invoke('studio:exportStems', opts),
    exportSong: (opts) => ipcRenderer.invoke('studio:exportSong', opts),
    pickAudio: () => ipcRenderer.invoke('studio:pickAudio'),
    scout: (opts) => ipcRenderer.invoke('studio:scout', opts),
    catalog: () => ipcRenderer.invoke('studio:catalog'),
    redoStem: (opts) => ipcRenderer.invoke('studio:redoStem', opts),
    shelve: (opts) => ipcRenderer.invoke('studio:shelve', opts),
    fold: (opts) => ipcRenderer.invoke('studio:fold', opts),
    peaks: (opts) => ipcRenderer.invoke('studio:peaks', opts),
    chords: (opts) => ipcRenderer.invoke('studio:chords', opts),
    lyrics: (opts) => ipcRenderer.invoke('studio:lyrics', opts),
    onLyricsProgress: on('studio:lyricsProgress'),
    lyricsSave: (opts) => ipcRenderer.invoke('studio:lyricsSave', opts),
    lyricsGroups: (opts) => ipcRenderer.invoke('studio:lyricsGroups', opts),
    extract: (opts) => ipcRenderer.invoke('studio:extract', opts),
    autoExtract: (opts) => ipcRenderer.invoke('studio:autoExtract', opts),
    cached: (opts) => ipcRenderer.invoke('studio:cached', opts),
    plan: (opts) => ipcRenderer.invoke('studio:plan', opts),
    memory: (opts) => ipcRenderer.invoke('studio:memory', opts),
    closeApps: (opts) => ipcRenderer.invoke('studio:closeApps', opts),
    polish: (opts) => ipcRenderer.invoke('studio:polish', opts),
    unpolish: (opts) => ipcRenderer.invoke('studio:unpolish', opts),
    onProgress: on('studio:progress'),
    onStatus: on('studio:status')
  }
}

contextBridge.exposeInMainWorld('mptrix', api)
