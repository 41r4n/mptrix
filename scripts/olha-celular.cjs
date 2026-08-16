// ── OLHAR A TELA DO CELULAR SEM O CELULAR ──
//
//   npm run olha:celular [caminho-da-foto.png]
//
// Abre a pagina do celular DE VERDADE (celular/www/index.html), com o acervo
// falso no lugar do computador, no tamanho de um aparelho comum, e tira foto.
//
// Nasceu de um estrago: eu vinha conferindo o cartao numa maquete solta, e na
// maquete o desenho parecia certo. No aparelho o nome da musica estava POR
// BAIXO da capa e a trama de fundo tinha comido a busca e os filtros — duas
// coisas que so aparecem quando a tela inteira esta montada junto.
// Maquete de peca solta responde "a peca esta bonita?". Ela nao responde "da
// pra usar?" — e essa e a unica pergunta que importa.
const { app, BrowserWindow, session } = require('electron')
app.commandLine.appendSwitch('use-angle', 'swiftshader')
app.disableHardwareAcceleration()
const { writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

const raiz = join(__dirname, '..')
const tmp = join(app.getPath('temp'), 'mptrix-olhatela')
mkdirSync(tmp, { recursive: true })

// capas falsas em disco, pra poder redirecionar /capa/* pra ca
const CAPAS = [
  ['#1d3b2a', '#4ecb8c'], ['#3b2a1d', '#e8a55a'], ['#2a1d3b', '#8f7ad9'],
  ['#3b1d2a', '#e85a7a'], ['#1d2a3b', '#5a9de8'],
]
CAPAS.forEach(([a, b], i) => {
  writeFileSync(join(tmp, `capa${i}.svg`),
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
      <rect width='300' height='300' fill='${a}'/>
      <circle cx='150' cy='130' r='78' fill='${b}'/>
      <rect x='0' y='230' width='300' height='70' fill='${b}' opacity='.75'/>
    </svg>`)
})

const TITULOS = [
  '\u273bNSYNC - Girlfriend (Official HD Video)',
  'Djavan - Azul (Ao Vivo) (\u00c1udio Oficial)',
  'L\u00e9a Mendon\u00e7a  /  \u00c9 Tempo (Ao Vivo) #MKNETWORK',
  'Nada Me Separa Desse Amor',
  'Um Novo Dia  /  Get Worship (Clipe Oficial)',
]
const acervo = TITULOS.map((titulo, i) => ({
  chave: 'm' + i,
  titulo,
  duracao: 210 + i * 13,
  tom: [ 'Cm', 'F', null, null, 'G' ][i],
  bpm: [ 94, 120, null, null, 132 ][i],
  capa: '/capa/fake' + (i % CAPAS.length) + '.jpg',
  cor: ['#3f5a4a', '#5a4a3f', '#4a3f5a', '#5a3f4a', '#3f4a5a'][i],
  inteira: i === 2 || i === 3,
  faixas: (i === 2 || i === 3)
    ? [{ id: 'song', arquivo: 'song.m4a' }]
    : [ 'vocals', 'drums', 'bass', 'guitar', 'piano' ].map((id) => ({ id, arquivo: id + '.m4a' })),
}))

const RESPOSTAS = {
  '/api/acervo': acervo,
  '/api/tarefas': { tarefas: [] },
  '/api/tem-app': { tem: false },
}

app.whenReady().then(async () => {
  const ses = session.defaultSession
  ses.webRequest.onBeforeRequest((det, cb) => {
    const u = det.url
    const m = u.match(/\/capa\/fake(\d)/)
    if (m) return cb({ redirectURL: 'file:///' + join(tmp, `capa${m[1]}.svg`).replace(/\\/g, '/') })
    cb({})
  })

  const pre = join(tmp, 'pre.js')
  writeFileSync(pre, `
const R = ${JSON.stringify(RESPOSTAS)}
window.fetch = (u) => {
  const cam = String(u).split('?')[0].replace(/^https?:\\/\\/[^/]+/, '')
  const corpo = R[cam] || {}
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(corpo), text: () => Promise.resolve('') })
}
`)

  const w = new BrowserWindow({
    width: 456, height: 1000, show: false,
    webPreferences: { preload: pre, contextIsolation: false, nodeIntegration: false },
  })
  await w.loadFile(join(raiz, 'celular', 'www', 'index.html'))
  await new Promise((r) => setTimeout(r, 2600))
  const destino = process.argv[2] || join(tmp, 'tela.png')
  writeFileSync(destino, (await w.webContents.capturePage()).toPNG())
  console.log('foto da tela do celular: ' + destino)
  app.quit()
})
