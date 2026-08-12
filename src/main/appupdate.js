import { autoUpdater } from 'electron-updater'

// ██████████ O MPTRIX SE ATUALIZANDO ██████████
//
// Até agora, dar uma versão nova pra alguém era caçar a pessoa e mandar 141 MB
// na mão. Com três amigos que esquecem de instalar, viram três MPTRIX
// diferentes rodando por aí e ninguém sabe qual é qual.
//
// Aqui a direção se inverte: o dono publica UMA vez, e o app de cada pessoa
// olha sozinho e avisa. Ninguém é caçado, ninguém é rastreado — não existe
// lista de quem instalou. Existe um lugar onde os apps olham.
//
// REGRAS DA CASA NESTE ARQUIVO:
//
// 1. NADA acontece sozinho além de OLHAR. Baixar e instalar são sempre por
//    clique. Um app que troca a si mesmo enquanto a pessoa separa uma música é
//    um app que estraga o trabalho dela pra ficar em dia.
//
// 2. Rodando do código-fonte, isto fica desligado e DIZ que está desligado. O
//    electron-updater não funciona fora de app instalado; sem esse aviso, a
//    tela mostraria "não consegui verificar" e o dono ia caçar um problema que
//    não existe.
//
// 3. Erro de rede não vira susto. Ficar sem internet é normal — e este app é
//    offline por natureza. A tela diz "não deu pra verificar agora" e segue.

let janela = null
let estado = { fase: 'parado', versaoInstalada: null, versaoNova: null, notas: null, erro: null, progresso: null }
let ligado = false

const avisar = () => {
  if (janela && !janela.isDestroyed()) janela.webContents.send('app-update:estado', estado)
}

const mudar = (mexer) => { estado = { ...estado, ...mexer }; avisar() }

export function prepararAtualizacaoDoApp({ janelaPrincipal, empacotado, versao }) {
  janela = janelaPrincipal
  estado.versaoInstalada = versao

  if (!empacotado) {
    // Não é erro: é o app rodando do código. Dizer o motivo evita o dono caçar
    // defeito onde não tem.
    estado.fase = 'so-instalado'
    return
  }

  ligado = true
  // Baixar é decisão da pessoa, não do programa (regra 1).
  autoUpdater.autoDownload = false
  // Instalar ao fechar também não: quem escolhe a hora é quem está usando.
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    mudar({ fase: 'tem-nova', versaoNova: info.version, notas: typeof info.releaseNotes === 'string' ? info.releaseNotes : null, erro: null })
  })
  autoUpdater.on('update-not-available', () => mudar({ fase: 'em-dia', versaoNova: null, erro: null }))
  autoUpdater.on('download-progress', (p) => {
    mudar({ fase: 'baixando', progresso: { porcento: p.percent || 0, recebido: p.transferred || 0, total: p.total || 0 } })
  })
  autoUpdater.on('update-downloaded', (info) => {
    mudar({ fase: 'baixada', versaoNova: info.version, progresso: null })
  })
  autoUpdater.on('error', (err) => {
    mudar({ fase: 'erro', erro: mensagemDeErro(err), progresso: null })
  })
}

// O erro cru do electron-updater fala de HTTP, de YAML e de caminho de arquivo.
// Quem lê é um músico. Cada tradução aqui é um caso que a pessoa pode resolver
// ou pode ignorar em paz — e ela precisa saber qual dos dois.
function mensagemDeErro(err) {
  const cru = String(err?.message || err || '')
  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|ETIMEDOUT|network/i.test(cru)) {
    return 'Não deu pra verificar agora — parece que a internet está fora. O MPTRIX funciona offline do mesmo jeito.'
  }
  if (/404|Cannot find latest|no published versions/i.test(cru)) {
    return 'Ainda não existe nenhuma versão publicada pra comparar.'
  }
  // Este é o erro do DONO, não do usuário: falta dizer no package.json onde as
  // versões são publicadas. Sem tradução, aparecia um texto em inglês sobre
  // configuração de build na tela de quem só queria tocar música.
  if (/publish|provider|app-update\.yml/i.test(cru)) {
    return 'O MPTRIX ainda não tem um lugar publicado pra buscar versões novas.'
  }
  if (/signature|not signed|SignerCertificate/i.test(cru)) {
    return 'O Windows recusou a versão baixada por causa da assinatura digital. Baixe o instalador na mão por enquanto.'
  }
  return cru || 'Não deu pra verificar agora.'
}

export function estadoDaAtualizacao() { return estado }

export async function procurarAtualizacao() {
  if (!ligado) return estado
  mudar({ fase: 'procurando', erro: null })
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    mudar({ fase: 'erro', erro: mensagemDeErro(err) })
  }
  return estado
}

export async function baixarAtualizacao() {
  if (!ligado) return estado
  mudar({ fase: 'baixando', erro: null, progresso: null })
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    mudar({ fase: 'erro', erro: mensagemDeErro(err) })
  }
  return estado
}

export function instalarAtualizacao() {
  if (!ligado || estado.fase !== 'baixada') return false
  // true, true = fecha e reabre já na versão nova. Sair e a pessoa ter que
  // procurar o ícone de novo seria trocar um clique por três.
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
  return true
}
