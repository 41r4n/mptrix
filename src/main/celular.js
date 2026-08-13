import { createServer } from 'http'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'

// ██████████ O ESTÚDIO NO CELULAR ██████████
//
// O computador serve uma página; o celular abre pelo navegador, na rede de
// casa. Sem loja, sem instalar nada, sem servidor de ninguém no meio.
//
// A DIVISÃO É ESTA, e ela é o projeto inteiro em uma linha:
//
//   o computador faz o TRABALHO   baixar, separar, analisar, achar os acordes
//   o celular faz o USO           tocar, mudo, solo, volume, repetir trecho
//
// Trabalho pesado em celular é ruim — e não precisa: a máquina que já faz isso
// está ligada na mesma casa.
//
// NADA SAI DA CASA. O servidor só existe na rede local; não há nuvem, não há
// conta, não há lugar onde o acervo de duas pessoas pudesse se encontrar. Os
// três medos do dono (um pagando a conta do outro, perder música, achar música
// alheia) não são evitados aqui — eles não têm onde acontecer.

let servidor = null
let senha = null
let porta = 0
let ffmpeg = null

// ██████████ POR QUE O CELULAR RECEBE OUTRO ARQUIVO ██████████
//
// MEDIDO no aparelho do dono: com as faixas cruas, o celular tocava só parte
// delas — e escolhia quais pelo critério dele, então sumia justo a voz. As
// faixas estavam inteiras; quem não dava conta era o telefone.
//
// A conta explica: cada faixa é FLAC de ~40 MB, sem compressão. Nove ao mesmo
// tempo são uns 12 Mbps voando no Wi-Fi e nove descompactações rodando juntas
// num aparelho de bolso.
//
//   FLAC original   43,8 MB por faixa
//   AAC 128k         3,6 MB por faixa      12x menor, e muito mais leve de abrir
//
// A conversão leva ~4 segundos por faixa e fica GUARDADA: só acontece na
// primeira vez que aquela música é aberta no celular.
//
// 128k e não mais: isto é pra ensaiar, não pra masterizar. E quem quiser o som
// cru tem o estúdio do computador, com o arquivo original.
const PASTA_CELULAR = 'celular'

// A SENHA existe porque "rede de casa" inclui a visita, o vizinho que pegou o
// Wi-Fi e qualquer aparelho conectado. Ela não protege contra ataque de
// verdade — protege contra alguém tropeçar no seu acervo sem querer.
const novaSenha = () => randomBytes(4).toString('hex')

function enderecosDaCasa() {
  const achados = []
  for (const [nome, lista] of Object.entries(networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family !== 'IPv4' || i.internal) continue
      // 169.254.x.x é endereço de "não consegui achar a rede" — mostrar isso
      // pro dono seria mandar ele digitar um número que não leva a lugar nenhum
      if (i.address.startsWith('169.254.')) continue
      achados.push({ nome, ip: i.address })
    }
  }
  return achados
}

// ── o acervo, lido direto das sessões já separadas ──
function lerAcervo(stemsDir) {
  if (!existsSync(stemsDir)) return []
  const itens = []
  for (const nome of readdirSync(stemsDir)) {
    if (nome.startsWith('_')) continue
    const dir = join(stemsDir, nome)
    const meta = join(dir, 'meta.json')
    const base = join(dir, 'base')
    if (!existsSync(meta) || !existsSync(base)) continue
    let m
    try { m = JSON.parse(readFileSync(meta, 'utf8')) } catch { continue }

    // As faixas "_orig" são cópias de antes do tratamento — servem ao motor,
    // não a quem toca. Mandar as duas faria o celular tocar a mesma coisa
    // duas vezes e ainda gastar rede pra isso.
    const faixas = readdirSync(base)
      .filter((f) => /\.(flac|wav|mp3|m4a)$/i.test(f))
      .filter((f) => !/_orig\./i.test(f))
      .filter((f) => !/^song\./i.test(f))
      .map((f) => ({
        id: f.replace(/\.[^.]+$/, ''),
        arquivo: f,
        bytes: statSync(join(base, f)).size
      }))
      .sort((a, b) => a.id.localeCompare(b.id))

    if (!faixas.length) continue
    itens.push({
      chave: nome,
      titulo: m.title || nome,
      duracao: m.duration || 0,
      tom: m.analysis?.key ? `${m.analysis.key}${m.analysis.scale === 'minor' ? 'm' : ''}` : null,
      bpm: m.analysis?.bpm ? Math.round(m.analysis.bpm) : null,
      faixas
    })
  }
  return itens.sort((a, b) => a.titulo.localeCompare(b.titulo))
}

// ── entregar áudio com RANGE, que é o que faz o celular conseguir arrastar ──
// Sem isto, o navegador baixa o arquivo inteiro antes de tocar e a barra de
// tempo não anda. Com 40 MB por faixa, isso é a diferença entre funcionar e
// parecer travado.
function servirAudio(req, res, caminho) {
  if (!existsSync(caminho)) { res.writeHead(404); res.end('nao achei'); return }
  const total = statSync(caminho).size
  const tipo = caminho.endsWith('.flac') ? 'audio/flac'
    : caminho.endsWith('.wav') ? 'audio/wav'
      : caminho.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4'

  const range = req.headers.range
  if (!range) {
    res.writeHead(200, { 'Content-Length': total, 'Content-Type': tipo, 'Accept-Ranges': 'bytes' })
    createReadStream(caminho).pipe(res)
    return
  }
  const m = /bytes=(\d*)-(\d*)/.exec(range)
  const ini = m && m[1] ? parseInt(m[1], 10) : 0
  const fim = m && m[2] ? parseInt(m[2], 10) : total - 1
  if (ini >= total) {
    res.writeHead(416, { 'Content-Range': `bytes */${total}` })
    res.end()
    return
  }
  res.writeHead(206, {
    'Content-Range': `bytes ${ini}-${fim}/${total}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': fim - ini + 1,
    'Content-Type': tipo
  })
  createReadStream(caminho, { start: ini, end: fim }).pipe(res)
}

// Converte uma vez e guarda ao lado. Se já existe, devolve na hora.
// O arquivo temporário só vira o definitivo no fim (rename): assim, se o
// computador for desligado no meio, o celular não encontra meio arquivo e
// acha que é a música — ele simplesmente converte de novo.
const emAndamento = new Map()

function prepararLeve(stemsDir, chave, arq) {
  const cru = join(stemsDir, chave, 'base', arq)
  if (!ffmpeg || !existsSync(ffmpeg)) return Promise.resolve(cru)
  if (/\.(m4a|mp3)$/i.test(arq)) return Promise.resolve(cru)

  const pasta = join(stemsDir, chave, PASTA_CELULAR)
  const leve = join(pasta, arq.replace(/\.[^.]+$/, '.m4a'))
  if (existsSync(leve)) return Promise.resolve(leve)
  if (!existsSync(cru)) return Promise.resolve(cru)
  if (emAndamento.has(leve)) return emAndamento.get(leve)

  const trabalho = new Promise((resolve) => {
    try { mkdirSync(pasta, { recursive: true }) } catch {}
    // O .m4a FICA NO FIM do nome temporário: o ffmpeg escolhe o formato pela
    // EXTENSÃO, e com "vocals.m4a.parcial" ele não sabia o que gerar e saía
    // com erro — o servidor então mandava o arquivo cru e parecia que a
    // conversão simplesmente não existia.
    const tmp = leve.replace(/\.m4a$/, '.parcial.m4a')
    const p = spawn(ffmpeg, [
      '-y', '-loglevel', 'error', '-i', cru,
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', tmp
    ], { windowsHide: true })
    p.on('error', () => { emAndamento.delete(leve); resolve(cru) })
    p.on('close', (code) => {
      emAndamento.delete(leve)
      if (code === 0 && existsSync(tmp)) {
        try { renameSync(tmp, leve); resolve(leve); return } catch {}
      }
      try { if (existsSync(tmp)) unlinkSync(tmp) } catch {}
      // deu errado? manda o cru. Pesado é melhor que mudo.
      resolve(cru)
    })
  })
  emAndamento.set(leve, trabalho)
  return trabalho
}

export function ligarCelular({ stemsDir, paginaHtml, ffmpegPath }) {
  if (servidor) return infoCelular()
  senha = novaSenha()
  ffmpeg = ffmpegPath

  servidor = createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    const caminho = decodeURIComponent(url.pathname)

    // a senha viaja na própria URL: o celular abre um endereço e pronto,
    // sem tela de login pra alguém digitar no escuro
    const autorizado = url.searchParams.get('s') === senha ||
      (req.headers.cookie || '').includes(`mptrix=${senha}`)

    if (!autorizado) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Endereço incompleto. Use o link que aparece no MPTRIX do computador.')
      return
    }

    if (caminho === '/' || caminho === '/index.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `mptrix=${senha}; Path=/; SameSite=Lax`,
        'Cache-Control': 'no-store'
      })
      res.end(paginaHtml())
      return
    }

    if (caminho === '/api/acervo') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(lerAcervo(stemsDir)))
      return
    }

    const audio = /^\/audio\/([^/]+)\/([^/]+)$/.exec(caminho)
    if (audio) {
      // sem "..": pedir /audio/../../ seria pedir o disco inteiro
      const chave = audio[1].replace(/[^\w-]/g, '')
      const arq = audio[2].replace(/[^\w.\-]/g, '')
      prepararLeve(stemsDir, chave, arq)
        .then((caminhoFinal) => servirAudio(req, res, caminhoFinal))
        .catch(() => { res.writeHead(500); res.end('nao consegui preparar o audio') })
      return
    }

    res.writeHead(404); res.end('nao achei')
  })

  // ESPERAR O SERVIDOR SUBIR ANTES DE DAR O ENDEREÇO.
  // "listen" é assíncrono: pedindo porta 0, quem escolhe o número é o sistema,
  // e ele só existe quando o servidor está de pé. Eu li antes e devolvi "não
  // consegui achar rede" — com a rede ali, funcionando. Erro que só aparece
  // rodando: no papel a função estava linda.
  return new Promise((resolve) => {
    servidor.on('error', () => { servidor = null; resolve({ ligado: false, enderecos: [] }) })
    // 0.0.0.0: precisa aceitar de FORA da máquina, senão o celular não alcança
    servidor.listen(0, '0.0.0.0', () => {
      porta = servidor.address().port
      resolve(infoCelular())
    })
  })
}

export function desligarCelular() {
  if (servidor) { try { servidor.close() } catch {} }
  servidor = null
  senha = null
  porta = 0
  return infoCelular()
}

export function infoCelular() {
  if (!servidor || !porta) return { ligado: false, enderecos: [] }
  return {
    ligado: true,
    porta,
    enderecos: enderecosDaCasa().map(({ nome, ip }) => ({
      nome,
      url: `http://${ip}:${porta}/?s=${senha}`
    }))
  }
}
