// CONFERE A JANELA DO HISTORICO — rodar com: npm run confere:janela
//
// A JANELA DO HISTORICO CABE NA TELA? Com a gaveta da correcao aberta e com
// muita linha, ela pode crescer alem do monitor e levar o "Fechar" junto — que
// e exatamente o defeito que o dono ja apontou uma vez.
//
// O vh e trocado por px no proprio CSS: a pergunta e "com a tela valendo X, a
// janela cabe?", e trocar a unidade responde isso direto. Redimensionar a
// BrowserWindow nao serve (o Windows nao deixa passar do monitor, entao todo
// tamanho pedido vinha grudado em ~779px) e a emulacao de dispositivo travou o
// processo.
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
app.disableHardwareAcceleration()
const cssOriginal = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'src', 'styles.css'), 'utf8')

const comTela = (altura) =>
  cssOriginal.replace(/([\d.]+)vh/g, (_, n) => (parseFloat(n) / 100 * altura).toFixed(1) + 'px')

const linha = (i) => '<li class="uso"><span class="livro-toque"><span class="livro-marca"></span></span>' +
  '<span class="livro-quando">12/08 16:3' + (i % 10) + '</span>' +
  '<span class="livro-txt"><b>separou</b> · US$ 0,05</span></li>'

const html = (aberto, n, alturaTela) => `<style>${comTela(alturaTela)}</style>
<div style="height:${alturaTela}px;overflow:hidden">
<div class="modal-overlay"><div class="modal modal-livro">
  <header class="modal-header"><div>
    <span class="modal-etiqueta">crédito</span><h3>O que já aconteceu</h3>
    <p class="modal-sub">Cada entrada de crédito e cada uso, com hora e valores.
    <strong>O saldo sai daqui</strong> — apagar uma linha refaz a conta sem ela.
    A linha vermelha é o uso que encostou no limite: ela some junto se você apagar aquele uso.</p>
  </div><button class="btn-close">×</button></header>
  <div class="modal-body">
    <div class="livro-conta-linha"><span class="livro-total"><b>${n}</b> registros</span>
      <span class="modal-espaco"></span>
      <button class="livro-mini">marcar todos</button><button class="livro-mini">desmarcar</button></div>
    <ul class="livro-lista">${Array.from({ length: n }, (_, i) => linha(i)).join('')}</ul>
    <details class="conserto" ${aberto ? 'open' : ''}>
      <summary class="conserto-cab"><span class="conserto-sinal">!</span>
        <b>A minha conta não bate com o Replicate?</b><span class="conserto-seta"></span></summary>
      <p class="conserto-txt">O MPTRIX não consegue ler o seu saldo — a conta deles não entrega
      esse número. Ele <strong>estima</strong> o que gastou pelo preço da máquina de cada
      trabalho, e estima <strong>pra mais</strong> de propósito, pra frear antes e não deixar
      você furar o crédito. Só que erro pra mais se acumula: um dia eu digo que acabou e ainda
      tem dinheiro lá. Quando isso acontecer, o número certo é o deles — e este é o lugar de
      me dizer qual é.</p>
      <ol class="conserto-passos">
        <li><span>1</span><div>Abra a página do crédito <button class="conserto-ir">abrir no navegador</button></div></li>
        <li><span>2</span><div>Procure <em>Crédito restante</em> — é o que sobrou de verdade</div></li>
        <li><span>3</span><div>Digite esse número aqui embaixo</div></li>
      </ol>
      <div class="conserto-linha">
        <div class="freio-caixa conserto-caixa"><em>US$</em><input class="freio-num" value="7,31"></div>
        <button class="conserto-ok">corrigir para US$ 7,31</button>
      </div>
      <p class="conserto-efeito ligado"><span>Isto <strong>fecha a conta atual</strong>: o gasto de
      <strong>US$ 3,40</strong> volta a zero e eu recomeço a contar a partir de
      <strong>US$ 7,31</strong>. Os registros de cima continuam guardados — só param de contar.</span></p>
    </details>
    <div class="modal-actions"><button class="btn-danger">Apagar dados…</button>
      <span class="modal-espaco"></span><button class="btn-secondary">Fechar</button></div>
  </div>
</div></div></div>`

const MEDE = `(() => {
  const palco = document.querySelector('.modal-overlay').getBoundingClientRect()
  const m = document.querySelector('.modal-livro').getBoundingClientRect()
  const f = document.querySelector('.modal-actions .btn-secondary').getBoundingClientRect()
  const l = document.querySelector('.livro-lista')
  const li = document.querySelector('.livro-lista li')
  return {
    janela: Math.round(m.height),
    sobraEmBaixo: Math.round(palco.bottom - f.bottom),
    sobraEmCima: Math.round(m.top - palco.top),
    lista: Math.round(l.getBoundingClientRect().height),
    alturaLinha: Math.round(li.getBoundingClientRect().height + 4)
  }
})()`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 760 })
  const arq = path.join(os.tmpdir(), 'mptrix-prova-janela.html')
  const telas = [1080, 900, 768, 640]
  const casos = [['gaveta fechada', false], ['gaveta ABERTA ', true]]
  let tudo = true
  console.log('A JANELA DO HISTORICO CABE NA TELA? (200 registros no livro)\n')
  for (const [nome, aberto] of casos) {
    for (const h of telas) {
      fs.writeFileSync(arq, html(aberto, 200, h), 'utf8')
      await win.loadFile(arq)
      const alturaTela = h
      const linhasVisiveis = (x) => Math.floor(x.lista / x.alturaLinha)
      const r = await win.webContents.executeJavaScript(MEDE)
      // O CRITERIO ESTAVA ERRADO. Eu comparava com o rodape do .modal-overlay,
      // que e position:fixed — ele mede a janela REAL do teste (760px), nao a
      // tela simulada. Dava "ERRO" em caso que passava. O que importa e se a
      // janela cabe na altura simulada, e se a lista continua servindo pra
      // alguma coisa.
      const cabe = r.janela <= alturaTela - 48 && linhasVisiveis(r) >= 3
      if (!cabe) tudo = false
      const linhas = linhasVisiveis(r)
      console.log('  ' + (cabe ? 'ok   ' : 'ERRO ') + nome +
        ' | tela ' + String(h).padStart(4) +
        ' | janela ' + String(r.janela).padStart(4) + 'px' +
        ' | teto ' + String(alturaTela - 48).padStart(4) + 'px' +
        ' | lista mostra ' + String(linhas).padStart(2) + ' linhas')
    }
    console.log()
  }
  app.exit(tudo ? 0 : 1)
})
