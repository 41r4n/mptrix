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

// Quanto esperar antes de desistir — em DUAS fases, porque são esperas de
// natureza diferente:
//
// "starting" é o Replicate puxando a imagem pra uma máquina. Depois que eu
// republico o modelo, o PRIMEIRO carregamento da imagem nova (CUDA, gigabytes)
// pode passar tranquilamente de 8 minutos — e foi exatamente assim que um
// limite único de 8 min cancelou uma extração que estava quase pronta pra
// começar. Carregamento não é sintoma de problema, é fila: espera larga.
//
// "processing" é o modelo trabalhando de verdade. Aí sim demora demais É
// sintoma: nenhuma extração nossa passa de ~3 min de trabalho real.
const LIMITE_STARTING_MS = 25 * 60 * 1000
const LIMITE_PROCESSING_MS = 10 * 60 * 1000

const cab = (chave) => ({ Authorization: `Bearer ${chave}` })

// Fala com a API esperando JSON — e aguenta os soluços dela. No meio de uma
// extração o Replicate respondeu uma página HTML de erro (502) e o "<!DOCTYPE"
// derrubou o lote INTEIRO de quatro instrumentos por causa de um soluço de
// segundos. Resposta que não é JSON e erro 5xx/429 são transitórios: espera e
// tenta de novo. Erro 4xx com corpo JSON é real e sobe na hora.
async function pedirJson(url, opts, tentativas = 3) {
  let ultima
  for (let i = 0; i < tentativas; i++) {
    if (i) await new Promise((s) => setTimeout(s, 4000 * i))
    let r
    try {
      r = await fetch(url, opts)
    } catch (e) {
      ultima = e // rede caiu no meio — transitório
      continue
    }
    const texto = await r.text()
    let j = null
    try { j = JSON.parse(texto) } catch { /* veio HTML */ }
    if (j !== null && r.ok) return j
    if (j !== null && r.status < 500 && r.status !== 429) {
      throw new Error(j.detail || `o Replicate recusou (${r.status})`)
    }
    ultima = new Error(j?.detail || `o Replicate respondeu ${r.status}${j === null ? ' (não-JSON)' : ''}`)
  }
  throw ultima
}

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
  let ultima
  for (let i = 0; i < 3; i++) {
    if (i) await new Promise((s) => setTimeout(s, 4000 * i))
    // o FormData é reconstruído a cada tentativa — corpo consumido não se reusa
    const fd = new FormData()
    fd.append('content', new Blob([dados]), nome)
    try {
      const r = await fetch(`${API}/files`, { method: 'POST', headers: cab(chave), body: fd })
      if (r.ok) {
        const j = await r.json()
        return j.urls.get
      }
      if (r.status < 500 && r.status !== 429) throw new Error(`falha ao enviar o áudio (${r.status})`)
      ultima = new Error(`falha ao enviar o áudio (${r.status})`)
    } catch (e) {
      if (/falha ao enviar/.test(String(e.message)) && !/50\d|429/.test(String(e.message))) throw e
      ultima = e
    }
  }
  throw ultima
}

async function versaoAtual(chave) {
  const j = await pedirJson(`${API}/models/${MODELO}`, { headers: cab(chave) })
  if (!j.latest_version?.id) throw new Error('o modelo está sem versão publicada')
  return j.latest_version.id
}

/**
 * Roda uma predição e espera terminar.
 * onTick(segundos) é chamado a cada consulta pra a barra andar.
 */
async function rodar(chave, versao, input, state, onTick) {
  const criada = await pedirJson(`${API}/predictions`, {
    method: 'POST',
    headers: { ...cab(chave), 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: versao, input })
  })

  const t0 = Date.now()
  let p = criada
  // GPU já queimada antes de a predição morrer também é dinheiro. Sem isso, um
  // cancelamento ou um travamento gastava sem o contador (e o teto) andar.
  const segundosQueimados = () => {
    if (!p.started_at) return 0
    return Math.max(0, Math.round((Date.now() - Date.parse(p.started_at)) / 1000))
  }
  while (p.status === 'starting' || p.status === 'processing') {
    if (state?.cancelled) {
      // não deixa rodando (e cobrando) uma separação que ninguém mais quer
      fetch(`${API}/predictions/${p.id}/cancel`, { method: 'POST', headers: cab(chave) }).catch(() => {})
      const e = new Error('cancelado')
      e.segundosGastos = segundosQueimados()
      throw e
    }
    const trabalhando = p.status === 'processing' || p.started_at
    const limite = trabalhando ? LIMITE_PROCESSING_MS : LIMITE_STARTING_MS
    const desde = trabalhando && p.started_at ? Date.parse(p.started_at) : t0
    if (Date.now() - desde > limite) {
      fetch(`${API}/predictions/${p.id}/cancel`, { method: 'POST', headers: cab(chave) }).catch(() => {})
      const e = new Error(trabalhando
        ? 'a nuvem travou no meio do trabalho'
        : 'a fila da nuvem demorou demais (mais de 25 min só pra começar)')
      e.segundosGastos = segundosQueimados()
      throw e
    }
    await new Promise((s) => setTimeout(s, 3000))
    try {
      p = await pedirJson(`${API}/predictions/${p.id}`, { headers: cab(chave) })
    } catch { /* soluço no poll não mata a predição — ela segue lá; consulta de novo */ }
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
    err.segundosGastos = p.metrics?.predict_time || segundosQueimados()
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
// O "2" no nome nao e versao de codigo -- e implantacao nova no Replicate. A
// original travou depois de um republish: toda predicao (de QUALQUER versao,
// inclusive a que rodava de manha) ficava em "starting" pra sempre, enquanto
// modelos publicos subiam em 9s. Implantacao zerada resolve; a antiga fica
// como esta, morta, de testemunha.
const MODELO_INST = '41r4n/mptrix-instrumentos2'

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
    try {
      mod = await pedirJson(`${API}/models/${MODELO_INST}`, { headers: cab(chave) })
      if (mod.latest_version?.id) break
      mod = null
    } catch { mod = null }
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

// ------------------------------------------------------------- LETRA -------
// WhisperX: transcreve E alinha por PALAVRA com alinhamento forçado (casa o
// texto com o áudio de verdade, em vez de estimar pela atenção do modelo).
// Medido na Azul, contra o whisper.cpp local com DTW:
//   local  218 palavras · 94,5% caem dentro de região de voz · vários minutos
//   nuvem  206 palavras · 100,0% ................. · 12 SEGUNDOS
// E as 12 palavras a menos não são letra perdida: são a contagem de entrada
// ("um, dois, três") e o "obrigado" pra plateia, que o local incluía como se
// fossem verso. A nuvem ganha em tempo, em alinhamento e em limpeza.
const MODELO_LETRA = 'victor-upmeet/whisperx'

export async function transcreverNaNuvem({ chave, arquivo, idioma = 'pt', state, onProgress }) {
  const mod = await pedirJson(`${API}/models/${MODELO_LETRA}`, { headers: cab(chave) })
  if (!mod.latest_version?.id) throw new Error('o transcritor está sem versão publicada')

  const url = await subirArquivo(chave, arquivo, 'voz.flac')
  const p = await rodar(
    chave, mod.latest_version.id,
    { audio_file: url, language: idioma, align_output: true, batch_size: 16 },
    state,
    (s) => onProgress?.({ percent: Math.min(95, 10 + s * 3) })
  )

  // Traduz pra MESMA forma que o pós-processamento do app já consome, pra
  // correção pelo dicionário, votação entre repetições e corte em estrofes
  // continuarem valendo sem saber de onde a letra veio.
  const words = []
  let iSeg = -1
  for (const seg of p.saida?.segments || []) {
    iSeg++
    for (const w of seg.words || []) {
      const texto = String(w.word || '').trim()
      if (!texto || w.start == null) continue
      words.push({
        t0: w.start,
        t1: w.end ?? w.start,
        text: texto,
        ps: typeof w.score === 'number' ? w.score : 0.5,
        pn: 1,
        seg: iSeg
      })
    }
  }
  if (!words.length) throw new Error('a nuvem não achou letra nenhuma nessa voz')
  return { words, segundos: p.segundos }
}

// ------------------------------------------------------------- CROMA -------
// A parte CARA do detector de acordes, e só ela. Medido: o detector local leva
// 450s numa música de 4min20, e 300s são uma chamada só — o LogSpectrum do
// essentia.js, a 431ms por quadro, porque a ponte JS/WASM reconstrói a tabela
// a cada quadro. Nativo, configurado uma vez, custa ~1ms.
//
// A INTELIGÊNCIA dos acordes não vem pra cá: gabaritos, tonalidade, Viterbi,
// votação entre repetições e inversão pelo baixo continuam no chords.cjs, no
// computador do usuário. Este pedaço devolve só os números que a etapa cara
// produzia.
//
// A croma daqui NÃO é idêntica à do WASM (são versões diferentes do essentia:
// 68% dos quadros concordam na nota mais forte). Exigir igualdade era critério
// meu mal escolhido — o que não pode piorar é o ACORDE. Medido nas duas
// músicas de referência, com o detector inteiro rodando:
//   Azul  53,7% -> 54,4%   (croma: 300s -> 22s)
//   Vaso  45,0% -> 46,3%   (detector inteiro: 669s -> 42s)
const MODELO_CROMA = '41r4n/mptrix-croma'

export async function cromaNaNuvem({ chave, harmonia, baixo, destino, state, onProgress }) {
  const mod = await pedirJson(`${API}/models/${MODELO_CROMA}`, { headers: cab(chave) })
  if (!mod.latest_version?.id) throw new Error('a croma está sem versão publicada')

  const entrada = { harmonia: await subirArquivo(chave, harmonia, 'harmonia.wav') }
  if (baixo) entrada.baixo = await subirArquivo(chave, baixo, 'baixo.flac')

  const p = await rodar(chave, mod.latest_version.id, entrada, state,
    (s) => onProgress?.(Math.min(95, 10 + s * 2)))

  const { writeFile } = await import('fs/promises')
  await writeFile(destino, p.saida)
  return { segundos: p.segundos }
}

// ------------------------------------------- GUITARRA/PIANO (6 faixas) -----
// Uma passada do htdemucs_6s sobre o "outros" — o MESMO passo que o app fazia
// localmente. Era o ÚLTIMO trabalho pesado que ainda rodava na máquina do
// usuário: um Demucs de ~3GB numa máquina de 6GB, que estourou a memória no
// meio de um lote e derrubou o que faltava. Na GPU são segundos.
export async function gpNaNuvem({ chave, arquivo, quais, destinoDir, ffmpegPath, run, workDir, state, onProgress }) {
  const versao = await versaoAtual(chave)

  // o wav do "outros" tem ~50MB; em FLAC cai pela metade sem perder nada
  let envio = arquivo
  if (ffmpegPath && run && workDir) {
    const flac = join(workDir, 'gp_envio.flac')
    try {
      await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', arquivo, '-compression_level', '8', flac], state)
      envio = flac
    } catch { /* vai o wav mesmo */ }
  }

  const url = await subirArquivo(chave, envio, 'outros.flac')
  const p = await rodar(
    chave, versao,
    { audio: url, model: 'htdemucs_6s', output_format: 'flac', shifts: 1 },
    state,
    (s) => onProgress?.(Math.min(95, 5 + s * 1.2))
  )

  // baixa só o que foi pedido, os dois ao mesmo tempo. O nome sai .wav porque
  // é o que o passo seguinte do app espera ler — o ffmpeg identifica o formato
  // pelo conteúdo, não pela extensão, então o FLAC dentro não atrapalha.
  const arquivos = {}
  await Promise.all((quais || []).map(async (q) => {
    if (!p.saida?.[q]) throw new Error(`a nuvem não devolveu a faixa de ${q}`)
    const destino = join(destinoDir, `${q}.wav`)
    await baixar(p.saida[q], destino)
    arquivos[q] = destino
  }))
  return { arquivos, segundos: p.segundos }
}

// Estimativa de custo. O Replicate NÃO devolve o valor cobrado pela API, só o
// tempo de GPU. Uso a tabela pública da placa mais cara que esses modelos
// (a conta de centavos mora em store.js, com o preço de cada máquina — uma
//  cópia só, pra não existir duas verdades sobre o dinheiro do usuário)

export { MODELO }
