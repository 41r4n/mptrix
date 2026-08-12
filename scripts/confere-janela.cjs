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

const historico = (n, alturaTela) => `<style>${comTela(alturaTela)}</style>
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
    <button class="conserto-abrir"><span class="conserto-sinal">!</span>
      <b>A minha conta não bate com o Replicate?</b>
      <span class="conserto-abrir-cta">corrigir o saldo</span></button>
    <div class="modal-actions"><button class="btn-danger">Apagar dados…</button>
      <span class="modal-espaco"></span><button class="btn-secondary">Fechar</button></div>
  </div>
</div></div></div>`

const conserto = (n, alturaTela) => `<style>${comTela(alturaTela)}</style>
<div style="height:${alturaTela}px;overflow:hidden">
<div class="modal-overlay overlay-cima"><div class="modal modal-conserto">
  <header class="modal-header"><div><span class="modal-etiqueta">correção</span>
    <h3>A minha conta não bate com o Replicate</h3>
    <p class="modal-sub">O número certo é o <strong>deles</strong>. Aqui você me diz qual é,
    e eu recomeço a contar a partir dele.</p></div><button class="btn-close">×</button></header>
  <div class="modal-body conserto">
    <p class="conserto-txt">O MPTRIX não consegue ler o seu saldo — a conta deles não entrega
    esse número. Ele <strong>estima</strong> o que gastou pelo preço da máquina de cada
    trabalho, e estima <strong>pra mais</strong> de propósito, pra frear antes e não deixar
    você furar o crédito. Só que erro pra mais se acumula: um dia eu digo que acabou e ainda
    tem dinheiro lá.</p>
    <ol class="conserto-passos">
      <li><span>1</span><div>Abra a página do crédito <button class="conserto-ir">abrir no navegador</button></div></li>
      <li><span>2</span><div>Procure <em>Crédito restante</em> — é o que sobrou de verdade</div></li>
      <li><span>3</span><div>Digite esse número aqui embaixo</div></li>
    </ol>
    <div class="conserto-linha"><div class="freio-caixa conserto-caixa"><em>US$</em>
      <input class="freio-num" value="7,31"></div></div>
    <p class="conserto-efeito ligado"><span>Isto <strong>fecha a conta atual</strong>: o gasto de
    <strong>US$ 3,40</strong> volta a zero e eu recomeço a contar a partir de
    <strong>US$ 7,31</strong>. Os registros continuam guardados — só param de contar.</span></p>
    <div class="modal-actions"><button class="conserto-ok">corrigir para US$ 7,31</button>
      <span class="modal-espaco"></span><button class="btn-secondary">Cancelar</button></div>
  </div>
</div></div></div>`

const MEDE = `(() => {
  const palco = document.querySelector('.modal-overlay').getBoundingClientRect()
  const m = document.querySelector('.modal').getBoundingClientRect()
  const f = document.querySelector('.modal-actions .btn-secondary').getBoundingClientRect()
  const l = document.querySelector('.livro-lista')
  const li = document.querySelector('.livro-lista li')
  return {
    janela: Math.round(m.height),
    temLista: !!l,
    sobraEmBaixo: Math.round(palco.bottom - f.bottom),
    sobraEmCima: Math.round(m.top - palco.top),
    lista: l ? Math.round(l.getBoundingClientRect().height) : 0,
    alturaLinha: li ? Math.round(li.getBoundingClientRect().height + 4) : 1
  }
})()`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1440, height: 760 })
  const arq = path.join(os.tmpdir(), 'mptrix-prova-janela.html')
  const telas = [1080, 900, 768, 640]
  let tudo = true
  console.log('AS JANELAS DO CREDITO CABEM NA TELA? (200 registros no livro)')
  console.log()
  for (const [nome, monta, pisoDeLinhas] of [
    ['historico ', historico, 3],
    ['correcao  ', conserto, 0]
  ]) {
    for (const h of telas) {
      fs.writeFileSync(arq, monta(200, h), 'utf8')
      await win.loadFile(arq)
      const r = await win.webContents.executeJavaScript(MEDE)
      const linhas = Math.floor(r.lista / r.alturaLinha)
      // a janela cabe? e, se ela tem lista, a lista ainda serve pra alguma coisa?
      const cabe = r.janela <= h - 48 && (!r.temLista || linhas >= pisoDeLinhas)
      if (!cabe) tudo = false
      console.log('  ' + (cabe ? 'ok   ' : 'ERRO ') + nome +
        ' | tela ' + String(h).padStart(4) +
        ' | janela ' + String(r.janela).padStart(4) + 'px' +
        ' | teto ' + String(h - 48).padStart(4) + 'px' +
        (r.temLista ? ' | lista mostra ' + String(linhas).padStart(2) + ' linhas' : ''))
    }
    console.log()
  }
  app.exit(tudo ? 0 : 1)
})
