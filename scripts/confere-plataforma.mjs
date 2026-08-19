// CONFERE O QUE O APP PROCURA EM CADA SISTEMA — rodar com: npm run confere:plataforma
//
// O MPTRIX nasceu no Windows. Quando ele passar a abrir num Mac, o jeito de
// quebrar nao vai ser um estouro na cara: vai ser o app procurando
// `venv/Scripts/python.exe` numa maquina onde o Python mora em `venv/bin`,
// concluindo que o motor nao esta instalado, e ficando quieto sobre isso.
//
// Este fiscal existe porque o dono nao tem um Mac na mesa. O sistema entra como
// argumento, entao as tres respostas sao medidas de qualquer computador — e a
// primeira coisa que ele cobra e que NADA mudou no Windows, que e a maquina que
// hoje funciona e nao pode regredir.
//
// UMA ARMADILHA QUE VALE ESCRITA: `path.join` usa o separador da maquina que
// esta RODANDO, nao o do sistema pedido. Por isso os casos comparam com join
// tambem, nunca com o caminho escrito a mao — senao o fiscal acusaria erro no
// Linux por uma barra que no Windows estaria certa.
import { mkdtempSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath, pathToFileURL } from 'url'

// mesmo motivo do confere-motor: src/main e lido como CommonJS, e uma copia
// .mjs basta pra importar o codigo que vai pro app, byte a byte.
const aqui = dirname(fileURLToPath(import.meta.url))
const copia = join(mkdtempSync(join(tmpdir(), 'mptrix-plat-')), 'plataforma.mjs')
copyFileSync(join(aqui, '..', 'src', 'main', 'plataforma.js'), copia)
const P = await import(pathToFileURL(copia).href)

const casos = []
const caso = (nome, f) => casos.push([nome, f])
const SEMPRE = () => true
const NUNCA = () => false

caso('windows: tudo continua exatamente como e hoje', () => {
  return [
    [P.programa('yt-dlp', 'win32') === 'yt-dlp.exe', 'yt-dlp.exe'],
    [P.programa('ffmpeg', 'win32') === 'ffmpeg.exe', 'ffmpeg.exe'],
    [P.programa('rubberband', 'win32') === 'rubberband.exe', 'rubberband.exe'],
    [P.programa('whisper-cli', 'win32') === 'whisper-cli.exe', 'whisper-cli.exe'],
    [P.programa('curl', 'win32') === 'curl.exe', 'curl.exe'],
    [P.caminhoDoPython('/M', 'win32') === join('/M', 'venv', 'Scripts', 'python.exe'), 'venv/Scripts/python.exe'],
    [P.pythonDoPacote('/M/python', 'win32') === join('/M/python', 'python.exe'), 'o python do pacote fica solto na raiz'],
    [P.descompactador('win32', { SystemRoot: 'C:\\Win' }, SEMPRE) === join('C:\\Win', 'System32', 'tar.exe'), 'tar de fabrica do System32']
  ]
})

caso('mac: procura os programas sem sufixo, e o python em bin', () => {
  return [
    [P.programa('yt-dlp', 'darwin') === 'yt-dlp', 'yt-dlp, sem .exe'],
    [P.programa('ffmpeg', 'darwin') === 'ffmpeg', 'ffmpeg, sem .exe'],
    [P.caminhoDoPython('/M', 'darwin') === join('/M', 'venv', 'bin', 'python'), 'venv/bin/python'],
    [P.pythonDoPacote('/M/python', 'darwin') === join('/M/python', 'bin', 'python'), 'no mac o python do pacote fica em bin'],
    [P.descompactador('darwin', {}, NUNCA) === 'tar', 'o tar e do sistema, vem do PATH']
  ]
})

caso('linux responde igual ao mac: os dois sao unix', () => {
  const iguais = ['yt-dlp', 'ffmpeg', 'rubberband', 'whisper-cli', 'curl']
    .every((n) => P.programa(n, 'linux') === P.programa(n, 'darwin'))
  return [
    [iguais, 'mesmos nomes de programa'],
    [P.caminhoDoPython('/M', 'linux') === P.caminhoDoPython('/M', 'darwin'), 'mesmo caminho de python']
  ]
})

caso('o descompactador que falta no windows vira recado, nao silencio', () => {
  return [
    [P.descompactador('win32', { SystemRoot: 'C:\\Win' }, NUNCA) === null, 'sem tar no windows: devolve null'],
    [P.SEM_DESCOMPACTADOR.includes('desde 2018'), 'e o recado explica que isso e computador desatualizado'],
    [P.descompactador('darwin', {}, NUNCA) !== null, 'mac nunca fica sem: nao ha o que avisar']
  ]
})

caso('os pacotes de IA se declaram como sao: so de windows', () => {
  const recado = P.recadoSemPacote('darwin')
  return [
    [P.temPacoteDeIA('win32') === true, 'no windows existem'],
    [P.temPacoteDeIA('darwin') === false, 'no mac ainda nao'],
    [P.temPacoteDeIA('linux') === false, 'no linux tambem nao'],
    [recado.includes('Mac'), 'o recado do mac fala em Mac: "' + recado.slice(0, 46) + '..."'],
    [/tocar|metr|tom/i.test(recado), 'e diz o que AINDA funciona, em vez de so negar']
  ]
})

caso('o atualizador do yt-dlp se recusa onde estragaria', () => {
  return [
    [P.sabeAtualizarYtDlp('win32') === true, 'no windows atualiza, como sempre atualizou'],
    [P.sabeAtualizarYtDlp('darwin') === false, 'no mac recusa: o endereco que ele conhece e .exe'],
    [P.sabeAtualizarYtDlp('linux') === false, 'no linux idem'],
    [/por fora|gerenciador/.test(P.NAO_SABE_ATUALIZAR), 'e o recado diz o que fazer no lugar']
  ]
})

caso('o sistema de verdade e o padrao: ninguem precisa passar nada', () => {
  const eu = process.platform
  return [
    [P.programa('yt-dlp') === P.programa('yt-dlp', eu), 'programa() sozinho responde pelo sistema de agora (' + eu + ')'],
    [P.caminhoDoPython('/M') === P.caminhoDoPython('/M', eu), 'caminhoDoPython() idem'],
    [P.temPacoteDeIA() === P.temPacoteDeIA(eu), 'temPacoteDeIA() idem']
  ]
})

let tudo = true
console.log('O QUE O APP PROCURA EM CADA SISTEMA\n')
for (const [nome, f] of casos) {
  let checks
  try { checks = f() } catch (e) { checks = [[false, 'explodiu: ' + e.message]] }
  const passou = checks.every(([ok]) => ok)
  if (!passou) tudo = false
  console.log((passou ? 'ok   ' : 'ERRO ') + nome)
  for (const [ok, txt] of checks) console.log('       ' + (ok ? '·' : '✗') + ' ' + txt)
}
console.log()
process.exit(tudo ? 0 : 1)
