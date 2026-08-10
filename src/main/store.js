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
// MÊS CORRENTE, no relógio de quem usa. O Replicate fecha a conta por mês, e
// o teto só faz sentido se contar a mesma coisa que a fatura conta.
function mesAgora() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// VIRADA DE MÊS. Sem isto o contador soma pra sempre e o teto vira uma parede
// que uma hora bate — e a pessoa aprende a "zerar contador" toda vez, que é
// justamente o hábito que anula a proteção. Contando por mês, o teto é um
// orçamento que se renova sozinho e ninguém precisa mexer.
function virarMesSePreciso() {
  const mes = mesAgora()
  if (store.get('nuvem.mes') === mes) return
  const gastoAnterior = store.get('nuvem.centavosGastos') || 0
  store.set('nuvem.mes', mes)
  store.set('nuvem.centavosGastos', 0)
  store.set('nuvem.segundosGastos', 0)
  store.set('nuvem.musicasFeitas', 0)
  // guarda o mês anterior pra tela poder mostrar "no mês passado você gastou"
  if (gastoAnterior > 0) store.set('nuvem.gastoMesPassado', Math.round(gastoAnterior * 100) / 100)
}

export function getNuvem() {
  virarMesSePreciso()
  const n = store.get('nuvem', {})
  return {
    ligada: !!n.ligada,
    temChave: !!n.chave,
    segundosGastos: n.segundosGastos || 0,
    // gasto de verdade, pelo preço da máquina que fez cada trabalho
    centavosGastos: n.centavosGastos != null
      ? Math.round(n.centavosGastos * 100) / 100
      : Math.round((n.segundosGastos || 0) * 0.000307 * 100 * 100) / 100,
    musicasFeitas: n.musicasFeitas || 0,
    tetoCentavos: n.tetoCentavos ?? 500,
    mes: n.mes || mesAgora(),
    gastoMesPassado: n.gastoMesPassado || 0,
    // por que a nuvem se desligou sozinha, se foi o caso
    paradaPor: n.paradaPor || null
  }
}

/**
 * A NUVEM SE DESLIGA SOZINHA quando o serviço recusa por falta de crédito.
 *
 * Antes o app detectava a recusa, parava aquele trabalho e não fazia mais
 * nada — a próxima separação tentava de novo e falhava de novo, e a pessoa
 * ficava esperando 30 segundos pra receber erro, repetidamente, sem entender.
 *
 * Desligar é o único jeito de a proteção não depender de alguém configurar
 * coisa nenhuma: o serviço disse que não dá, então o app para de pedir e
 * volta a separar aqui. E guarda o motivo, pra tela poder explicar e oferecer
 * religar quando houver crédito de novo.
 */
export function desligarNuvemPor(motivo) {
  store.set('nuvem.ligada', false)
  store.set('nuvem.paradaPor', motivo || 'desconhecido')
  return getNuvem()
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
export function somarGastoNuvem(segundos, { contaMusica = false, maquina = 'gpu' } = {}) {
  store.set('nuvem.segundosGastos', (store.get('nuvem.segundosGastos') || 0) + (segundos || 0))
  // O que manda no teto é o CENTAVO, medido pelo preço da máquina que fez o
  // trabalho — não mais um chute de pior caso igual pra tudo.
  const preco = PRECO_POR_SEGUNDO[maquina] ?? PRECO_POR_SEGUNDO.gpu
  const custo = (segundos || 0) * preco * 100 * (MAQUINA_PRIVADA[maquina] ? MARGEM_PRIVADO : 1)
  // A base é `gastoCentavos()`, não zero: conta antiga só tinha segundos, e
  // começar do zero apagaria todo o histórico no primeiro gasto novo — o teto
  // voltaria a achar que o crédito está intacto.
  store.set('nuvem.centavosGastos', gastoCentavos() + custo)
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
  if (n.tetoCentavos > 0 && gastoCentavos() >= n.tetoCentavos) return false
  return true
}

// PREÇO POR SEGUNDO, do jeito que o Replicate cobra de verdade.
//
// O contador antigo usava 0,0014 $/s pra TUDO. Eu achava que era um "pior caso
// chutado" — não era: é o preço EXATO do demucs e do WhisperX, que rodam em
// A100. O erro estava noutro lugar: o grosso dos segundos vem das sondas, que
// rodam no nosso modelo em T4, seis vezes mais barato. Por isso o app dizia
// US$ 4,42 quando a fatura real era ~US$ 1, e o teto travou a dissecação com o
// crédito quase intacto. A correção não é baratear tudo — é cobrar de cada
// trabalho o preço da máquina que ele usou.
// Conferido nas páginas dos modelos, não chutado:
//   ryan5453/demucs ......... "runs on Nvidia A100 (40GB)"  -> 0,0014 $/s
//   victor-upmeet/whisperx .. "runs on Nvidia A100 (80GB)"  -> 0,0014 $/s
//   41r4n/mptrix-instrumentos2 (nosso, T4)                   -> 0,000225 $/s
//   41r4n/mptrix-croma (nosso, CPU)                          -> 0,0001 $/s
const PRECO_POR_SEGUNDO = {
  cpu: 0.0001,
  gpu: 0.000225,   // T4 — sondas e especialistas (o grosso dos segundos)
  a100: 0.0014     // separação base, guitarra/teclado, prévia e letra
}

// MARGEM DOS MODELOS PRÓPRIOS. O Replicate cobra modelo PÚBLICO só pelo tempo
// de trabalho, mas modelo PRIVADO (os nossos dois) cobra também o tempo que a
// máquina passa ligando e ocioso — e `predict_time`, que é o que a gente
// recebe, não conta nada disso. Sem margem, a conta do app fica menor que a
// fatura, e subestimar é justamente o que o teto existe pra impedir.
//
// 3,19x NÃO É CHUTE — é medição contra a fatura de verdade. O painel do
// Replicate mostrou US$ 6,43 de uso no mês; somando o `predict_time` de todas
// as 235 chamadas pelo preço de cada máquina dá US$ 2,60. A diferença, US$ 3,83,
// é máquina ligando e esperando. Descontando os modelos públicos (US$ 0,84,
// esses são exatos), sobra 3,19x em cima do que os nossos reportam. Eu tinha
// posto 1,4x de dedo — errava a conta em mais da metade, e o teto de gasto
// deixava passar mais que o dobro do que devia.
//
// A razão é alta porque o grosso das chamadas são SONDAS CURTAS (~38s de
// trabalho): o tempo de ligar é custo fixo por chamada, então quanto mais curta
// a chamada, mais pesa. Numa extração longa a proporção cairia — mas a
// dissecação é feita de sondas curtas, e é ela que gasta.
const MARGEM_PRIVADO = 3.19
const MAQUINA_PRIVADA = { gpu: true, cpu: true }

/** Quanto já foi gasto, em centavos de dólar. */
export function gastoCentavos() {
  const n = store.get('nuvem') || {}
  if (n.centavosGastos != null) return Math.round(n.centavosGastos * 100) / 100
  // Conta antiga só tinha segundos. Converte pela MÉDIA REAL medida contra a
  // fatura: US$ 6,43 de uso em 8.547 segundos de trabalho = 0,000752 $/s.
  // (Antes eu usava 0,000307, calculado só pelo preço das máquinas — de novo
  // sem contar o tempo de ligar, que é metade da conta.)
  return Math.round((n.segundosGastos || 0) * 0.000752 * 100 * 100) / 100
}

/**
 * Quanto CUSTARIA esse tanto de segundos na máquina indicada — com a mesma
 * margem que o somador aplica, senão "cabem 6 sondas" mente na hora de decidir.
 */
export function estimativaCentavos(segundos, maquina = 'gpu') {
  const p = PRECO_POR_SEGUNDO[maquina] ?? PRECO_POR_SEGUNDO.gpu
  const m = MAQUINA_PRIVADA[maquina] ? MARGEM_PRIVADO : 1
  return Math.round((segundos || 0) * p * 100 * m * 100) / 100
}

export function zerarGastoNuvem() {
  store.set('nuvem.segundosGastos', 0)
  store.set('nuvem.centavosGastos', 0)
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
