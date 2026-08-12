// CONFERE AS QUINAS — rodar com: npm run confere:quinas
//
// A quina cortada e assinatura da casa, e o contorno dela ja se abriu duas
// vezes. A segunda fui eu: subi a linha da diagonal pro :root achando que
// estava tirando duplicata, e apaguei a cor dela na tela inteira — inclusive
// na barra do acervo, que estava certa. O motivo: var() dentro de custom
// property e resolvido ONDE ELA E DECLARADA, nao onde e usada. No :root nao
// existe --fio, entao a cor do fallback ja nascia colada no valor.
//
// Esse tipo de erro nao aparece em lint nem em build: o CSS e valido, o app
// sobe, e a unica coisa errada e um pedacinho de linha na cor errada. So
// aparece MEDINDO. Este script carrega o styles.css de verdade num Electron
// invisivel (separado do app do dono) e le o backgroundImage computado de cada
// peca chanfrada: se a diagonal existe e se ela esta na cor do estado.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
app.disableHardwareAcceleration()
const path = require('path')
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'src', 'styles.css'), 'utf8')

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 900, height: 700 })
  const html = `<style>${css}</style>
    <div class="painel" id="p1">painel normal</div>
    <div class="painel parou" id="p2">painel parado</div>
    <div class="painel pouco" id="p3">painel apertado</div>
    <div class="freio-caixa" id="f1"><input id="inp"></div>
    <button class="livro-quadro" id="q1">hist</button>
    <div class="baixar-poco" id="b1"></div>
    <div class="mandamento" id="m1">m</div>
    <button class="conserto-abrir" id="ca"><b>A minha conta não bate?</b></button>
    <section class="share-app" id="sa">compartilhar</section>
    <button class="share-tile" id="st">tile</button>
    <button class="preset-chip chanfro" id="c1">chip</button>
    <button class="preset-chip chanfro active" id="c2">chip aceso</button>`
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

  const bruto = await w.webContents.executeJavaScript(`(() => {
    const g = (id) => getComputedStyle(document.getElementById(id)).backgroundImage
    const antes = g('f1')
    document.getElementById('inp').focus()
    return { p1: g('p1'), p2: g('p2'), p3: g('p3'), q1: g('q1'), b1: g('b1'),
             m1: g('m1'), ca: g('ca'), sa: g('sa'), st: g('st'), c1: g('c1'), c2: g('c2'), fSolto: antes, fFoco: g('f1') }
  })()`)

  // a primeira cor do degrade e o "transparent", que o Chromium computa como
  // rgba(0, 0, 0, 0) — a cor do fio e a proxima
  const corDoFio = (g) => {
    const todas = g.match(/rgba?\([^)]*\)/g) || []
    return todas.find((c) => c.replace(/\s/g, '') !== 'rgba(0,0,0,0)') || 'so transparente'
  }
  const camadas = (g) => (g.match(/gradient/g) || []).length

  const casos = [
    ['painel normal', 'p1', 'rgba(255,255,255'],
    ['painel PAROU (vermelho)', 'p2', 'rgba(248,113,113'],
    ['painel POUCO (ambar)', 'p3', 'rgba(234,179,8'],
    ['campo US$ solto', 'fSolto', 'rgba(255,255,255'],
    ['campo US$ EM FOCO (lima)', 'fFoco', 'rgba(182,255,59'],
    ['quadro historico', 'q1', 'rgba(255,255,255'],
    ['campo de link (BAIXAR)', 'b1', 'rgba(255,255,255'],
    ['mandamento', 'm1', 'rgba(182,255,59'],
    ['porta da correcao', 'ca', 'rgba(234,179,8'],
    ['bloco compartilhar', 'sa', 'rgba(255,255,255'],
    ['tile de compartilhar', 'st', 'rgba(255,255,255'],
    ['-- chip apagado (acervo)', 'c1', 'rgba(255,255,255'],
    ['-- chip ACESO (acervo)', 'c2', 'rgb(182,255,59']
  ]
  let tudo = true
  console.log('A DIAGONAL DA QUINA — DESENHADA E NA COR CERTA?\n')
  for (const [nome, id, esperado] of casos) {
    const g = bruto[id]
    const cor = corDoFio(g)
    const bate = camadas(g) >= 2 && cor.replace(/\s/g, '').startsWith(esperado.replace(/\s/g, ''))
    if (!bate) tudo = false
    console.log((bate ? 'ok   ' : 'ERRO ') + nome.padEnd(26) + String(camadas(g)).padStart(2) + ' camadas | ' + cor)
  }
  if (!tudo) {
    console.log('\n--- valor cru de quem falhou ---')
    for (const [nome, id, esperado] of casos) {
      const g = bruto[id]
      if (camadas(g) >= 2 && corDoFio(g).replace(/\s/g, '').startsWith(esperado.replace(/\s/g, ''))) continue
      console.log(nome + ':\n  ' + g.slice(0, 220) + '\n')
    }
  }
  app.exit(tudo ? 0 : 1)
})
