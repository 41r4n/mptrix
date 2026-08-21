import { join } from 'path'
import { existsSync } from 'fs'

// ██████████ QUAL PROGRAMA CHAMAR EM CADA SISTEMA ██████████
//
// O MPTRIX nasceu no Windows e foi escrevendo `.exe` na unha em sete lugares
// diferentes: o yt-dlp, o ffmpeg, o Python do motor, o rubberband, o whisper, o
// curl e o tar. Cada um desses é a mesma decisão tomada de novo — e decisão
// espalhada é decisão que se perde: bastaria esquecer UM pra o app dizer
// "motor instalado" e quebrar na hora de separar, que é justamente o defeito
// que o resto deste arquivo existe pra evitar.
//
// Aqui a decisão fica num lugar só. E fica FORA do electron de propósito, pelo
// mesmo motivo do binpath.js: assim ela pode ser medida sem subir o app, e nas
// três máquinas ao mesmo tempo — quem confere não precisa ter um Mac na mesa
// pra saber o que o app vai procurar num Mac.
//
// O SISTEMA ENTRA COMO ARGUMENTO, sempre com o de verdade por padrão. Não é
// firula de teste: é a única forma de o fiscal provar as três respostas
// rodando numa máquina só.

export const WINDOWS = 'win32'

// No Windows todo programa termina em `.exe`; em Mac e Linux, não termina em
// nada. É só isso — e é isso que estava espalhado por sete arquivos.
export function programa(nome, sistema = process.platform) {
  return sistema === WINDOWS ? nome + '.exe' : nome
}

// O AMBIENTE PYTHON MUDA DE FORMA, não só de nome. No Windows os executáveis
// dele ficam em `Scripts`; em Mac e Linux, em `bin`. Procurar `venv/Scripts`
// num Mac não acha nada, e o app concluiria que o motor não está instalado.
export function caminhoDoPython(pastaDoMotor, sistema = process.platform) {
  return sistema === WINDOWS
    ? join(pastaDoMotor, 'venv', 'Scripts', 'python.exe')
    : join(pastaDoMotor, 'venv', 'bin', 'python')
}

// O Python que vem DENTRO do pacote, e cujo caminho é reescrito no pyvenv.cfg.
// A assimetria é do próprio Python: no Windows ele fica solto na raiz da
// instalação, em Mac e Linux fica em `bin`.
export function pythonDoPacote(pastaDoPython, sistema = process.platform) {
  return sistema === WINDOWS
    ? join(pastaDoPython, 'python.exe')
    : join(pastaDoPython, 'bin', 'python')
}

// QUEM ABRE O .tar.gz. No Windows é o descompactador de fábrica, que mora em
// lugar fixo — e conferir se ele está lá é a diferença entre um recado claro e
// uma instalação que morre no meio. Em Mac e Linux o `tar` é do sistema e vive
// no PATH; procurar caminho absoluto ali seria adivinhar.
export function descompactador(sistema = process.platform, ambiente = process.env, existe = existsSync) {
  if (sistema !== WINDOWS) return 'tar'
  const cam = join(ambiente.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
  return existe(cam) ? cam : null
}

// O recado de quando não há descompactador. Só o Windows pode ficar sem, então
// só ele tem recado — em Mac e Linux o tar faz parte do sistema.
export const SEM_DESCOMPACTADOR =
  'Este Windows não tem o descompactador de fábrica (tar). Ele existe desde 2018 — o computador pode estar muito desatualizado.'

// ██████████ OS PACOTES DE IA SÓ EXISTEM PRA WINDOWS ██████████
//
// Isto não é um caminho errado, é um fato do mundo: os pacotes publicados em
// `motor-v1` trazem um Python de Windows INTEIRO dentro. Num Mac, baixar 790 MB
// deles instalaria um Python que não roda, e o app só descobriria isso na hora
// de separar — depois da espera, com erro que não explica nada. Exatamente o
// defeito que o próprio motor já se preocupa em não cometer.
//
// Então o app diz na cara, antes de baixar. Quando os pacotes de Mac existirem,
// é aqui que a resposta muda — e em nenhum outro lugar.
export function temPacoteDeIA(sistema = process.platform) {
  return sistema === WINDOWS
}

export function recadoSemPacote(sistema = process.platform) {
  const casa = sistema === 'darwin' ? 'no Mac' : 'neste sistema'
  return 'As inteligências artificiais ainda só existem em versão Windows — ' +
    'baixar ' + casa + ' traria um programa que não roda aqui. ' +
    'O resto do MPTRIX funciona: tocar, ver tom e BPM, metrônomo, marcar trecho e letra escrita à mão.'
}

// ██████████ O AUTOATUALIZADOR DO yt-dlp ██████████
//
// O MPTRIX baixa o yt-dlp novo direto do GitHub deles, e o endereço que ele
// conhece termina em `yt-dlp.exe`. Num Mac isso seria pior que não atualizar:
// ele gravaria um programa de Windows POR CIMA do yt-dlp que funciona, e o app
// pararia de baixar música — com a pessoa achando que tinha acabado de
// melhorar alguma coisa.
//
// O yt-dlp publica build pra cada sistema com nome próprio. Qual é o nome
// exato, eu não vou chutar daqui: é coisa de conferir na máquina de verdade,
// junto com marcar o arquivo como executável (`chmod +x`), que no Windows não
// existe e em Mac e Linux é obrigatório. Até lá, o app diz que não sabe — em
// vez de estragar o que está funcionando.
export function sabeAtualizarYtDlp(sistema = process.platform) {
  return sistema === WINDOWS
}

export const NAO_SABE_ATUALIZAR =
  'Atualizar o yt-dlp por aqui só funciona no Windows por enquanto. ' +
  'Neste sistema, atualize o yt-dlp por fora (pelo gerenciador de pacotes) e reinicie o MPTRIX.'
