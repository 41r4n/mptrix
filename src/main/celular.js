import { createServer } from 'http'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join, isAbsolute, basename } from 'path'
import { spawn } from 'child_process'
import { Buffer } from 'buffer'
import { createHash, randomBytes } from 'crypto'
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
// nome diferente do parâmetro de propósito: com o mesmo nome, o parâmetro
// tapa a variável e a atribuição vira "guardarPorta = guardarPorta", que não
// guarda nada e não reclama
let salvarPorta = null
let mandarBaixar = null
let espiar = null
let iconePng = null
let apkDoCelular = null
let pastaFontes = null
let paginaProvas = null
const ultimosPedidos = []

// ██████████ AS TAREFAS ██████████
// O celular manda baixar e vai embora — quem trabalha é o computador, e o
// trabalho continua mesmo se o telefone travar, bloquear a tela ou perder o
// Wi-Fi por um minuto. Por isso o andamento mora AQUI, e o celular só pergunta
// "como está?". Se ele guardasse o próprio andamento, uma tela bloqueada
// perderia o download.
const tarefas = new Map()

function novaTarefa(url, preset) {
  const id = randomBytes(4).toString('hex')
  tarefas.set(id, { id, url, preset, estado: 'começando', porcento: 0, titulo: null, erro: null, quando: Date.now() })
  return id
}

function mexerTarefa(id, mudanca) {
  const t = tarefas.get(id)
  if (t) tarefas.set(id, { ...t, ...mudanca })
}

// as terminadas somem depois de um tempo: a lista é do que está ACONTECENDO,
// e uma lista que só cresce deixa de ser lida
function limparTarefasVelhas() {
  const agora = Date.now()
  for (const [id, t] of tarefas) {
    if ((t.estado === 'pronto' || t.estado === 'erro') && agora - (t.terminou || t.quando) > 90000) tarefas.delete(id)
  }
}

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

    // ██████ AS MESMAS REGRAS DO ESTÚDIO DO COMPUTADOR ██████
    // Ler a pasta e mostrar tudo que está lá dentro parecia inofensivo, e não
    // é: o computador esconde faixas por três motivos, e cada um deles vira um
    // defeito diferente se o celular ignorar.
    //
    //   present: false        faixa muda. Na Girlfriend o órgão está em -72 dB
    //                         e o PC não mostra; o celular mostrava um "Órgão"
    //                         que não faz som nenhum.
    //   dentroDeOutros        o som dela JÁ FOI SOMADO ao "Outros". Tocar as
    //                         duas toca o mesmo instrumento DOBRADO, mais alto
    //                         e ligeiramente fora de fase. É o pior dos três, e
    //                         é inaudível como defeito: soa só "esquisito".
    //   _orig                 cópia de antes do tratamento, serve ao motor.
    const info = m.stemInfo || {}
    const escondida = (id) => info[id]?.present === false || info[id]?.dentroDeOutros
    const faixas = readdirSync(base)
      .filter((f) => /\.(flac|wav|mp3|m4a)$/i.test(f))
      .filter((f) => !/_orig\./i.test(f))
      .filter((f) => !/^song\./i.test(f))
      .filter((f) => !escondida(f.replace(/\.[^.]+$/, '')))
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
      // A LETRA, A CIFRA E AS BATIDAS JÁ ESTAVAM AQUI. O computador descobriu
      // tudo isso quando separou a música, e eu simplesmente não mandava pro
      // celular — o telefone tinha o som e nada do que rodeia o som, que é
      // metade do motivo de alguém abrir isto num ensaio.
      cifra: m.chords?.list || null,
      letra: m.lyrics?.segments || null,
      batidas: m.analysis?.ticks || null,
      // grade = o pulso constante que descreve a gravação. Só existe quando um
      // pulso constante REALMENTE serve; sem ela, metrônomo firme se separa da
      // música e a tela precisa avisar.
      grade: m.analysis?.grade || null,
      capa: capaDe(m.sourceFile, stemsDir),
      onda: ondaDaMusica(dir),
      faixas
    })
  }
  return itens.sort((a, b) => a.titulo.localeCompare(b.titulo))
}

function acervoCompleto(stemsDir, historico) {
  const separadas = lerAcervo(stemsDir)
  const nomes = new Set(separadas.map((m) => m.titulo))
  const inteiras = lerBaixadas(historico, nomes, stemsDir)
  // A MAIS NOVA PRIMEIRO. Em ordem alfabética, a música que a pessoa acabou de
  // baixar cai no meio de doze e parece que não chegou — foi exatamente o que
  // aconteceu com o dono: ele baixou, procurou no topo, e concluiu que falhou.
  // O que acabou de acontecer é o que ela está procurando.
  return separadas.concat(inteiras)
}

// ── A ONDA DA MÚSICA ──
// O computador já desenhou a onda de cada faixa quando separou — 800 pontos
// por faixa, 2000 pra música inteira. Ela estava parada no disco.
//
// No cartão ela NÃO É TEXTURA: é o formato daquela música. Dá pra ver de
// relance onde tem refrão, onde entra a banda toda, se começa devagar. Enfeite
// que imita informação é o que a casa não faz — mas isto é informação de
// verdade, e por acaso é bonita.
//
// Vai reduzida a 56 pontos: no tamanho de um cartão de celular, mais que isso
// vira borrão. Menos é mais legível, não mais pobre.
function ondaDaMusica(dir) {
  try {
    const song = join(dir, 'peaks3_song.json')
    let bruta = null
    if (existsSync(song)) {
      bruta = JSON.parse(readFileSync(song, 'utf8'))
    } else {
      // sem a onda da música inteira, o maior de cada faixa em cada ponto
      // desenha a mesma silhueta: onde qualquer instrumento toca alto, a
      // música está alta.
      const arquivos = readdirSync(dir).filter((f) => /^peaks2_.*\.json$/.test(f))
      for (const f of arquivos) {
        const p = JSON.parse(readFileSync(join(dir, f), 'utf8'))
        if (!Array.isArray(p)) continue
        if (!bruta) bruta = p.slice()
        else for (let i = 0; i < bruta.length && i < p.length; i++) bruta[i] = Math.max(bruta[i], p[i])
      }
    }
    if (!Array.isArray(bruta) || !bruta.length) return null

    const N = 56
    const passo = bruta.length / N
    const fora = []
    for (let i = 0; i < N; i++) {
      let m = 0
      for (let k = Math.floor(i * passo); k < Math.floor((i + 1) * passo); k++) {
        if (bruta[k] > m) m = bruta[k]
      }
      fora.push(Math.round(m * 100) / 100)
    }
    return fora
  } catch { return null }
}

// ── A ONDA DE QUEM NUNCA FOI SEPARADO ──
//
// A onda só existia para música separada: o computador desenha ela durante a
// separação. Resultado — das catorze músicas do dono, duas tinham onda e doze
// não, e a mudança quase não apareceu na tela.
//
// Aqui ela é desenhada do próprio arquivo, com o ffmpeg: o áudio vira PCM cru,
// mono e baixinho (4 kHz basta — a silhueta de uma música não fica melhor com
// mais resolução), e daí saem os 56 pontos.
const PONTOS_DA_ONDA = 56

function ondaDeArquivo(arquivo, guardarEm) {
  return new Promise((resolve) => {
    if (!ffmpeg || !existsSync(ffmpeg) || !existsSync(arquivo)) { resolve(null); return }
    const p = spawn(ffmpeg, [
      '-v', 'quiet', '-i', arquivo,
      '-ac', '1', '-ar', '4000', '-f', 's16le', '-'
    ], { windowsHide: true })

    const pedacos = []
    p.stdout.on('data', (d) => pedacos.push(d))
    p.on('error', () => resolve(null))
    p.on('close', () => {
      try {
        const b = Buffer.concat(pedacos)
        const amostras = Math.floor(b.length / 2)
        if (amostras < PONTOS_DA_ONDA) { resolve(null); return }
        const passo = Math.floor(amostras / PONTOS_DA_ONDA)
        const onda = []
        for (let i = 0; i < PONTOS_DA_ONDA; i++) {
          let maior = 0
          for (let k = i * passo; k < (i + 1) * passo; k++) {
            const v = Math.abs(b.readInt16LE(k * 2))
            if (v > maior) maior = v
          }
          onda.push(Math.round(maior / 32768 * 100) / 100)
        }
        try {
          mkdirSync(guardarEm.replace(/[\\/][^\\/]+$/, ''), { recursive: true })
          writeFileSync(guardarEm, JSON.stringify(onda))
        } catch {}
        resolve(onda)
      } catch { resolve(null) }
    })
  })
}

// UMA DE CADA VEZ, EM SEGUNDO PLANO. Na primeira olhada as ondas ainda não
// existem: o dono vê a lista na hora e as ondas aparecem na próxima. Melhor
// lista rápida sem onda do que tela parada esperando doze conversões — e doze
// ffmpeg ao mesmo tempo travariam a máquina de quem está usando o app.
const filaDeOndas = []
let desenhandoOnda = false

function pedirOnda(arquivo, guardarEm) {
  if (existsSync(guardarEm)) return
  if (filaDeOndas.some((x) => x.guardarEm === guardarEm)) return
  filaDeOndas.push({ arquivo, guardarEm })
  tocarFilaDeOndas()
}

function tocarFilaDeOndas() {
  if (desenhandoOnda || !filaDeOndas.length) return
  desenhandoOnda = true
  const t = filaDeOndas.shift()
  ondaDeArquivo(t.arquivo, t.guardarEm).then(() => {
    desenhandoOnda = false
    tocarFilaDeOndas()
  })
}

function ondaGuardada(caminho) {
  try { return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : null } catch { return null }
}

// ── A CAPA ──
// O computador já baixou e guardou as capas de todas as músicas. A chave é
// calculada do arquivo (caminho, tamanho, data) — a MESMA conta do app, senão
// a capa existiria e nunca seria encontrada. Duas contas pra mesma chave é o
// erro que eu já cometi com os nomes e com as regras; aqui a conta é uma só,
// copiada linha a linha do lado que a criou.
const CAPA_V = 2
function capaDe(arquivo, stemsDir) {
  try {
    if (!arquivo || !existsSync(arquivo)) return null
    const st = statSync(arquivo)
    const chave = createHash('sha1')
      .update(`${arquivo}|${st.size}|${st.mtimeMs}|v${CAPA_V}`).digest('hex').slice(0, 16)
    const alvo = join(stemsDir, '_capas', 'img', `${chave}.jpg`)
    if (!existsSync(alvo) || statSync(alvo).size === 0) return null
    return `/capa/${chave}.jpg`
  } catch { return null }
}

// ── AS MÚSICAS BAIXADAS, sem separação ──
// O celular só mostrava música separada, e o dono nem sempre quer separar:
// muitas vezes ele quer só a música inteira, com o tom e o andamento à mão,
// pra tocar junto no ensaio. Sem isto, quem baixasse quatro músicas e não
// separasse abriria o celular numa lista vazia — e concluiria que o app
// quebrou, quando na verdade ele nunca ia mostrar nada.
//
// Uma faixa só, chamada "Música completa". É o estúdio rápido.
function lerBaixadas(historico, jaSeparadas, stemsDir) {
  const itens = []
  const vistos = new Set()
  // o histórico já vem do mais novo pro mais velho
  for (const h of historico || []) {
    const arq = h.primaryFile || (h.files && h.files[0])
    if (!arq) continue
    if (!/\.(mp3|m4a|wav|flac|opus|ogg|aac)$/i.test(arq)) continue
    // primaryFile JÁ É o caminho completo. Colar a pasta na frente dele dava
    // um caminho inexistente, e o resultado era uma lista vazia no celular —
    // silenciosa, porque "arquivo não existe" é motivo legítimo pra pular.
    const caminho = isAbsolute(arq) ? arq : join(h.outputDir || '', arq)
    if (!existsSync(caminho)) continue
    // a mesma música baixada duas vezes vira uma linha só
    const titulo = (h.customName || h.displayName || h.title || arq).replace(/\.[^.]+$/, '')
    if (vistos.has(caminho)) continue
    vistos.add(caminho)
    const chaveInteira = h.id || createHash('sha1').update(caminho).digest('hex').slice(0, 12)
    const ondaEm = join(stemsDir, '_inteiras', String(chaveInteira), 'onda.json')
    if (!existsSync(ondaEm)) pedirOnda(caminho, ondaEm)

    // se ela JÁ está separada, o lugar dela é entre as separadas — com todas
    // as faixas. Mostrar as duas seria a mesma música duas vezes na lista.
    if (jaSeparadas.has(titulo)) continue
    itens.push({
      // A CHAVE NUNCA PODE SER "inteira:undefined". Item velho sem id fazia
      // todos compartilharem a mesma chave — e o celular guarda o que foi
      // levado POR chave, então levar uma marcaria as outras. O caminho do
      // arquivo é único por natureza; ele serve de identidade quando o id
      // falta.
      chave: 'inteira:' + chaveInteira,
      // A ONDA TAMBÉM PRA QUEM NUNCA FOI SEPARADO. Das catorze músicas do
      // dono, só duas tinham onda — as separadas — e a mudança quase não
      // apareceu na tela. Agora o computador desenha a das outras a partir do
      // próprio arquivo, em segundo plano.
      onda: ondaGuardada(ondaEm),
      titulo,
      duracao: 0,
      tom: null,
      bpm: null,
      inteira: true,
      capa: capaDe(caminho, stemsDir),
      faixas: [{ id: 'song', arquivo: basename(caminho), bytes: statSync(caminho).size }]
    })
  }
  return itens
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

// a mesma conversão, dita uma vez: origem qualquer, destino qualquer
function prepararLeveDe(cru, pasta) {
  if (!ffmpeg || !existsSync(ffmpeg)) return Promise.resolve(cru)
  if (/\.(m4a|mp3)$/i.test(cru)) return Promise.resolve(cru)
  if (!existsSync(cru)) return Promise.resolve(cru)
  const nome = cru.split(/[\/]/).pop().replace(/\.[^.]+$/, '.m4a')
  return converter(cru, join(pasta, nome))
}

function prepararLeve(stemsDir, chave, arq) {
  const cru = join(stemsDir, chave, 'base', arq)
  if (!ffmpeg || !existsSync(ffmpeg)) return Promise.resolve(cru)
  if (/\.(m4a|mp3)$/i.test(arq)) return Promise.resolve(cru)

  const pasta = join(stemsDir, chave, PASTA_CELULAR)
  const leve = join(pasta, arq.replace(/\.[^.]+$/, '.m4a'))
  if (existsSync(leve)) return Promise.resolve(leve)
  if (!existsSync(cru)) return Promise.resolve(cru)
  if (emAndamento.has(leve)) return emAndamento.get(leve)

  return converter(cru, leve)
}

function converter(cru, leve) {
  if (existsSync(leve)) return Promise.resolve(leve)
  if (emAndamento.has(leve)) return emAndamento.get(leve)
  const pasta = leve.replace(/[\/][^\/]+$/, '')
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

// ██████████ O GUARDADOR ██████████
//
// Sem ele, o celular só toca com o computador ligado na mesma casa — e o
// ensaio é justamente onde o computador não está.
//
// "ignoreSearch" é o detalhe que faz funcionar: os endereços carregam a senha
// no fim (?s=...), e comparar o endereço inteiro faria o que foi guardado
// nunca ser encontrado de novo.
const GUARDADOR = `
const CAIXA = 'mptrix-v1';

self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;

  // A PÁGINA e a LISTA: tenta a rede, cai no guardado. Assim em casa ela vem
  // sempre fresca (música nova aparece), e fora de casa ela ainda abre.
  if (u.pathname === '/' || u.pathname === '/index.html' || u.pathname === '/api/acervo') {
    e.respondWith(
      fetch(e.request).then(function (r) {
        var copia = r.clone();
        caches.open(CAIXA).then(function (c) { c.put(u.pathname, copia); });
        return r;
      }).catch(function (e) {
        return caches.match(u.pathname).then(function (r) {
          // sem nada guardado, o erro REAL sobe pra tela. Inventar um 503 aqui
          // era trocar "recusado pelo computador" por "sem conexão" — e mandar
          // o dono procurar defeito na rede, que estava boa.
          if (r) return r;
          throw e;
        });
      })
    );
    return;
  }

  // O SOM: guardado primeiro. Se está no celular, não vai na rede nem quando
  // o computador está ligado — é mais rápido e não gasta Wi-Fi à toa.
  if (u.pathname.indexOf('/audio/') === 0) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(function (r) {
        return r || fetch(e.request);
      })
    );
  }
});

// LEVAR: a página manda a lista de faixas e o guardador baixa uma a uma,
// avisando o progresso. Uma a uma de propósito: dez pedidos juntos numa rede
// de casa fazem o roteador engasgar e o progresso mentir.
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.tipo === 'levar') {
    e.waitUntil(levar(d.chave, d.urls, e.source));
  }
  if (d.tipo === 'largar') {
    e.waitUntil(caches.open(CAIXA).then(function (c) {
      return Promise.all(d.urls.map(function (u) { return c.delete(u, { ignoreSearch: true }); }));
    }).then(function () { e.source && e.source.postMessage({ tipo: 'largou', chave: d.chave }); }));
  }
  if (d.tipo === 'quais') {
    caches.open(CAIXA).then(function (c) { return c.keys(); }).then(function (ks) {
      var chaves = {};
      ks.forEach(function (k) {
        var m = /\/audio\/([^/]+)\//.exec(new URL(k.url).pathname);
        if (m) chaves[m[1]] = true;
      });
      e.source && e.source.postMessage({ tipo: 'guardadas', chaves: Object.keys(chaves) });
    });
  }
});

function levar(chave, urls, quem) {
  return caches.open(CAIXA).then(function (c) {
    var i = 0;
    function proxima() {
      if (i >= urls.length) {
        quem && quem.postMessage({ tipo: 'levou', chave: chave });
        return Promise.resolve();
      }
      var u = urls[i++];
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error('falhou');
        return c.put(u, r);
      }).then(function () {
        quem && quem.postMessage({ tipo: 'levando', chave: chave, feito: i, total: urls.length });
        return proxima();
      }).catch(function () {
        quem && quem.postMessage({ tipo: 'falhou', chave: chave });
      });
    }
    return proxima();
  });
}
`

export function ligarCelular({ stemsDir, paginaHtml, ffmpegPath, senhaSalva, guardarSenha, historico, portaSalva, guardarPorta, baixar, icone, apk, olhar, fontes, provas }) {
  if (servidor) return infoCelular()
  // A SENHA PRECISA SER A MESMA SEMPRE. Ela viaja na URL, e o que o celular
  // guardou pra tocar offline fica preso ao endereço — mudar a senha a cada
  // abertura transformaria a música guardada em lixo inalcançável na hora do
  // ensaio, que é exatamente a hora em que não dá pra consertar.
  senha = senhaSalva || novaSenha()
  if (!senhaSalva && guardarSenha) guardarSenha(senha)
  ffmpeg = ffmpegPath
  salvarPorta = guardarPorta
  mandarBaixar = baixar
  espiar = olhar
  iconePng = icone
  apkDoCelular = apk
  pastaFontes = fontes
  paginaProvas = provas

  servidor = createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    // O REGISTRO DE QUEM BATEU NA PORTA. Sem isto, "não consegui falar com o
    // computador" é a única informação que existe — e ela é justamente a que
    // não diz nada. Com isto, dá pra ver do lado de cá se o pedido chegou.
    res.on('finish', () => {
      ultimosPedidos.unshift({
        quando: new Date().toISOString().slice(11, 19),
        de: (req.socket.remoteAddress || '').replace('::ffff:', ''),
        caminho: url.pathname + (url.searchParams.get('s') ? ' (com senha)' : ' (SEM SENHA)'),
        resposta: res.statusCode
      })
      ultimosPedidos.length = Math.min(ultimosPedidos.length, 40)
    })
    const caminho = decodeURIComponent(url.pathname)

    // a senha viaja na própria URL: o celular abre um endereço e pronto,
    // sem tela de login pra alguém digitar no escuro
    const autorizado = url.searchParams.get('s') === senha ||
      (req.headers.cookie || '').includes(`mptrix=${senha}`)

    // O GUARDADOR NÃO EXIGE SENHA: ele é código, não dado — não entrega música
    // nem lista de ninguém. Exigindo, o navegador falha ao instalar e não conta
    // pra ninguém que falhou; a página fica sem o modo ensaio e ninguém sabe.
    if (caminho === '/sw.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(GUARDADOR)
      return
    }

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

    // ██████████ VIRAR APP NA TELA DO CELULAR ██████████
    // Sem loja: o Android deixa qualquer página virar ícone na tela inicial,
    // desde que ela diga como quer ser. É o que este arquivo faz — nome,
    // ícone, cor e "abre em tela cheia, sem barra de navegador".
    // Isso não resolve baixar sem o computador (navegador é proibido de falar
    // com o YouTube), mas resolve o resto: ele deixa de parecer um site aberto
    // e passa a ser um app com ícone, que abre sozinho e funciona offline no
    // que foi levado.
    if (caminho === '/app.webmanifest') {
      res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8' })
      res.end(JSON.stringify({
        name: 'MPTRIX',
        short_name: 'MPTRIX',
        description: 'Seu estúdio de ensaio',
        // com a senha dentro do start_url, abrir pelo ícone já entra logado
        start_url: `/?s=${senha}`,
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0c0f',
        theme_color: '#0b0c0f',
        icons: [
          { src: '/icone.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icone.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }))
      return
    }

    // ██████████ O PRÓPRIO APP, PRA INSTALAR ██████████
    // O celular já está falando com o computador — é ele quem deve entregar o
    // app, não o dono ter que passar arquivo por WhatsApp ou cabo. Um toque na
    // tela do celular e o Android começa a instalação.
    if (caminho === '/app.apk') {
      if (!apkDoCelular || !existsSync(apkDoCelular)) { res.writeHead(404); res.end('ainda nao existe app pra instalar'); return }
      const tam = statSync(apkDoCelular).size
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': tam,
        'Content-Disposition': 'attachment; filename="MPTRIX.apk"'
      })
      createReadStream(apkDoCelular).pipe(res)
      return
    }

    if (caminho === '/api/tem-app') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        tem: !!(apkDoCelular && existsSync(apkDoCelular)),
        mb: apkDoCelular && existsSync(apkDoCelular) ? Math.round(statSync(apkDoCelular).size / 1048576 * 10) / 10 : 0
      }))
      return
    }

    // ██████████ AS FONTES DA CASA ██████████
    // O celular estava com a fonte genérica do sistema, e isso sozinho fazia a
    // tela parecer outro programa. Space Grotesk e IBM Plex Mono já vivem no
    // projeto, auto-hospedadas — o app é offline e nunca puxa fonte de fora.
    // São 248 KB no total, servidos da rede de casa: o custo é nenhum e o
    // ganho é o app inteiro parecer o mesmo dos dois lados.
    const fonte = /^\/fonts\/([\w.-]+)$/.exec(caminho)
    if (fonte) {
      const arq = join(pastaFontes || '', fonte[1])
      if (!pastaFontes || !existsSync(arq)) { res.writeHead(404); res.end(); return }
      res.writeHead(200, {
        'Content-Type': fonte[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'font/woff2',
        'Cache-Control': 'max-age=2592000'
      })
      createReadStream(arq).pipe(res)
      return
    }

    if (caminho === '/icone.png') {
      if (!iconePng || !existsSync(iconePng)) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=604800' })
      createReadStream(iconePng).pipe(res)
      return
    }

    const capa = /^\/capa\/([\w-]+\.jpg)$/.exec(caminho)
    if (capa) {
      const arq = join(stemsDir, '_capas', 'img', capa[1])
      if (!existsSync(arq)) { res.writeHead(404); res.end(); return }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=604800' })
      createReadStream(arq).pipe(res)
      return
    }

    // ── OLHAR ANTES DE BAIXAR ──
    // Colar um link e apertar "baixar" é um salto no escuro: a pessoa não sabe
    // se é a música certa, se é o clipe, se é a versão ao vivo. Ver a capa, o
    // nome e a duração antes custa alguns segundos e evita baixar errado — e
    // baixar errado custa muito mais que esperar.
    if (caminho === '/api/olhar') {
      const alvo = url.searchParams.get('url')
      if (!alvo || !espiar) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ erro: 'faltou o endereço' }))
        return
      }
      espiar(alvo)
        .then((info) => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify(info))
        })
        .catch((e) => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ erro: String(e && e.message ? e.message : e).slice(0, 160) }))
        })
      return
    }

    // ── MANDAR BAIXAR ──
    // O celular não baixa: ele PEDE. O programa que fala com o YouTube é de
    // computador, e o computador está ligado na mesma casa.
    if (caminho === '/api/baixar' && req.method === 'POST') {
      let corpo = ''
      req.on('data', (c) => { corpo += c; if (corpo.length > 4000) req.destroy() })
      req.on('end', () => {
        let d = {}
        try { d = JSON.parse(corpo || '{}') } catch {}
        if (!d.url || !mandarBaixar) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ erro: 'faltou o endereço da música' }))
          return
        }
        const id = novaTarefa(d.url, d.preset || 'music')
        mandarBaixar({
          url: d.url,
          presetId: d.preset || 'music',
          onProgress: (p) => mexerTarefa(id, { estado: 'baixando', porcento: Math.round(p.percent || 0), titulo: p.title || null }),
          onStatus: (st) => {
            if (st.state === 'done') mexerTarefa(id, { estado: 'pronto', porcento: 100, terminou: Date.now(), titulo: st.title || null })
            else if (st.state === 'error') mexerTarefa(id, { estado: 'erro', erro: st.message || 'não deu', terminou: Date.now() })
            else mexerTarefa(id, { estado: st.state === 'converting' ? 'convertendo' : 'baixando' })
          }
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ id }))
      })
      return
    }

    if (caminho === '/api/tarefas') {
      limparTarefasVelhas()
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify([...tarefas.values()].sort((a, b) => b.quando - a.quando)))
      return
    }

    // ██████████ AS PROVAS ██████████
    // Em vez de o dono garimpar referência em site de design, ele olha as
    // opções na tela do próprio celular, com as músicas dele, e aponta. Foi
    // assim que tudo funcionou hoje: ele não precisa saber explicar por que
    // gostou — precisa ver.
    if (caminho === '/provas') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(paginaProvas ? paginaProvas(acervoCompleto(stemsDir, historico ? historico() : [])) : '<p>sem provas</p>')
      return
    }

    if (caminho === '/api/acervo') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(acervoCompleto(stemsDir, historico ? historico() : [])))
      return
    }

    const audio = /^\/audio\/([^/]+)\/([^/]+)$/.exec(caminho)
    if (audio) {
      // sem "..": pedir /audio/../../ seria pedir o disco inteiro
      const chave = audio[1].replace(/[^\w:-]/g, '')
      const arq = audio[2].replace(/[^\w.\-]/g, '')
      // música inteira: o arquivo mora na pasta de downloads, não no acervo
      // separado. O caminho vem do PRÓPRIO registro, nunca do que o celular
      // mandou — senão bastaria pedir um nome de arquivo pra ler o disco.
      if (chave.startsWith('inteira')) {
        const id = caminho.split('/')[2].replace('inteira:', '')
        const lista = historico ? historico() : []
        const h = lista.find((x) => String(x.id) === id) ||
          lista.find((x) => {
            const f = x.primaryFile || (x.files && x.files[0])
            if (!f) return false
            const cheio = isAbsolute(f) ? f : join(x.outputDir || '', f)
            return createHash('sha1').update(cheio).digest('hex').slice(0, 12) === id
          })
        const nome = h && (h.primaryFile || (h.files && h.files[0]))
        if (!h || !nome) { res.writeHead(404); res.end('nao achei'); return }
        const cheio = isAbsolute(nome) ? nome : join(h.outputDir || '', nome)
        prepararLeveDe(cheio, join(stemsDir, '_inteiras', String(h.id)))
          .then((f) => servirAudio(req, res, f))
          .catch(() => { res.writeHead(500); res.end('nao consegui preparar o audio') })
        return
      }
      prepararLeve(stemsDir, chave, arq)
        .then((caminhoFinal) => servirAudio(req, res, caminhoFinal))
        .catch(() => { res.writeHead(500); res.end('nao consegui preparar o audio') })
      return
    }

    res.writeHead(404); res.end('nao achei')
  })

  // ██████████ A PORTA TAMBÉM PRECISA SER SEMPRE A MESMA ██████████
  //
  // Eu deixei a senha fixa e esqueci a porta — e a porta é metade do endereço.
  // O dono digitou 63482 no celular, reiniciou o app, virou 56971, e o
  // telefone não achou mais nada. Pior: o que ele tinha levado pro ensaio fica
  // guardado POR ENDEREÇO, então porta nova jogaria fora tudo que ele baixou,
  // silenciosamente, na hora de sair de casa.
  //
  // Meia solução é o mesmo que nenhuma, quando a outra metade quebra igual.
  //
  // Se a porta preferida estiver ocupada, tenta as seguintes. Só no fim aceita
  // qualquer uma — melhor um endereço estranho do que app que não abre.
  const preferida = Number(portaSalva) || 8788
  const tentativas = [preferida, preferida + 1, preferida + 2, preferida + 3, 0]

  return new Promise((resolve) => {
    let i = 0
    const tentar = () => {
      servidor.listen(tentativas[i], '0.0.0.0')
    }
    servidor.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && i < tentativas.length - 1) {
        i++
        setImmediate(tentar)
        return
      }
      servidor = null
      resolve({ ligado: false, enderecos: [] })
    })
    // 0.0.0.0: precisa aceitar de FORA da máquina, senão o celular não alcança
    servidor.on('listening', () => {
      porta = servidor.address().port
      if (salvarPorta) salvarPorta(porta)
      resolve(infoCelular())
    })
    tentar()
  })
}

export function desligarCelular() {
  if (servidor) { try { servidor.close() } catch {} }
  servidor = null
  senha = null
  porta = 0
  return infoCelular()
}

export function pedidosRecentes() { return ultimosPedidos }

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
