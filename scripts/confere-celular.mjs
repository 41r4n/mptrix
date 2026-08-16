// CONFERE O ESTUDIO NO CELULAR — rodar com: npm run confere:celular
//
// Sobe o servidor de verdade, com o acervo de verdade, e faz o que o celular
// faria: pede a lista, pede um pedaco de audio, e tenta entrar sem a senha.
// Assim o dono nao precisa descobrir no celular que nao funciona.
import { mkdtempSync, copyFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath, pathToFileURL } from 'url'

const aqui = dirname(fileURLToPath(import.meta.url))
// mesma manha do confere:motor — .js em projeto sem "type": "module" e lido
// como CommonJS e o import nomeado falha
const copia = join(mkdtempSync(join(tmpdir(), 'mptrix-cel-')), 'celular.mjs')
copyFileSync(join(aqui, '..', 'src', 'main', 'celular.js'), copia)
const { ligarCelular, desligarCelular } = await import(pathToFileURL(copia).href)

const stemsDir = join(process.env.LOCALAPPDATA || '', 'MPTRIX', 'stems')
const ffmpegPath = join(aqui, '..', 'resources', 'bin', 'ffmpeg.exe')
const info = await ligarCelular({ stemsDir, paginaHtml: () => '<!doctype html><title>ok</title>pagina', ffmpegPath, senhaSalva: 'testefixo', guardarSenha: () => {}, portaSalva: 8790, guardarPorta: () => {} })

const casos = []
const caso = (nome, ok, extra) => { casos.push([nome, ok, extra]) }

if (!info.ligado || !info.enderecos.length) {
  console.log('ERRO nao consegui subir o servidor nem achar rede')
  process.exit(1)
}
const base = info.enderecos[0].url.replace(/\/\?s=.*/, '')
// lida como o navegador le, e nao "tudo depois do s=": o endereco carrega
// tambem a versao da tela (&v=...), e cortar na mao pegaria as duas juntas
const senha = new URL(info.enderecos[0].url).searchParams.get('s')

console.log('SERVIDOR DO CELULAR\n')
console.log('  endereco(s) que o celular usaria:')
for (const e of info.enderecos) console.log('    ' + e.nome.padEnd(16) + e.url)
console.log('')

// 1. sem senha, nao entra
const semSenha = await fetch(base + '/api/acervo')
caso('sem a senha na URL, recusa', semSenha.status === 403, 'HTTP ' + semSenha.status)

// 2. com senha, devolve o acervo
const r = await fetch(base + '/api/acervo?s=' + senha)
const acervo = r.ok ? await r.json() : []
caso('com a senha, devolve o acervo', r.ok && Array.isArray(acervo), acervo.length + ' musicas')

// 3. as musicas tem o que a tela precisa
const m = acervo[0]
caso('cada musica traz titulo, duracao e faixas',
  !!m && !!m.titulo && m.duracao > 0 && m.faixas.length > 0,
  m ? `"${m.titulo.slice(0, 28)}" · ${m.faixas.length} faixas · ${Math.round(m.duracao)}s` : 'acervo vazio')

// 4. as copias "_orig" ficaram de fora (tocariam a mesma coisa duas vezes)
caso('as faixas _orig ficaram de fora',
  !!m && !m.faixas.some((f) => /_orig/.test(f.id)),
  m ? m.faixas.map((f) => f.id).join(', ') : '')

// 5. o audio responde por PEDACO — e o que faz a barra de tempo andar no celular
if (m) {
  const f = m.faixas[0]
  const a = await fetch(base + '/audio/' + m.chave + '/' + encodeURIComponent(f.arquivo) + '?s=' + senha,
    { headers: { Range: 'bytes=0-99999' } })
  const buf = a.ok ? await a.arrayBuffer() : new ArrayBuffer(0)
  caso('o audio responde por pedaco (arrastar a barra)',
    a.status === 206 && buf.byteLength === 100000,
    'HTTP ' + a.status + ' · ' + buf.byteLength + ' bytes · ' + (a.headers.get('content-type') || ''))
}

// AS MESMAS FAIXAS QUE O PC MOSTRA. O computador esconde faixa muda e faixa
// que ja foi somada ao "Outros" — a segunda, tocada em separado, faz o mesmo
// instrumento soar dobrado e ligeiramente fora de fase.
if (m) {
  const meta = JSON.parse((await import('fs')).readFileSync(join(stemsDir, m.chave, 'meta.json'), 'utf8'))
  const info = meta.stemInfo || {}
  const deviaEsconder = Object.keys(info).filter((id) => info[id].present === false || info[id].dentroDeOutros)
  const mostradas = m.faixas.map((f) => f.id)
  const vazou = deviaEsconder.filter((id) => mostradas.includes(id))
  caso('nao mostra faixa que o PC esconde', vazou.length === 0,
    deviaEsconder.length ? 'escondidas: ' + deviaEsconder.join(', ') : 'nao ha nenhuma pra esconder')
}

// 5b. O CELULAR RECEBE O ARQUIVO LEVE, nao o cru. Medido no aparelho do dono:
// com FLAC de 40 MB por faixa, o telefone tocava so parte delas e escolhia
// quais pelo criterio dele — sumia justo a voz.
if (m) {
  const f = m.faixas[0]
  const u = base + '/audio/' + m.chave + '/' + encodeURIComponent(f.arquivo) + '?s=' + senha
  const cheio = await fetch(u)               // primeira vez: converte (leva alguns segundos)
  const bytes = (await cheio.arrayBuffer()).byteLength
  const encolheu = f.bytes / bytes
  caso('a faixa vai comprimida pro celular',
    cheio.headers.get('content-type') === 'audio/mp4' && encolheu > 4,
    Math.round(f.bytes / 1048576) + ' MB -> ' + (bytes / 1048576).toFixed(1) + ' MB (' + Math.round(encolheu) + 'x menor)')

  const t0 = Date.now()
  await fetch(u)                              // segunda vez: ja guardado
  caso('na segunda vez ja esta pronta (nao converte de novo)',
    Date.now() - t0 < 2000, (Date.now() - t0) + ' ms')
}

// O GUARDADOR — e ele que faz o celular tocar na igreja, sem o computador
const sw = await fetch(base + '/sw.js?s=' + senha)
const swTxt = sw.ok ? await sw.text() : ''
caso('o guardador e servido da raiz', sw.ok && sw.headers.get('content-type').includes('javascript'), 'HTTP ' + sw.status)
caso('ele guarda o som e responde sem rede',
  swTxt.includes("caches.match") && swTxt.includes('ignoreSearch'),
  'ignoreSearch: a senha na URL nao pode atrapalhar o reencontro')

// O ENDERECO INTEIRO E SEMPRE O MESMO. A senha era metade; a porta e a outra.
// O dono digitou uma porta, reiniciou o app, e o telefone nao achou mais nada.
caso('a porta pedida e respeitada', info.porta === 8790, 'porta = ' + info.porta)

// A SENHA E SEMPRE A MESMA: o que foi levado esta preso ao endereco
caso('a senha guardada e reusada', senha === 'testefixo', 'senha = ' + senha)

// 6. nao da pra pedir arquivo de fora da pasta
const fuga = await fetch(base + '/audio/..%2f..%2f..%2f/windows?s=' + senha)
caso('nao serve arquivo de fora do acervo', fuga.status === 404, 'HTTP ' + fuga.status)

desligarCelular()

console.log('')
let tudo = true
for (const [nome, ok, extra] of casos) {
  if (!ok) tudo = false
  console.log((ok ? 'ok   ' : 'ERRO ') + nome.padEnd(44) + (extra || ''))
}
process.exit(tudo ? 0 : 1)
