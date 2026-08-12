import Store from 'electron-store'
import { safeStorage } from 'electron'
import { randomUUID } from 'crypto'

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
//
// Data em hora LOCAL de propósito. Quando fui conferir isto, meu próprio teste
// disse que a virada não funcionava — porque eu escrevi new Date('2026-09-01'),
// que o JavaScript lê como meia-noite em Londres e vira 31 de agosto às 21h
// aqui. O código estava certo; o teste é que estava errado. Fica anotado
// porque o mesmo tropeço espera qualquer um que for mexer aqui.
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

/**
 * ██████ O LIVRO É A VERDADE ██████
 *
 * O saldo NÃO é mais guardado em separado: ele é calculado do livro, toda vez.
 *
 * Antes eram duas verdades pro mesmo fato — um número guardado e um registro
 * do que aconteceu — e elas podiam discordar. Foi o que aconteceu: o dono
 * apagou a linha da recarga e o saldo continuou de pé, porque o número morava
 * noutro lugar. Aí eu ia consertar isso com um AVISO explicando que apagar o
 * recibo não mexe na carteira. Errado: se apagar o registro não muda o
 * resultado, o registro não é registro, é enfeite.
 *
 * Agora:
 *   informado = valor da carga mais recente
 *   gasto     = soma dos usos que vieram DEPOIS dela
 *
 * Apagar uma carga faz a anterior valer. Apagar um uso devolve aquele
 * dinheiro. A conta nunca discorda do que está escrito, porque ela É o que
 * está escrito.
 */
function contasDoLivro(livro) {
  const lista = Array.isArray(livro) ? livro : []
  // a lista é do mais novo pro mais velho: a primeira carga que aparece é a
  // que vale, e o que está ACIMA dela veio depois dela
  const iCarga = lista.findIndex((l) => l && l.tipo === 'carga')
  const informado = iCarga >= 0 ? (lista[iCarga].valor || 0) : 0
  const depois = iCarga >= 0 ? lista.slice(0, iCarga) : lista
  const usos = depois.filter((l) => l && l.tipo === 'uso')
  const gasto = usos.reduce((soma, l) => soma + (l.valor || 0), 0)
  return {
    informado,
    gasto: Math.round(gasto * 100) / 100,
    // MIÚDO NÃO É MÚSICA. A linha de sondas/letra/cifra também é 'uso', e
    // contá-la como música fazia o "US$ X cada" mentir — dividia o gasto por
    // um número inflado de músicas que nunca existiram.
    musicas: usos.filter((l) => !l.miudo).length
  }
}

export function getNuvem() {
  virarMesSePreciso()
  garantirIdsDoLivro()
  limparFinsInertes()
  // a trava anda junto com a conta: se o número mudou, ela é refeita ANTES de
  // alguém ler qualquer coisa. Sem isso a tela mostra a barra passando da
  // marca com a nuvem ligada, que foi o que aconteceu.
  reavaliarTrava()
  const n = store.get('nuvem', {})
  const livro = Array.isArray(n.livro) ? n.livro : []
  const contas = contasDoLivro(livro)
  return {
    ligada: !!n.ligada,
    temChave: !!n.chave,
    segundosGastos: n.segundosGastos || 0,
    // gasto do MÊS: este continua guardado, porque conta dinheiro real que o
    // livro não mostra linha a linha (sondas, letra, cifra). É a conta do
    // teto mensal, não a do ciclo de crédito.
    centavosGastos: n.centavosGastos != null
      ? Math.round(n.centavosGastos * 100) / 100
      : Math.round((n.segundosGastos || 0) * 0.000307 * 100 * 100) / 100,
    tetoCentavos: n.tetoCentavos ?? 500,
    // ▼ tudo daqui pra baixo SAI DO LIVRO, não do disco
    creditoInformado: contas.informado,
    gastoDesdeCredito: contas.gasto,
    musicasFeitas: contas.musicas,
    mes: n.mes || mesAgora(),
    gastoMesPassado: n.gastoMesPassado || 0,
    paradaPor: n.paradaPor || null,
    livro
  }
}

/**
 * O LIVRO DO CRÉDITO.
 *
 * Sem ele, a nuvem trancar não deixa rastro: a pessoa abre o app dias depois,
 * vê tudo parado e não tem como saber quando aconteceu, quanto sobrou, nem se
 * já tinha recarregado. Registro não é enfeite — é a prova do que o sistema
 * fez com o dinheiro de alguém.
 *
 * Guarda os 40 últimos. Passado disso não ajuda ninguém e só engorda o
 * arquivo de configuração.
 */
function anotarNoLivro(entrada) {
  const livro = store.get('nuvem.livro')
  const lista = Array.isArray(livro) ? livro : []
  // ID PRÓPRIO em cada linha. Apagar por posição na lista quebra sozinho: uma
  // linha nova entra no topo entre a pessoa escolher e confirmar, e some a
  // errada. Com id, o que ela apontou é o que vai embora.
  lista.unshift({ id: randomUUID(), ...entrada, quando: new Date().toISOString() })
  // O CORTE NUNCA PODE COMER O CICLO CORRENTE. O saldo sai da carga mais
  // recente e dos usos acima dela; se o corte apagasse um desses usos, o
  // gasto DIMINUIRIA sozinho e a trava soltaria — o app passaria a achar que
  // sobra dinheiro que já foi. Por isso o limite só vale pro que está abaixo
  // da carga atual, que é história e não conta mais.
  const iCarga = lista.findIndex((l) => l && l.tipo === 'carga')
  const minimo = iCarga >= 0 ? iCarga + 1 : lista.length
  store.set('nuvem.livro', lista.slice(0, Math.max(minimo, TETO_LIVRO)))
}

// linhas gravadas antes de existir id ficariam impossíveis de apagar uma a
// uma. Recebem o seu na primeira leitura, e só uma vez.
// LINHAS INERTES ANTIGAS. As de "freio-credito" foram gravadas quando o fim
// era evento; agora ele é propriedade do uso que cruzou. Elas não somam nem
// subtraem nada — só ocupam espaço parecendo importantes. Saem na primeira
// leitura.
// GASTO MIÚDO: sonda, letra, cifra. Cada chamada custa centavos, e uma
// separação faz dezenas — como linha própria, elas enterrariam a carga e o
// uso. Somando na linha miúda da mesma leva (menos de 45 min), fica uma linha
// por rajada de trabalho, e o dinheiro continua todo contado.
// A FOLGA DO FREIO: paro em 85% do informado, não em 100%. O gasto daqui é
// ESTIMADO pelo tempo de máquina; parar em cima do valor exato deixaria a
// dívida acontecer por erro de arredondamento.
// Declarada aqui em cima, antes de quem usa: `const` não sobe, e reavaliarTrava
// roda dentro de getNuvem, que pode ser chamada de qualquer lugar.
const FOLGA_CREDITO = 0.85

const JANELA_MIUDO = 45 * 60 * 1000
// quantas linhas guardar de história. O ciclo corrente nunca é cortado — ver
// anotarNoLivro.
const TETO_LIVRO = 120

function anotarGastoMiudo(valor) {
  const livro = store.get('nuvem.livro')
  const lista = Array.isArray(livro) ? livro : []
  const topo = lista[0]
  const recente = topo && topo.tipo === 'uso' && topo.miudo
    && (Date.now() - new Date(topo.quando).getTime()) < JANELA_MIUDO
  if (recente) {
    lista[0] = { ...topo, valor: Math.round((topo.valor + valor) * 100) / 100 }
    store.set('nuvem.livro', lista)
    return
  }
  anotarNoLivro({ tipo: 'uso', valor, miudo: true })
}

function limparFinsInertes() {
  const livro = store.get('nuvem.livro')
  if (!Array.isArray(livro) || !livro.length) return
  const limpo = livro.filter((l) => !(l && l.tipo === 'fim' && l.motivo === 'freio-credito'))
  if (limpo.length !== livro.length) store.set('nuvem.livro', limpo)
}

function garantirIdsDoLivro() {
  const livro = store.get('nuvem.livro')
  if (!Array.isArray(livro) || !livro.length) return
  if (livro.every((l) => l && l.id)) return
  store.set('nuvem.livro', livro.map((l) => (l?.id ? l : { ...l, id: randomUUID() })))
}

/**
 * SIMULADOR DE GASTO.
 *
 * Finge que uma separação custou tanto, sem tocar na nuvem. Existe pra dar
 * pra ver o freio, o jornal, a trava e o livro reagindo — coisas que só
 * acontecem quando o dinheiro anda, e que de outro jeito só se testaria
 * gastando de verdade.
 *
 * Duas regras que fazem dele um teste honesto:
 *
 * 1) Ele passa pelo MESMO caminho do gasto real: soma nos dois contadores e
 *    depois chama usarNuvem(), que é quem decide parar. Se eu tivesse escrito
 *    um caminho paralelo, o simulador provaria o comportamento do simulador,
 *    não o do app.
 *
 * 2) A linha nasce marcada como simulada. O livro é a prova do que aconteceu
 *    com o dinheiro de alguém — misturar teste com gasto real ali seria
 *    estragar justamente o que ele serve pra guardar.
 *
 * SEM BOTÃO NA TELA desde 2026-08-12: o teste foi feito e passou, e ferramenta
 * de teste morando na tela de dinheiro um dia é apertada achando que é função.
 * O motor fica: ele é o único jeito de ver o freio, a trava e o livro reagindo
 * sem gastar de verdade — o dono está com a conta suspensa por US$ 0,25, então
 * "testa gastando" não é opção. Pra usar de novo é só chamar
 * window.mptrix.nuvem.simular(centavos) no console do renderer.
 */
export function simularGasto(centavos) {
  const c = Math.max(0, Number(centavos) || 0)
  if (!c) return getNuvem()
  // NÃO soma no contador do mês: aquele conta dinheiro real e alimenta o teto
  // mensal. Teste que entra na conta real é teste que estraga o que ele devia
  // estar testando.
  anotarNoLivro({ tipo: 'uso', valor: Math.round(c * 100) / 100, titulo: null, simulado: true })
  // é isto que faz o teste valer: quem decide parar é a mesma função que o
  // motor chama antes de cada trabalho de verdade
  usarNuvem()
  return getNuvem()
}

/**
 * A TRAVA É CONSEQUÊNCIA DA CONTA, nos DOIS sentidos.
 *
 * Eu escrevi esta função só na direção de soltar: se a conta melhorasse, ela
 * destravava. Faltou a outra metade — se a conta PIORA (uma linha apagada faz
 * o gasto voltar a passar da marca), nada travava de novo. O dono apagou
 * registros, o gasto passou de 85% na barra, e a nuvem seguiu ligada.
 *
 * O erro de fundo é o mesmo que eu vinha consertando: a trava era decidida em
 * UM lugar (na hora de rodar um trabalho) e o número em outro. Agora ela é
 * recalculada junto com o número, toda leitura — porque ela É o número.
 *
 * Não chama getNuvem() de propósito: getNuvem chama esta, e uma chamaria a
 * outra pra sempre. Lê o livro direto.
 */
function reavaliarTrava() {
  const n = store.get('nuvem', {})
  const contas = contasDoLivro(n.livro)
  const aperta = contas.informado > 0 && contas.gasto >= contas.informado * FOLGA_CREDITO
  const motivo = n.paradaPor

  // TETO DO MÊS: mesma assimetria que o freio tinha. Ele era avaliado só na
  // hora de rodar um trabalho, e a virada do mês zera o gasto sem soltar a
  // trava — a nuvem ficaria desligada pra sempre depois de bater o teto uma
  // vez. Aqui ele anda junto com o número, igual ao freio.
  const teto = n.tetoCentavos ?? 500
  const gastoMes = gastoCentavos()
  if (motivo === 'teto-do-mes') {
    if (!(teto > 0 && gastoMes >= teto)) {
      store.set('nuvem.paradaPor', null)
      store.set('nuvem.ligada', true)
    }
    return
  }
  if (teto > 0 && gastoMes >= teto && !motivo) {
    store.set('nuvem.ligada', false)
    store.set('nuvem.paradaPor', 'teto-do-mes')
    return
  }

  const travadaPorDinheiro = motivo === 'freio-credito' || motivo === 'sem-credito'

  if (aperta && !travadaPorDinheiro) {
    // passou da marca e estava solta: trava agora.
    //
    // E NÃO escreve linha nenhuma. O fim do crédito não é um evento à parte —
    // é uma propriedade do último uso, aquele que encostou na marca. Como
    // linha separada ela ficava INERTE: apagar não mudava nada, porque a conta
    // vem das cargas e dos usos. Registro que não muda nada quando some não é
    // registro, é comentário — e com a mesma cara dos que mudam, confunde.
    // Quem desenha essa marca é a tela, calculando qual uso cruzou.
    store.set('nuvem.ligada', false)
    store.set('nuvem.paradaPor', 'freio-credito')
    return
  }
  if (!aperta && travadaPorDinheiro) {
    // a conta melhorou: solta
    store.set('nuvem.paradaPor', null)
    store.set('nuvem.ligada', true)
  }
}

/** Apaga linhas escolhidas do livro, por id. */
export function apagarLinhasDoLivro(ids) {
  const alvo = new Set(Array.isArray(ids) ? ids : [])
  if (!alvo.size) return getNuvem()
  const livro = store.get('nuvem.livro')
  const lista = Array.isArray(livro) ? livro : []
  store.set('nuvem.livro', lista.filter((l) => !alvo.has(l.id)))
  // APAGAR RECALCULA TUDO. Se a linha que fez o freio bater sumiu, o freio
  // não tem mais motivo pra existir — deixar travado seria a conta antiga
  // sobrevivendo ao fato que a criou.
  reavaliarTrava()
  return getNuvem()
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
/**
 * A PESSOA DIZ QUANTO PÔS, e o contador de sobra recomeça.
 * É a única forma de o app saber quanto resta: ler o saldo não dá.
 */
export function informarCredito(centavos, extra = {}) {
  const v = Math.max(0, Math.round(Number(centavos) || 0))
  const antes = getNuvem()
  const sobrava = Math.max(0, antes.creditoInformado - antes.gastoDesdeCredito)

  // ZERO NÃO É CARGA, é apagar a declaração. Escrever "carreguei US$0" no
  // livro seria mentira; o certo é tirar a carga que valia.
  if (!v) {
    const livro = (store.get('nuvem.livro') || []).filter((l) => l && l.tipo !== 'carga')
    store.set('nuvem.livro', livro)
    store.set('nuvem.paradaPor', null)
    return getNuvem()
  }

  // A LINHA CONTA O ATO, não só o resultado.
  //
  // "valor" é o total depois (é dele que a conta sai), mas quem adicionou US$4
  // com US$11 sobrando fez UM ATO DE 4 — e a linha dizia "carregou US$15".
  // Registro que conta o resultado em vez do ato faz a pessoa duvidar da
  // própria memória: ela sabe que pôs 4.
  // Então guardo os dois: o total pra conta, e o que foi feito pra leitura.
  anotarNoLivro({
    tipo: 'carga',
    valor: v,
    sobrava,
    ...(extra.adicionado ? { adicionado: extra.adicionado } : { declarado: true })
  })
  // carga nova derruba a parada por dinheiro: a parede caiu
  const motivo = store.get('nuvem.paradaPor')
  if (motivo === 'sem-credito' || motivo === 'freio-credito') {
    store.set('nuvem.paradaPor', null)
    store.set('nuvem.ligada', true)
  }
  return getNuvem()
}

/**
 * ACABEI DE COMPRAR TANTO — soma ao que sobrou.
 *
 * A pergunta "quanto você tem agora" é a certa, e mesmo assim pegou o dono
 * duas vezes: sobrava US$1, ele comprou US$10 e digitou 10, esperando ver 11.
 * O erro é do desenho, não dele — ninguém pensa em saldo, pensa em recarga.
 *
 * Então existem as duas, cada uma com nome próprio: informar o TOTAL (que
 * corrige qualquer desvio meu, porque vem da página deles) e somar o que
 * ACABOU DE COMPRAR (que é como a cabeça funciona na hora). Uma pergunta só,
 * por mais bem escrita que seja, não vence o jeito de pensar de quem usa.
 */
export function somarCredito(centavos) {
  const add = Math.max(0, Math.round(Number(centavos) || 0))
  if (!add) return getNuvem()
  const n = getNuvem()
  const sobrava = Math.max(0, n.creditoInformado - n.gastoDesdeCredito)
  return informarCredito(sobrava + add, { adicionado: add })
}

/**
 * APAGAR DADOS DA NUVEM, por partes.
 *
 * Um botão só de "apagar tudo" obriga quem queria limpar uma coisa a jogar
 * fora as outras — e aqui as coisas têm pesos bem diferentes: histórico é
 * memória, contador é conta, e a chave é o acesso. Escolher o que vai embora
 * é o que separa faxina de estrago.
 */
export function apagarDadosNuvem({ livro, credito, contadores, chave } = {}) {
  if (livro) store.set('nuvem.livro', [])
  // "crédito" agora quer dizer as cargas do livro: é lá que ele mora
  if (credito) {
    const livro = (store.get('nuvem.livro') || []).filter((l) => l && l.tipo !== 'carga')
    store.set('nuvem.livro', livro)
  }
  if (contadores) {
    store.set('nuvem.centavosGastos', 0)
    store.set('nuvem.segundosGastos', 0)
    store.set('nuvem.gastoMesPassado', 0)
  }
  if (chave) {
    store.set('nuvem.chave', null)
    store.set('nuvem.ligada', false)
  }
  // sem crédito informado nem contador não existe motivo pra seguir travada:
  // a parada era baseada em números que não existem mais
  if (credito || contadores) store.set('nuvem.paradaPor', null)
  return getNuvem()
}

export function desligarNuvemPor(motivo) {
  // não repete a linha se já estava desligada pelo mesmo motivo
  const antes = store.get('nuvem.paradaPor')
  store.set('nuvem.ligada', false)
  store.set('nuvem.paradaPor', motivo || 'desconhecido')
  // SÓ O QUE VEIO DE FORA vira linha. A recusa do Replicate e o teto do mês
  // são fatos que aconteceram e que a conta do livro não explica sozinha —
  // esses precisam ficar escritos. Já o freio é consequência da própria
  // conta: ele se lê nos usos, não numa linha extra.
  if (antes !== motivo && motivo !== 'freio-credito') {
    const n = getNuvem()
    anotarNoLivro({
      tipo: 'fim',
      motivo: motivo || 'desconhecido',
      informado: n.creditoInformado,
      gasto: n.gastoDesdeCredito,
      sobra: Math.max(0, n.creditoInformado - n.gastoDesdeCredito)
    })
  }
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
  // subir o teto derruba a parada que ELE mesmo causou. Quem reavalia é a
  // função que reavalia tudo — antes havia uma cópia da regra aqui, lendo
  // campos que deixaram de existir quando o saldo virou derivado. Regra
  // copiada é regra que envelhece escondida.
  reavaliarTrava()
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
export function somarGastoNuvem(segundos, { contaMusica = false, maquina = 'gpu', titulo = null } = {}) {
  store.set('nuvem.segundosGastos', (store.get('nuvem.segundosGastos') || 0) + (segundos || 0))
  // O que manda no teto é o CENTAVO, medido pelo preço da máquina que fez o
  // trabalho — não mais um chute de pior caso igual pra tudo.
  const preco = PRECO_POR_SEGUNDO[maquina] ?? PRECO_POR_SEGUNDO.gpu
  const custo = (segundos || 0) * preco * 100 * (MAQUINA_PRIVADA[maquina] ? MARGEM_PRIVADO : 1)
  // A base é `gastoCentavos()`, não zero: conta antiga só tinha segundos, e
  // começar do zero apagaria todo o histórico no primeiro gasto novo — o teto
  // voltaria a achar que o crédito está intacto.
  store.set('nuvem.centavosGastos', gastoCentavos() + custo)
  // TODO GASTO VAI PRO LIVRO — e este é um buraco que eu abri hoje.
  //
  // Quando o saldo passou a ser calculado do livro, só a separação da música
  // escrevia linha. Sonda, letra e cifra continuavam custando dinheiro e
  // sumiam da conta do ciclo — ou seja, o freio, que existe justamente pra
  // evitar dívida, contava menos do que a pessoa estava gastando. Justo no
  // trabalho onde o grosso do custo vem das sondas.
  //
  // Só que dezenas de linhas de centavos enterrariam a carga e o uso, que são
  // o que se lê. Então o miúdo entra somando na linha miúda mais recente, se
  // ela for da mesma leva: um gasto por rajada, em vez de um por chamada.
  const valor = Math.round(custo * 100) / 100
  if (contaMusica) {
    anotarNoLivro({ tipo: 'uso', valor, titulo: titulo || null })
  } else if (valor > 0) {
    anotarGastoMiudo(valor)
  }
  return getNuvem()
}

/**
 * A nuvem deve ser usada agora? Ligada, com chave, e ainda dentro do teto.
 * O teto existe porque o Replicate NÃO tem limite de gasto configurável: se
 * algo entrar em laço, a conta é do usuário. Zero significa sem teto.
 */
// PARA ANTES DE ENCOSTAR, não em cima. O gasto daqui é ESTIMADO pelo tempo de
// máquina de cada trabalho — perto do real, mas não idêntico. Se o app parasse
// exatamente no valor informado, um erro de poucos centavos pra menos já viraria
// dívida, que é justamente o que a pessoa quer evitar. Parando em 85% sobra
// folga pro erro da estimativa e pro trabalho que já começou.

/**
 * A nuvem deve ser usada agora?
 *
 * UMA LINHA, e é de propósito. Aqui existia uma cópia das regras de teto e
 * freio — e cópia de regra é o erro que se repetiu o dia inteiro nesta tela:
 * duas fontes pro mesmo fato, uma consertada e a outra esquecida.
 *
 * Agora quem decide é reavaliarTrava(), que roda dentro de getNuvem() a cada
 * leitura. Quando esta função pergunta, a resposta já está no estado — ela só
 * lê. Se um dia a regra mudar, muda num lugar só.
 */
export function usarNuvem() {
  const n = getNuvem()
  return !!(n.ligada && n.temChave)
}

/** O que ainda dá pra gastar sem encostar no crédito informado. */
export function sobraEstimada() {
  const n = getNuvem()
  if (!n.creditoInformado) return null
  return Math.max(0, Math.round((n.creditoInformado - n.gastoDesdeCredito) * 100) / 100)
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
