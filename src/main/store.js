import Store from 'electron-store'
import { safeStorage } from 'electron'

// Guarda praticamente tudo — a interface mostra só os 100 mais recentes,
// mas a busca encontra qualquer item do acervo inteiro
const HISTORY_LIMIT = 5000

const store = new Store({
  name: 'mptrix',
  defaults: {
    settings: {
      downloadDir: null
    },
    // Separação na nuvem: opcional, chave do próprio usuário, desligada até
    // ele ligar. `chave` guarda o token JÁ CIFRADO (ver setChaveNuvem).
    nuvem: {
      chave: null,
      ligada: false,
      segundosGastos: 0,
      musicasFeitas: 0,
      tetoCentavos: 500
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

// ---------------------------------------------------------------- NUVEM ----
// A chave do Replicate gasta dinheiro real, então ela NÃO fica em texto puro
// no disco: o safeStorage cifra com a credencial do usuário do sistema
// operacional. Em máquina sem esse recurso o guardar é recusado — prefiro
// avisar que não dá do que gravar um token legível num JSON.
export function getNuvem() {
  const n = store.get('nuvem', {})
  return {
    ligada: !!n.ligada,
    temChave: !!n.chave,
    segundosGastos: n.segundosGastos || 0,
    musicasFeitas: n.musicasFeitas || 0,
    tetoCentavos: n.tetoCentavos ?? 500
  }
}

export function podeGuardarChave() {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function setChaveNuvem(chave) {
  if (!chave) {
    store.set('nuvem.chave', null)
    store.set('nuvem.ligada', false)
    return { ok: true }
  }
  if (!podeGuardarChave()) {
    return { ok: false, erro: 'Este computador não tem cofre de senhas disponível — não vou gravar sua chave em texto puro.' }
  }
  store.set('nuvem.chave', safeStorage.encryptString(String(chave).trim()).toString('base64'))
  return { ok: true }
}

/** Só o processo principal chama isto — a chave nunca vai pra interface. */
export function lerChaveNuvem() {
  const c = store.get('nuvem.chave')
  if (!c) return null
  try {
    return safeStorage.decryptString(Buffer.from(c, 'base64'))
  } catch {
    return null
  }
}

export function setNuvemLigada(v) {
  store.set('nuvem.ligada', !!v)
  return getNuvem()
}

export function setTetoNuvem(centavos) {
  store.set('nuvem.tetoCentavos', Math.max(0, Number(centavos) || 0))
  return getNuvem()
}

/**
 * Contabiliza trabalho feito na nuvem. Os SEGUNDOS somam sempre (é o que
 * alimenta o teto de gasto). Já o contador de MÚSICAS só avança quando o
 * trabalho é a separação de uma música nova — sem isso o placar mente: uma
 * dissecação sozinha faz dezenas de chamadas (sondas de 40s, especialistas,
 * letra, cifra) e o painel diria "37 músicas" pra quem separou três, com um
 * "por música" que despenca pro preço de uma sonda.
 */
export function somarGastoNuvem(segundos, { contaMusica = false } = {}) {
  store.set('nuvem.segundosGastos', (store.get('nuvem.segundosGastos') || 0) + (segundos || 0))
  if (contaMusica) store.set('nuvem.musicasFeitas', (store.get('nuvem.musicasFeitas') || 0) + 1)
  return getNuvem()
}

/**
 * A nuvem deve ser usada agora? Ligada, com chave, e ainda dentro do teto.
 * O teto existe porque o Replicate NÃO tem limite de gasto configurável: se
 * algo entrar em laço, a conta é do usuário. Zero significa sem teto.
 */
export function usarNuvem() {
  const n = getNuvem()
  if (!n.ligada || !n.temChave) return false
  if (n.tetoCentavos > 0 && estimativaCentavos(n.segundosGastos) >= n.tetoCentavos) return false
  return true
}

// mesma tabela do módulo da nuvem; fica aqui pra o teto não depender dele
export function estimativaCentavos(segundos) {
  return Math.round((segundos || 0) * 0.0014 * 100 * 100) / 100
}

export function zerarGastoNuvem() {
  store.set('nuvem.segundosGastos', 0)
  store.set('nuvem.musicasFeitas', 0)
  return getNuvem()
}

export function setUiZoom(z) {
  store.set('settings.uiZoom', z)
  return z
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
