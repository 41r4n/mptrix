// Separação na NUVEM — opcional, com a chave do próprio usuário.
//
// POR QUE EXISTE: separar uma música de 4 minutos leva minutos num
// processador comum, e é isso que faz esperar. Numa GPU o mesmo trabalho leva
// ~30 segundos. O MPTrix não tem servidor nem cobra nada: quem quiser
// velocidade põe a própria chave do Replicate e paga centavos por música;
// quem não puser continua com a separação local, idêntica ao que sempre foi.
//
// O modelo é o `ryan5453/demucs` — Demucs público, com mais de 1,7 milhão de
// execuções. Não publico modelo meu de propósito: já tentei e o Replicate
// recusou a imagem duas vezes, sem explicação utilizável. Chamar o que já
// roda tira essa dependência do caminho.
import { createWriteStream } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'

const API = 'https://api.replicate.com/v1'
const MODELO = 'ryan5453/demucs'

// Quanto tempo esperar por uma predição antes de desistir. Separação de música
// longa numa fila cheia pode passar de 2 minutos; além disso é sintoma de
// problema, não de fila.
const LIMITE_MS = 8 * 60 * 1000

const cab = (chave) => ({ Authorization: `Bearer ${chave}` })

/** A chave serve? Devolve o nome da conta ou o motivo da recusa. */
export async function testarChave(chave) {
  if (!chave || !/^r8_[A-Za-z0-9]{20,}$/.test(chave.trim())) {
    return { ok: false, erro: 'Isso não parece uma chave do Replicate (elas começam com r8_).' }
  }
  try {
    const r = await fetch(`${API}/account`, { headers: cab(chave.trim()) })
    if (r.status === 401) return { ok: false, erro: 'Chave recusada. Confira se copiou inteira.' }
    if (!r.ok) return { ok: false, erro: `O Replicate respondeu ${r.status}.` }
    const j = await r.json()
    return { ok: true, conta: j.username || j.name || 'conta' }
  } catch {
    return { ok: false, erro: 'Não consegui falar com o Replicate. Sem internet?' }
  }
}

/** Sobe um arquivo e devolve a URL que o modelo vai ler. */
async function subirArquivo(chave, caminho, nome) {
  const { readFile } = await import('fs/promises')
  const dados = await readFile(caminho)
  const fd = new FormData()
  fd.append('content', new Blob([dados]), nome)
  const r = await fetch(`${API}/files`, { method: 'POST', headers: cab(chave), body: fd })
  if (!r.ok) throw new Error(`falha ao enviar o áudio (${r.status})`)
  const j = await r.json()
  return j.urls.get
}

async function versaoAtual(chave) {
  const r = await fetch(`${API}/models/${MODELO}`, { headers: cab(chave) })
  if (!r.ok) throw new Error(`não consegui ler o modelo (${r.status})`)
  const j = await r.json()
  if (!j.latest_version?.id) throw new Error('o modelo está sem versão publicada')
  return j.latest_version.id
}

/**
 * Roda uma predição e espera terminar.
 * onTick(segundos) é chamado a cada consulta pra a barra andar.
 */
async function rodar(chave, versao, input, state, onTick) {
  const r = await fetch(`${API}/predictions`, {
    method: 'POST',
    headers: { ...cab(chave), 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: versao, input })
  })
  const criada = await r.json()
  if (!r.ok) throw new Error(criada?.detail || `o Replicate recusou o pedido (${r.status})`)

  const t0 = Date.now()
  let p = criada
  while (p.status === 'starting' || p.status === 'processing') {
    if (state?.cancelled) {
      // não deixa rodando (e cobrando) uma separação que ninguém mais quer
      fetch(`${API}/predictions/${p.id}/cancel`, { method: 'POST', headers: cab(chave) }).catch(() => {})
      throw new Error('cancelado')
    }
    if (Date.now() - t0 > LIMITE_MS) {
      fetch(`${API}/predictions/${p.id}/cancel`, { method: 'POST', headers: cab(chave) }).catch(() => {})
      throw new Error('a nuvem demorou demais')
    }
    await new Promise((s) => setTimeout(s, 3000))
    const rr = await fetch(`${API}/predictions/${p.id}`, { headers: cab(chave) })
    p = await rr.json()
    onTick?.((Date.now() - t0) / 1000)
  }
  if (p.status !== 'succeeded') {
    const msg = String(p.error || p.status)
    // O link do arquivo enviado tem validade. Se a fila demorar, ele vence e o
    // contêiner recebe 403 ao tentar baixar a entrada — a predição fica presa
    // e morre sem dizer por quê. Já vi acontecer: 94 minutos em "starting" pra
    // terminar em "403 Forbidden ...?expiry=". Marco pra quem chamou reenviar.
    const err = new Error(msg.includes('403') ? 'o link do áudio venceu antes de a nuvem começar' : msg)
    err.linkVenceu = /403|expiry/i.test(msg)
    throw err
  }
  return { saida: p.output, segundos: p.metrics?.predict_time || 0 }
}

async function baixar(url, destino) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`falha ao baixar a faixa (${r.status})`)
  await pipeline(Readable.fromWeb(r.body), createWriteStream(destino))
}

/**
 * Separa na nuvem e devolve { rawPaths, segundos } no MESMO formato que a
 * separação local produz — quem chama não precisa saber de onde veio.
 *
 * A cascata do modo 6 faixas é reproduzida igual à local: voz/bateria/baixo
 * saem do modelo de 4 (mais limpo) e o de 6 entra só pra guitarra e piano.
 * Chamar o de 6 direto seria mais barato e mais rápido, e entregaria faixas
 * PIORES do que o usuário já tem — velocidade não vale isso.
 */
export async function separarNaNuvem({ chave, model, srcWav, inputFile, workDir, ffmpegPath, state, onProgress, run }) {
  const versao = await versaoAtual(chave)
  let gastoS = 0

  // O QUE SUBIR. O WAV normalizado de uma música de 4 minutos tem ~46MB; numa
  // conexão doméstica isso é mais de um minuto só de envio, e come inteira a
  // vantagem dos 30 segundos. Quando o arquivo de origem já é comprimido, ele
  // sobe no lugar: o Demucs lê mp3/m4a/ogg direto, e converter pra WAV antes
  // não acrescenta informação nenhuma — o WAV veio DELE. Só quando a origem
  // já é sem compressão (wav/aiff) eu gero um FLAC, que é menor e não perde
  // nada. Nos dois casos o que a nuvem recebe é o áudio inteiro, sem degradar.
  const COMPRIMIDOS = /\.(mp3|m4a|aac|ogg|opus|webm|mp4)$/i
  let paraEnviar = srcWav
  let nomeEnvio = 'entrada.wav'
  if (inputFile && COMPRIMIDOS.test(inputFile)) {
    paraEnviar = inputFile
    nomeEnvio = 'entrada' + inputFile.slice(inputFile.lastIndexOf('.'))
  } else if (ffmpegPath && run) {
    const flac = join(workDir, 'envio.flac')
    try {
      await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', srcWav, '-compression_level', '8', flac], state)
      paraEnviar = flac
      nomeEnvio = 'entrada.flac'
    } catch { /* sem FLAC vai o WAV mesmo — mais lento, mas funciona */ }
  }

  const enviar = () => subirArquivo(chave, paraEnviar, nomeEnvio)
  let urlEntrada = await enviar()

  // uma re-tentativa com arquivo novo cobre o caso do link vencido
  const rodarComReenvio = async (input, onTick) => {
    try {
      return await rodar(chave, versao, input, state, onTick)
    } catch (e) {
      if (!e.linkVenceu || input.audio !== urlEntrada) throw e
      urlEntrada = await enviar()
      return await rodar(chave, versao, { ...input, audio: urlEntrada }, state, onTick)
    }
  }

  // FLAC, não WAV: é sem perda igual, e o app converte pra FLAC logo depois de
  // qualquer jeito. Em WAV as 6 faixas somavam 370MB de download e o tempo de
  // baixar passava do dobro do tempo de GPU — o gargalo virava a internet.
  const base = { output_format: 'flac', shifts: 1 }
  const rawPaths = {}
  const seisFaixas = model === 'htdemucs_6s'

  // ---- 1ª passada
  onProgress?.({ stage: 'separating', percent: 5 })
  const p1 = await rodarComReenvio(
    { ...base, audio: urlEntrada, model: seisFaixas ? 'htdemucs' : model },
    (s) => onProgress?.({ stage: 'separating', percent: Math.min(seisFaixas ? 45 : 90, 5 + s * 1.5) })
  )
  gastoS += p1.segundos

  const guarda = async (nome, url) => {
    const destino = join(workDir, `${nome}.flac`)
    await baixar(url, destino)
    return destino
  }

  // TODAS de uma vez. Uma por uma, o download era mais demorado que a própria
  // separação — são seis arquivos independentes, esperar um pra começar o
  // outro não tem motivo nenhum.
  const guardarTodas = async (pares) => {
    const feitos = await Promise.all(pares.map(async ([nome, url]) => [nome, await guarda(nome, url)]))
    return Object.fromEntries(feitos)
  }

  if (!seisFaixas) {
    onProgress?.({ stage: 'separating', percent: 92 })
    Object.assign(rawPaths, await guardarTodas(Object.entries(p1.saida)))
    return { rawPaths, segundos: gastoS }
  }

  Object.assign(rawPaths, await guardarTodas([
    ['vocals', p1.saida.vocals],
    ['drums', p1.saida.drums],
    ['bass', p1.saida.bass]
  ]))

  // ---- 2ª passada: o "outros" da 1ª vira entrada, direto pela URL (sem
  // baixar e reenviar — a saída de uma predição serve de entrada da outra)
  onProgress?.({ stage: 'separating', percent: 50 })
  const p2 = await rodar(
    chave, versao, { ...base, audio: p1.saida.other, model: 'htdemucs_6s' }, state,
    (s) => onProgress?.({ stage: 'separating', percent: Math.min(88, 50 + s * 1.5) })
  )
  gastoS += p2.segundos

  // guitarra, piano e as quatro sobras: seis downloads, todos juntos
  const daSegunda = await guardarTodas([
    ['guitar', p2.saida.guitar],
    ['piano', p2.saida.piano],
    ...['other', 'vocals', 'drums', 'bass'].map((n) => [`s_${n}`, p2.saida[n]])
  ])
  rawPaths.guitar = daSegunda.guitar
  rawPaths.piano = daSegunda.piano

  // O que a 2ª passada vazou pra voz/bateria/baixo volta pro "outros", igual
  // à cascata local — nenhum som da música pode se perder no caminho
  const sobra = Object.fromEntries(
    ['other', 'vocals', 'drums', 'bass'].map((n) => [n, daSegunda[`s_${n}`]])
  )
  const juntado = join(workDir, 'other_merged.wav')
  await run(ffmpegPath, [
    '-y', '-loglevel', 'error',
    '-i', sobra.other, '-i', sobra.vocals, '-i', sobra.drums, '-i', sobra.bass,
    '-filter_complex', 'amix=inputs=4:normalize=0',
    '-ar', '44100', juntado
  ], state)
  rawPaths.other = juntado

  return { rawPaths, segundos: gastoS }
}

// ------------------------------------------------- INSTRUMENTO AVULSO ------
// Modelo meu, este: nenhum público roda os pesos do catálogo de 53. É o mesmo
// BS-RoFormer e o MESMO COMMIT do MSST que roda na máquina do usuário — a
// única diferença é a GPU no lugar do processador. Medido: 47 minutos viram
// menos de 2.
const MODELO_INST = '41r4n/mptrix-instrumentos'

export async function extrairInstrumentoNaNuvem({
  chave, instrumento, arquivo, destino, state, onProgress, ffmpegPath, run, workDir
}) {
  // Enquanto uma versão nova está sendo publicada, o modelo fica alguns
  // segundos sem `latest_version` e a chamada falha por nada. Aconteceu de
  // verdade: derrubou a extração do órgão no meio. Espera e tenta de novo —
  // é uma janela curta, não um defeito permanente.
  let mod = null
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (state?.cancelled) throw new Error('cancelado')
    const r = await fetch(`${API}/models/${MODELO_INST}`, { headers: cab(chave) })
    if (r.ok) {
      mod = await r.json()
      if (mod.latest_version?.id) break
      mod = null
    }
    if (tentativa < 2) await new Promise((s) => setTimeout(s, 8000))
  }
  if (!mod) throw new Error('o extrator está sem versão publicada (tentei 3 vezes)')

  // FLAC pra subir: o mix já descontado é WAV de ~46MB, e o envio pesa tanto
  // quanto o processamento numa conexão comum
  let envio = arquivo
  if (ffmpegPath && run && workDir) {
    const flac = join(workDir, `envio_${instrumento}.flac`)
    try {
      await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', arquivo, '-compression_level', '8', flac], state)
      envio = flac
    } catch { /* segue com o WAV */ }
  }

  const enviar = () => subirArquivo(chave, envio, `mix.${envio.endsWith('.flac') ? 'flac' : 'wav'}`)
  let url = await enviar()

  let p
  try {
    p = await rodar(chave, mod.latest_version.id, { audio: url, instrumento }, state,
      (s) => onProgress?.(Math.min(95, 5 + s * 0.5)))
  } catch (e) {
    if (!e.linkVenceu) throw e
    url = await enviar()
    p = await rodar(chave, mod.latest_version.id, { audio: url, instrumento }, state,
      (s) => onProgress?.(Math.min(95, 5 + s * 0.5)))
  }

  await baixar(p.saida, destino)
  return { segundos: p.segundos }
}

// Estimativa de custo. O Replicate NÃO devolve o valor cobrado pela API, só o
// tempo de GPU. Uso a tabela pública da placa mais cara que esses modelos
// costumam pegar, pra a conta errar pra MAIS e nunca surpreender pra menos.
// O valor exato aparece no painel do Replicate, em Billing.
const DOLAR_POR_SEGUNDO = 0.0014

export function estimarCentavos(segundos) {
  return Math.round(segundos * DOLAR_POR_SEGUNDO * 100 * 100) / 100
}

export { MODELO }
