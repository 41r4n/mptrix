import Store from 'electron-store'

// Guarda praticamente tudo — a interface mostra só os 100 mais recentes,
// mas a busca encontra qualquer item do acervo inteiro
const HISTORY_LIMIT = 5000

const store = new Store({
  name: 'mptrix',
  defaults: {
    settings: {
      downloadDir: null
    },
    history: [],
    updates: {
      lastCheckAt: null,
      latestVersion: null,
      latestPublishedAt: null,
      dismissedVersion: null,
      latestChannel: null,
      latestDownloadUrl: null,
      latestStableVersion: null
    }
  }
})

export function getUpdateCache() {
  return store.get('updates', {})
}

export function setUpdateCache(patch) {
  const cur = store.get('updates', {})
  store.set('updates', { ...cur, ...patch })
  return store.get('updates')
}

export function getSettings() {
  return store.get('settings')
}

export function setDownloadDir(dir) {
  store.set('settings.downloadDir', dir)
  return dir
}

export function getHistory() {
  return store.get('history', [])
}

export function addHistoryEntry(entry) {
  const list = store.get('history', [])
  const next = [entry, ...list].slice(0, HISTORY_LIMIT)
  store.set('history', next)
  return next
}

export function updateHistoryEntry(id, patch) {
  const list = store.get('history', [])
  const next = list.map((e) => (e.id === id ? { ...e, ...patch } : e))
  store.set('history', next)
  return next
}

export function removeHistoryEntry(id) {
  const list = store.get('history', [])
  const next = list.filter((e) => e.id !== id)
  store.set('history', next)
  return next
}

export function clearHistory() {
  store.set('history', [])
  return []
}
