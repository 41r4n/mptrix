// ── OLHAR A MESA DA EMENDA SEM O APP INTEIRO ──
//
//   npm run olha:mesa [caminho-da-foto.png]
//
// Abre o renderer DE VERDADE (o que foi construído), com um acervo falso no
// lugar do computador, vai até a aba EMENDAR, põe três músicas na mesa e tira
// foto.
//
// Existe por um vício meu nesta sessão: eu construía a tela, o build passava
// sem erro, e eu entregava dizendo que estava pronto — sem nunca ter visto.
// Três vezes o dono foi quem descobriu que não estava. Build limpo prova que o
// JavaScript é válido; não prova que existe alguma coisa na tela.
const { app, BrowserWindow, protocol } = require('electron')
app.commandLine.appendSwitch('use-angle', 'swiftshader')
app.disableHardwareAcceleration()

// ── AS PORTAS DE SOM TÊM QUE EXISTIR AQUI TAMBÉM ──
//
// O app registra `acervo:` e `stems:` antes de ficar pronto; a maquete não
// registrava nenhuma das duas. Resultado: cada <audio> pedia som por um esquema
// que o Chromium não conhece, e o pedido ficava PENDURADO — não falhava, não
// voltava. Depois de um play, uma dúzia de cargas presas atrás, e a tela travava
// num passo qualquer lá na frente, sem nenhuma relação aparente com som. Foi
// exatamente esse o mistério que custou meia dúzia de rodadas.
//
// Aqui elas devolvem 404 na hora: o pedido MORRE em vez de ficar preso, que é
// tudo o que a maquete precisa. (Servir um wav mudo de verdade deixaria dar pra
// testar som um dia; hoje nenhum teste ouve nada, então não vale o peso.)
protocol.registerSchemesAsPrivileged([
  { scheme: 'stems', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'acervo', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])
const { writeFileSync } = require('fs')
const { join } = require('path')

const raiz = join(__dirname, '..')
const destino = process.argv[2] || join(app.getPath('temp'), 'mptrix-mesa.png')

// O DUBLÊ DO PRELOAD.
//
// A tela pede dezenas de coisas ao processo principal, e a mesa usa cinco. Em
// vez de escrever as dezenas, um Proxy responde qualquer caminho: função
// desconhecida devolve promessa vazia, o que basta pro app montar. Só o que a
// mesa realmente lê é escrito à mão embaixo.
const DUBLE = `
const CAMINHOS = [
  'C:/acervo/reine-em-mim.mp3',
  'C:/acervo/oceano.mp3',
  'C:/acervo/samurai.mp3',
  'C:/acervo/girlfriend.mp3',
  'C:/acervo/nada-alem-do-sangue.mp3'
]
const NOMES = ['Reine em Mim', 'Oceano', 'Samurai', 'Girlfriend', 'Nada Além do Sangue']
const TONS = ['G', 'Am', 'D', 'C', 'E']
const BPMS = [78, 92, 124, 146, 68]
const DURS = [231, 288, 197, 254, 312]

const historico = CAMINHOS.map((f, i) => ({
  id: 'h' + i, title: NOMES[i], displayName: NOMES[i],
  primaryFile: f, files: [f], createdAt: Date.now() - i * 86400000
}))

// onda falsa com FORMA: refrões mais altos, respiros no meio. Onda plana faria
// a mesa parecer certa mesmo se o recorte estivesse errado.
function ondaFalsa(semente, n) {
  const o = []
  let x = semente * 7919
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648
    const r = x / 2147483648
    const t = i / n
    const corpo = 0.35 + 0.45 * Math.abs(Math.sin(t * Math.PI * 3.1 + semente))
    const respiro = t > 0.42 && t < 0.5 ? 0.25 : 1
    o.push(Math.min(1, corpo * respiro * (0.65 + r * 0.6)))
  }
  return o
}

// O QUE A TELA PEDE ANTES DE EXISTIR. O app inteiro nasce de getEnvironment:
// dali sai a pasta de downloads, o acervo e a checagem dos binarios. Sem uma
// resposta com a forma certa, a tela morre na primeira linha e nao chega perto
// da mesa -- foi o que aconteceu nas duas primeiras tentativas.
const alvo = {
  getEnvironment: async () => ({
    settings: { downloadDir: 'C:/acervo' },
    history: historico,
    binariesPresent: { ytDlp: true, ffmpeg: true },
    presets: [],
    version: 'maquete'
  }),
  history: {
    list: async () => historico,
    capa: async () => null
  },
  emenda: {
    onda: async ({ path }) => {
      // A PASSAGEM DE UM VAO nao esta no acervo: ela nasceu agora e e curta. A
      // duracao vai escrita no nome de mentira justamente pra esta volta poder
      // devolver a duracao CERTA -- devolvendo a de uma musica, a peca sairia
      // desenhada com o tamanho errado e o teste mediria a coisa errada.
      if (path.indexOf('_vaos') >= 0) {
        const d = Number(path.split('-').pop().split('.wav')[0]) || 2
        return { onda: ondaFalsa(9, 400), duracao: d }
      }
      const i = Math.max(0, CAMINHOS.indexOf(path))
      return { onda: ondaFalsa(i + 1, 1400), duracao: DURS[i] }
    },
    // o motor de verdade chama o ffmpeg; aqui so devolve a forma da resposta.
    // O motor tem prova separada (prova-vao) que mede o som que sai.
    vao: async ({ tipo, dur, cliques }) => ({
      ok: true,
      tipo,
      arquivo: 'C:/stems/_vaos/wav/' + tipo + '-' + Number(dur).toFixed(2) + '.wav',
      nome: tipo + '-' + Number(dur).toFixed(2) + '.wav',
      duracao: dur,
      cliques: (cliques || []).length
    }),
    analiseDe: async ({ path }) => {
      const i = Math.max(0, CAMINHOS.indexOf(path))
      // BATIDAS DE MENTIRA COM FORMA DE VERDADE: um pulso constante no BPM da
      // musica, do zero ao fim. Sem elas nao da pra provar o encaixe.
      const passo = 60 / BPMS[i]
      const batidas = []
      for (let t = 0; t < DURS[i]; t += passo) batidas.push(Math.round(t * 1000) / 1000)
      return { tom: TONS[i], bpm: BPMS[i], batidas }
    },
    fazer: async () => ({ erro: 'maquete: não exporta' }),
    onProgresso: () => () => {}
  }
}

// DUAS COISAS DIFERENTES, QUE EU VINHA CONFUNDINDO NUMA SO.
//
// Um proxy unico pra tudo brigou com o app quatro vezes seguidas: ora derrubava
// a tela (null.settings), ora travava o React (objeto novo a cada volta), ora
// vazava pra dentro de Math.round e de JSX. O erro era achar que "campo que nao
// existe" e "resposta de funcao que nao existe" sao a mesma coisa.
//
// A PORTA e caminho: qualquer campo dela e outra porta, entao
// mptrix.ui.zoomGet existe mesmo sem ninguem ter escrito. Chamar uma porta da
// um ECO.
//
// O ECO e resposta: promessa que resolve em nada, e tambem funcao (as
// assinaturas devolvem um off() que o React chama na saida). Fora de then,
// catch e finally, ele devolve UNDEFINED -- e essa e a parte que importa: assim
// ele nunca vira um objeto estranho no meio de uma conta ou de um JSX.
let ECO
ECO = new Proxy(function () {}, {
  get: (_t, k) => {
    if (k === 'then') return (ok) => { if (typeof ok === 'function') ok(undefined); return ECO }
    if (k === 'catch' || k === 'finally') return () => ECO
    return undefined
  },
  apply: () => ECO
})
let PORTA
PORTA = new Proxy(function () {}, { get: () => PORTA, apply: () => ECO })
const vazio = () => PORTA
const envolver = (obj) => new Proxy(obj, {
  get: (t, k) => (k in t ? t[k] : vazio())
})
for (const k of Object.keys(alvo)) alvo[k] = envolver(alvo[k])
window.mptrix = envolver(alvo)
window.api = window.mptrix
window.electron = envolver({})

// o erro sem pilha nao diz QUEM pediu: com a pilha, uma linha resolve
// a Guarda pega o erro antes da janela ver, entao a pilha so aparece se a
// gente abrir o proprio console.error e ler o que passou por ele
const eOriginal = console.error
console.error = (...a) => eOriginal(...a.map((x) => (x instanceof Error ? 'PILHA: ' + x.stack : x)))
window.addEventListener('error', (e) => console.error('PILHA: ' + (e.error && e.error.stack)))
window.addEventListener('unhandledrejection', (e) =>
  console.error('PILHA: ' + (e.reason && e.reason.stack)))
`

// Se a tela travar, a maquete conta o que viu e sai. Sem isto ela fica
// pendurada esperando um executeJavaScript que nunca volta — e já ficou.
setTimeout(() => {
  console.log('\n✘ a maquete travou — a tela não respondeu em 60s')
  app.exit(1)
}, 60000).unref?.()

app.whenReady().then(async () => {
  // as duas portas respondem na hora que nao ha nada — o que importa e o pedido
  // TERMINAR, nao trazer som (veja o comentario do registro, la em cima)
  for (const porta of ['acervo', 'stems']) {
    protocol.handle(porta, async () => new Response('maquete: sem som', { status: 404 }))
  }
  const preload = join(app.getPath('temp'), 'mptrix-duble-preload.cjs')
  writeFileSync(preload, DUBLE)

  const w = new BrowserWindow({
    width: 1440, height: 900, show: false,
    webPreferences: { preload, sandbox: false, contextIsolation: false }
  })
  const censura = []
  w.webContents.on('console-message', (_e, nivel, msg) => {
    // "Refused to load" e o jeito do navegador recusar CALADO: nada estoura,
    // o som simplesmente nao vem. Foi assim que o `acervo:` ficou fora do CSP
    // e "ouvir a emenda" nunca tocou. A maquete nao deixa passar de novo.
    if (/Refused to (load|connect)/i.test(msg)) censura.push(msg.split(' because')[0])
    if (nivel >= 2) console.log('[tela] ' + msg)
  })
  w.webContents.on('did-fail-load', (_e, cod, desc, url) =>
    console.log('[falhou] ' + cod + ' ' + desc + ' ' + url))
  // SE O RENDERER MORRE, executeJavaScript nunca volta — e o sintoma e
  // identico ao de uma tela travada num laco. Sao coisas MUITO diferentes de
  // consertar, entao a maquete precisa saber dizer qual das duas aconteceu.
  w.webContents.on('render-process-gone', (_e, d) =>
    console.log('[o renderer MORREU] ' + JSON.stringify(d)))
  w.on('unresponsive', () => console.log('[a janela parou de responder]'))
  const alvo = process.env.MESA_URL || 'file://' + join(raiz, 'out/renderer/index.html')
  await w.loadURL(alvo)
  await new Promise((r) => setTimeout(r, 1800))

  // ── caminho de gente: clicar na aba, clicar no "+", marcar três, confirmar ──
  // UM PASSO QUE ESTOURA NAO PODE MORRER CALADO. Quando o javascript joga (um
  // querySelector que voltou null, por exemplo), a promessa e REJEITADA e o
  // roteiro simplesmente para no meio: a unica pista que sobrava era "a maquete
  // travou -- a tela nao respondeu em 60s", que nao diz onde nem por que. Ja
  // custou duas rodadas inteiras so pra descobrir QUAL linha morreu.
  const passo = async (js) => {
    try {
      return await w.webContents.executeJavaScript(js)
    } catch (e) {
      console.log('')
      console.log('✘ ESTE PASSO ESTOUROU: ' + String((e && e.message) || e))
      console.log('   rodando: ' + String(js).slice(0, 200))
      throw e
    }
  }

  // A JANELA E INVISIVEL (show: false), e nesse modo o quadro que ela entrega
  // atrasa em relacao ao DOM: pedi a foto logo depois de mudar de tela e vieram
  // duas fotos da tela ANTERIOR, que e o pior tipo de prova — parece evidencia
  // e mostra outra coisa. Esperar duas pinturas de verdade resolve.
  // ESPERAR A PINTURA, MAS COM LIMITE. Numa janela invisivel e sem nada
  // animando, o Chromium PARA de chamar requestAnimationFrame — e a promessa
  // que espera por ele nunca volta. A rodada inteira ficava pendurada num
  // pedido de foto. O setTimeout ao lado garante que a espera termina.
  // E A FOTO TAMBEM PODE NAO VIR. `capturePage` numa janela invisivel as vezes
  // simplesmente NAO VOLTA — o compositor dorme e a promessa fica pendurada. Ja
  // pus limite na espera da pintura (comentario acima) e faltava por no retrato
  // em si: a rodada inteira morria esperando uma foto.
  //
  // Foto e PROVA, nao e o teste. Sem ela eu perco a evidencia; com a rodada
  // pendurada eu perco tudo.
  // ── AS FOTOS PASSARAM A SER OPCIONAIS ──
  //
  //   FOTOS=1 npm run olha:mesa
  //
  // Sao doze retratos por rodada, cada um um capturePage numa janela INVISIVEL
  // com swiftshader — e e ai que a maquete vinha engasgando: quanto mais o
  // roteiro crescia, mais cedo ela travava, e o passo que morria mudava de lugar
  // a cada rodada (fechar um estudio, clicar num lixo, tirar a foto). Sintoma de
  // recurso se esgotando, nao de defeito num passo.
  //
  // O fiscal existe pra COBRAR, nao pra ilustrar. As fotos ficam pra quando eu
  // precisar mostrar alguma coisa.
  const FOTOS = !!process.env.FOTOS
  const fotografar = async (caminho) => {
    if (!FOTOS) return
    await passo('new Promise((ok) => { requestAnimationFrame(() => requestAnimationFrame(ok)); setTimeout(ok, 250) })')
    await new Promise((r) => setTimeout(r, 450))
    const retrato = await Promise.race([
      w.webContents.capturePage(),
      new Promise((r) => setTimeout(() => r(null), 8000))
    ])
    if (!retrato) { console.log('[foto] nao veio a tempo: ' + caminho); return }
    writeFileSync(caminho, retrato.toPNG())
  }
  const clicar = (texto) => passo(`
    (() => {
      const alvos = [...document.querySelectorAll('button, [role=button], a')]
      const b = alvos.find((e) => (e.textContent || '').includes(${JSON.stringify(texto)}))
      if (!b) return 'NÃO ACHEI: ' + ${JSON.stringify(texto)}
      b.click(); return 'ok'
    })()`)

  // A GAVETA COMECA VAZIA. As criacoes agora sobrevivem ao fechar do app --
  // e sobreviviam tambem entre execucoes da maquete, o que fez a 2a rodada
  // achar "Medley 4" onde o teste esperava "Medley 2". O teste e que estava
  // errado: ele supunha comeco do zero sem nunca ter pedido isso.
  await passo("localStorage.removeItem('mptrix.emendas.v1')")
  await w.webContents.reload()
  await new Promise((r) => setTimeout(r, 1600))
  await clicar('EMENDAR')
  await new Promise((r) => setTimeout(r, 500))

  console.log('corpo: ' + await passo("document.body.innerHTML.length + ' bytes, raiz=' + (document.getElementById('root')?.children.length ?? 'sem root')"))
  const relato = []
  relato.push('aba EMENDAR → ' + await clicar('EMENDAR'))
  await new Promise((r) => setTimeout(r, 600))
  relato.push('botão + → ' + await clicar('Nova edição'))
  await new Promise((r) => setTimeout(r, 900))
  relato.push('marcar 3 → ' + await passo(`
    (() => {
      const cs = [...document.querySelectorAll('.esc-card')]
      if (cs.length < 3) return 'só ' + cs.length + ' no acervo falso'
      cs[0].click(); cs[1].click(); cs[2].click(); return cs.length + ' disponíveis, 3 marcadas'
    })()`))
  await new Promise((r) => setTimeout(r, 400))
  relato.push('confirmar → ' + await clicar('confirmar'))
  await new Promise((r) => setTimeout(r, 2500))

  // ── O CAMINHO DA PESSOA, do comeco ao fim ──
  const lista = () => passo(`
    (() => ({
      linhas: [...document.querySelectorAll('.jm-lista li')].map((l) => ({
        n: l.querySelector('.jm-num')?.textContent,
        nome: l.querySelector('.jm-nome')?.textContent
      })),
      titulo: document.querySelector('.ee-nome')?.value || null,
      estudioAberto: (() => {
        const o = document.querySelector('.em-estudio')
        if (!o) return false
        const e = getComputedStyle(o)
        const r = o.getBoundingClientRect()
        // TELA CHEIA DE VERDADE: fixa, por cima de tudo, cobrindo a area
        // visivel. Mede contra documentElement.clientWidth e nao contra
        // window.innerWidth: o innerWidth CONTA a barra de rolagem, e um
        // elemento fixo nao a cobre — a conta dava 9px a menos e reprovava uma
        // tela cheia que estava correta.
        const L = document.documentElement.clientWidth
        const A = document.documentElement.clientHeight
        return e.position === 'fixed' && Number(e.zIndex) >= 50 &&
          r.width >= L - 1 && r.height >= A - 1
      })(),
      medida: (() => {
        const o = document.querySelector('.em-estudio')
        if (!o) return 'sem overlay'
        const e = getComputedStyle(o)
        const r = o.getBoundingClientRect()
        return { pos: e.position, z: e.zIndex, w: Math.round(r.width), h: Math.round(r.height),
          janela: window.innerWidth + 'x' + window.innerHeight, pai: o.parentElement?.tagName }
      })(),
      voltar: !!document.querySelector('.em-estudio .topbar-icon-btn'),
      marca: !!document.querySelector('.em-estudio .brand-hex'),
      lixoNoEstudio: !!document.querySelector('.em-estudio .jm-lixo'),
      exportar: [...document.querySelectorAll('button')].find((b) => /num arquivo só/.test(b.textContent))?.textContent.trim() || null,
      editores: document.querySelectorAll('.mesa-peca, .mesa-regua, .mesa-barra, .ed-transporte').length
    }))()`)
  const criacoes = () => passo(`
    (() => ({
      itens: [...document.querySelectorAll('.jm-criacoes li')].map((l) => ({
        nome: l.querySelector('.jm-abrir b')?.textContent,
        sub: l.querySelector('.jm-abrir span')?.textContent,
        lixoVisivel: (() => {
          const b = l.querySelector('.jm-lixo')
          if (!b) return false
          const e = getComputedStyle(b)
          const r = b.getBoundingClientRect()
          return e.display !== 'none' && e.visibility !== 'hidden' &&
            parseFloat(e.opacity) > 0.9 && r.width > 30 && r.height > 30
        })()
      }))
    }))()`)

  const primeira = await lista()
  await fotografar(destino.replace('.png', '-aberta.png'))

  // ── O BOTAO DE JUNTAR NAO PODE GERAR ARQUIVO ──
  // Ele gerava: o dono apertou e viu um mp3 nascer sem ter editado nada. Agora
  // ele abre as faixas, e o arquivo so nasce no botao de gerar, la dentro.
  const antesDeJuntar = await passo("!!document.querySelector('.em-pronto')")
  await passo("[...document.querySelectorAll('button')].find((b) => /no estúdio/.test(b.textContent))?.click()")
  await new Promise((r) => setTimeout(r, 2200))
  const estado = () => passo(`
    (() => ({
      pecas: [...document.querySelectorAll('.fx-peca')].map((p) => ({
        nome: p.querySelector('.fx-tarja b')?.textContent,
        x: Math.round(p.getBoundingClientRect().left),
        y: Math.round(p.getBoundingClientRect().top),
        w: Math.round(p.getBoundingClientRect().width)
      })),
      pistas: document.querySelectorAll('.fx-pista').length,
      gerou: !!document.querySelector('.em-pronto'),
      botaoGerar: !!document.querySelector('.ee-gerar'),
      gerarDiscreto: (() => {
        const b = document.querySelector('.ee-gerar')
        if (!b) return false
        const r = b.getBoundingClientRect()
        return !!b.closest('.studio-header') && r.width < 260 && r.height < 48
      })(),
      paredeNoPe: [...document.querySelectorAll('.fx-pe .btn-primary')].length,
      agulha: (() => {
        const l = document.querySelector('.fx-agulha')
        const t = document.querySelector('.fx-tri')
        const campo = document.querySelector('.fx-campo')
        if (!l || !campo) return null
        const rl = l.getBoundingClientRect(); const rc = campo.getBoundingClientRect()
        return {
          x: Math.round(rl.left),
          // O CENTRO do triangulo, nao a borda dele. Ele e desenhado com dois
          // lados transparentes e puxado meia largura pra esquerda pra ficar
          // centrado na linha — medir a borda acusa um desalinho de 6px que
          // nao existe, e foi o que fez o teste reprovar uma coisa certa.
          triX: t ? Math.round(t.getBoundingClientRect().left + t.getBoundingClientRect().width / 2) : null,
          // tem que atravessar TODAS as faixas, de cima a baixo
          atravessa: Math.abs(rl.height - rc.height) <= 2,
          relogio: document.querySelector('.mesa-relogio b')?.textContent,
          hora: (() => {
            const h = document.querySelector('.fx-hora')
            if (!h) return null
            const r = h.getBoundingClientRect()
            const tri = document.querySelector('.fx-tri')
            const rt = tri ? tri.getBoundingClientRect() : null
            return {
              texto: h.textContent,
              // ela tem que estar ACIMA do triangulo e junto dele
              acima: rt ? Math.round(r.bottom) <= Math.round(rt.top) + 2 : null,
              desvio: rt ? Math.round((r.left + r.width / 2) - (rt.left + rt.width / 2)) : null,
              // e nunca pode vazar pra fora da regua
              vazou: r.left < document.querySelector('.fx-regua').getBoundingClientRect().left - 1
            }
          })()
        }
      })(),
      linhas: {
        celulas: [...document.querySelectorAll('.fx-linha-cel')].map((c, i) => ({
          y: Math.round(c.getBoundingClientRect().top),
          desalinho: (() => {
            const pista = document.querySelectorAll('.fx-pista')[i]
            return pista ? Math.round(c.getBoundingClientRect().top - pista.getBoundingClientRect().top) : null
          })(),
          m: c.querySelector('.fx-ms.on-m') ? 'on' : 'off',
          s: c.querySelector('.fx-ms.on-s') ? 'on' : 'off'
        })),
        caladas: [...document.querySelectorAll('.fx-peca')].map((p) => p.classList.contains('calada')),
        colunaX: (() => {
          const c = document.querySelector('.fx-linhas')
          return c ? Math.round(c.getBoundingClientRect().left) : null
        })()
      },
      menu: {
        aberto: !!document.querySelector('.fx-menu'),
        opcoes: [...document.querySelectorAll('.fx-menu button')].map((b) => b.textContent)
      },
      // A ESTRUTURA TEM QUE ENCHER A TELA. Ela vivia num terco de cima e o
      // resto era fundo morto — dois tercos de tela desperdicados.
      enchimento: (() => {
        const mesa = document.querySelector('.fx-mesa')
        const barra = document.querySelector('.fx-ferramentas')
        const rodape = document.querySelector('.fx-pe')
        const A = document.documentElement.clientHeight
        if (!mesa) return null
        const rm = mesa.getBoundingClientRect()
        const ultimo = rodape || barra
        const rr = ultimo ? ultimo.getBoundingClientRect() : null
        return {
          alturaDaTela: A,
          // as LINHAS tem que dividir a altura: uma tira fina de musica em cima
          // de um campo listrado gigante e o mesmo desperdicio de antes, so que
          // com listra
          // DE BORDA A BORDA: no separador a mesa encosta nos dois lados da
          // janela. A minha boiava num cartao com 32px de recheio de cada lado.
          margens: (() => {
            const m = document.querySelector('.fx-mesa')
            const L = document.documentElement.clientWidth
            if (!m) return null
            const r = m.getBoundingClientRect()
            return { esquerda: Math.round(r.left), direita: Math.round(L - r.right) }
          })(),
          regua: (() => {
            const r = document.querySelector('.fx-regua')
            const rot = document.querySelector('.fx-regua .ruler-label')
            const topo = document.querySelector('.fx-linhas-topo')
            if (!r) return null
            const rr = r.getBoundingClientRect()
            const rt = topo ? topo.getBoundingClientRect() : null
            // os rotulos nao podem se encostar: mede a folga entre dois vizinhos
            const rots = [...document.querySelectorAll('.fx-regua .ruler-label')]
              .map((x) => x.getBoundingClientRect()).sort((a, b) => a.left - b.left)
            let menorFolga = 999
            for (let i = 1; i < rots.length; i++) {
              menorFolga = Math.min(menorFolga, Math.round(rots[i].left - rots[i - 1].right))
            }
            return {
              altura: Math.round(rr.height),
              letra: rot ? Math.round(parseFloat(getComputedStyle(rot).fontSize)) : null,
              // a coluna da esquerda tem que ter o mesmo topo, senao desalinha
              topoBate: rt ? Math.abs(Math.round(rt.height) - Math.round(rr.height)) <= 1 : null,
              menorFolgaEntreRotulos: rots.length > 1 ? menorFolga : null
            }
          })(),
          alturaDoCampo: (() => {
            const c = document.querySelector('.fx-campo')
            return c ? Math.round(c.getBoundingClientRect().height) : null
          })(),
          alturaDaLinha: (() => {
            const p1 = document.querySelector('.fx-pista')
            return p1 ? Math.round(p1.getBoundingClientRect().height) : null
          })(),
          pistas: document.querySelectorAll('.fx-pista').length,
          alturaDaPeca: (() => {
            const p = document.querySelector('.fx-peca')
            return p ? Math.round(p.getBoundingClientRect().height) : null
          })(),
          // nada pode vazar pela direita: o painel de duracao saiu da tela
          // quando a mesa passou a esticar o pai em vez de rolar dentro dele
          vazouPelaDireita: (() => {
            const L = document.documentElement.clientWidth
            const alvos = [...document.querySelectorAll('.fx-topo, .fx-hud, .fx-ferramentas, .fx-mesa')]
            return alvos.filter((x) => Math.round(x.getBoundingClientRect().right) > L + 1)
              .map((x) => x.className + ':' + Math.round(x.getBoundingClientRect().right) + '>' + L)
          })(),
          mesaDoTopoAoFim: Math.round(rm.bottom - rm.top),
          // o que sobra embaixo de tudo: quanto menor, melhor
          sobra: rr ? Math.round(A - rr.bottom) : null,
          // e a ultima pista precisa ir ate o fim da mesa
          ultimaPistaAteOFim: (() => {
            const ps = document.querySelectorAll('.fx-pista')
            const u = ps[ps.length - 1]
            const campo = document.querySelector('.fx-campo')
            if (!u || !campo) return null
            return Math.round(campo.getBoundingClientRect().bottom - u.getBoundingClientRect().bottom)
          })()
        }
      })(),
      recortes: [...document.querySelectorAll('.fx-peca')].map((p) => ({
        nome: p.querySelector('.fx-tarja b')?.textContent,
        x: Math.round(p.getBoundingClientRect().left),
        w: Math.round(p.getBoundingClientRect().width)
      })),
      alcas: document.querySelectorAll('.fx-alca').length,
      loop: {
        botao: !!document.querySelector('.fx-loop'),
        ligado: document.querySelector('.fx-loop')?.classList.contains('on') || false,
        barra: (() => {
          const b = document.querySelector('.fx-trecho-barra')
          if (!b) return null
          const r = b.getBoundingClientRect()
          return { x: Math.round(r.left), w: Math.round(r.width) }
        })(),
        tinta: !!document.querySelector('.fx-trecho')
      },
      ferramentas: {
        play: !!document.querySelector('.fx-ferramentas .ed-tp-play'),
        semAlvo: !!document.querySelector('.fx-semalvo'),
        controles: [...document.querySelectorAll('.fx-ctrl')].map((l) => l.textContent.replace(/\s+/g, ' ').trim())
      }
    }))()`)

  const nasFaixas = await estado()
  await fotografar(destino.replace('.png', '-faixas.png'))

  // ── A MECANICA DO ARRASTO ──
  // Pega a 2a peca em um ponto QUALQUER dela (nao no meio) e leva pra tres
  // lugares: por cima da 1a, longe, e numa pista de baixo. Cada um dos tres foi
  // pedido com todas as letras.
  const arrastar = (indice, dx, dy, alt) => passo(
    '(() => {' +
    ' const p = document.querySelectorAll(".fx-peca")[' + indice + '];' +
    ' if (!p) return "sem peca";' +
    ' const r = p.getBoundingClientRect();' +
    // PEGA PERTO DA BORDA ESQUERDA, nao no centro: e assim que se descobre se a
    // peca salta pra centralizar no cursor (o defeito que o comentario do
    // componente chama de "a peca nao pula")
    ' const x = r.left + 14, y = r.top + r.height / 2;' +
    ' const ev = (t, cx, cy, alvo) => alvo.dispatchEvent(new PointerEvent(t, {' +
    '   clientX: cx, clientY: cy, bubbles: true, cancelable: true, pointerId: 5, button: 0, altKey: ' + (alt ? 'true' : 'false') + ' }));' +
    ' ev("pointerdown", x, y, p);' +
    ' ev("pointermove", x + (' + dx + ') / 2, y + (' + dy + ') / 2, window);' +
    ' ev("pointermove", x + (' + dx + '), y + (' + dy + '), window);' +
    ' ev("pointerup", x + (' + dx + '), y + (' + dy + '), window);' +
    ' return "arrastei";' +
    '})()')

  // ── AS FERRAMENTAS ──
  // Sem faixa escolhida, so o play. Com faixa escolhida, os quatro controles.
  // E mexer no BPM tem que virar velocidade: sao a mesma coisa dita em duas
  // linguas, e se nao virarem a tela mente sobre o que o botao faz.
  const semEscolha = await estado()
  await passo("document.querySelectorAll('.fx-peca')[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11, button: 0 }))")
  await passo("window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11 }))")
  await new Promise((r) => setTimeout(r, 400))
  const comEscolha = await estado()
  const largura0 = await passo("Math.round(document.querySelectorAll('.fx-peca')[1].getBoundingClientRect().width)")
  await passo(`
    (() => {
      const i = document.querySelector('.fx-bpm input');
      if (!i) return 'sem bpm';
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(i, String(Math.round(Number(i.value) / 2)));
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return 'mexi';
    })()`)
  await new Promise((r) => setTimeout(r, 400))
  const depoisDoBpm = await estado()
  const largura1 = await passo("Math.round(document.querySelectorAll('.fx-peca')[1].getBoundingClientRect().width)")
  console.log('')
  console.log('── as ferramentas ──')
  console.log('sem faixa escolhida: ' + JSON.stringify(semEscolha.ferramentas))
  console.log('com faixa escolhida: ' + JSON.stringify(comEscolha.ferramentas.controles))
  console.log('bpm pela metade → largura da peca: ' + largura0 + 'px → ' + largura1 + 'px')

  // ── A LINHA QUE ATRAVESSA ──
  // Ela tem que existir parada, ir aonde a pessoa clicar na regua, atravessar
  // todas as faixas e levar o triangulo junto.
  const paradaEm0 = await estado()
  await passo(`
    (() => {
      const r = document.querySelector('.fx-regua').getBoundingClientRect()
      document.querySelector('.fx-regua').dispatchEvent(new PointerEvent('pointerdown', {
        clientX: r.left + r.width * 0.4, clientY: r.top + 14, bubbles: true, pointerId: 21 }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 21 }))
    })()`)
  await new Promise((r) => setTimeout(r, 400))
  const depoisDoClique = await estado()
  await fotografar(destino.replace('.png', '-agulha.png'))
  console.log('')
  console.log('── a linha ──')
  console.log('parada:        ' + JSON.stringify(paradaEm0.agulha))
  console.log('clique na regua: ' + JSON.stringify(depoisDoClique.agulha))
  console.log('a hora no zero:  ' + JSON.stringify(paradaEm0.agulha.hora))

  // ── A LINHA COM O SOM ANDANDO ──
  // Era aqui que ela parecia quebrada: o relogio do play reescrevia a linha a
  // cada quadro e o clique sumia no quadro seguinte.
  const bt = "[...document.querySelectorAll('.fx-ferramentas button')][0]"
  await passo(bt + ".click()")
  await new Promise((r) => setTimeout(r, 1200))
  const tocandoAgora = await estado()
  await passo(`
    (() => {
      const r = document.querySelector('.fx-regua').getBoundingClientRect()
      const el = document.querySelector('.fx-regua')
      el.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: r.left + r.width * 0.75, clientY: r.top + 14, bubbles: true, pointerId: 31 }))
      window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: r.left + r.width * 0.75, clientY: r.top + 14, bubbles: true, pointerId: 31 }))
    })()`)
  await new Promise((r) => setTimeout(r, 500))
  const depoisDoSeek = await estado()
  const aindaTocando = await passo(bt + ".textContent.trim()")
  await new Promise((r) => setTimeout(r, 900))
  const seguiuAndando = await estado()
  await passo(bt + ".click()")
  await new Promise((r) => setTimeout(r, 300))
  console.log('')
  console.log('── a linha com o play ligado ──')
  console.log('tocando:      x=' + tocandoAgora.agulha.x + ' relogio=' + tocandoAgora.agulha.relogio)
  console.log('cliquei a 75%: x=' + depoisDoSeek.agulha.x + ' relogio=' + depoisDoSeek.agulha.relogio + ' botao=' + JSON.stringify(aindaTocando))
  console.log('0,9s depois:  x=' + seguiuAndando.agulha.x + ' relogio=' + seguiuAndando.agulha.relogio)

  // ── O LOOP, igual ao do separador ──
  // arrastar na regua marca E JA LIGA o loop; clique seco solta tudo.
  // UM TOQUE arrasta a linha; DOIS TOQUES marcam o trecho. Sao gestos
  // diferentes, e o teste precisa saber fazer os dois.
  const arrastarRegua = (de, ate, doisToques) => {
    const js = [
      '(() => {',
      '  const el = document.querySelector(".fx-regua");',
      '  const r = el.getBoundingClientRect();',
      '  const y = r.top + 20;',
      '  const xDe = r.left + r.width * ' + de + ';',
      '  const xAte = r.left + r.width * ' + ate + ';',
      '  const ev = (t, cx, alvo) => alvo.dispatchEvent(new PointerEvent(t, {',
      '    clientX: cx, clientY: y, bubbles: true, cancelable: true, pointerId: 41 }));',
      (doisToques
        ? '  ev("pointerdown", xDe, el); ev("pointerup", xDe, window);'
        : '  /* um toque so */'),
      '  ev("pointerdown", xDe, el);',
      '  ev("pointermove", (xDe + xAte) / 2, window);',
      '  ev("pointermove", xAte, window);',
      '  ev("pointerup", xAte, window);',
      '  return "arrastei";',
      '})()'
    ].join(' ')
    return passo(js)
  }

  // primeiro: UM toque e arrasta — a linha anda e NADA e marcado
  const antesDoArrastoSimples = await estado()
  await arrastarRegua(0.2, 0.45, false)
  await new Promise((r) => setTimeout(r, 500))
  const soArrastou = await estado()

  // agora DOIS toques e arrasta — ai sim marca e liga o loop
  await arrastarRegua(0.2, 0.45, true)
  await new Promise((r) => setTimeout(r, 600))
  const marcado = await estado()
  await fotografar(destino.replace('.png', '-loop.png'))
  // o som tem que estar rodando dentro do trecho: espera e ve se a agulha
  // voltou pro comeco dele em vez de passar reto
  await new Promise((r) => setTimeout(r, 900))
  const dentroDoTrecho = await estado()
  // clique seco solta a marcacao E o loop, porque foi ela que o ligou
  await arrastarRegua(0.6, 0.6, false)
  await new Promise((r) => setTimeout(r, 500))
  const depoisDoCliqueSeco = await estado()
  console.log('')
  console.log('── o loop ──')
  console.log('um toque + arrasto: linha ' + antesDoArrastoSimples.agulha.x + ' → ' +
    soArrastou.agulha.x + ' | marcou? ' + JSON.stringify(soArrastou.loop.barra) +
    ' | loop ' + soArrastou.loop.ligado)
  console.log('marquei 20%→45%: ' + JSON.stringify(marcado.loop))
  console.log('agulha dentro:    x=' + dentroDoTrecho.agulha.x + ' (trecho ' +
    marcado.loop.barra.x + '→' + (marcado.loop.barra.x + marcado.loop.barra.w) + ')')
  console.log('clique seco:      ' + JSON.stringify(depoisDoCliqueSeco.loop))


  // ── PUXAR A LATERAL (o gesto do CapCut) ──
  // Encolhe pela direita: a peca fica menor e o comeco dela nao sai do lugar.
  const puxarAlca = (indice, qual, dx) => passo(
    '(() => {' +
    ' const p = document.querySelectorAll(".fx-peca")[' + indice + '];' +
    ' const a = p.querySelector(".fx-alca-' + qual + '");' +
    ' if (!a) return "sem alca";' +
    ' const r = a.getBoundingClientRect();' +
    ' const x = r.left + r.width / 2, y = r.top + r.height / 2;' +
    ' const ev = (t, cx, alvo) => alvo.dispatchEvent(new PointerEvent(t, {' +
    '   clientX: cx, clientY: y, bubbles: true, cancelable: true, pointerId: 51, button: 0 }));' +
    ' ev("pointerdown", x, a);' +
    ' ev("pointermove", x + (' + dx + ') / 2, window);' +
    ' ev("pointermove", x + (' + dx + '), window);' +
    ' ev("pointerup", x + (' + dx + '), window);' +
    ' return "puxei";' +
    '})()')

  const antesDaAlca = await estado()
  await puxarAlca(0, 'd', -160)
  await new Promise((r) => setTimeout(r, 400))
  const encolhida = await estado()
  await puxarAlca(0, 'e', 90)
  await new Promise((r) => setTimeout(r, 400))
  const pelaEsquerda = await estado()
  console.log('')
  console.log('── puxar a lateral ──')
  console.log('antes:          x=' + antesDaAlca.recortes[0].x + ' w=' + antesDaAlca.recortes[0].w)
  console.log('direita -160px: x=' + encolhida.recortes[0].x + ' w=' + encolhida.recortes[0].w)
  console.log('esquerda +90px: x=' + pelaEsquerda.recortes[0].x + ' w=' + pelaEsquerda.recortes[0].w)

  // ── O BOTAO DIREITO NO TRECHO ──
  await arrastarRegua(0.15, 0.35, true)
  await new Promise((r) => setTimeout(r, 700))
  const quantasAntes = await passo("document.querySelectorAll('.fx-peca').length")
  const abrirMenu = (fracao) => passo(
    '(() => {' +
    ' const campo = document.querySelector(".fx-campo");' +
    ' const r = campo.getBoundingClientRect();' +
    ' campo.dispatchEvent(new MouseEvent("contextmenu", {' +
    '   clientX: r.left + r.width * ' + fracao + ', clientY: r.top + 40,' +
    '   bubbles: true, cancelable: true }));' +
    ' return !!document.querySelector(".fx-menu");' +
    '})()')
  const temMenu = () => passo("!!document.querySelector('.fx-menu')")
  await abrirMenu(0.8)
  await new Promise((r) => setTimeout(r, 350))
  const foraDoTrecho = await temMenu()
  await abrirMenu(0.25)
  await new Promise((r) => setTimeout(r, 400))
  const dentroDoTrecho2 = await temMenu()
  const comMenu = await estado()
  await fotografar(destino.replace('.png', '-menu.png'))
  await passo("(() => { const b = [...document.querySelectorAll('.fx-menu button')].find((x) => /Duplicar/.test(x.textContent)); if (b) b.click(); return !!b })()")
  await new Promise((r) => setTimeout(r, 450))
  const depoisDeDuplicar = await passo("document.querySelectorAll('.fx-peca').length")
  // CONTAR PECA NAO PROVA APAGAR. Apagar um trecho no meio de uma faixa longa
  // PARTE ELA EM DUAS — a contagem sobe, e mesmo assim o pedaco sumiu. O que
  // prova e nao sobrar nenhuma peca ocupando aquele espaco.
  const janela = await passo(`
    (() => {
      const b = document.querySelector('.fx-trecho-barra')
      if (!b) return null
      const r = b.getBoundingClientRect()
      return { a: Math.round(r.left), b: Math.round(r.right) }
    })()`)
  await abrirMenu(0.25)
  await new Promise((r) => setTimeout(r, 350))
  await passo("(() => { const b = [...document.querySelectorAll('.fx-menu button')].find((x) => /Apagar/.test(x.textContent)); if (b) b.click(); return !!b })()")
  await new Promise((r) => setTimeout(r, 500))
  const depoisDeApagar = await passo("document.querySelectorAll('.fx-peca').length")
  // (o medidor de verdade e o `invasores` logo abaixo)
  const sobrouNaJanela = await passo(`
    (() => {
      const j = ${JSON.stringify('JANELA')}
      return 0
    })()`)
  const invasores = await passo(
    '(() => {' +
    ' const A = ' + (janela ? janela.a : 0) + ', B = ' + (janela ? janela.b : 0) + ';' +
    ' return [...document.querySelectorAll(".fx-peca")].filter((p) => {' +
    '   const r = p.getBoundingClientRect();' +
    // 3px de folga: a borda desenhada da peca tem 1px de cada lado
    '   return r.right > A + 3 && r.left < B - 3;' +
    ' }).map((p) => p.querySelector(".fx-tarja b")?.textContent);' +
    '})()')

  console.log('')
  console.log('── o botao direito no trecho ──')
  console.log('fora do trecho abriu? ' + foraDoTrecho + ' | dentro? ' + dentroDoTrecho2)
  console.log('opcoes: ' + JSON.stringify(comMenu.menu.opcoes))
  console.log('pecas: ' + quantasAntes + ' → duplicar ' + depoisDeDuplicar + ' → apagar ' + depoisDeApagar)
  console.log('sobrou dentro do trecho apagado: ' + JSON.stringify(invasores))


  // ── MUDO E ISOLAR ──
  const linhas0 = await estado()
  const apertar = (linha, qual) => passo(
    '(() => {' +
    ' const c = document.querySelectorAll(".fx-linha-cel")[' + linha + '];' +
    ' const b = [...c.querySelectorAll(".fx-ms")].find((x) => x.textContent === "' + qual + '");' +
    ' if (!b) return "sem botao"; b.click(); return "ok";' +
    '})()')

  await apertar(0, 'M')
  await new Promise((r) => setTimeout(r, 350))
  const comMudo = await estado()
  await apertar(0, 'M')
  await new Promise((r) => setTimeout(r, 250))
  // isolar a 2a: a 1a e a 3a tem que calar, mesmo sem mudo aceso nelas
  await apertar(1, 'S')
  await new Promise((r) => setTimeout(r, 350))
  const comIsolado = await estado()
  await fotografar(destino.replace('.png', '-ms.png'))
  // e o mudo aceso na PROPRIA isolada nao pode calar ela: isolar ganha
  await apertar(1, 'M')
  await new Promise((r) => setTimeout(r, 350))
  const isoladoEMudo = await estado()
  await apertar(1, 'M')
  await apertar(1, 'S')
  await new Promise((r) => setTimeout(r, 300))

  // a coluna nao rola com o campo
  const colunaAntes = (await estado()).linhas.colunaX
  await passo("document.querySelector('.fx-quadro').scrollLeft = 240")
  await new Promise((r) => setTimeout(r, 300))
  const colunaDepois = (await estado()).linhas.colunaX
  await passo("document.querySelector('.fx-quadro').scrollLeft = 0")
  await new Promise((r) => setTimeout(r, 250))

  console.log('')
  console.log('── mudo e isolar ──')
  console.log('desalinho das celulas: ' + JSON.stringify(linhas0.linhas.celulas.map((c) => c.desalinho)))
  console.log('mudo na linha 1: caladas=' + JSON.stringify(comMudo.linhas.caladas))
  console.log('isolar a linha 2: caladas=' + JSON.stringify(comIsolado.linhas.caladas))
  console.log('mudo na propria isolada: caladas=' + JSON.stringify(isoladoEMudo.linhas.caladas))
  console.log('rolei 240px: coluna ' + colunaAntes + ' → ' + colunaDepois)


  // ── BOTAO DIREITO NA PROPRIA FAIXA ──
  // Faltava: so dava pra apagar via trecho marcado, entao apagar UMA faixa
  // exigia marcar em cima dela antes.
  const menuNaPeca = (indice) => passo(
    '(() => {' +
    ' const p = document.querySelectorAll(".fx-peca")[' + indice + '];' +
    ' if (!p) return "sem peca";' +
    ' const r = p.getBoundingClientRect();' +
    ' p.dispatchEvent(new MouseEvent("contextmenu", {' +
    '   clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,' +
    '   bubbles: true, cancelable: true }));' +
    ' return "abri";' +
    '})()')

  // primeiro sem trecho marcado, pra ver so as acoes da faixa
  await passo(`
    (() => {
      const el = document.querySelector('.fx-regua')
      const r = el.getBoundingClientRect()
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 20, clientY: r.top + 14, bubbles: true, pointerId: 61 }))
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: r.left + 20, clientY: r.top + 14, bubbles: true, pointerId: 61 }))
    })()`)
  await new Promise((r) => setTimeout(r, 350))
  const quantasFaixas = await passo("document.querySelectorAll('.fx-peca').length")
  await menuNaPeca(0)
  await new Promise((r) => setTimeout(r, 400))
  const menuDaFaixa = await passo("[...document.querySelectorAll('.fx-menu button')].map((b) => b.textContent)")
  await fotografar(destino.replace('.png', '-menupeca.png'))
  await passo("(() => { const b = [...document.querySelectorAll('.fx-menu button')].find((x) => /Apagar faixa/.test(x.textContent)); if (b) b.click(); return !!b })()")
  await new Promise((r) => setTimeout(r, 450))
  const depoisDeApagarFaixa = await passo("document.querySelectorAll('.fx-peca').length")

  // o menu branco do Chromium nao pode aparecer: o evento tem que sair barrado
  const barrouONativo = await passo(`
    (() => {
      const campo = document.querySelector('.fx-campo')
      const r = campo.getBoundingClientRect()
      const ev = new MouseEvent('contextmenu', {
        clientX: r.left + r.width - 20, clientY: r.top + 20, bubbles: true, cancelable: true })
      campo.dispatchEvent(ev)
      return ev.defaultPrevented
    })()`)

  console.log('')
  console.log('── botao direito na faixa ──')
  console.log('opcoes: ' + JSON.stringify(menuDaFaixa))
  console.log('faixas: ' + quantasFaixas + ' → apagar faixa ' + depoisDeApagarFaixa)
  console.log('menu do Chromium barrado em area vazia? ' + barrouONativo)


  // ── CRAVAR E DESCRAVAR UM PONTO ──
  const estadoDasMarcas = () => passo(`
    (() => ({
      bandeiras: [...document.querySelectorAll('.fx-marca-bandeira button')].map((e) => e.textContent),
      linhas: document.querySelectorAll('.fx-marca-linha').length,
      horaAcesa: document.querySelector('.fx-hora')?.classList.contains('cravada') || false,
      hora: document.querySelector('.fx-hora')?.textContent
    }))()`)
  const clicarNaHora = (ondeNaEtiqueta = 0.5) => passo(
    '(() => {' +
    ' const h = document.querySelector(".fx-hora");' +
    ' const r = h.getBoundingClientRect();' +
    ' const cx = r.left + r.width * ' + ondeNaEtiqueta + ', cy = r.top + r.height / 2;' +
    ' const op = { clientX: cx, clientY: cy, bubbles: true, cancelable: true, pointerId: 81, button: 0 };' +
    ' h.dispatchEvent(new PointerEvent("pointerdown", op));' +
    ' h.dispatchEvent(new PointerEvent("pointerup", op));' +
    ' h.dispatchEvent(new MouseEvent("click", op));' +
    ' return "cliquei";' +
    '})()')
  const levarAgulha = (f) => passo(
    '(() => {' +
    ' const el = document.querySelector(".fx-regua"); const r = el.getBoundingClientRect();' +
    ' el.dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + r.width * ' + f + ', clientY: r.top + 14, bubbles: true, pointerId: 71 }));' +
    ' window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 71 }));' +
    '})()')

  // para o som antes: com o play andando, a etiqueta muda de segundo entre uma
  // leitura e outra e o teste acusa diferenca que nao existe
  await passo("(() => { const b = document.querySelector('.fx-ferramentas .ed-tp-play'); if (b && b.textContent.trim() === '■') b.click() })()")
  await new Promise((r) => setTimeout(r, 300))
  await levarAgulha(0.3)
  await new Promise((r) => setTimeout(r, 350))
  const antesDeCravar = await estadoDasMarcas()
  await clicarNaHora()
  await new Promise((r) => setTimeout(r, 400))
  const cravado = await estadoDasMarcas()
  await fotografar(destino.replace('.png', '-marca.png'))
  // segundo ponto, noutro lugar
  await levarAgulha(0.55)
  await new Promise((r) => setTimeout(r, 350))
  await clicarNaHora()
  await new Promise((r) => setTimeout(r, 400))
  const dois = await estadoDasMarcas()
  // e clicar de novo NO MESMO ponto tira — pela beirada da etiqueta, que e
  // onde a mao cai quando ela mira o numero e nao o centro do retangulo
  await clicarNaHora(0.12)
  await new Promise((r) => setTimeout(r, 400))
  const tirou = await estadoDasMarcas()

  console.log('')
  console.log('── cravar o ponto ──')
  console.log('antes:      ' + JSON.stringify(antesDeCravar))
  console.log('cravei:     ' + JSON.stringify(cravado))
  console.log('outro:      ' + JSON.stringify(dois))
  console.log('cliquei de novo: ' + JSON.stringify(tirou))

  // ── O CASO QUE ESTRAGOU NA MAO DO DONO ──
  // Levar a agulha PERTO (mas nao em cima) de um ponto e clicar na hora
  // empilhava outra marca em vez de tirar. Agora a agulha gruda no ponto.
  const antesDoQuase = await estadoDasMarcas()
  await passo(`
    (() => {
      const el = document.querySelector('.fx-regua'); const r = el.getBoundingClientRect()
      const marca = document.querySelector('.fx-marca-bandeira')
      const x = marca.getBoundingClientRect().left + 6   // 6px ao lado do ponto
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: r.top + 14, bubbles: true, pointerId: 91 }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 91 }))
    })()`)
  await new Promise((r) => setTimeout(r, 400))
  await clicarNaHora()
  await new Promise((r) => setTimeout(r, 400))
  const depoisDoQuase = await estadoDasMarcas()

  // e tirar clicando NA PROPRIA BANDEIRA, sem mexer na agulha
  await clicarNaHora()   // crava de volta pra ter o que tirar
  await new Promise((r) => setTimeout(r, 350))
  const comUm = await estadoDasMarcas()
  await passo(`
    (() => {
      const b = document.querySelector('.fx-marca-bandeira button')
      const r = b.getBoundingClientRect()
      const op = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, pointerId: 92, button: 0 }
      b.dispatchEvent(new PointerEvent('pointerdown', op))
      b.dispatchEvent(new PointerEvent('pointerup', op))
      b.dispatchEvent(new MouseEvent('click', op))
    })()`)
  await new Promise((r) => setTimeout(r, 400))
  const pelaBandeira = await estadoDasMarcas()

  console.log('quase em cima + clique na hora: ' + antesDoQuase.bandeiras.length +
    ' → ' + depoisDoQuase.bandeiras.length + ' marcas')
  console.log('clique na bandeira: ' + comUm.bandeiras.length + ' → ' + pelaBandeira.bandeiras.length)

  const enchendo = await estado()
  await fotografar(destino.replace('.png', '-cheia.png'))
  console.log('')
  console.log('── a estrutura na tela ──')
  console.log(JSON.stringify(enchendo.enchimento))
  console.log('regua: ' + JSON.stringify(enchendo.enchimento.regua))


  // ── PUXAR A DIVISORIA PRA MUDAR A ALTURA DA FAIXA ──
  const alturasDasLinhas = () => passo(`
    (() => ({
      pistas: [...document.querySelectorAll('.fx-pista')].map((p) => Math.round(p.getBoundingClientRect().height)),
      celulas: [...document.querySelectorAll('.fx-linha-cel')].map((c) => Math.round(c.getBoundingClientRect().height)),
      pecaDaLinha2: (() => {
        const p = [...document.querySelectorAll('.fx-peca')].find((x) => x.getBoundingClientRect().top > 200)
        return p ? Math.round(p.getBoundingClientRect().height) : null
      })(),
      divisorias: document.querySelectorAll('.fx-divisoria').length
    }))()`)

  const puxarDivisoria = (indice, dy) => passo(
    '(() => {' +
    ' const d = document.querySelectorAll(".fx-divisoria")[' + indice + '];' +
    ' if (!d) return "sem divisoria";' +
    ' const r = d.getBoundingClientRect();' +
    ' const x = r.left + 200, y = r.top + r.height / 2;' +
    ' const ev = (t, cy, alvo) => alvo.dispatchEvent(new PointerEvent(t, {' +
    '   clientX: x, clientY: cy, bubbles: true, cancelable: true, pointerId: 101, button: 0 }));' +
    ' ev("pointerdown", y, d);' +
    ' ev("pointermove", y + (' + dy + ') / 2, window);' +
    ' ev("pointermove", y + (' + dy + '), window);' +
    ' ev("pointerup", y + (' + dy + '), window);' +
    ' return "puxei";' +
    '})()')

  const antesDeRedimensionar = await alturasDasLinhas()
  await puxarDivisoria(0, 120)
  await new Promise((r) => setTimeout(r, 450))
  const depoisDeCrescer = await alturasDasLinhas()
  await fotografar(destino.replace('.png', '-alturas.png'))
  // duplo clique volta ao automatico
  await passo(`
    (() => {
      const d = document.querySelectorAll('.fx-divisoria')[0]
      const r = d.getBoundingClientRect()
      d.dispatchEvent(new MouseEvent('dblclick', { clientX: r.left + 200, clientY: r.top + 3, bubbles: true }))
    })()`)
  await new Promise((r) => setTimeout(r, 450))
  const voltouAoAuto = await alturasDasLinhas()

  console.log('')
  console.log('── altura das faixas ──')
  console.log('antes:  ' + JSON.stringify(antesDeRedimensionar.pistas) + ' | celulas ' + JSON.stringify(antesDeRedimensionar.celulas))
  console.log('puxei +120 na 1a: ' + JSON.stringify(depoisDeCrescer.pistas) + ' | celulas ' + JSON.stringify(depoisDeCrescer.celulas))
  console.log('dois cliques:     ' + JSON.stringify(voltouAoAuto.pistas))


  // ── APROFUNDAR COM A RODA, ANCORADO NO CURSOR ──
  // O que faz isto parecer certo e a ancora: o instante embaixo do cursor tem
  // que continuar embaixo do cursor. Mede-se assim: escolhe um ponto fixo na
  // tela, ve que segundo esta ali, gira a roda, e ve se ainda e o mesmo.
  // SEM REGEX. O `\d` some no caminho ate o navegador (ja aconteceu tres vezes
  // nesta sessao), e uma regex mutilada nao falha alto: ela devolve null e o
  // teste morre longe da causa. `split(':')` faz o mesmo sem escape nenhum.
  const segundoSobOCursor = (xNaTela) => passo(
    '(() => {' +
    ' const q = document.querySelector(".fx-quadro");' +
    ' const r = q.getBoundingClientRect();' +
    ' const riscos = [...document.querySelectorAll(".fx-regua .ruler-tick.major")].filter((t) => t.querySelector(".ruler-label"));' +
    ' if (riscos.length < 2) return null;' +
    ' const ult = riscos[riscos.length - 1], penult = riscos[riscos.length - 2];' +
    ' const seg = (t) => { const p = t.trim().split(":"); return Number(p[0]) * 60 + Number(p[1]); };' +
    ' const hora = (r) => seg(r.querySelector(".ruler-label").textContent);' +
    ' const dx = ult.getBoundingClientRect().left - penult.getBoundingClientRect().left;' +
    ' const dt = hora(ult) - hora(penult);' +
    ' if (!dt) return null;' +
    ' const zoom = dx / dt;' +
    ' return Math.round(((q.scrollLeft + (' + xNaTela + ' - r.left)) / zoom) * 10) / 10;' +
    '})()')

  const rodar = (xNaTela, entalhes) => passo(
    '(() => {' +
    ' const q = document.querySelector(".fx-quadro");' +
    ' const r = q.getBoundingClientRect();' +
    ' for (let i = 0; i < ' + Math.abs(entalhes) + '; i++) {' +
    '   q.dispatchEvent(new WheelEvent("wheel", {' +
    '     clientX: ' + xNaTela + ', clientY: r.top + 80,' +
    '     deltaY: ' + (entalhes > 0 ? -100 : 100) + ', bubbles: true, cancelable: true }));' +
    ' }' +
    ' return "rodei";' +
    '})()')

  const larguraDo = () => passo("Math.round(document.querySelector('.fx-conteudo').getBoundingClientRect().width)")
  const alvoX = await passo("Math.round(document.querySelector('.fx-quadro').getBoundingClientRect().left + 500)")
  const antesDaRoda = await larguraDo()
  const segAntes = await segundoSobOCursor(alvoX)
  await rodar(alvoX, 5)
  await new Promise((r) => setTimeout(r, 500))
  const depoisDaRoda = await larguraDo()
  const segDepois = await segundoSobOCursor(alvoX)
  await fotografar(destino.replace('.png', '-fundo.png'))
  await rodar(alvoX, -5)
  await new Promise((r) => setTimeout(r, 500))
  const devolta = await larguraDo()

  console.log('')
  console.log('── aprofundar com a roda ──')
  console.log('largura do conteudo: ' + antesDaRoda + ' → ' + depoisDaRoda + ' → ' + devolta)
  console.log('segundo sob o cursor: ' + segAntes + 's → ' + segDepois + 's')


  // ── A LINHA TEM QUE ACOMPANHAR A APROXIMACAO ──
  // Este era o bug: o relogio do play guardava o zoom de quando comecou, entao
  // ao aproximar a regua ia pra um lado e a agulha pra outro — a musica tocando
  // com a linha parada em cima de campo vazio.
  const ondeALinhaEstaEmSegundos = () => passo(`
    (() => {
      const q = document.querySelector('.fx-quadro')
      const linha = document.querySelector('.fx-agulha')
      // pelo RISCO: o rotulo tem margem de 6px pra nao encostar nele, e em
      // zoom baixo esses 6px valem varios segundos de erro
      const riscos = [...document.querySelectorAll('.fx-regua .ruler-tick.major')]
        .filter((t) => t.querySelector('.ruler-label'))
      if (!linha || riscos.length < 2) return null
      const seg = (t) => { const p = t.trim().split(':'); return Number(p[0]) * 60 + Number(p[1]) }
      const hora = (r) => seg(r.querySelector('.ruler-label').textContent)
      const a = riscos[riscos.length - 2], b = riscos[riscos.length - 1]
      const dx = b.getBoundingClientRect().left - a.getBoundingClientRect().left
      const dt = hora(b) - hora(a)
      if (!dt) return null
      const zoom = dx / dt
      const xLinha = linha.getBoundingClientRect().left
      return Math.round((hora(a) + (xLinha - a.getBoundingClientRect().left) / zoom) * 10) / 10
    })()`)

  // poe a agulha num ponto conhecido, toca, e aproxima com o som andando
  await passo(`
    (() => {
      const el = document.querySelector('.fx-regua'); const r = el.getBoundingClientRect()
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + r.width * 0.25, clientY: r.top + 20, bubbles: true, pointerId: 111 }))
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 111 }))
    })()`)
  await new Promise((r) => setTimeout(r, 400))
  const relogioAntes = await passo("document.querySelector('.mesa-relogio b').textContent")
  const linhaAntes = await ondeALinhaEstaEmSegundos()
  await passo("document.querySelector('.fx-ferramentas .ed-tp-play').click()")
  await new Promise((r) => setTimeout(r, 700))
  const xAlvo = await passo("Math.round(document.querySelector('.fx-quadro').getBoundingClientRect().left + 400)")
  await rodar(xAlvo, 4)
  await new Promise((r) => setTimeout(r, 700))
  const relogioDepois = await passo("document.querySelector('.mesa-relogio b').textContent")
  const linhaDepois = await ondeALinhaEstaEmSegundos()
  await fotografar(destino.replace('.png', '-acompanha.png'))
  await passo("(() => { const b = document.querySelector('.fx-ferramentas .ed-tp-play'); if (b.textContent.trim() === '■') b.click() })()")
  await new Promise((r) => setTimeout(r, 300))

  const segDe = (t) => { const p = String(t).trim().split(':'); return Number(p[0]) * 60 + Number(p[1]) }
  console.log('')
  console.log('── a linha acompanha a aproximacao ──')
  console.log('antes:  relogio ' + relogioAntes + ' (' + segDe(relogioAntes) + 's) | a regua ve a linha em ' + linhaAntes + 's')
  console.log('depois: relogio ' + relogioDepois + ' (' + segDe(relogioDepois) + 's) | a regua ve a linha em ' + linhaDepois + 's')


  // ── ESTICAR UMA FAIXA COM O SOM ANDANDO ──
  // Era aqui que dava mudo: o vigia de cada faixa guardava o fim de quando o
  // play comecou, entao esticar a faixa nao adiantava — ela parava no fim
  // velho e a linha seguia sozinha, sem som.
  // NA MAQUETE O SOM NAO TOCA (os arquivos sao falsos), entao medir <audio> nao
  // diz nada. O que se mede e a DECISAO do relogio: quais pecas ele considera
  // soando agora — que e exatamente o que estava errado.
  const quemEstaTocando = () => passo(`
    (() => ({
      acesas: [...document.querySelectorAll('.fx-peca.soando')].map((p) => p.dataset.peca),
      total: document.querySelectorAll('.fx-sons audio').length
    }))()`)

  // poe a agulha no comeco da 1a peca, estica ela, e ve se o som continua
  const dadosDaPeca = await passo(`
    (() => {
      const p = document.querySelectorAll('.fx-peca')[0]
      const r = p.getBoundingClientRect()
      return { esquerda: Math.round(r.left), direita: Math.round(r.right), largura: Math.round(r.width) }
    })()`)
  await passo(
    '(() => {' +
    ' const el = document.querySelector(".fx-regua"); const r = el.getBoundingClientRect();' +
    ' const x = ' + (dadosDaPeca.direita - 40) + ';' +
    ' el.dispatchEvent(new PointerEvent("pointerdown", { clientX: x, clientY: r.top + 20, bubbles: true, pointerId: 121 }));' +
    ' window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 121 }));' +
    '})()')
  await new Promise((r) => setTimeout(r, 350))
  await passo("document.querySelector('.fx-ferramentas .ed-tp-play').click()")
  await new Promise((r) => setTimeout(r, 600))
  const tocandoAntesDeEsticar = await quemEstaTocando()
  // estica a peca 260px pra direita, com o som andando
  await puxarAlca(0, 'd', 260)
  await new Promise((r) => setTimeout(r, 1400))
  const tocandoDepoisDeEsticar = await quemEstaTocando()
  const relogioNoFim = await passo("document.querySelector('.mesa-relogio b').textContent")
  await passo("(() => { const b = document.querySelector('.fx-ferramentas .ed-tp-play'); if (b.textContent.trim() === '■') b.click() })()")
  await new Promise((r) => setTimeout(r, 300))

  console.log('')
  console.log('── esticar a faixa tocando ──')
  console.log('antes de esticar:  ' + JSON.stringify(tocandoAntesDeEsticar))
  console.log('1,4s depois de esticar: ' + JSON.stringify(tocandoDepoisDeEsticar) + ' | relogio ' + relogioNoFim)


  // ── PARAR VOLTA PRO PONTO ──
  //
  // Pedido do dono, com as palavras dele: "digamos que deixei a lima no meio da
  // musica, ai eu pauso, depois de pausar a lima reinicia de onde eu deixei
  // ela". Igual ao loop, com o ponto DELE no lugar do trecho.
  //
  // A distincao que este teste cobra e sutil e e toda a questao: nao basta a
  // linha PARAR -- ela para em qualquer lugar. Ela tem que VOLTAR pro ponto de
  // onde o play saiu. Sem isso, repetir um trecho obriga a mirar de novo depois
  // de cada parada, que foi exatamente a bronca. Eu tinha entendido "continua de
  // onde parou" e implementado a coisa errada.
  //
  // O LOOP TEM QUE ESTAR DESLIGADO, senao quem manda na volta e o trecho e o
  // teste mede a mecanica do loop achando que mede esta.
  // Este teste passou horas desligado por um fantasma que nao era dele: com o
  // play tendo rodado, a maquete congelava LA NA FRENTE, num passo sem relacao
  // nenhuma com som, e o passo que morria mudava de lugar a cada rodada. Culpei
  // midia, culpei o `src=''`, culpei a insistencia do play (esses dois eram
  // defeitos de verdade e foram consertados) -- mas o culpado era o
  // `capturePage` das doze fotos numa janela invisivel. Desligadas as fotos, ele
  // roda junto com todo o resto.
  //
  // Fica a licao: quando o passo que quebra MUDA DE LUGAR a cada rodada, o
  // problema nao esta no passo. Esta no que se acumula atras dele.
  const PULA_PONTO = false
  let pontoPosto = null
  let linhaAndando = null
  let linhaDepoisDeParar = null
  if (!PULA_PONTO) {
    if (await passo("!!document.querySelector('.fx-loop.on')")) {
      await passo("document.querySelector('.fx-loop').click()")
      await new Promise((r) => setTimeout(r, 250))
    }
    await levarAgulha(0.42)
    await new Promise((r) => setTimeout(r, 350))
    pontoPosto = await ondeALinhaEstaEmSegundos()
    await passo("document.querySelector('.fx-ferramentas .ed-tp-play').click()")
    await new Promise((r) => setTimeout(r, 1500))
    linhaAndando = await ondeALinhaEstaEmSegundos()
    await passo("(() => { const b = document.querySelector('.fx-ferramentas .ed-tp-play'); if (b.textContent.trim() === '■') b.click() })()")
    await new Promise((r) => setTimeout(r, 400))
    linhaDepoisDeParar = await ondeALinhaEstaEmSegundos()
  }
  const saiuDoPonto = PULA_PONTO || (pontoPosto !== null && linhaAndando !== null &&
    linhaAndando > pontoPosto + 0.3)
  const voltouProPonto = PULA_PONTO || (pontoPosto !== null && linhaDepoisDeParar !== null &&
    Math.abs(linhaDepoisDeParar - pontoPosto) <= 0.3)

  // ── AS SETAS DO TECLADO ──
  //
  // "igual o youtube, sabe quando aperta as setinhas esquerda ou direita, ai ele
  // adianta 10 segundos pra frente ou pra tras, e se segura ele agiliza a
  // velocidade". E ele fez questao: as setas DO TECLADO, nao botao na tela.
  //
  // Duas coisas diferentes pra cobrar, e a segunda e a que importa: o TOQUE anda
  // dez segundos, e a SEGURADA anda muito mais que dez. Sem cobrar as duas, um
  // teclado que so repetisse o toque passaria como se acelerasse.
  const seta = (lado, ms) => passo(
    '(() => {' +
    ' const k = "Arrow' + lado + '";' +
    ' window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));' +
    ' setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true })), ' + ms + ');' +
    ' return "apertei";' +
    '})()')
  await levarAgulha(0.3)
  await new Promise((r) => setTimeout(r, 350))
  const antesDaSeta = await ondeALinhaEstaEmSegundos()
  await seta('Right', 40)                       // um toque
  await new Promise((r) => setTimeout(r, 400))
  const depoisDoToque = await ondeALinhaEstaEmSegundos()
  await seta('Right', 1600)                     // segurando
  await new Promise((r) => setTimeout(r, 2000))
  const depoisDaSegurada = await ondeALinhaEstaEmSegundos()
  await seta('Left', 40)                        // e volta pro outro lado
  await new Promise((r) => setTimeout(r, 400))
  const depoisDaVolta = await ondeALinhaEstaEmSegundos()

  const andouDez = antesDaSeta !== null && depoisDoToque !== null &&
    Math.abs((depoisDoToque - antesDaSeta) - 10) <= 1.5
  const seguradaAcelera = depoisDaSegurada !== null && depoisDoToque !== null &&
    (depoisDaSegurada - depoisDoToque) > 25
  const voltaPraTras = depoisDaVolta !== null && depoisDaSegurada !== null &&
    Math.abs((depoisDaSegurada - depoisDaVolta) - 10) <= 1.5

  console.log('')
  console.log('── as setas do teclado ──')
  console.log('linha em ' + antesDaSeta + 's → um toque: ' + depoisDoToque +
    's (+' + (depoisDoToque - antesDaSeta).toFixed(1) + 's)')
  console.log('segurando 1,6s: ' + depoisDaSegurada + 's (+' +
    (depoisDaSegurada - depoisDoToque).toFixed(1) + 's)')
  console.log('seta pra tras: ' + depoisDaVolta + 's (' +
    (depoisDaVolta - depoisDaSegurada).toFixed(1) + 's)')

  console.log('')
  console.log('── parar volta pro ponto ──')
  console.log('ponto posto: ' + pontoPosto + 's → tocando: ' + linhaAndando +
    's → parou em: ' + linhaDepoisDeParar + 's')
  if (process.env.SAI_DEPOIS) {
    // experimento: depois de tocar e parar, a tela ainda responde? Se travar
    // AQUI, o defeito e do app e o dono trava usando; se so travar la na frente,
    // e o teste que esta perturbando o roteiro.
    console.log('[teste] vou fechar o estudio logo depois do play/parar')
    await passo("document.querySelector('.em-estudio .topbar-icon-btn').click()")
    console.log('[teste] fechei — a tela respondeu')
    process.exit(0)
  }


  // ── ENCAIXAR NA BATIDA ──
  // Solta a peca perto de uma batida da vizinha (sem Alt) e ve se ela pousa
  // EXATAMENTE nela — e se a tela avisa que encaixou.
  const ondeEntra = (indice) => passo(
    '(() => {' +
    ' const p = document.querySelectorAll(".fx-peca")[' + indice + '];' +
    ' const campo = document.querySelector(".fx-campo");' +
    ' const riscos = [...document.querySelectorAll(".fx-regua .ruler-tick.major")].filter((t) => t.querySelector(".ruler-label"));' +
    ' const seg = (t) => { const q = t.trim().split(":"); return Number(q[0]) * 60 + Number(q[1]); };' +
    ' const hora = (r) => seg(r.querySelector(".ruler-label").textContent);' +
    ' const a = riscos[0], b = riscos[1];' +
    ' const zoom = (b.getBoundingClientRect().left - a.getBoundingClientRect().left) / (hora(b) - hora(a));' +
    ' return Math.round(((p.getBoundingClientRect().left - campo.getBoundingClientRect().left) / zoom) * 1000) / 1000;' +
    '})()')

  const bpmDaPrimeira = 78          // o duble usa 78 na 1a musica
  // A GRADE DE BATIDAS COMECA ONDE A 1a PECA COMECA, nao no zero do medley.
  // O teste dividia `entra` por 0,769s direto, o que so vale enquanto a 1a peca
  // estiver colada no zero -- e a essa altura do roteiro ela ja foi arrastada,
  // esticada e mexida. Ficou passando por sorte, e quebrou no dia em que o zoom
  // mudou. Medir contra a grade DELA e o que o teste sempre quis dizer.
  const zoomAtual = () => passo(
    '(() => {' +
    ' const riscos = [...document.querySelectorAll(".fx-regua .ruler-tick.major")].filter((t) => t.querySelector(".ruler-label"));' +
    ' const seg = (t) => { const q = t.trim().split(":"); return Number(q[0]) * 60 + Number(q[1]); };' +
    ' const hora = (r) => seg(r.querySelector(".ruler-label").textContent);' +
    ' const a = riscos[0], b = riscos[1];' +
    ' return Math.round(((b.getBoundingClientRect().left - a.getBoundingClientRect().left) / (hora(b) - hora(a))) * 100) / 100;' +
    '})()')
  // ── APROXIMAR ANTES DE COBRAR MIRA ──
  //
  // A 3,66 px/s (que e onde o roteiro chegava) o pulso de 0,769s ocupa 2,8
  // PIXELS. Nessa escala a batida, a borda da peca vizinha e qualquer outro alvo
  // caem todos dentro de meio pixel um do outro: o encaixe passava ou reprovava
  // por sorte, e nao por acerto. Foi assim que ele quebrou quando o passo da
  // roda mudou -- o defeito era do teste, nao do encaixe.
  //
  // Com 25 px/s a batida tem 19px e a pergunta "caiu na batida?" volta a ter
  // resposta.
  for (let i = 0; i < 18 && (await zoomAtual()) < 25; i++) {
    await passo("document.querySelector('.fx-zoom [title=aproximar]').click()")
    await new Promise((r) => setTimeout(r, 120))
  }
  const entra0 = await ondeEntra(0)
  const antesDoEncaixe = await ondeEntra(1)
  const zoomNoEncaixe = await zoomAtual()
  // arrasta a 2a peca pra perto de uma batida da 1a, SEM Alt
  await arrastar(1, -137, 0, false)
  await new Promise((r) => setTimeout(r, 500))
  const depoisDoEncaixe = await ondeEntra(1)
  const periodo = 60 / bpmDaPrimeira
  const relativo = depoisDoEncaixe - entra0
  const restoDaBatida = ((relativo % periodo) + periodo) % periodo
  const naBatida = Math.min(restoDaBatida, periodo - restoDaBatida)

  console.log('')
  console.log('── encaixar na batida ──')
  console.log('a 1a peca comeca em ' + entra0 + 's; o zoom esta em ' + zoomNoEncaixe + ' px/s')
  console.log('entra em: ' + antesDoEncaixe + 's → ' + depoisDoEncaixe + 's')
  console.log('distancia da batida mais proxima (pulso de ' + periodo.toFixed(3) + 's): ' +
    naBatida.toFixed(3) + 's = ' + (naBatida * zoomNoEncaixe).toFixed(2) + 'px')
  // e devolve o zoom pra um lugar conhecido: os testes seguintes medem em pixels
  // e nao podem herdar a aproximacao que este aqui precisou
  await passo("document.querySelector('.fx-zoom [title=\"caber na tela\"]').click()")
  await new Promise((r) => setTimeout(r, 300))

  // ── AS PONTAS ──
  const fadeDaPeca = (indice) => passo(
    '(() => {' +
    ' const p = document.querySelectorAll(".fx-peca")[' + indice + '];' +
    ' const e = p.querySelector(".fx-ponta-e"), d = p.querySelector(".fx-ponta-d");' +
    ' return { entrada: Math.round(e.getBoundingClientRect().width), saida: Math.round(d.getBoundingClientRect().width) };' +
    '})()')
  const pontasAntes = await fadeDaPeca(0)
  // QUEM PEGA A RAMPA E A BOLINHA, nao o desenho dela. O desenho virou
  // pointer-events:none justamente porque cobria a alca de encolher.
  await passo(
    '(() => {' +
    ' const p = document.querySelectorAll(".fx-peca")[0];' +
    ' const b = p.querySelector(".fx-bolinha-e");' +
    ' if (!b) return "sem bolinha";' +
    ' const r = b.getBoundingClientRect();' +
    ' const x = r.left + r.width / 2, y = r.top + r.height / 2;' +
    ' const ev = (t, cx, alvo) => alvo.dispatchEvent(new PointerEvent(t, {' +
    '   clientX: cx, clientY: y, bubbles: true, cancelable: true, pointerId: 131, button: 0 }));' +
    ' ev("pointerdown", x, b);' +
    ' ev("pointermove", x + 60, window);' +
    ' ev("pointermove", x + 120, window);' +
    ' ev("pointerup", x + 120, window);' +
    ' return "puxei a bolinha";' +
    '})()')
  await new Promise((r) => setTimeout(r, 450))
  const pontasDepois = await fadeDaPeca(0)
  await fotografar(destino.replace('.png', '-conexao.png'))
  console.log('')
  console.log('── a ponta de entrada ──')
  console.log('largura da rampa: ' + JSON.stringify(pontasAntes) + ' → ' + JSON.stringify(pontasDepois))

  // ── A ALCA NAO PODE PERDER PRO DESENHO DA RAMPA ──
  //
  // Bronca do dono, com a rampa ja criada: "eu nao consigo aumentar ou diminuir
  // o audio porque tem a linha". A rampa tinha altura inteira e z-index maior
  // que a alca: com rampa na peca, puxar a lateral pegava a rampa, sempre.
  //
  // O teste antigo de encolher passava porque rodava ANTES de existir rampa
  // nenhuma. Este roda DEPOIS, na peca que acabou de ganhar 120px de rampa --
  // que e a situacao em que ele estava quando reclamou.
  // O TESTE TEM QUE PERGUNTAR QUEM ESTA EMBAIXO DO DEDO.
  //
  // O puxarAlca() de cima dispara o pointerdown DIRETO no elemento da alca --
  // e dispatchEvent num elemento nao passa por empilhamento nenhum. Ou seja:
  // ele passaria verdinho mesmo com a rampa cobrindo a alca inteira, que e o
  // defeito que o dono viveu. Testar assim e testar um caminho que mao nenhuma
  // percorre; ja errei isso antes nesta mesma tela.
  //
  // Entao aqui o gesto comeca por elementFromPoint: o navegador diz quem esta
  // no pixel, e o teste cobra que quem esteja la seja a ALCA. Puxa o lado
  // ESQUERDO, que e onde a rampa de 120px acabou de nascer -- na direita ela tem
  // so os 9px do minimo e provaria pouco.
  const larguraDaPeca = (i) => passo(
    'Math.round(document.querySelectorAll(".fx-peca")[' + i + '].getBoundingClientRect().width)')
  const puxarOndeAMaoPega = (i, dx) => passo(
    '(() => {' +
    ' const q = document.querySelector(".fx-quadro");' +
    ' const campo = document.querySelector(".fx-campo").getBoundingClientRect();' +
    ' const p = document.querySelectorAll(".fx-peca")[' + i + '];' +
    ' q.scrollLeft = Math.max(0, p.getBoundingClientRect().left - campo.left - 120);' +
    ' const r = p.getBoundingClientRect();' +
    ' const x = r.left + 6, y = r.top + r.height / 2;' +
    ' const sob = document.elementFromPoint(x, y);' +
    ' if (!sob) return { quem: "nada" };' +
    ' const ev = (t, cx, alvo) => alvo.dispatchEvent(new PointerEvent(t, {' +
    '   clientX: cx, clientY: y, bubbles: true, cancelable: true, pointerId: 77, button: 0 }));' +
    ' ev("pointerdown", x, sob);' +
    ' ev("pointermove", x + (' + dx + ') / 2, window);' +
    ' ev("pointermove", x + (' + dx + '), window);' +
    ' ev("pointerup", x + (' + dx + '), window);' +
    ' return { quem: String(sob.className || sob.tagName) };' +
    '})()')
  const comRampaAntes = await larguraDaPeca(0)
  const sobODedo = await puxarOndeAMaoPega(0, 140)
  await new Promise((r) => setTimeout(r, 450))
  const comRampaDepois = await larguraDaPeca(0)
  const quemPegou = String(sobODedo && sobODedo.quem)
  const alcaVenceARampa = quemPegou.indexOf('fx-alca') >= 0 &&
    comRampaAntes - comRampaDepois > 100
  console.log('na lateral com rampa de 120px, o dedo pega: ' + quemPegou)
  console.log('encolher pela esquerda: ' + comRampaAntes + 'px → ' + comRampaDepois + 'px')

  // ── O BARULHO QUE PREENCHE O VAO ──
  //
  // O dono deixou um buraco entre duas pecas e pediu "pelo menos algum barulho"
  // ali. Sao tres (cauda, puxada, contagem) e ele disse que precisa OUVIR os tres
  // pra escolher -- entao o que este teste cobra nao e so criar: e conseguir
  // TROCAR um pelo outro no mesmo lugar, que e o gesto da comparacao.
  //
  // O vao e procurado entre as pecas onde elas estiverem, inclusive em LINHAS
  // DIFERENTES: era assim no campo dele, e um buraco so vale como buraco quando
  // nao ha som nenhum ali, em linha nenhuma.
  //
  // No fim a passagem e TIRADA, e nao e so pra testar tirar: deixar uma peca a
  // mais no campo mudaria a conta de todos os testes que vem depois.
  // ACHAR O BURACO PELO CAMPO, NAO PELA JANELA. A primeira versao mediu
  // getBoundingClientRect e comparou a peca 0 com a 1 -- e devolveu null sempre,
  // por dois motivos que se somam: depois dos testes anteriores as pecas estao
  // espalhadas (a 1 pode estar a ESQUERDA da 0) e a maioria esta FORA DA VISTA,
  // com o quadro rolado. Rect de peca fora da tela nao mede vao nenhum.
  //
  // Entao: posicoes relativas ao campo, ordenadas, e o maior buraco entre o fim
  // de tudo que veio antes e o comeco da proxima -- que e a mesma definicao que
  // o app usa. So depois de achar e que o quadro rola pra por o buraco a vista,
  // porque o botao direito precisa de um ponto que exista na tela.
  const olharOVao = () => passo(
    '(() => {' +
    ' const q = document.querySelector(".fx-quadro");' +
    ' const campo = document.querySelector(".fx-campo");' +
    ' if (!q || !campo) return null;' +
    ' const cr = campo.getBoundingClientRect();' +
    ' const ps = [...document.querySelectorAll(".fx-peca")].map((p) => {' +
    '   const r = p.getBoundingClientRect();' +
    '   return { e: r.left - cr.left, d: r.left - cr.left + r.width, y: r.top - cr.top + r.height / 2 };' +
    ' }).sort((a, b) => a.e - b.e);' +
    // quando NAO ha buraco, o teste tem que dizer o que viu em vez de um "null"
    // mudo: foi um null mudo que me fez perder duas rodadas aqui
    ' const retrato = ps.map((p) => Math.round(p.e) + "-" + Math.round(p.d));' +
    ' if (ps.length < 2) return { largura: 0, pecas: retrato };' +
    ' let melhor = null; let ateAqui = ps[0].d;' +
    ' for (let i = 1; i < ps.length; i++) {' +
    '   const larg = ps[i].e - ateAqui;' +
    '   if (larg > 20 && (!melhor || larg > melhor.largura)) {' +
    '     melhor = { largura: Math.round(larg), meio: ateAqui + larg / 2, y: ps[i - 1].y };' +
    '   }' +
    '   if (ps[i].d > ateAqui) ateAqui = ps[i].d;' +
    ' }' +
    ' if (!melhor) return { largura: 0, pecas: retrato };' +
    ' q.scrollLeft = Math.max(0, melhor.meio - q.clientWidth / 2);' +
    ' const dp = campo.getBoundingClientRect();' +
    ' return { largura: melhor.largura, meio: Math.round(melhor.meio),' +
    '   x: Math.round(dp.left + melhor.meio), y: Math.round(dp.top + melhor.y) };' +
    '})()')
  // O GESTO E A LEITURA SAO DOIS PASSOS. Lendo os botoes na mesma expressao do
  // dispatch, a lista volta VAZIA: o React ainda nao desenhou o menu. Foi isso
  // que reprovou a rodada anterior com o recurso ja funcionando -- o clique
  // seguinte, esse sim depois de uma espera, achava o botao sem problema.
  const opcoesDoMenu = () => passo(
    '[...document.querySelectorAll(".fx-menu button")].map((b) => b.textContent.trim())')
  const menuNoPonto = (x, y) => passo(
    '(() => {' +
    ' const campo = document.querySelector(".fx-campo");' +
    ' campo.dispatchEvent(new MouseEvent("contextmenu", { clientX: ' + x + ', clientY: ' + y + ',' +
    '   bubbles: true, cancelable: true }));' +
    ' return "abri";' +
    '})()')
  const clicarNoMenu = (texto) => passo(
    '(() => {' +
    ' const b = [...document.querySelectorAll(".fx-menu button")]' +
    '   .find((x) => x.textContent.indexOf("' + texto + '") >= 0);' +
    ' if (!b) return "sem opcao";' +
    ' b.click();' +
    ' return "cliquei";' +
    '})()')
  const passagens = () => passo(
    '(() => {' +
    ' const campo = document.querySelector(".fx-campo").getBoundingClientRect();' +
    ' return [...document.querySelectorAll(".fx-vao")].map((v) => {' +
    '   const r = v.getBoundingClientRect();' +
    '   const c = v.className;' +
    '   const b = v.querySelector(".fx-tarja b");' +
    '   return { tipo: c.indexOf("vao-") >= 0 ? c.split("vao-")[1].split(" ")[0] : null,' +
    '     esq: Math.round(r.left - campo.left), largura: Math.round(r.width),' +
    '     rotulo: b ? b.textContent.trim() : null,' +
    '     tracejada: getComputedStyle(v).borderTopStyle,' +
    '     onda: !!v.querySelector(".fx-onda") };' +
    ' });' +
    '})()')

  // a rolagem de agora, pra devolver no fim: os testes que vem depois medem em
  // coordenadas de tela e nao podem herdar um quadro rolado por mim
  const rolagemAntesDoVao = await passo('document.querySelector(".fx-quadro").scrollLeft')
  // as pecas EM ORDEM DE DOM, que e a ordem que o arrastar() enxerga
  const posicoesDasPecas = () => passo(
    '(() => {' +
    ' const cr = document.querySelector(".fx-campo").getBoundingClientRect();' +
    ' return [...document.querySelectorAll(".fx-peca")].map((p) => {' +
    '   const r = p.getBoundingClientRect();' +
    '   return { e: Math.round(r.left - cr.left), d: Math.round(r.left + r.width - cr.left) };' +
    ' });' +
    '})()')
  let oVao = await olharOVao()
  console.log('antes de abrir: ' + JSON.stringify(oVao))
  if (!oVao || oVao.largura < 40) {
    // NAO HA BURACO PORQUE A PRIMEIRA PECA COBRE AS OUTRAS. Depois de todos os
    // testes anteriores as pecas ficam empilhadas dentro da mais longa (984-2347
    // com as outras dentro), e empurrar 320px so mexe uma peca dentro da outra.
    // Pra abrir buraco de verdade e preciso levar uma peca pra DEPOIS do fim de
    // todas -- e quanto, so o campo sabe.
    const ps = await posicoesDasPecas()
    const mover = 1
    const fimDeTodas = Math.max(...ps.filter((_, i) => i !== mover).map((p) => p.d))
    const empurrao = Math.round(fimDeTodas + 190 - ps[mover].e)
    console.log('empurrando a peca ' + mover + ' em ' + empurrao + 'px pra abrir o buraco')
    await arrastar(mover, empurrao, 0, true)
    await new Promise((r) => setTimeout(r, 500))
    oVao = await olharOVao()
  }
  console.log('')
  console.log('── o vao entre duas faixas ──')
  console.log('buraco achado: ' + JSON.stringify(oVao))
  if (oVao) await menuNoPonto(oVao.x, oVao.y)
  await new Promise((r) => setTimeout(r, 350))
  const menuDoVao = oVao ? await opcoesDoMenu() : []
  console.log('menu do vao:   ' + JSON.stringify(menuDoVao))
  const ofereceOsTres = ['cauda', 'puxada', 'contagem']
    .every((t) => menuDoVao.some((o) => o.toLowerCase().indexOf(t) >= 0))
  console.log('clique na cauda: ' + await clicarNoMenu('A cauda'))
  await new Promise((r) => setTimeout(r, 700))
  const comCauda = await passagens()
  console.log('com a cauda:   ' + JSON.stringify(comCauda))
  // a passagem tem que COBRIR o buraco: e pra isso que ela existe
  const cobriuOBuraco = comCauda.length === 1 && !!oVao &&
    Math.abs(comCauda[0].largura - oVao.largura) <= 12
  // troca no mesmo lugar -- a comparacao que ele pediu.
  // O ACESSO E GUARDADO: sem passagem na tela, `[0]` e undefined e o teste
  // MORRE no dispatchEvent em vez de dizer o que faltou. Ja aconteceu.
  const menuNaPassagem = () => passo(
    '(() => {' +
    ' const v = document.querySelector(".fx-vao");' +
    ' if (!v) return "sem passagem na tela";' +
    ' const r = v.getBoundingClientRect();' +
    ' v.dispatchEvent(new MouseEvent("contextmenu", { clientX: r.left + r.width / 2,' +
    '   clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));' +
    ' return "abri";' +
    '})()')
  const abriuNaPassagem = await menuNaPassagem()
  await new Promise((r) => setTimeout(r, 350))
  const menuDaPassagem = abriuNaPassagem === 'abri' ? await opcoesDoMenu() : [abriuNaPassagem]
  console.log('menu dela:     ' + JSON.stringify(menuDaPassagem))
  console.log('clique na troca: ' + await clicarNoMenu('Trocar pela contagem'))
  await new Promise((r) => setTimeout(r, 700))
  const comContagem = await passagens()
  const trocouNoLugar = comContagem.length === 1 && comContagem[0].tipo === 'contagem' &&
    !!comCauda[0] && Math.abs(comContagem[0].esq - comCauda[0].esq) <= 2
  console.log('trocada:       ' + JSON.stringify(comContagem))
  await fotografar(destino.replace('.png', '-vao.png'))
  // e some quando se pede pra sumir
  await menuNaPassagem()
  await new Promise((r) => setTimeout(r, 300))
  await clicarNoMenu('Apagar a passagem')
  await new Promise((r) => setTimeout(r, 450))
  const semPassagem = (await passagens()).length === 0
  console.log('tirada? ' + semPassagem)
  await passo('document.querySelector(".fx-quadro").scrollLeft = ' + (rolagemAntesDoVao || 0))
  await new Promise((r) => setTimeout(r, 200))

  const antesDoArrasto = await estado()
  const p1 = antesDoArrasto.pecas[1]
  // 1) POR CIMA da primeira: leva pra esquerda ate cair dentro dela
  await arrastar(1, antesDoArrasto.pecas[0].x - p1.x + 60, 0, true)
  await new Promise((r) => setTimeout(r, 400))
  const porCima = await estado()
  // 2) PRA OUTRA PISTA: desce uma faixa
  await arrastar(1, 0, 96, true)
  await new Promise((r) => setTimeout(r, 400))
  const outraPista = await estado()
  // 3) LONGE: empurra 300px pra direita
  await arrastar(1, 300, 0, true)
  await new Promise((r) => setTimeout(r, 400))
  const longe = await estado()
  await fotografar(destino.replace('.png', '-arrasto.png'))

  console.log('')
  console.log('── o arrasto ──')
  console.log('antes:      ' + JSON.stringify(antesDoArrasto.pecas.map((p) => p.x + ',' + p.y)))
  console.log('por cima:   ' + JSON.stringify(porCima.pecas.map((p) => p.x + ',' + p.y)))
  console.log('outra pista:' + JSON.stringify(outraPista.pecas.map((p) => p.x + ',' + p.y)))
  console.log('longe:      ' + JSON.stringify(longe.pecas.map((p) => p.x + ',' + p.y)))
  console.log('pistas: ' + antesDoArrasto.pistas + ' → ' + longe.pistas)
  console.log('')
  console.log('── as faixas ──')
  console.log('antes de juntar ja havia arquivo? ' + antesDeJuntar)
  console.log(JSON.stringify(nasFaixas, null, 1))
  await passo("[...document.querySelectorAll('button')].find((b) => /as músicas/.test(b.textContent))?.click()")
  await new Promise((r) => setTimeout(r, 500))
  console.log('')
  console.log('── a 1a criacao, ja aberta ──')
  console.log(JSON.stringify(primeira, null, 1))

  // SAI DO ESTUDIO DE ONDE QUER QUE ESTEJA. Os testes das ferramentas levam a
  // tela pra fase das faixas, e daqui em diante o roteiro precisa da LISTA de
  // criacoes — sem este passo ele tentava clicar num card que nao estava na
  // tela e morria calado, travando a rodada inteira.
  console.log('[marco] vou sair das faixas')
  await passo("(() => { const v = [...document.querySelectorAll('button')].find((b) => /as músicas/.test(b.textContent)); if (v) v.click() })()")
  await new Promise((r) => setTimeout(r, 400))
  console.log('[marco] sai das faixas; vou fechar o estudio')
  await passo("document.querySelector('.em-estudio .topbar-icon-btn').click()")
  await new Promise((r) => setTimeout(r, 500))
  console.log('[marco] estudio fechado; vou clicar em Nova edicao')
  await clicar('Nova edição')
  await new Promise((r) => setTimeout(r, 900))
  console.log('[marco] Nova edicao clicada')
  console.log('[marco] cartoes: ' + await passo("(() => { const cs=[...document.querySelectorAll('.esc-card')]; if (cs.length < 5) return 'so ' + cs.length; cs[3].click(); cs[4].click(); return 'ok' })()"))
  await new Promise((r) => setTimeout(r, 350))
  console.log('[marco] confirmar: ' + await clicar('confirmar'))
  await new Promise((r) => setTimeout(r, 900))
  console.log('[marco] vou ler a lista')
  const segunda = await lista()
  console.log('[marco] li a lista')
  console.log('[marco] estado antes de fechar: ' + JSON.stringify(await passo(
    '(() => { const c = document.querySelector(".fx-conteudo");' +
    ' return { pecas: document.querySelectorAll(".fx-peca").length,' +
    '   audios: document.querySelectorAll("audio").length,' +
    '   nos: document.querySelectorAll("*").length,' +
    '   larguraDoCampo: c ? Math.round(c.getBoundingClientRect().width) : 0 }; })()')))
  await passo("document.querySelector('.em-estudio .topbar-icon-btn').click()")
  await new Promise((r) => setTimeout(r, 600))
  console.log('[marco] fechei o 2o estudio')
  const duas = await criacoes()
  console.log('[marco] li as criacoes')
  await fotografar(destino)
  console.log('[marco] fotografei')
  console.log('')
  console.log('── depois do 2o + ──')
  console.log('2a criacao: ' + JSON.stringify(segunda.titulo) + ' com ' + segunda.linhas.length + ' musicas')
  console.log('a gaveta: ' + JSON.stringify(duas.itens))

  await passo("document.querySelectorAll('.jm-criacoes .jm-lixo')[0].click()")
  await new Promise((r) => setTimeout(r, 500))
  const perguntou = await passo("document.querySelector('.confirm-title')?.textContent || null")
  await clicar('Jogar fora')
  await new Promise((r) => setTimeout(r, 500))
  const sobrou = await criacoes()
  console.log('')
  console.log('── o lixo ──')
  console.log('perguntou: ' + JSON.stringify(perguntou))
  console.log('sobrou: ' + JSON.stringify(sobrou.itens.map((i) => i.nome)))

  console.log(relato.join('\n'))
  console.log('foto: ' + destino)

  const semEditor = primeira.editores === 0
  const abriuNaCriacao = primeira.linhas.length === 3 && primeira.titulo === 'Medley 1'
  const abriuEstudio = primeira.estudioAberto && primeira.voltar && primeira.marca && primeira.lixoNoEstudio
  const maisFezNova = segunda.titulo === 'Medley 2' && segunda.linhas.length === 2
  const duasNaGaveta = duas.itens.length === 2
  const lixoAVista = duas.itens.length > 0 && duas.itens.every((i) => i.lixoVisivel)
  const perguntouAntes = !!perguntou && /Jogar fora/.test(perguntou)
  const jogouFora = sobrou.itens.length === 1
  if (!semEditor) console.log('✘ sobrou peca de EDITOR na tela: ' + primeira.editores)
  if (!abriuNaCriacao) console.log('✘ o + nao abriu a criacao nova com as 3 musicas')
  if (!abriuEstudio) console.log('✘ confirmar NAO abriu o estudio em tela cheia: ' + JSON.stringify({
    fixa: primeira.estudioAberto, voltar: primeira.voltar, marca: primeira.marca, lixo: primeira.lixoNoEstudio }))
  if (!maisFezNova) console.log('✘ o 2o + NAO comecou uma edicao nova')
  if (!duasNaGaveta) console.log('✘ as duas criacoes nao ficaram na lista')
  if (!lixoAVista) console.log('✘ o lixinho NAO esta a vista em toda criacao')
  if (!perguntouAntes) console.log('✘ jogar fora nao perguntou antes')
  if (!jogouFora) console.log('✘ o lixo nao jogou fora')
  const abriuFaixas = nasFaixas.pecas.length === 3
  // a peca nao pode PULAR ao ser pega: peguei a 14px da borda esquerda e mandei
  // andar dx; ela tem que andar exatamente dx (com Alt o grude esta desligado)
  const p0 = antesDoArrasto.pecas[1]
  const andouCerto = Math.abs((longe.pecas[1].x - outraPista.pecas[1].x) - 300) <= 2
  const foiPorCima = porCima.pecas[1].x < antesDoArrasto.pecas[1].x
  const mudouDePista = outraPista.pecas[1].y > porCima.pecas[1].y
  if (!abriuFaixas) console.log('✘ juntar NAO abriu as 3 faixas')
  if (!andouCerto) console.log('✘ a peca PULOU ao ser pega (andou ' +
    (longe.pecas[1].x - outraPista.pecas[1].x) + 'px onde eu pedi 300)')
  if (!foiPorCima) console.log('✘ nao deu pra por uma faixa por cima da outra')
  if (!mudouDePista) console.log('✘ nao deu pra mover a faixa pra outra pista')
  const naoGerouSozinho = !antesDeJuntar && !nasFaixas.gerou && nasFaixas.botaoGerar
  const finalDiscreto = nasFaixas.gerarDiscreto && nasFaixas.paredeNoPe === 0
  if (!finalDiscreto) console.log('✘ o botao final NAO esta discreto no cabecalho: ' +
    JSON.stringify({ discreto: nasFaixas.gerarDiscreto, paredeNoPe: nasFaixas.paredeNoPe }))
  if (!abriuFaixas) console.log('✘ juntar NAO abriu as 3 faixas com onda: ' + JSON.stringify(nasFaixas.faixas))
  if (!naoGerouSozinho) console.log('✘ o arquivo nasceu SEM ninguem pedir')
  const temPlay = semEscolha.ferramentas.play
  const escondeSemAlvo = semEscolha.ferramentas.semAlvo && semEscolha.ferramentas.controles.length === 0
  const quatroControles = comEscolha.ferramentas.controles.length === 4
  // metade do BPM = metade da velocidade = o DOBRO de tempo na tela
  const bpmVirouVelocidade = largura1 > largura0 * 1.8 && largura1 < largura0 * 2.2
  if (!temPlay) console.log('✘ nao ha play na barra')
  if (!escondeSemAlvo) console.log('✘ os controles aparecem sem faixa escolhida')
  if (!quatroControles) console.log('✘ faltam controles: ' + JSON.stringify(comEscolha.ferramentas.controles))
  if (!bpmVirouVelocidade) console.log('✘ mexer no BPM NAO mudou a velocidade (' + largura0 + ' → ' + largura1 + ')')
  const linhaExisteParada = !!paradaEm0.agulha && paradaEm0.agulha.atravessa
  const linhaFoi = depoisDoClique.agulha.x > paradaEm0.agulha.x + 100
  const trianguloJunto = Math.abs(depoisDoClique.agulha.triX - depoisDoClique.agulha.x) <= 2
  const relogioAndou = depoisDoClique.agulha.relogio !== '0:00'
  const h0 = paradaEm0.agulha.hora
  const h1 = depoisDoClique.agulha.hora
  const horaAcompanha = !!h1 && h1.texto === depoisDoClique.agulha.relogio && h1.acima === true
  const horaNaoVaza = !!h0 && h0.vazou === false
  if (!horaAcompanha) console.log('✘ a hora em cima do triangulo nao acompanha: ' + JSON.stringify(h1))
  if (!horaNaoVaza) console.log('✘ a hora vaza pra fora da regua no zero: ' + JSON.stringify(h0))
  if (!linhaExisteParada) console.log('✘ a linha nao existe parada ou nao atravessa as faixas')
  if (!linhaFoi) console.log('✘ clicar na regua nao levou a linha')
  if (!trianguloJunto) console.log('✘ o triangulo nao acompanhou a linha')
  if (!relogioAndou) console.log('✘ o relogio nao acompanhou a agulha')
  const seekFuncionou = depoisDoSeek.agulha.x > tocandoAgora.agulha.x + 200
  const naoParouDeTocar = aindaTocando === '■'
  const continuouDali = seguiuAndando.agulha.x > depoisDoSeek.agulha.x
  if (!seekFuncionou) console.log('✘ a regua NAO levou a linha com o play ligado')
  if (!naoParouDeTocar) console.log('✘ mexer na regua PAROU o play (botao: ' + aindaTocando + ')')
  if (!continuouDali) console.log('✘ o som nao seguiu do ponto novo')
  const umToqueSoAnda = !soArrastou.loop.barra && soArrastou.loop.ligado === false &&
    Math.abs(soArrastou.agulha.x - antesDoArrastoSimples.agulha.x) > 100
  if (!umToqueSoAnda) console.log('✘ um toque so deveria arrastar a linha, mas mexeu no loop: ' +
    JSON.stringify(soArrastou.loop) + ' linha ' + antesDoArrastoSimples.agulha.x + '→' + soArrastou.agulha.x)
  const marcouEligou = !!marcado.loop.barra && marcado.loop.ligado && marcado.loop.tinta
  const ficouDentro = dentroDoTrecho.agulha.x >= marcado.loop.barra.x - 4 &&
    dentroDoTrecho.agulha.x <= marcado.loop.barra.x + marcado.loop.barra.w + 4
  const cliqueSoltou = !depoisDoCliqueSeco.loop.barra && !depoisDoCliqueSeco.loop.ligado
  if (!marcouEligou) console.log('✘ marcar na regua nao ligou o loop: ' + JSON.stringify(marcado.loop))
  if (!ficouDentro) console.log('✘ o som saiu do trecho marcado')
  if (!cliqueSoltou) console.log('✘ o clique seco nao soltou a marcacao/o loop')
  const encolheuPelaDireita = encolhida.recortes[0].w < antesDaAlca.recortes[0].w - 100 &&
    Math.abs(encolhida.recortes[0].x - antesDaAlca.recortes[0].x) <= 2
  const encolheuPelaEsquerda = pelaEsquerda.recortes[0].x > encolhida.recortes[0].x + 40 &&
    pelaEsquerda.recortes[0].w < encolhida.recortes[0].w - 40
  const menuSoDentro = !foraDoTrecho && dentroDoTrecho2
  // os rotulos ganharam sobrenome quando o menu passou a ter dois grupos:
  // "Duplicar" sozinho nao dizia mais duplicar O QUE
  const duasOpcoes = comMenu.menu.opcoes.join(',') === 'Duplicar trecho,Apagar trecho'
  const duplicou = depoisDeDuplicar > quantasAntes
  const apagou = !!janela && invasores.length === 0
  if (!encolheuPelaDireita) console.log('✘ a lateral direita nao encolheu com o comeco parado')
  if (!encolheuPelaEsquerda) console.log('✘ a lateral esquerda nao andou junto com o recorte')
  if (!menuSoDentro) console.log('✘ o menu abriu fora do trecho (ou nao abriu dentro)')
  if (!duasOpcoes) console.log('✘ as opcoes nao sao Duplicar/Apagar: ' + JSON.stringify(comMenu.menu.opcoes))
  if (!duplicou) console.log('✘ duplicar nao criou peca')
  if (!apagou) console.log('✘ sobrou som dentro do trecho apagado: ' + JSON.stringify(invasores))
  const alinhadas = linhas0.linhas.celulas.every((c) => c.desalinho === null || Math.abs(c.desalinho) <= 1)
  const mudoCalou = comMudo.linhas.caladas[0] === true && comMudo.linhas.caladas[1] === false
  const isolarCalouORestо = comIsolado.linhas.caladas[0] === true &&
    comIsolado.linhas.caladas[1] === false && comIsolado.linhas.caladas[2] === true
  const isolarGanhaDeMudo = isoladoEMudo.linhas.caladas[1] === false
  const colunaFixa = colunaAntes === colunaDepois
  if (!alinhadas) console.log('✘ as celulas nao batem com as linhas')
  if (!mudoCalou) console.log('✘ o mudo nao calou so a linha dele: ' + JSON.stringify(comMudo.linhas.caladas))
  if (!isolarCalouORestо) console.log('✘ isolar nao calou o resto: ' + JSON.stringify(comIsolado.linhas.caladas))
  if (!isolarGanhaDeMudo) console.log('✘ o mudo venceu o isolar na mesma linha')
  if (!colunaFixa) console.log('✘ a coluna rolou junto com o campo')
  const temAcoesDaFaixa = menuDaFaixa.some((t) => /Duplicar faixa/.test(t)) &&
    menuDaFaixa.some((t) => /Apagar faixa/.test(t))
  const apagouAFaixa = depoisDeApagarFaixa === quantasFaixas - 1
  if (!temAcoesDaFaixa) console.log('✘ o menu da faixa nao tem duplicar/apagar: ' + JSON.stringify(menuDaFaixa))
  if (!apagouAFaixa) console.log('✘ apagar faixa nao tirou a faixa (' + quantasFaixas + ' → ' + depoisDeApagarFaixa + ')')
  if (!barrouONativo) console.log('✘ o menu do Chromium NAO foi barrado')
  const cravou = cravado.bandeiras.length === 1 && cravado.linhas === 1 && cravado.horaAcesa === true &&
    cravado.bandeiras[0] === cravado.hora
  const dosPontos = dois.bandeiras.length === 2
  const descravou = tirou.bandeiras.length === 1 && tirou.horaAcesa === false
  if (!cravou) console.log('✘ cravar nao marcou o ponto: ' + JSON.stringify(cravado))
  if (!dosPontos) console.log('✘ o segundo ponto nao entrou: ' + JSON.stringify(dois))
  if (!descravou) console.log('✘ clicar de novo nao tirou o ponto: ' + JSON.stringify(tirou))
  const naoEmpilhou = depoisDoQuase.bandeiras.length < antesDoQuase.bandeiras.length
  const bandeiraTira = pelaBandeira.bandeiras.length === comUm.bandeiras.length - 1
  if (!naoEmpilhou) console.log('✘ clicar quase em cima EMPILHOU outra marca em vez de tirar')
  if (!bandeiraTira) console.log('✘ clicar na bandeira nao tirou o ponto')
  const e = enchendo.enchimento
  // sobra de ate 40px e respiro; mais que isso e tela jogada fora
  // as linhas tem que ocupar a altura, e nenhuma pode ser uma tira fina
  // enquanto sobra campo vazio embaixo
  // as linhas dividem O CAMPO, nao a mesa: a mesa ainda tem a regua em cima e
  // a barra de rolagem embaixo, e comparar com ela acusava um desalinho de 10px
  // que era so a barra
  const linhasDividem = !!e && e.alturaDaLinha >= 90 &&
    Math.abs(e.alturaDaLinha * e.pistas - e.alturaDoCampo) <= 4
  const r = e && e.regua
  const reguaMaior = !!r && r.altura >= 40 && r.letra >= 11 && r.topoBate === true &&
    (r.menorFolgaEntreRotulos === null || r.menorFolgaEntreRotulos >= 6)
  if (!!r && !reguaMaior) console.log('✘ a regua nao ficou maior/legivel: ' + JSON.stringify(r))
  const bordaABorda = reguaMaior && !!e && !!e.margens && e.margens.esquerda <= 1 && e.margens.direita <= 1
  if (!!e && !bordaABorda) console.log('✘ a mesa nao vai de borda a borda: ' + JSON.stringify(e.margens))
  const encheATela = bordaABorda && !!e && e.sobra !== null && e.sobra <= 40 &&
    e.vazouPelaDireita.length === 0 && linhasDividem
  if (!!e && !linhasDividem) console.log('✘ as linhas nao dividem a altura: ' +
    e.pistas + ' linhas de ' + e.alturaDaLinha + 'px num campo de ' + e.alturaDoCampo)
  if (!encheATela) console.log('✘ a estrutura NAO enche a tela: ' + JSON.stringify(e))
  // O ZOOM PRECISA SER COBRADO. Ele ficou quebrado por varias rodadas porque
  // nenhum teste media a largura depois de aproximar — o botao + respondia ao
  // clique e nao mudava nada, calado.
  const aprofundou = depoisDaRoda > antesDaRoda * 1.8
  const voltouDaRoda = Math.abs(devolta - antesDaRoda) / antesDaRoda < 0.08
  const ancorou = Math.abs(segDepois - segAntes) <= 2
  const cresceu = depoisDeCrescer.pistas[0] > antesDeRedimensionar.pistas[0] + 90
  const soAPrimeira = Math.abs(depoisDeCrescer.pistas[1] - antesDeRedimensionar.pistas[1]) <= 2
  const colunaAcompanha = depoisDeCrescer.celulas[0] === depoisDeCrescer.pistas[0]
  const voltouAoAutomatico = Math.abs(voltouAoAuto.pistas[0] - antesDeRedimensionar.pistas[0]) <= 2
  if (!aprofundou) console.log('✘ a roda nao aprofundou: ' + antesDaRoda + ' → ' + depoisDaRoda)
  if (!voltouDaRoda) console.log('✘ rodar de volta nao voltou: ' + devolta + ' vs ' + antesDaRoda)
  if (!ancorou) console.log('✘ o ponto sob o cursor FUGIU: ' + segAntes + 's → ' + segDepois + 's')
  if (!cresceu) console.log('✘ puxar a divisoria nao aumentou a faixa: ' + JSON.stringify(depoisDeCrescer.pistas))
  if (!soAPrimeira) console.log('✘ mexer numa faixa mexeu nas outras')
  if (!colunaAcompanha) console.log('✘ a coluna da esquerda nao acompanhou a altura')
  if (!voltouAoAutomatico) console.log('✘ dois cliques nao voltaram ao automatico')
  // a regua e o relogio tem que contar a MESMA hora, antes e depois de aproximar
  const batiaAntes = Math.abs(linhaAntes - segDe(relogioAntes)) <= 3
  const bateDepois = Math.abs(linhaDepois - segDe(relogioDepois)) <= 3
  if (!batiaAntes) console.log('✘ antes de aproximar a linha ja nao batia com o relogio')
  if (!bateDepois) console.log('✘ a linha NAO acompanhou a aproximacao: regua ve ' +
    linhaDepois + 's e o relogio diz ' + segDe(relogioDepois) + 's')
  // o som tem que CONTINUAR depois de esticar: antes ele emudecia no fim velho
  const naoEmudeceu = tocandoDepoisDeEsticar.acesas.length >= 1
  if (!naoEmudeceu) console.log('✘ esticar a faixa com o som andando EMUDECEU: ' +
    JSON.stringify(tocandoAntesDeEsticar) + ' → ' + JSON.stringify(tocandoDepoisDeEsticar))
  // A TOLERANCIA E EM PIXELS, nao em segundos. Grudar e uma conta de tela: a
  // peca gruda quando esta a menos de 18px do alvo, e a medida daqui vem toda de
  // pixels (posicao do elemento dividida pelo zoom lido da regua). Cobrar 25
  // MILESIMOS DE SEGUNDO era cobrar mais precisao do que a propria medicao tem —
  // a 38px/s, 25ms sao 0,96px, ou seja, dentro do erro de leitura. Dois pixels e
  // "em cima da batida" em qualquer zoom.
  const encaixouNaBatida = naBatida * zoomNoEncaixe < 2 &&
    Math.abs(depoisDoEncaixe - antesDoEncaixe) > 0.3
  const rampaCresceu = pontasDepois.entrada > pontasAntes.entrada + 80
  if (!encaixouNaBatida) console.log('✘ a peca nao encaixou na batida: ficou a ' +
    naBatida.toFixed(3) + 's (' + (naBatida * zoomNoEncaixe).toFixed(2) + 'px) dela')
  if (!rampaCresceu) console.log('✘ a ponta de entrada nao virou rampa: ' + JSON.stringify(pontasDepois))
  if (!alcaVenceARampa) console.log('✘ com rampa na peca, a lateral nao obedece: o dedo pegou "' +
    quemPegou + '" e a peca foi de ' + comRampaAntes + 'px pra ' + comRampaDepois + 'px')
  // ── o vao ──
  // "nao precisa ser nada extraordinario, mas pelo menos ter algum barulho"
  const achouOVao = !!oVao && oVao.largura >= 40
  // A PASSAGEM NAO PODE PARECER UMA GRAVACAO: ela e som fabricado aqui, e quem
  // olha o campo tem que ver isso sem precisar clicar. Tracejada e com a onda
  // desenhada -- a onda importa porque e ela que MOSTRA a cauda morrendo.
  const vaoSeDeclara = !!comCauda[0] && comCauda[0].tracejada === 'dashed' &&
    comCauda[0].onda === true && (comCauda[0].rotulo || '').toLowerCase().indexOf('cauda') >= 0
  if (!achouOVao) console.log('✘ nao consegui abrir um buraco entre duas faixas: ' + JSON.stringify(oVao))
  if (!ofereceOsTres) console.log('✘ o botao direito no vao nao ofereceu os tres: ' + JSON.stringify(menuDoVao))
  if (!cobriuOBuraco) console.log('✘ a passagem nao cobriu o buraco: ' +
    JSON.stringify(oVao) + ' → ' + JSON.stringify(comCauda))
  if (!vaoSeDeclara) console.log('✘ a passagem esta se passando por gravacao: ' + JSON.stringify(comCauda[0]))
  // O MENU DA PASSAGEM TEM QUE OFERECER OS OUTROS DOIS. Sem isso, comparar os
  // tres exigiria apagar e remarcar o vao a cada tentativa -- e comparar foi o
  // pedido, nao um extra.
  const ofereceTroca = ['puxada', 'contagem']
    .every((t) => menuDaPassagem.some((o) => o.toLowerCase().indexOf(t) >= 0))
  if (!ofereceTroca) console.log('✘ o menu da passagem nao oferece trocar pelos outros: ' +
    JSON.stringify(menuDaPassagem))
  // APAGAR TEM QUE SE CHAMAR APAGAR. Estava escrito "Tirar a passagem" e o dono
  // olhou o menu e pediu a opcao de deletar -- ela estava na frente dele, com
  // nome inventado. Acao que existe e nao e encontrada nao existe.
  const passagemSabeApagar = menuDaPassagem.some((o) => o.indexOf('Apagar') >= 0)
  if (!passagemSabeApagar) console.log('✘ o menu da passagem nao diz APAGAR: ' +
    JSON.stringify(menuDaPassagem))
  if (!trocouNoLugar) console.log('✘ nao deu pra TROCAR um barulho pelo outro no mesmo lugar: ' +
    JSON.stringify(menuDaPassagem) + ' → ' + JSON.stringify(comContagem))
  if (!semPassagem) console.log('✘ tirar a passagem nao tirou')
  const oVaoFecha = achouOVao && ofereceOsTres && cobriuOBuraco && vaoSeDeclara &&
    ofereceTroca && passagemSabeApagar && trocouNoLugar && semPassagem
  if (!andouDez) console.log('✘ um toque na seta nao andou 10s: ' + antesDaSeta + 's → ' + depoisDoToque + 's')
  if (!seguradaAcelera) console.log('✘ segurar a seta NAO acelerou: ' + depoisDoToque + 's → ' + depoisDaSegurada + 's')
  if (!voltaPraTras) console.log('✘ a seta da esquerda nao voltou 10s: ' + depoisDaSegurada + 's → ' + depoisDaVolta + 's')
  if (!saiuDoPonto) console.log('✘ a linha nem andou com o play: ' + pontoPosto + 's → ' + linhaAndando + 's')
  if (!voltouProPonto) console.log('✘ parar NAO devolveu a linha pro ponto: pus em ' + pontoPosto +
    's, tocou ate ' + linhaAndando + 's e parou em ' + linhaDepoisDeParar + 's')
  const ok = oVaoFecha && encaixouNaBatida && rampaCresceu && alcaVenceARampa && naoEmudeceu &&
    saiuDoPonto && voltouProPonto && andouDez && seguradaAcelera && voltaPraTras && batiaAntes && bateDepois && umToqueSoAnda && aprofundou && voltouDaRoda && ancorou && cresceu && soAPrimeira &&
    colunaAcompanha && voltouAoAutomatico && encheATela && naoEmpilhou && bandeiraTira && cravou && dosPontos && descravou && horaAcompanha && horaNaoVaza && temAcoesDaFaixa && apagouAFaixa && barrouONativo &&
    alinhadas && mudoCalou && isolarCalouORestо && isolarGanhaDeMudo && colunaFixa &&
    encolheuPelaDireita && encolheuPelaEsquerda && menuSoDentro && duasOpcoes &&
    duplicou && apagou && marcouEligou && ficouDentro && cliqueSoltou &&
    seekFuncionou && naoParouDeTocar && continuouDali &&
    linhaExisteParada && linhaFoi && trianguloJunto && relogioAndou &&
    temPlay && escondeSemAlvo && quatroControles && bpmVirouVelocidade &&
    semEditor && abriuNaCriacao && abriuEstudio && abriuFaixas && andouCerto &&
    foiPorCima && mudouDePista && naoGerouSozinho && finalDiscreto && maisFezNova && duasNaGaveta &&
    lixoAVista && perguntouAntes && jogouFora && censura.length === 0
  console.log('')
  console.log(ok ? '✔ o vao vira barulho (e troca) + encaixa na batida + pontas suaves + o resto'
    : '✘ o caminho NAO fecha — veja acima')
  app.exit(ok ? 0 : 1)
})
