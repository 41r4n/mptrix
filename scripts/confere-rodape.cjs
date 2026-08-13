// CONFERE O RODAPE — rodar com: npm run confere:rodape
//
// A linha de atualizacao ja apareceu DUAS vezes por cima do pe do trilho, e as
// duas vezes eu "consertei" no olho e errei. A tela e uma grade de duas colunas
// (trilho | conteudo); o rodape tem que ficar na coluna do conteudo, sem
// encostar no trilho.
//
// Aqui a grade e montada com o CSS de verdade e as caixas sao MEDIDAS: se a
// borda esquerda do rodape entrar na faixa do trilho, e sobreposicao.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
app.disableHardwareAcceleration()
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'src', 'styles.css'), 'utf8')

const html = `<style>${css}</style>
<div class="app">
  <nav class="trilho">
    <div class="trilho-marca"><span class="trilho-nome">MPTRIX</span></div>
    <div class="trilho-itens"></div>
    <div class="trilho-pe">
      <div><span class="pe-rot">DESTINO</span><b>teste 1</b></div>
      <div><span class="pe-rot">NUVEM</span><b>LIGADA</b></div>
    </div>
  </nav>
  <main class="palco"><div class="palco-in"><h1 class="palco-titulo">conteudo</h1></div></main>
  <footer class="version-footer">
    <div class="appup fase-em-dia">
      <span class="appup-luz"></span>
      <span class="appup-versao">MPTRIX <b>0.4.0</b></span>
      <span class="appup-txt">esta na versao mais nova</span>
      <span class="appup-espaco"></span>
      <button class="appup-link">verificar de novo</button>
    </div>
    <div class="version-info"><span class="version-pill">yt-dlp <code>2026.08.04</code></span></div>
    <div class="version-actions"><button class="link-btn">verificar atualizacoes</button></div>
  </footer>
</div>`

const MEDE = `(() => {
  const cx = (s) => { const e = document.querySelector(s); if (!e) return null
    const r = e.getBoundingClientRect(); return { esq: Math.round(r.left), dir: Math.round(r.right), topo: Math.round(r.top), base: Math.round(r.bottom) } }
  return { trilho: cx('.trilho'), rodape: cx('.version-footer'), linha: cx('.appup'),
           pe: cx('.trilho-pe'), largura: innerWidth }
})()`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 800 })
  const arq = path.join(os.tmpdir(), 'mptrix-rodape.html')
  fs.writeFileSync(arq, html, 'utf8')
  await win.loadFile(arq)
  const r = await win.webContents.executeJavaScript(MEDE)

  console.log('ONDE CADA COISA ESTA (em pixels da esquerda)\n')
  for (const [nome, c] of [['trilho', r.trilho], ['rodape', r.rodape], ['linha de atualizacao', r.linha]]) {
    if (!c) { console.log('  ' + nome + ': NAO ENCONTRADO'); continue }
    console.log('  ' + nome.padEnd(22) + 'de ' + String(c.esq).padStart(4) + ' a ' + String(c.dir).padStart(4) +
      '   |   altura ' + String(c.topo).padStart(4) + ' a ' + String(c.base).padStart(4))
  }

  const testes = []
  // sobrepoe em X? (o rodape comeca dentro da faixa do trilho)
  testes.push([r.rodape.esq >= r.trilho.dir - 1,
    'o rodape comeca depois do trilho (' + r.rodape.esq + ' >= ' + r.trilho.dir + ')'])
  testes.push([r.linha.esq >= r.trilho.dir - 1,
    'a linha de atualizacao tambem (' + r.linha.esq + ' >= ' + r.trilho.dir + ')'])
  // a linha ocupa a largura toda do rodape?
  testes.push([Math.abs(r.linha.dir - r.rodape.dir) < 60,
    'a linha ocupa a largura do rodape, nao uma coluna espremida'])
  // a linha esta ACIMA das pastilhas?
  testes.push([r.linha.base <= r.rodape.base,
    'a linha esta dentro do rodape'])

  console.log('')
  let tudo = true
  for (const [ok, txt] of testes) { if (!ok) tudo = false; console.log((ok ? 'ok   ' : 'ERRO ') + txt) }
  app.exit(tudo ? 0 : 1)
})
