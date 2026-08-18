import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/* ██████████ O CAMPO DAS FAIXAS ██████████
 *
 * O dono pediu, com estas palavras: as faixas devem ser móveis, ele quer pegar
 * uma com o mouse e arrastá-la pra qualquer área do campo — do lado de outra,
 * DENTRO de outra, ou LONGE de outra.
 *
 * As três são a mesma ideia levada a sério: cada faixa tem uma HORA DE ENTRAR.
 * Do lado vira sequência, por cima vira as duas soando juntas, longe deixa
 * silêncio. O motor foi refeito por causa disso — deixou de emendar em fila e
 * passou a MISTURAR (adelay + amix), porque emenda não sabe o que fazer com
 * duas músicas ocupando o mesmo segundo.
 *
 * ── A MECÂNICA, que ele pediu que fosse boa ──
 *
 * Quatro coisas fazem um arrasto parecer bom, e nenhuma delas é enfeite:
 *
 * 1. A PEÇA NÃO PULA quando você pega nela. Guardo em que ponto dela o dedo
 *    encostou e mantenho esse ponto embaixo do cursor até soltar. Sem isso a
 *    peça salta pra centralizar no cursor no primeiro pixel, e a mão perde a
 *    referência do que estava fazendo.
 *
 * 2. ELA GRUDA no que importa: no zero, na borda das outras peças e na agulha.
 *    Sem grude é impossível encostar duas exatamente — sempre sobra um fiapo de
 *    silêncio ou dois quadros de sobreposição que ninguém vê e todo mundo ouve.
 *    Segurar Alt desliga o grude pra quando a pessoa quiser mesmo um vão.
 *
 * 3. O CAMPO CRESCE. Tem sempre uma pista vazia embaixo: arrastar pra lá cria
 *    faixa nova. Sem isso "qualquer área do campo" seria mentira — só daria pra
 *    mover entre as pistas que já existem.
 *
 * 4. NADA ANDA PRA TRÁS DO ZERO. Tempo negativo não existe, e deixar arrastar
 *    pra lá só ensina que a peça "some" pra esquerda.
 */
const mmss = (s) => {
  const n = Math.max(0, Number(s) || 0)
  return Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0')
}

const CORES = ['#b4e85a', '#4ecb8c', '#dff9a0', '#27a08d', '#7ed97a', '#8fa57a']
// --stem-6, o verde apagado que a casa usa pra "Outros" — som sem dono. A
// passagem entre duas músicas é exatamente isso, e por isso não entra na escala
// das faixas: pintada com a cor de um louvor, ela viraria uma faixa a mais na
// conta de quem olha o campo.
const COR_VAO = '#8fa57a'
// PISO da altura de uma linha. Ela NAO e mais fixa: as linhas dividem a altura
// que a tela tem. Fixa em 96px, duas faixas ocupavam uma tira fina no topo e o
// resto virava um campo listrado gigante — espaco usado com nada continua sendo
// espaco jogado fora, e foi essa a bronca.
const ALTURA_MINIMA = 96
const ALTURA_MAXIMA = 260  // acima disso a onda vira mancha e nao ganha leitura
const GRUDE = 9            // em pixels: distância em que a peça cola
// O ZOOM DEIXOU DE SER LISTA E VIROU NÚMERO CONTÍNUO. Com oito degraus fixos,
// a roda do mouse dava saltos — e "entrar mais a fundo" com salto é sempre ou
// perto demais ou longe demais. Os limites: 0,3 px/s mostra vinte minutos numa
// tela; 200 px/s deixa meio segundo com 100px, que é onde se corta no detalhe.
// (Era 120. Subiu junto com o teto do estúdio de separação, que passou a ser
// medido em pixels por segundo — as duas telas aproximam o mesmo tanto, senão a
// mesma roda do mesmo mouse faz coisas diferentes em cada uma.)
const ZOOM_MIN = 0.3
const ZOOM_MAX = 200
// por entalhe da roda. Subiu de 1,18 junto com o teto: com 200 px/s de fundo, o
// passo antigo pedia trinta e tantos giros pra atravessar a faixa toda de zoom —
// e as duas telas têm que responder igual à mesma roda do mesmo mouse.
const PASSO_DA_RODA = 1.25

export default function FaixasDaEmenda({ criacao, analises, onMudar, onVoltar, exportando, pct, feito, erro }) {
  const [ondas, setOndas] = useState({})
  const [zoom, setZoom] = useState(1.5)
  const [arrastando, setArrastando] = useState(null)
  const [escolhida, setEscolhida] = useState(null)
  const [guia, setGuia] = useState(null)   // onde a peça grudou, em segundos
  const [menu, setMenu] = useState(null)   // { x, y } do botão direito no trecho
  const [tocando, setTocando] = useState(false)
  // QUAIS PEÇAS ESTÃO SOANDO AGORA. Enquanto o som anda, elas acendem — a
  // pessoa vê de onde está vindo o que ela ouve, que num campo com faixas
  // sobrepostas é a única forma de saber. Anda ~4x/s, não por quadro.
  const [soando, setSoando] = useState([])
  // A ALTURA QUE A BARRA DE ROLAGEM COME. Ela vive DENTRO do quadro, então o
  // campo é uns 10px mais baixo que a coluna das linhas ao lado — e as células
  // saíam desalinhadas das faixas por essa diferença. Medida, ela vira um
  // rodapé da mesma espessura embaixo da coluna, e as duas voltam a bater.
  const [barraDeRolagem, setBarraDeRolagem] = useState(0)
  const campoRef = useRef(null)
  const quadroRef = useRef(null)
  const somRef = useRef(new Map())     // id da peça -> <audio>
  // O PORTA-SONS. As faixas tocam em elementos criados por `new Audio()`, que
  // não moram em lugar nenhum da página. Pendurados aqui, o que está soando
  // passa a existir no DOM como todo o resto do app — dá pra inspecionar, e o
  // navegador para de ser o único que sabe o que está tocando.
  const sonsRef = useRef(null)
  const relogioRef = useRef(null)
  const rafRef = useRef(0)
  const inicioRef = useRef(0)
  // A AGULHA É UM LUGAR. Antes ela só existia enquanto o som andava: parava e
  // sumia. Uma linha que só aparece tocando não serve pra apontar — e apontar é
  // pra que ela existe. Agora ela fica onde foi posta, e o play parte dali.
  //
  // O segundo em que ela está mora em DUAS mãos: o ref anda por quadro (é ele
  // que a linha lê, sem re-render), e o estado anda devagar, só pro relógio e
  // pros botões saberem.
  const agulhaRef = useRef(0)
  const [agulha, setAgulha] = useState(0)
  // ── O LOOP, igual ao do separador ──
  //
  // Lá a regra é: arrastar na onda marca um trecho, e MARCAR JÁ É MANDAR
  // REPETIR — quem cerca um pedaço da música quer aquele pedaço rodando, e
  // obrigar a achar o botão de loop depois é um passo a mais pra dizer o que a
  // marcação já disse. Clique seco solta a marcação; e se o loop tinha sido
  // ligado PELA marcação, sai junto.
  //
  // Aqui a marcação mora na RÉGUA e não no campo: no campo o arrasto já é da
  // peça, e um gesto que faz duas coisas dependendo de onde caiu é armadilha.
  // O resto é idêntico.
  const [trecho, setTrecho] = useState(null)      // { ini, fim } em segundos
  const [loopLigado, setLoopLigado] = useState(false)
  const loopAutoRef = useRef(false)               // o loop foi ligado pela marcação?
  // UMA VERDADE SÓ sobre o loop, lida pelo relógio do play. Um segundo ref
  // (ou ler o estado dentro do quadro) é como o loop e a agulha se desencontram
  // — é o mesmo cuidado que está escrito no estúdio de separação.
  const loopRef = useRef({ on: false, tr: null })
  useEffect(() => { loopRef.current = { on: loopLigado, tr: trecho } }, [loopLigado, trecho])
  const triRef = useRef(null)

  const pecas = criacao.musicas

  useEffect(() => {
    const q = quadroRef.current
    if (!q) return
    const medir = () => setBarraDeRolagem(q.offsetHeight - q.clientHeight)
    const ro = new ResizeObserver(medir)
    ro.observe(q)
    medir()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      for (const m of pecas) {
        if (!vivo) return
        if (ondas[m.arquivo]) continue
        const r = await window.mptrix.emenda.onda({ path: m.arquivo }).catch(() => null)
        if (vivo && r) setOndas((o) => ({ ...o, [m.arquivo]: r }))
      }
    })()
    return () => { vivo = false }
  }, [pecas.map((m) => m.arquivo).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── A PEÇA PASSA A SER UM RECORTE DA GRAVAÇÃO ──
  //
  // Até aqui toda peça tocava o arquivo inteiro, do zero ao fim, e a única
  // liberdade era QUANDO ela entrava. Apagar um trecho no meio de uma música
  // não tinha como existir nesse mundo — não havia onde escrever "esta peça
  // começa em 1:20 e acaba em 2:05".
  //
  // Agora há: `ini` e `fim` dizem que pedaço DA GRAVAÇÃO a peça toca, e `entra`
  // continua dizendo quando ela entra no medley. São dois tempos diferentes e
  // confundi-los é o erro clássico aqui: um corre dentro do arquivo, o outro
  // corre na tela.
  // ── DE ONDE O SOM DESTA PEÇA VEM ──
  //
  // Quase toda peça é música do acervo e toca pela porta `acervo:`. O barulho que
  // preenche um vão NÃO: ele foi criado pelo próprio MPTRIX agora, e a porta
  // `acervo:` recusaria ele com 403 — ela só serve arquivo que está no histórico,
  // e com toda razão. Esse mora na pasta das faixas e vem pela porta `stems:`,
  // que é a mesma que serve as capas.
  const enderecoDe = (m) => (m.som || 'acervo://a/?f=' + encodeURIComponent(m.arquivo))
  const arquivoDe = (m) => ondas[m.arquivo]?.duracao || 0
  const iniDe = (m) => Number(m.ini) || 0
  const fimDe = (m) => Number(m.fim) || arquivoDe(m)
  const duracaoDe = (m) => Math.max(0, fimDe(m) - iniDe(m))
  const entraDe = (m) => Number(m.entra) || 0
  const laneDe = (m) => Number(m.lane) || 0

  // ── MUDO E ISOLAR, por linha ──
  //
  // São da LINHA, não da peça: é a linha que faz papel de instrumento aqui, e
  // uma linha pode ter vários pedaços. Ficam guardados na criação, então
  // sobrevivem ao fechar o app junto com o resto.
  //
  // ISOLAR GANHA DE MUDO, sempre. Com um isolado aceso, o resto cala — inclusive
  // o que não está marcado como mudo. É a regra de qualquer mesa, e inverter
  // isso faz a pessoa apertar isolar, não ouvir nada, e não descobrir que a
  // culpa era de um mudo esquecido aceso lá em cima.
  const infoDaLinha = (i) => (criacao.pistas || [])[i] || {}
  const mudarLinha = (i, campo, v) => {
    const ps = [...(criacao.pistas || [])]
    while (ps.length <= i) ps.push({})
    ps[i] = { ...ps[i], [campo]: v }
    onMudar({ ...criacao, pistas: ps })
  }
  const temIsolado = (criacao.pistas || []).some((x) => x && x.solo)
  const linhaSoa = (i) => (temIsolado ? !!infoDaLinha(i).solo : !infoDaLinha(i).mudo)
  const volDe = (m) => (m.ganho === undefined ? 1 : Number(m.ganho))
  const velDe = (m) => (m.velocidade === undefined ? 1 : Number(m.velocidade))
  const tomDe = (m) => Number(m.tom) || 0
  // A VELOCIDADE MUDA O TAMANHO DA PEÇA NA TELA. Meia velocidade é o dobro de
  // tempo — e se a peça não crescesse junto, a tela estaria mentindo sobre onde
  // a música acaba, que é justamente a conta que a pessoa faz pra encaixar a
  // próxima.
  const duracaoNaLinha = (m) => duracaoDe(m) / Math.max(0.01, velDe(m))

  // ── ARRUMAÇÃO INICIAL: escada ──
  //
  // Uma música por pista, cada uma entrando quando a anterior acaba. É o medley
  // que a pessoa pediu ao escolher as músicas, e continua sendo verdade depois:
  // dali ela arrasta pra onde quiser. Empilhar todas em zero seria começar com
  // todas tocando juntas — um estrondo que ninguém pediu.
  const jaArrumou = useRef(false)
  useLayoutEffect(() => {
    if (jaArrumou.current) return
    if (!pecas.length || pecas.some((m) => !ondas[m.arquivo])) return
    if (pecas.some((m) => m.entra !== undefined)) { jaArrumou.current = true; return }
    let t = 0
    onMudar({
      ...criacao,
      musicas: pecas.map((m, i) => {
        const posto = { ...m, lane: i, entra: t }
        t += duracaoNaLinha(m)
        return posto
      })
    })
    jaArrumou.current = true
  }, [ondas, pecas]) // eslint-disable-line react-hooks/exhaustive-deps

  const pistas = Math.max(pecas.reduce((n, m) => Math.max(n, laneDe(m) + 1), 0), 1) + 1 // +1 vazia

  // ── A ALTURA DE CADA FAIXA, NA MÃO ──
  //
  // Até aqui as linhas dividiam a altura em partes iguais, e isso enche a tela
  // mas não deixa escolher: quem está trabalhando numa faixa quer ELA grande e
  // as outras pequenas, não todas médias.
  //
  // O MODELO É "AUTOMÁTICO ATÉ ALGUÉM ENCOSTAR". Sem nada guardado, dividem
  // igual e ocupam a tela — que é o comportamento certo pra quem acabou de
  // chegar. No instante em que a mão puxa uma divisória, tiro uma fotografia
  // das alturas atuais e a partir dali quem manda é a pessoa; se a soma passar
  // da tela, a mesa rola. Duplo clique na divisória devolve tudo ao automático.
  //
  // Guardar só a que foi mexida seria pior: as outras continuariam "automáticas"
  // e mudariam de tamanho sozinhas ao mexer numa, o que parece defeito.
  const alturasSalvas = criacao.alturas || null
  const alturaAutomatica = () => {
    const h = campoRef.current?.clientHeight || 0
    return Math.max(ALTURA_MINIMA, Math.floor(h / Math.max(1, pistas)))
  }
  const alturaDe = (i) => (alturasSalvas ? (alturasSalvas[i] || ALTURA_MINIMA) : alturaAutomatica())
  const topoDe = (i) => {
    let t = 0
    for (let k = 0; k < i; k++) t += alturaDe(k)
    return t
  }
  const alturaTotal = () => {
    let t = 0
    for (let i = 0; i < pistas; i++) t += alturaDe(i)
    return t
  }
  // que linha está num certo Y — com alturas diferentes não dá mais pra dividir
  const linhaEm = (y) => {
    let t = 0
    for (let i = 0; i < pistas; i++) {
      t += alturaDe(i)
      if (y < t) return i
    }
    return pistas - 1
  }

  const puxarDivisoria = (i) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const y0 = e.clientY
    // a fotografia: sem ela, mexer numa faixa faria as outras mudarem sozinhas
    const base = alturasSalvas
      ? [...alturasSalvas]
      : Array.from({ length: pistas }, () => alturaAutomatica())
    const meu = base[i]
    const mover = (ev) => {
      const n = [...base]
      n[i] = Math.max(ALTURA_MINIMA, Math.min(600, meu + (ev.clientY - y0)))
      onMudar({ ...criacao, alturas: n })
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }
  const voltarAoAutomatico = () => onMudar({ ...criacao, alturas: null })

  // ── AS LINHAS DIVIDEM A ALTURA, EM PORCENTAGEM ──
  //
  // A primeira tentativa mediu a altura com ResizeObserver e dividiu na mão. O
  // resultado errou por 14px, e o motivo é banal: a barra de rolagem horizontal
  // come altura por dentro do quadro, e o número medido nunca é o número que o
  // navegador vai usar pra desenhar.
  //
  // Em porcentagem a conta não tem como errar — quem divide é o próprio
  // navegador, depois de já saber de tudo. O piso em pixels continua existindo
  // (`min-height` no campo): com dez faixas elas encolheriam até virar risco, e
  // aí é melhor a mesa rolar.
  const fatia = 100 / Math.max(1, pistas)
  // só pro cálculo do arrasto, lido do DOM na hora do gesto
  const alturaDaLinha = () => (campoRef.current?.clientHeight || 400) / Math.max(1, pistas)
  const fim = pecas.reduce((n, m) => Math.max(n, entraDe(m) + duracaoNaLinha(m)), 0)
  // ── O ZOOM E O FIM MORAM NUM REF, e não só no estado ──
  //
  // O relógio do play é um `requestAnimationFrame` que se repõe sozinho. A
  // função que ele chama pra mover a linha foi criada num certo desenho da tela
  // e guardou o zoom DAQUELE momento — então, ao aproximar durante o play, a
  // régua passava a usar o zoom novo e a linha continuava no antigo. Resultado:
  // a agulha ia parar longe da música, em cima de campo vazio, e o som tocando
  // sem nada embaixo dela.
  //
  // Um ref conserta pela raiz: ele não é uma cópia presa a um desenho, é o
  // lugar onde está o valor de agora. Mesma coisa pro `fim`, que o relógio usa
  // pra saber onde parar — mexer numa faixa durante o play mudava o fim e ele
  // continuava com o antigo.
  const px = (t) => t * zoom
  const zoomRef = useRef(zoom)
  const fimRef = useRef(0)
  const ondasRef = useRef({})
  const linhaSoaRef = useRef(() => true)
  const larguraCampo = Math.max(600, px(fim) + 240)



  // ── AS PONTAS DE CADA PEÇA ──
  //
  // O outro lado do "muito seco". Encaixar na batida põe a emenda no lugar
  // certo; o fade tira o estalo de cortar no meio de uma nota que ainda soava.
  // São remédios pra doenças diferentes e é por isso que existem os dois.
  //
  // O gesto é o triangulinho no canto de cima, arrastado pra dentro — o mesmo
  // de qualquer editor de vídeo, que é a referência que o dono tem na mão.
  const fadeInDe = (m) => Number(m.fadeIn) || 0
  const fadeOutDe = (m) => Number(m.fadeOut) || 0
  const pegarPonta = (m, qual) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* segue */ }
    const x0 = e.clientX
    const base = qual === 'in' ? fadeInDe(m) : fadeOutDe(m)
    const metade = duracaoNaLinha(m) / 2   // nenhuma ponta come mais que metade
    setEscolhida(m.id)
    const mover = (ev) => {
      const d = (ev.clientX - x0) / zoom
      const v = Math.max(0, Math.min(metade, base + (qual === 'in' ? d : -d)))
      onMudar({
        ...criacao,
        musicas: criacao.musicas.map((x) => (x.id === m.id
          ? { ...x, [qual === 'in' ? 'fadeIn' : 'fadeOut']: v } : x))
      })
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  // ── ENCAIXAR NA BATIDA ──
  //
  // Esta é a resposta pro "fica muito seco". Emenda seca quase nunca é falta de
  // fade: é o corte caindo FORA DO COMPASSO. Entra meio tempo antes ou depois e
  // o corpo de quem ensaia sente o tropeço sem saber nomear — e nenhum fade
  // conserta isso, só disfarça.
  //
  // O analisador já sabia onde estão as batidas de cada gravação. Aqui elas
  // viram ímãs: ao arrastar, a peça gruda no tempo da música que já está
  // tocando, e a emenda cai onde o ouvido espera.
  //
  // As batidas moram no tempo DA GRAVAÇÃO. Pra virar tempo do medley: tira o
  // que foi recortado do começo, divide pela velocidade (a peça está esticada
  // na tela) e soma a hora em que ela entra.
  const batidasDe = (m) => analises[m.arquivo]?.batidas || null
  const batidasNoMedley = (m) => {
    const bs = batidasDe(m)
    if (!bs || !bs.length) return []
    const ini = iniDe(m)
    const fim = fimDe(m)
    const vel = velDe(m)
    const entra = entraDe(m)
    const saida = []
    for (const b of bs) {
      if (b < ini || b > fim) continue
      saida.push(entra + (b - ini) / vel)
    }
    return saida
  }
  // a primeira batida DENTRO da peça, contada do começo dela — é por ela que a
  // peça se alinha quando a gente encosta o começo dela numa batida alheia
  const primeiraBatidaRelativa = (m) => {
    const bs = batidasDe(m)
    if (!bs || !bs.length) return null
    const ini = iniDe(m)
    const fim = fimDe(m)
    for (const b of bs) {
      if (b >= ini && b <= fim) return (b - ini) / velDe(m)
    }
    return null
  }

  // ── O ARRASTO ──
  const pegar = (m) => (e) => {
    if (e.button !== 0) return
    // a lateral tem dono: quem encostou nela quer encolher, não mover
    if (e.target.closest('.fx-alca') || e.target.closest('.fx-bolinha')) return
    e.preventDefault()
    // PRENDER O PONTEIRO NUM TRY. Sem o try, um pointerId que o navegador nao
    // reconhece faz o setPointerCapture ESTOURAR — e o estouro acontece antes
    // das linhas que registram o mover e o soltar, entao a peca simplesmente
    // nao anda, sem erro nenhum na tela. A prisao e um conforto (o arrasto
    // sobrevive ao cursor sair da peca), nao um requisito: se ela falhar, o
    // gesto tem que continuar valendo.
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* segue */ }
    const campo = campoRef.current.getBoundingClientRect()
    // ONDE O DEDO ENCOSTOU DENTRO DA PEÇA — é isto que impede o salto
    const pegouEm = e.clientX - (campo.left + px(entraDe(m)))
    setEscolhida(m.id)
    setArrastando({ id: m.id })

    const mover = (ev) => {
      const campoAgora = campoRef.current.getBoundingClientRect()
      let t = (ev.clientX - campoAgora.left - pegouEm) / zoom
      let lane = linhaEm(ev.clientY - campoAgora.top)
      lane = Math.max(0, Math.min(pistas - 1, lane))
      t = Math.max(0, t)

      // ── o grude ──
      let grudouEm = null
      let grudouNaBatida = false
      if (!ev.altKey) {
        const dur = duracaoNaLinha(m)
        // as BORDAS das outras peças, e as BATIDAS delas perto daqui
        const bordas = [0]
        const batidas = []
        for (const o of pecas) {
          if (o.id === m.id) continue
          bordas.push(entraDe(o), entraDe(o) + duracaoNaLinha(o))
          for (const b of batidasNoMedley(o)) {
            // só as que estão à vista deste gesto: percorrer as milhares de
            // batidas de seis músicas a cada movimento do mouse trava a tela
            if (Math.abs(b - t) * zoom < 120) batidas.push(b)
          }
        }
        const relativa = primeiraBatidaRelativa(m)
        let melhor = null
        const tentar = (alvo, marca, naBatida) => {
          if (alvo < 0) return
          const d = Math.abs(px(alvo) - px(t))
          // A BATIDA GANHA DA BORDA quando as duas estão por perto: alinhar com
          // o compasso é o que faz a emenda soar inteira; encostar as bordas é
          // só arrumação visual. Sem esse desempate, a borda (que é um alvo só)
          // roubaria o encaixe da batida quase sempre.
          const peso = naBatida ? d * 0.6 : d
          if (d <= GRUDE * 2 && (!melhor || peso < melhor.peso)) {
            melhor = { t: alvo, peso, marca, naBatida }
          }
        }
        for (const c of bordas) {
          // gruda tanto pelo COMEÇO quanto pelo FIM da peça: encostar o fim de
          // uma no começo de outra é metade dos gestos que se faz aqui
          tentar(c, c, false)
          tentar(c - dur, c, false)
        }
        for (const b of batidas) {
          tentar(b, b, true)                                   // o começo na batida
          tentar(b - dur, b, true)                             // o fim na batida
          // e o alinhamento que importa de verdade: a PRIMEIRA BATIDA da peça
          // caindo em cima de uma batida da outra música
          if (relativa !== null) tentar(b - relativa, b, true)
        }
        if (melhor) { t = melhor.t; grudouEm = melhor.marca; grudouNaBatida = melhor.naBatida }
      }
      setGuia(grudouEm === null ? null : { t: grudouEm, batida: grudouNaBatida })
      onMudar({
        ...criacao,
        musicas: criacao.musicas.map((x) => (x.id === m.id ? { ...x, entra: t, lane } : x))
      })
    }
    const soltar = () => {
      setArrastando(null)
      setGuia(null)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  // ██████████ O TOCADOR ██████████
  //
  // Ouvir é a única ferramenta que não dá pra substituir por leitura: dois
  // louvores podem estar no mesmo BPM no papel e mesmo assim se atropelarem.
  //
  // COMO FUNCIONA: uma <audio> por faixa, cada uma entrando na hora dela. Não é
  // um mixer de verdade — é o navegador tocando vários arquivos ao mesmo tempo,
  // que é exatamente o que a mistura final faz. Hora de entrada, volume e
  // velocidade valem aqui igual valem na exportação.
  //
  // O QUE ELE NÃO FAZ: mudar o TOM ao vivo. Subir semitons sem mexer na
  // velocidade é conta pesada — o Rubber Band faz isso na exportação, no motor.
  // Aqui o tom entra no arquivo final, e a tela avisa isso na letra miúda em
  // vez de fingir que está ouvindo.
  // ── LARGAR OS SONS DIREITO ──
  //
  // Aqui estava `a.src = ''`, e isso NÃO é "sem fonte": string vazia resolve pro
  // endereço da própria página, então o navegador vai buscar o documento inteiro
  // e tentar decodificar HTML como se fosse música. A carga fica pendurada, uma
  // por faixa, e mais tarde a tela engasga sem ninguém entender por quê — foi
  // assim que o fiscal travou depois de um play/parar, num passo que não tinha
  // nada a ver com som.
  //
  // Tirar o atributo e mandar recarregar é o jeito certo, e é o que o tocador do
  // estúdio de separação já fazia — eu é que não olhei o vizinho antes de
  // escrever este.
  const pararTudo = () => {
    for (const a of somRef.current.values()) {
      a.pause()
      a.removeAttribute('src')
      a.load()
      a.remove()
    }
    somRef.current.clear()
    cancelAnimationFrame(rafRef.current)
  }
  useEffect(() => () => pararTudo(), [])

  const linhaRef = useRef(null)
  const horaRef = useRef(null)
  const escrever = (t) => {
    agulhaRef.current = t
    // lê o zoom de AGORA, não o de quando esta função nasceu
    const x = 'translateX(' + (t * zoomRef.current) + 'px)'
    if (relogioRef.current) relogioRef.current.textContent = mmss(t)
    if (linhaRef.current) linhaRef.current.style.transform = x
    if (triRef.current) triRef.current.style.transform = x
    // A HORA EM CIMA DO TRIÂNGULO. O relógio lá embaixo diz a mesma coisa, mas
    // fica a meia tela de distância de onde os olhos estão — e quem está
    // apontando um ponto na música não desvia o olhar pra ler que ponto é.
    //
    // A etiqueta é presa pela ESQUERDA e centrada na mão, com um freio no zero:
    // centrada de verdade, ela sairia meia largura pra fora no começo da régua
    // e o minuto ficaria cortado bem no lugar mais visitado da tela.
    if (horaRef.current) {
      horaRef.current.textContent = mmss(t)
      horaRef.current.style.transform = 'translateX(' + Math.max(0, t * zoomRef.current - 22) + 'px)'
    }
  }
  // a cada desenho: põe os refs em dia e devolve a linha ao lugar certo com o
  // zoom novo (é isto que faz a agulha acompanhar a aproximação)
  useLayoutEffect(() => {
    zoomRef.current = zoom
    fimRef.current = fim
    ondasRef.current = ondas
    pecasRef.current = pecas
    linhaSoaRef.current = linhaSoa
    escrever(agulhaRef.current)
  })

  // ── PÔR A AGULHA: clicar ou arrastar na régua ──
  //
  // É na régua e não no campo porque no campo a mão já tem trabalho — pegar
  // peça, arrastar, soltar. Um clique que faz duas coisas dependendo de onde
  // caiu é armadilha. É também a divisão que o estúdio de separação usa.
  // ── UM TOQUE ARRASTA A LINHA; DOIS TOQUES MARCAM O TRECHO ──
  //
  // Antes, qualquer arrasto na régua marcava um trecho e ligava o loop. Só que
  // arrastar a linha pra ouvir a partir de outro ponto é o gesto mais comum que
  // existe aqui — e ele estava criando loop sem ninguém pedir, o tempo todo.
  //
  // Marcar é decisão; arrastar a agulha é navegação. Duas intenções diferentes
  // não podem sair do mesmo gesto. O segundo toque é o que separa uma da outra:
  // ele custa quase nada pra quem QUER marcar, e some do caminho de quem só
  // quer andar na música.
  const ultimoToqueRef = useRef({ quando: 0, x: 0 })
  const naRegua = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const agora = Date.now()
    const antes = ultimoToqueRef.current
    // "dois toques" com a folga de sempre: 400ms e 12px. Exigir o mesmo pixel
    // faria o segundo toque falhar na mão de quem tem pulso normal.
    const podeMarcar = agora - antes.quando < 400 && Math.abs(e.clientX - antes.x) < 12
    ultimoToqueRef.current = { quando: agora, x: e.clientX }
    const t0 = Math.max(0, Math.min(fim, (e.clientX - r.left) / zoom))
    const x0 = e.clientX
    let mexeu = false
    let marca = null
    // COM O SOM ANDANDO, o relógio do play reescreve a linha a cada quadro:
    // o clique acontecia e sumia no quadro seguinte, e parecia que a régua
    // tinha parado de funcionar. Então o som CALA enquanto a mão arrasta, a
    // linha obedece, e ao soltar ele volta do ponto novo.
    const estavaTocando = tocando
    if (estavaTocando) pararTudo()
    const leva = (ev) => {
      // 6px de folga antes de virar arrasto: sem isso um clique com a mão
      // trêmula marca um trecho de meio segundo que ninguém pediu
      if (Math.abs(ev.clientX - x0) > 6) mexeu = true
      let t = Math.max(0, Math.min(fim, (ev.clientX - r.left) / zoom))
      // A AGULHA GRUDA NOS PONTOS CRAVADOS quando não está marcando trecho.
      // Sem isso, voltar exatamente em cima de um ponto é pontaria de pixel — e
      // era isso que fazia a pessoa cravar outro em vez de tirar o de lá.
      if (!mexeu) {
        const perto = marcaPerto(t)
        if (perto !== undefined) t = perto
      }
      // só o segundo toque marca; o primeiro apenas leva a linha
      if (mexeu && podeMarcar) {
        marca = { ini: Math.min(t0, t), fim: Math.max(t0, t) }
        setTrecho(marca)
      }
      escrever(t)
      setAgulha(t)
    }
    leva(e)
    const soltar = () => {
      window.removeEventListener('pointermove', leva)
      window.removeEventListener('pointerup', soltar)
      if (podeMarcar && mexeu && marca && marca.fim - marca.ini > 0.15) {
        // MARCAR JÁ É MANDAR REPETIR
        loopAutoRef.current = true
        setLoopLigado(true)
        loopRef.current = { on: true, tr: marca }
        comecar(marca.ini)
        return
      }
      // arrastar a linha NÃO desmarca: quem está andando na música não pediu
      // pra perder o trecho que marcou. Só o clique seco solta.
      if (mexeu) { if (estavaTocando) comecar(agulhaRef.current); return }
      // clique seco: solta a marcação, e o loop sai junto se foi ela que o
      // ligou — o trecho ERA o loop
      setTrecho(null)
      if (loopAutoRef.current) { loopAutoRef.current = false; setLoopLigado(false) }
      loopRef.current = { on: loopAutoRef.current ? false : loopRef.current.on, tr: null }
      if (estavaTocando) comecar(agulhaRef.current)
    }
    window.addEventListener('pointermove', leva)
    window.addEventListener('pointerup', soltar)
  }

  // COMEÇAR DE UM PONTO QUALQUER.
  //
  // Isto era `tocar()` e só sabia partir da agulha parada. Virou uma função com
  // endereço porque mover a linha COM O SOM ANDANDO é recomeçar de outro ponto:
  // não dá pra empurrar um som que já está no ar, dá pra calar tudo e soltar de
  // novo de onde a pessoa apontou. É o que qualquer mesa faz quando se arrasta
  // o cursor tocando.
  // ── UM RELÓGIO SÓ MANDA EM TODAS AS FAIXAS ──
  //
  // A versão anterior AGENDAVA tudo no instante do play: cada peça ganhava um
  // `setTimeout` pra entrar e um vigia com o fim dela GUARDADO. Aí bastava
  // esticar uma faixa com o som andando pra ela parar no fim antigo — a linha
  // seguia em frente e não saía som nenhum, que foi exatamente o que aconteceu.
  //
  // Agora nada é agendado. O mesmo relógio que move a linha olha, a cada
  // quadro, o estado ATUAL de cada peça e decide: está dentro dela? então
  // toca; saiu? então cala. Esticar, encolher, mover, calar, mudar volume ou
  // velocidade com o som andando passa a valer na hora, porque não existe mais
  // uma cópia do passado governando nada.
  const pecasRef = useRef(pecas)
  // ── O PONTO DE RETORNO ──
  //
  // De onde este play saiu. Parar devolve a linha PRA CÁ, e não pro lugar onde a
  // música chegou: quem põe a linha num ponto quer repetir aquele ponto, e ter
  // que mirar de novo a cada parada é o trabalho que a máquina devia poupar.
  // É a mesma regra do loop, com o ponto da pessoa no lugar do trecho — e a
  // mesma que o estúdio de separação passou a seguir.
  const partiuDeRef = useRef(0)
  const comecar = (de) => {
    pararTudo()
    partiuDeRef.current = de
    escrever(de)
    inicioRef.current = Date.now() - de * 1000
    setTocando(true)
    let ultimo = de
    const passo = () => {
      const t = (Date.now() - inicioRef.current) / 1000
      escrever(t)
      // o estado anda 4x/s, só pro relógio e pros botões: escrever no estado a
      // cada quadro redesenharia o campo inteiro 60 vezes por segundo
      let bateu = false
      if (Math.abs(t - ultimo) > 0.25) { ultimo = t; setAgulha(t); bateu = true }

      // ── quem toca agora, lido do estado de AGORA ──
      const acesas = []
      for (const m of pecasRef.current) {
        const entra = Number(m.entra) || 0
        const vel = m.velocidade === undefined ? 1 : Number(m.velocidade)
        const arq = ondasRef.current[m.arquivo]?.duracao || 0
        const ini = Number(m.ini) || 0
        const fimDela = Number(m.fim) || arq
        const durNaLinha = Math.max(0, fimDela - ini) / Math.max(0.01, vel)
        const soa = linhaSoaRef.current(Number(m.lane) || 0)
        const dentro = soa && t >= entra && t < entra + durNaLinha
        let a = somRef.current.get(m.id)
        if (dentro) acesas.push(m.id)
        if (dentro) {
          if (!a) {
            // o endereço vem do `enderecoDe`, não colado aqui: peça de vão toca
            // por outra porta, e o relógio não tem que saber a diferença
            a = new Audio(enderecoDe(m))
            // preservesPitch: muda a velocidade SEM descer o tom — o mesmo
            // compromisso do rubberband na exportação
            a.preservesPitch = true
            a.dataset.peca = m.id
            somRef.current.set(m.id, a)
            sonsRef.current?.appendChild(a)
          }
          a.volume = Math.max(0, Math.min(1, m.ganho === undefined ? 1 : Number(m.ganho)))
          a.playbackRate = Math.max(0.25, Math.min(4, vel))
          const deveEstarEm = ini + (t - entra) * vel
          // só recoloca a agulha do arquivo quando ela saiu do lugar de
          // verdade: corrigir todo quadro faria o som picotar
          if (a.paused || Math.abs(a.currentTime - deveEstarEm) > 0.35) {
            a.currentTime = deveEstarEm
            // ── NÃO INSISTIR SESSENTA VEZES POR SEGUNDO ──
            //
            // Quando o arquivo não toca (foi movido de lugar, apagado, ou a
            // porta recusou), `a.paused` continua verdadeiro pra sempre — e este
            // ramo rodava A CADA QUADRO, disparando um `play()` novo sessenta
            // vezes por segundo enquanto a música inteira andasse. Centenas de
            // pedidos pendurados depois, a tela engasga em algum lugar que não
            // tem nada a ver com som, e ninguém liga uma coisa à outra.
            //
            // Uma tentativa por segundo dá conta: se foi tropeço, ele se
            // recupera; se o arquivo sumiu, o programa para de se debater.
            const agora = Date.now()
            if (a.paused && agora - (Number(a.dataset.tentou) || 0) > 1000) {
              a.dataset.tentou = String(agora)
              a.play().catch(() => {})
            }
          }
        } else if (a && !a.paused) {
          a.pause()
        }
      }
      if (bateu) setSoando(acesas)
      // ── onde este trecho acaba, e o que fazer quando acabar ──
      const lp = loopRef.current
      const temTrecho = lp.tr && lp.tr.fim - lp.tr.ini > 0.15
      const acaba = lp.on && temTrecho ? lp.tr.fim : fimRef.current
      if (t >= acaba) {
        if (lp.on) { comecar(temTrecho ? lp.tr.ini : 0); return }
        parar(de)
        return
      }
      rafRef.current = requestAnimationFrame(passo)
    }
    rafRef.current = requestAnimationFrame(passo)
  }

  // tocar é começar de onde a agulha está — e do zero quando ela já está no fim
  const tocar = () => comecar(agulhaRef.current >= fim - 0.05 ? 0 : agulhaRef.current)

  // parar devolve a agulha pra onde o play começou: é de lá que a pessoa vai
  // querer ouvir de novo, quase sempre
  const parar = (volta) => {
    pararTudo()
    setTocando(false)
    setSoando([])
    const t = volta === undefined ? partiuDeRef.current : volta
    escrever(t)
    setAgulha(t)
  }

  // ── AS SETAS DO TECLADO, as mesmas do estúdio de separação ──
  //
  // Um toque anda 10 segundos pro lado; segurando, acelera. O gesto do YouTube,
  // pedido pelo dono — e ele fez questão de dizer que são as setas DO TECLADO,
  // não botões desenhados na tela.
  //
  // A diferença daqui pro separador é o som: lá é um tocador só, aqui cada peça
  // tem o seu <audio>, e recolocar todos a cada quadro picotaria tudo. Então o
  // som CALA enquanto a tecla está presa e volta do ponto novo ao soltar — que é
  // exatamente a regra que arrastar na régua já segue.
  useEffect(() => {
    const digitando = (a) => a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)
    const ladoDa = (k) => (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0)
    let seta = null
    const soltar = () => {
      if (!seta) return
      cancelAnimationFrame(seta.raf)
      const voltaATocar = seta.tocava
      seta = null
      if (voltaATocar) comecar(agulhaRef.current)
    }
    const onDown = (e) => {
      const lado = ladoDa(e.key)
      if (!lado || digitando(e.target) || e.ctrlKey || e.altKey || e.metaKey) return
      e.preventDefault()
      if (seta) return          // repetição do teclado: quem manda é o nosso relógio
      const tocava = tocando
      if (tocava) pararTudo()
      const irPara = (t) => {
        const alvo = Math.max(0, Math.min(fimRef.current || 0, t))
        escrever(alvo)
        setAgulha(alvo)
      }
      irPara(agulhaRef.current + lado * 10)
      const nasceu = Date.now()
      let anterior = nasceu
      const passo = () => {
        const agora = Date.now()
        const segurando = (agora - nasceu) / 1000
        const dt = (agora - anterior) / 1000
        anterior = agora
        // meio segundo de carência pra um toque não virar corrida; depois abre
        // de 20 até 240 segundos por segundo
        if (segurando > 0.5) {
          const vel = Math.min(240, 20 + (segurando - 0.5) * 80)
          irPara(agulhaRef.current + lado * vel * dt)
        }
        if (seta) seta.raf = requestAnimationFrame(passo)
      }
      seta = { tocava, raf: requestAnimationFrame(passo) }
    }
    const onUp = (e) => { if (ladoDa(e.key)) soltar() }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    // sem isto, perder o foco com a tecla presa deixa a linha correndo sozinha
    window.addEventListener('blur', soltar)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', soltar)
      if (seta) cancelAnimationFrame(seta.raf)
    }
  }, [tocando]) // eslint-disable-line react-hooks/exhaustive-deps

  const sel = pecas.find((m) => m.id === escolhida) || null
  const anSel = sel ? analises[sel.arquivo] : null
  const mexer = (campo, v) => onMudar({
    ...criacao,
    musicas: criacao.musicas.map((x) => (x.id === sel.id ? { ...x, [campo]: v } : x))
  })


  // ── PEGAR NA LATERAL: ENCOLHER OU ESTICAR A FAIXA ──
  //
  // O gesto do CapCut, pedido do dono. Ele só existe porque a peça virou um
  // RECORTE: puxar a lateral é mover a borda do recorte dentro da gravação.
  //
  // As duas laterais NÃO fazem a mesma coisa espelhada, e é aí que se erra:
  //
  // · A borda DIREITA mexe só em onde o recorte acaba. A peça encolhe ou cresce
  //   pra direita e o começo dela fica onde estava.
  //
  // · A borda ESQUERDA mexe em DUAS coisas ao mesmo tempo: onde o recorte
  //   começa dentro da gravação E a hora em que a peça entra no medley. Se
  //   mexesse só no recorte, a peça encolheria pela esquerda mas continuaria
  //   entrando na mesma hora — ou seja, o som pularia pra frente sozinho. Movendo
  //   as duas juntas, a borda direita fica cravada e é a esquerda que anda, que
  //   é o que a mão está mandando.
  //
  // ESTICAR TEM LIMITE E O LIMITE É A GRAVAÇÃO: não dá pra puxar pra além do
  // que foi gravado. Chegou em 0 ou no fim do arquivo, para — e para de arrastar
  // a hora de entrada junto, senão a peça deslizaria sem crescer.
  const pegarBorda = (m, lado) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* segue */ }
    const x0 = e.clientX
    const ini0 = iniDe(m)
    const fim0 = fimDe(m)
    const entra0 = entraDe(m)
    const arq = arquivoDe(m)
    const vel = velDe(m)
    const MINIMO = 0.4          // segundos de gravação: menos que isto não é som, é clique
    setEscolhida(m.id)
    setArrastando({ id: m.id, lado })

    const mover = (ev) => {
      // um pixel vale 1/zoom segundos NA TELA, e isso vezes a velocidade é
      // quanto anda DENTRO da gravação — os dois tempos de novo
      const naTela = (ev.clientX - x0) / zoom
      const noArquivo = naTela * vel
      let campos
      if (lado === 'fim') {
        const novoFim = Math.max(ini0 + MINIMO, Math.min(arq, fim0 + noArquivo))
        campos = { fim: novoFim }
      } else {
        const novoIni = Math.max(0, Math.min(fim0 - MINIMO, ini0 + noArquivo))
        // quanto o recorte realmente andou, já com os limites aplicados
        const andou = (novoIni - ini0) / vel
        campos = { ini: novoIni, entra: Math.max(0, entra0 + andou) }
      }
      onMudar({
        ...criacao,
        musicas: criacao.musicas.map((x) => (x.id === m.id ? { ...x, ...campos } : x))
      })
    }
    const soltar = () => {
      setArrastando(null)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }


  // ██████████ O QUE SE FAZ COM UM TRECHO MARCADO ██████████
  //
  // Botão direito dentro da marcação abre duas opções: duplicar e apagar. As
  // duas trabalham em TEMPO DE TELA e precisam traduzir isso pra tempo DENTRO
  // da gravação — é a mesma dobradiça do trim, e é onde mora todo o cuidado.
  //
  // Cada peça pode estar em cinco situações em relação ao trecho [A, B]:
  //   1. fora dele                     → não muda nada
  //   2. inteira dentro                → some (apagar) / ganha uma cópia
  //   3. entra antes e acaba no meio   → perde o rabo
  //   4. começa no meio e sai depois   → perde a cabeça
  //   5. atravessa o trecho todo       → PARTE EM DUAS
  //
  // A quinta é a que se esquece, e é a que estraga a música: apagar o miolo de
  // uma faixa longa tem que deixar as duas pontas tocando.
  const noArquivo = (m, t) => iniDe(m) + Math.max(0, (t - entraDe(m))) * velDe(m)
  const fimNaTela = (m) => entraDe(m) + duracaoDe(m) / Math.max(0.01, velDe(m))

  const apagarTrecho = () => {
    if (!trecho) return
    const { ini: A, fim: B } = trecho
    const saida = []
    for (const m of criacao.musicas) {
      const c = entraDe(m)
      const f = fimNaTela(m)
      if (f <= A || c >= B) { saida.push(m); continue }        // 1. fora
      if (c >= A && f <= B) continue                            // 2. some
      if (c < A && f > B) {                                     // 5. parte em duas
        saida.push({ ...m, fim: noArquivo(m, A) })
        saida.push({
          ...m,
          id: m.id + ':d' + Date.now() + Math.random().toString(36).slice(2, 6),
          ini: noArquivo(m, B),
          entra: B
        })
        continue
      }
      if (c < A) { saida.push({ ...m, fim: noArquivo(m, A) }); continue }   // 3. perde o rabo
      saida.push({ ...m, ini: noArquivo(m, B), entra: B })                  // 4. perde a cabeça
    }
    onMudar({ ...criacao, musicas: saida })
    setTrecho(null)
    if (loopAutoRef.current) { loopAutoRef.current = false; setLoopLigado(false) }
    setMenu(null)
  }

  const duplicarTrecho = () => {
    if (!trecho) return
    const { ini: A, fim: B } = trecho
    const salto = B - A
    const copias = []
    for (const m of criacao.musicas) {
      const c = entraDe(m)
      const f = fimNaTela(m)
      if (f <= A || c >= B) continue
      // a cópia é SÓ o pedaço que estava dentro da marcação, e ela entra logo
      // depois do trecho — na mesma distância do começo dele. É isso que faz o
      // pedaço tocar duas vezes seguidas em vez de virar uma camada por cima.
      const de = Math.max(c, A)
      const ate = Math.min(f, B)
      copias.push({
        ...m,
        id: m.id + ':c' + Date.now() + Math.random().toString(36).slice(2, 6),
        ini: noArquivo(m, de),
        fim: noArquivo(m, ate),
        entra: de + salto
      })
    }
    if (!copias.length) { setMenu(null); return }
    onMudar({ ...criacao, musicas: [...criacao.musicas, ...copias] })
    setMenu(null)
  }


  // ── O QUE SE FAZ COM UMA FAIXA ──
  //
  // Faltava isto: só dava pra apagar através de um trecho marcado, então apagar
  // UMA faixa exigia marcar exatamente em cima dela primeiro. Trabalho que o
  // programa devia fazer sozinho.
  const apagarPeca = (id) => {
    onMudar({ ...criacao, musicas: criacao.musicas.filter((m) => m.id !== id) })
    if (escolhida === id) setEscolhida(null)
    setMenu(null)
  }
  const duplicarPeca = (m) => {
    // a cópia entra LOGO DEPOIS da original, na mesma linha: quem duplica uma
    // faixa quer ela de novo ali, e mandar a cópia pro fim obrigaria a arrastar
    // o caminho todo de volta
    onMudar({
      ...criacao,
      musicas: [...criacao.musicas, {
        ...m,
        id: m.id + ':f' + Date.now() + Math.random().toString(36).slice(2, 6),
        entra: entraDe(m) + duracaoDe(m) / Math.max(0.01, velDe(m))
      }]
    })
    setMenu(null)
  }
  const inteiraPeca = (m) => {
    onMudar({
      ...criacao,
      musicas: criacao.musicas.map((x) => (x.id === m.id ? { ...x, ini: 0, fim: 0 } : x))
    })
    setMenu(null)
  }
  const recortada = (m) => iniDe(m) > 0.05 || fimDe(m) < arquivoDe(m) - 0.05


  // ██████████ O VÃO ENTRE DUAS PEÇAS ██████████
  //
  // "eu fiz um vão aqui, e tipo, será que não dá pra preencher com algum efeito?
  //  não tem como se criar tipo uns efeitos, ou o sistema analisar e fazer com
  //  base no que tem... não precisa ser nada extraordinário, mas pelo menos ter
  //  algum barulho."
  //
  // O VÃO NÃO É DE UMA LINHA, É DA MÚSICA. No campo dele as duas peças estavam em
  // linhas DIFERENTES, uma acima da outra — e o buraco existia igual, porque
  // buraco é silêncio: instante em que nenhuma peça está soando, em linha
  // nenhuma. Procurar só dentro da mesma linha não teria achado o vão que ele
  // estava olhando, e o recurso nasceria sem funcionar no caso que o motivou.
  //
  // Então a conta é sobre a união de todos os pedaços: se `t` não está dentro de
  // nenhum, ando pra trás até quem acabou por último e pra frente até quem começa
  // primeiro. Essas duas são as vizinhas do vão, e são elas que dizem de onde o
  // barulho sai — a cauda vem de quem SAI, a puxada de quem ENTRA.
  const [fazendoVao, setFazendoVao] = useState(null)
  const [recadoVao, setRecadoVao] = useState(null)
  const NOMES_DE_VAO = { cauda: 'cauda', puxada: 'puxada', contagem: 'contagem' }

  const vaoEm = (t) => {
    let ini = 0
    let fim = Infinity
    let antes = null
    let depois = null
    for (const m of pecas) {
      const c = entraDe(m)
      const f = c + duracaoNaLinha(m)
      if (f - c < 0.01) continue
      if (t >= c && t < f) return null                    // aqui tem som: não é vão
      if (f <= t && f >= ini) { ini = f; antes = m }
      if (c > t && c < fim) { fim = c; depois = m }
    }
    // depois da última peça não é vão, é o fim do medley — preencher ali seria
    // pendurar um barulho no nada
    if (!isFinite(fim)) return null
    if (fim - ini < 0.15) return null
    return { ini, fim, dur: fim - ini, antes, depois }
  }

  // as vizinhas de um vão JÁ PREENCHIDO, pra poder trocar um barulho por outro.
  // Os vãos são pulados nesta conta: com o barulho ocupando o buraco, procurar
  // "quem soa antes" acharia ele mesmo e a troca ficaria girando em falso.
  const vizinhasDe = (ini, fim) => {
    let antes = null
    let depois = null
    for (const m of pecas) {
      if (m.vao) continue
      const c = entraDe(m)
      const f = c + duracaoNaLinha(m)
      if (f <= ini + 0.01 && (!antes || f > entraDe(antes) + duracaoNaLinha(antes))) antes = m
      if (c >= fim - 0.01 && (!depois || c < entraDe(depois))) depois = m
    }
    return { antes, depois }
  }
  const vaoDaPeca = (m) => {
    const ini = entraDe(m)
    const dur = duracaoNaLinha(m)
    return { ini, fim: ini + dur, dur, ...vizinhasDe(ini, ini + dur) }
  }

  // ── O PASSO DA CONTAGEM ──
  //
  // Ordem de preferência, e ela é a mesma doutrina do metrônomo: as BATIDAS que o
  // analisador achou na gravação vêm primeiro, porque só elas ficam junto de
  // banda humana (que acelera no refrão); depois o BPM, que é pulso constante; e
  // por último quatro cliques repartindo o vão.
  //
  // A última é feia, e existe de propósito: sem ela a contagem só funcionaria em
  // música já dissecada, e um botão que falha calado pra metade do acervo é pior
  // que um botão tosco que sempre bate.
  const passoDoVao = (vao) => {
    const alvo = vao.depois
    if (!alvo) return 0
    const bs = batidasNoMedley(alvo)
    if (bs.length > 1) return Math.max(0.15, bs[1] - bs[0])
    const an = analises[alvo.arquivo]
    if (an?.bpm) return Math.max(0.15, 60 / an.bpm / Math.max(0.01, velDe(alvo)))
    return 0
  }
  // OS CLIQUES CONTAM PRA TRÁS A PARTIR DA ENTRADA, nunca pra frente a partir do
  // começo do vão: quem conta "1 2 3 4" está mirando o instante em que a música
  // entra. Contando pra frente, o último clique cairia onde sobrou espaço e a
  // banda entraria em cima de um tempo quebrado.
  //
  // E conta DE QUATRO EM QUATRO quando cabe: é assim que se conta. Oito no máximo
  // — mais que isso não é contagem, é espera.
  const contagemDoVao = (vao) => {
    const passo = passoDoVao(vao) || vao.dur / 4
    let n = Math.floor((vao.dur + 0.001) / passo)
    if (n < 1) return [Math.max(0.01, vao.dur - 0.12)]
    n = Math.min(8, n)
    if (n >= 4) n = Math.floor(n / 4) * 4
    const saida = []
    for (let k = n; k >= 1; k--) {
      const c = vao.dur - k * passo
      if (c >= 0.005) saida.push(c)
    }
    return saida.length ? saida : [Math.max(0.01, vao.dur - 0.12)]
  }

  // ── CRIAR (OU TROCAR) O BARULHO DO VÃO ──
  //
  // O barulho vira um ARQUIVO e a peça é uma peça comum: é isso que faz a
  // comparação existir. Ele toca no play, se arrasta, se apaga e sai na
  // exportação sem o motor precisar saber que é especial — e o dono pode ouvir os
  // três um atrás do outro, que foi exatamente o que ele disse que precisava.
  //
  // A cauda sai do fim do RECORTE de quem sai, não do fim da gravação: se ele
  // encolheu a faixa, o último acorde que se ouve é o do recorte. (A velocidade e
  // o tom da peça vizinha não são aplicados no barulho — se ele tiver puxado o
  // tom da vizinha, dá pra puxar o do vão também, nos controles de baixo.)
  const preencher = async (tipo, vao, lane, trocando) => {
    if (tipo === 'cauda' && !vao.antes) return
    if (tipo === 'puxada' && !vao.depois) return
    setMenu(null)
    setRecadoVao(null)
    setFazendoVao(tipo)
    const fonte = tipo === 'cauda'
      ? { arquivo: vao.antes.arquivo, ate: fimDe(vao.antes) }
      : tipo === 'puxada'
        ? { arquivo: vao.depois.arquivo, de: iniDe(vao.depois) }
        : {}
    const r = await window.mptrix.emenda.vao({
      tipo,
      dur: vao.dur,
      fonte,
      cliques: tipo === 'contagem' ? contagemDoVao(vao) : []
    }).catch((e) => ({ erro: String(e?.message || e) }))
    setFazendoVao(null)
    if (!r || r.erro || !r.arquivo) {
      setRecadoVao(r?.erro || 'não deu pra criar a passagem')
      return
    }
    const id = 'vao:' + tipo + ':' + Date.now() + Math.random().toString(36).slice(2, 6)
    onMudar({
      ...criacao,
      musicas: [...criacao.musicas.filter((x) => x.id !== trocando), {
        id,
        vao: tipo,                       // é isto que faz a tela desenhar diferente
        nome: NOMES_DE_VAO[tipo],
        arquivo: r.arquivo,
        som: 'stems://s/_vaos/wav/' + r.nome,
        entra: vao.ini,
        lane,
        ini: 0,
        fim: r.duracao || vao.dur,
        ganho: 1,
        velocidade: 1,
        tom: 0,
        fadeIn: 0,
        fadeOut: 0
      }]
    })
    setEscolhida(id)
  }
  const trocarVao = (m, tipo) => preencher(tipo, vaoDaPeca(m), laneDe(m), m.id)


  // ── OS PONTOS MARCADOS ──
  //
  // Clicar na hora em cima do triângulo crava aquele ponto; clicar de novo
  // tira. É o pedido do dono, e serve pro que ninguém consegue guardar de
  // cabeça: "a virada é aqui", "aqui entra a segunda voz". A agulha some assim
  // que você a move; o ponto marcado fica.
  //
  // Eles moram na criação, então sobrevivem ao fechar o app — um ponto que se
  // perde ao sair não vale a pena marcar.
  //
  // TIRAR TEM QUE SER FÁCIL DE ACERTAR: clicar de novo com a agulha a alguns
  // pixels do ponto já tira. Exigir o mesmo milésimo de segundo seria pedir uma
  // pontaria que ninguém tem, e a pessoa acabaria com dez marcas empilhadas no
  // mesmo lugar sem entender por quê.
  const marcadas = criacao.marcas || []
  const marcaPerto = (t) => marcadas.find((x) => Math.abs(x - t) * zoom < 12)
  // TIRAR PELA PRÓPRIA BANDEIRA.
  //
  // Só dava pra tirar levando a agulha de volta em cima do ponto e clicando na
  // hora — e é aí que a coisa desandava: errar por poucos pixels não tirava,
  // CRAVAVA MAIS UM. O dono acabou com quatro marcas empilhadas tentando apagar
  // uma. Culpa do desenho: eu pedi pontaria pra desfazer.
  //
  // Agora a bandeirinha é o botão dela mesma. Você vê o ponto, clica nele, ele
  // sai — sem precisar levar nada a lugar nenhum antes.
  const tirarMarca = (t) => onMudar({ ...criacao, marcas: marcadas.filter((x) => x !== t) })
  const virarMarca = () => {
    const t = agulhaRef.current
    const achada = marcaPerto(t)
    onMudar({
      ...criacao,
      marcas: achada !== undefined
        ? marcadas.filter((x) => x !== achada)
        : [...marcadas, t].sort((a, b) => a - b)
    })
  }


  // ── APROFUNDAR A VISÃO COM A RODA ──
  //
  // O detalhe que faz isto parecer certo é a ÂNCORA: o instante que está embaixo
  // do cursor tem que continuar embaixo do cursor depois de aproximar. Sem isso
  // o conteúdo foge da mão — você mira um ponto, gira a roda, e ele escapa pro
  // lado, obrigando a caçar de novo a cada entalhe.
  //
  // A conta é uma regra de três: onde o cursor está, em segundos, vale
  // (rolagem + x) / zoom. Depois de trocar o zoom, a rolagem tem que ser
  // aquele mesmo segundo vezes o zoom novo, menos o x. Só que a rolagem nova só
  // pode ser escrita DEPOIS que o React redesenhar com a largura nova — daí a
  // âncora ficar guardada num ref e ser aplicada no layout seguinte.
  const ancoraRef = useRef(null)
  const aproximar = (fator, xNaTela) => {
    const q = quadroRef.current
    if (q) {
      const r = q.getBoundingClientRect()
      const x = xNaTela === undefined ? q.clientWidth / 2 : xNaTela - r.left
      ancoraRef.current = { t: (q.scrollLeft + x) / zoom, x }
    }
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * fator)))
  }
  useLayoutEffect(() => {
    const a = ancoraRef.current
    const q = quadroRef.current
    if (!a || !q) return
    q.scrollLeft = Math.max(0, a.t * zoom - a.x)
    ancoraRef.current = null
  }, [zoom])

  const naRoda = (e) => {
    // Shift rola de lado; a roda pelada aprofunda. Foi o dono quem pediu a roda
    // pelada — e é o gesto de qualquer editor de vídeo, que é a referência que
    // ele tem na mão.
    if (e.shiftKey) return
    e.preventDefault()
    aproximar(e.deltaY < 0 ? PASSO_DA_RODA : 1 / PASSO_DA_RODA, e.clientX)
  }

  const marcas = []
  {
    // 96px entre marcas: com a letra de 12px, 74 deixava "10:00" encostando no
    // "11:00" nos zooms baixos — régua com número colado é pior que sem número
    const minimo = 96 / zoom
    const passo = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((p) => p >= minimo) || 900
    for (let s = 0; s <= fim + passo; s += passo) {
      marcas.push(
        <div key={s} className="ruler-tick major" style={{ left: px(s) + 'px' }}>
          <span className="ruler-label">{mmss(s)}</span>
        </div>
      )
    }
  }

  return (
    <div className="fx">
      <div className="fx-topo">
        <button className="jm-voltar" onClick={onVoltar}>← as músicas</button>

        <div className="fx-zoom">
          <button className="mesa-icone" onClick={() => aproximar(1 / 1.6)} title="afastar">−</button>
          <button className="mesa-icone" onClick={() => {
            const L = (quadroRef.current?.clientWidth || 900) - 40
            const alvo = L / Math.max(1, fim)
            setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, alvo)))
          }} title="caber na tela">⤢</button>
          <button className="mesa-icone" onClick={() => aproximar(1.6)} title="aproximar">+</button>
        </div>

        {/* leitura de painel: não clica, então não tem forma de botão */}
        <span className="hud fx-hud">
          <span className="hud-cel"><b>{pecas.length}</b><i>faixas</i></span>
          <span className="hud-cel"><b className="lima">{fim ? mmss(fim) : '—'}</b><i>duração</i></span>
        </span>
      </div>

      {/* ── A COLUNA DOS CONTROLES ──
          Enxuta de propósito: o número da linha e os dois botões. Nome de
          música não entra aqui porque já está escrito em cada peça, e repetir
          a mesma informação em dois lugares só cria duas coisas pra manter
          iguais. Ela não rola com o campo: os controles têm que estar embaixo
          da mão o tempo todo, não a 4 minutos de rolagem de distância. */}
      <div className="fx-mesa">
        <div className="fx-linhas" style={{ paddingBottom: barraDeRolagem + 'px' }}>
          <div className="fx-linhas-topo" />
          {Array.from({ length: pistas }, (_, i) => {
            const vazia = !pecas.some((m) => laneDe(m) === i)
            return (
              <div key={i} className={`fx-linha-cel ${vazia ? 'vazia' : ''}`}
                style={alturasSalvas ? { height: alturaDe(i) + 'px', flex: '0 0 auto' } : { height: fatia + '%' }}>
                <span className="fx-linha-num">{i + 1}</span>
                {!vazia && (
                  <span className="fx-linha-bts">
                    <button
                      className={`fx-ms ${infoDaLinha(i).mudo ? 'on-m' : ''}`}
                      aria-pressed={!!infoDaLinha(i).mudo}
                      onClick={() => mudarLinha(i, 'mudo', !infoDaLinha(i).mudo)}
                      title="mudo: cala esta linha"
                    >M</button>
                    <button
                      className={`fx-ms ${infoDaLinha(i).solo ? 'on-s' : ''}`}
                      aria-pressed={!!infoDaLinha(i).solo}
                      onClick={() => mudarLinha(i, 'solo', !infoDaLinha(i).solo)}
                      title="isolar: ouvir só esta linha"
                    >S</button>
                  </span>
                )}
              </div>
            )
          })}
        </div>

      <div className="fx-quadro" ref={quadroRef} onWheel={naRoda}>
        <div className="fx-conteudo" style={{ width: larguraCampo + 'px' }}>
          <div className="fx-regua" onPointerDown={naRegua} title="clique ou arraste pra pôr a agulha">
            {marcas}
            {/* os pontos cravados, com a hora escrita: é a hora que faz o
                ponto servir de referência — um risco sem número não diz nada */}
            {marcadas.map((t) => (
              <span key={'m' + t} className="fx-marca-bandeira" style={{ left: px(t) + 'px' }}>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); tirarMarca(t) }}
                  title={`tirar o ponto de ${mmss(t)}`}
                >{mmss(t)}</button>
              </span>
            ))}

            {/* a barra do trecho, em cima da régua, como no separador */}
            {trecho && trecho.fim - trecho.ini > 0.15 && (
              <span className="fx-trecho-barra"
                style={{ left: px(trecho.ini) + 'px', width: px(trecho.fim - trecho.ini) + 'px' }} />
            )}
            {/* o marcador triangular, o mesmo do estúdio de separação, agora
                com a hora escrita em cima dele */}
            <button
              className={`fx-hora ${marcaPerto(agulha) !== undefined ? 'cravada' : ''}`}
              ref={horaRef}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={virarMarca}
              title="clique pra cravar este ponto; clique de novo pra tirar"
            >0:00</button>
            <span className="fx-tri" ref={triRef} aria-hidden="true" />
          </div>

          <div
            className="fx-campo"
            ref={campoRef}
            style={{ minHeight: (alturasSalvas ? alturaTotal() : pistas * ALTURA_MINIMA) + 'px' }}
            onContextMenu={(e) => {
              // O MENU FALA DO QUE ESTÁ EMBAIXO DO CURSOR. Se o dedo caiu numa
              // faixa, ele traz as ações dela; se caiu dentro de uma marcação,
              // traz as do trecho; caindo nos dois, traz os dois grupos — em
              // vez de eu escolher por ele qual dos dois ele quis.
              //
              // E o preventDefault vem SEMPRE, mesmo quando não há nada a
              // oferecer: sem ele o Chromium abre o menu branco dele por cima
              // do estúdio, com "Selecionar tudo" e afins, que não têm nada a
              // ver com o que está na tela.
              e.preventDefault()
              const r = campoRef.current.getBoundingClientRect()
              const t = (e.clientX - r.left) / zoom
              const alvo = e.target.closest('.fx-peca')
              const id = alvo?.dataset?.peca || null
              const noTrecho = !!trecho && t >= trecho.ini && t <= trecho.fim
              // E SE CAIU NO VAZIO, olho se aquele vazio é um VÃO entre duas
              // peças. Antes o botão direito no vazio não fazia nada — e é
              // justamente no vazio que se pede pra preencher o vazio.
              const v = id ? null : vaoEm(t)
              if (!id && !noTrecho && !v) { setMenu(null); return }
              if (id) setEscolhida(id)
              setMenu({
                x: e.clientX - r.left,
                y: e.clientY - r.top,
                peca: id,
                noTrecho,
                vao: v,
                // a linha em que o dedo caiu: é ali que o barulho vai pousar,
                // porque foi ali que ele apontou
                lane: Math.max(0, Math.min(pistas - 1, linhaEm(e.clientY - r.top)))
              })
            }}
          >
            {/* as pistas: faixas do fundo, pra a peça ter onde pousar */}
            {Array.from({ length: pistas }, (_, i) => (
              <div
                key={i}
                className={`fx-pista ${i === pistas - 1 ? 'vazia' : ''}`}
                // todas as linhas com a mesma fatia: a última era esticada até
                // o chão e virou um campo listrado gigante embaixo de uma tira
                // fina de música — encher a tela com listra não é encher a tela
                style={alturasSalvas
                  ? { top: topoDe(i) + 'px', height: alturaDe(i) + 'px' }
                  : { top: i * fatia + '%', height: fatia + '%' }}
              />
            ))}

            {/* AS DIVISÓRIAS: puxar muda a altura da faixa de cima. Ficam na
                emenda entre duas linhas, que é onde a mão procura. */}
            {Array.from({ length: pistas }, (_, i) => (
              <div
                key={'d' + i}
                className="fx-divisoria"
                style={alturasSalvas
                  ? { top: topoDe(i) + alturaDe(i) - 3 + 'px' }
                  : { top: `calc(${(i + 1) * fatia}% - 3px)` }}
                onPointerDown={puxarDivisoria(i)}
                onDoubleClick={voltarAoAutomatico}
                title="puxe pra mudar a altura desta faixa · dois cliques volta ao automático"
              />
            ))}

            {/* os pontos cravados, atravessando as faixas por trás de tudo */}
            {marcadas.map((t) => (
              <div key={'mc' + t} className="fx-marca-linha" style={{ left: px(t) + 'px' }} aria-hidden="true" />
            ))}

            {/* o trecho marcado, atravessando as faixas */}
            {trecho && trecho.fim - trecho.ini > 0.15 && (
              <div className="fx-trecho"
                style={{ left: px(trecho.ini) + 'px', width: px(trecho.fim - trecho.ini) + 'px' }}
                aria-hidden="true" />
            )}

            {menu && (() => {
              const alvo = menu.peca ? pecas.find((m) => m.id === menu.peca) : null
              return (
                <>
                  {/* o pano por baixo: clicar fora fecha, que é como todo menu
                      de botão direito se comporta */}
                  <div className="fx-menu-pano" onPointerDown={() => setMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setMenu(null) }} />
                  <div className="fx-menu" style={{ left: menu.x + 'px', top: menu.y + 'px' }}>
                    {alvo && alvo.vao && (() => {
                      // TROCAR UM BARULHO PELO OUTRO NO MESMO LUGAR. É a peça
                      // central do pedido dele: "isso é algo que eu preciso
                      // testar e ver qual fica melhor". Obrigar a apagar e
                      // remarcar o vão a cada tentativa mataria a comparação.
                      const v = vaoDaPeca(alvo)
                      const outros = ['cauda', 'puxada', 'contagem']
                        .filter((x) => x !== alvo.vao)
                        .filter((x) => (x === 'cauda' ? !!v.antes : x === 'puxada' ? !!v.depois : true))
                      return (
                        <>
                          <span className="fx-menu-olho">passagem: {alvo.vao}</span>
                          {outros.map((x) => (
                            <button key={x} onClick={() => trocarVao(alvo, x)}>
                              Trocar pela {x}
                            </button>
                          ))}
                          {/* APAGAR SE CHAMA APAGAR. Aqui estava escrito "Tirar a
                              passagem" e o dono olhou o menu e disse que faltava
                              a opção de deletar — ela estava ali, com outro nome.
                              O resto do app diz "Apagar faixa" e "Apagar trecho";
                              inventar um sinônimo só pra esta linha fez a ação
                              existir e não ser encontrada, que é o mesmo que
                              não existir. */}
                          <button className="perigo" onClick={() => apagarPeca(alvo.id)}>
                            Apagar a passagem
                          </button>
                        </>
                      )
                    })()}
                    {alvo && !alvo.vao && (
                      <>
                        <span className="fx-menu-olho" title={alvo.nome}>{alvo.nome}</span>
                        <button onClick={() => duplicarPeca(alvo)}>Duplicar faixa</button>
                        {recortada(alvo) && (
                          <button onClick={() => inteiraPeca(alvo)}>Voltar à música inteira</button>
                        )}
                        <button className="perigo" onClick={() => apagarPeca(alvo.id)}>Apagar faixa</button>
                      </>
                    )}

                    {/* ── O VÃO ──
                        Três opções e nenhuma escolhida por mim: ele disse que
                        precisa ouvir pra saber. A cauda só aparece se houver
                        peça ANTES (não há último acorde sem quem sai), e a
                        puxada só se houver peça DEPOIS. */}
                    {menu.vao && (
                      <>
                        <span className="fx-menu-olho">
                          vão de {menu.vao.dur.toFixed(1)}s · preencher com
                        </span>
                        {menu.vao.antes && (
                          <button onClick={() => preencher('cauda', menu.vao, menu.lane)}>
                            A cauda <em>o acorde que sai, ecoando</em>
                          </button>
                        )}
                        {menu.vao.depois && (
                          <button onClick={() => preencher('puxada', menu.vao, menu.lane)}>
                            A puxada <em>a próxima ao contrário, subindo</em>
                          </button>
                        )}
                        <button onClick={() => preencher('contagem', menu.vao, menu.lane)}>
                          A contagem <em>cliques no tempo da próxima</em>
                        </button>
                      </>
                    )}
                    {menu.vao && (alvo || menu.noTrecho) && <span className="fx-menu-fio" />}
                    {alvo && menu.noTrecho && <span className="fx-menu-fio" />}
                    {menu.noTrecho && trecho && (
                      <>
                        <span className="fx-menu-olho">
                          trecho {mmss(trecho.ini)} → {mmss(trecho.fim)}
                        </span>
                        <button onClick={duplicarTrecho}>Duplicar trecho</button>
                        <button className="perigo" onClick={apagarTrecho}>Apagar trecho</button>
                      </>
                    )}
                  </div>
                </>
              )
            })()}

            {/* A LINHA. Atravessa TODAS as faixas, de cima a baixo, e fica
                onde foi posta mesmo com o som parado — é ela que diz "aqui". */}
            <div className="fx-agulha" ref={linhaRef} aria-hidden="true"><span /></div>

            {/* a linha de grude: só aparece enquanto a peça está colada */}
            {guia !== null && (
              <div
                className={`fx-guia ${guia.batida ? 'na-batida' : ''}`}
                style={{ left: px(guia.t) + 'px' }}
              >
                {guia.batida && <em>na batida</em>}
              </div>
            )}

            {pecas.map((m, i) => {
              const o = ondas[m.arquivo]
              const an = analises[m.arquivo]
              // A PASSAGEM NÃO ENTRA NA ESCALA DAS MÚSICAS. Ela não é um louvor,
              // é a costura entre dois — e pintá-la com a cor de um stem faria
              // ela parecer uma faixa a mais na conta. O verde apagado da escala
              // ("Outros") é justamente o que a casa usa pra "som sem dono".
              // (em hex e não em var() porque esta cor também pinta a ONDA, e
              // canvas não entende variável de CSS — fillStyle com var() falha
              // calado e a onda sai preta)
              const cor = m.vao ? COR_VAO : CORES[i % CORES.length]
              const dur = duracaoNaLinha(m)
              return (
                <div
                  key={m.id}
                  className={`fx-peca ${m.vao ? 'fx-vao vao-' + m.vao : ''} ${arrastando?.id === m.id ? 'arrastando' : ''} ${escolhida === m.id ? 'sel' : ''} ${!linhaSoa(laneDe(m)) ? 'calada' : ''} ${soando.includes(m.id) ? 'soando' : ''}`}
                  style={{
                    left: px(entraDe(m)) + 'px',
                    width: Math.max(28, px(dur)) + 'px',
                    top: alturasSalvas
                      ? topoDe(laneDe(m)) + 6 + 'px'
                      : `calc(${laneDe(m) * fatia}% + 6px)`,
                    height: alturasSalvas
                      ? alturaDe(laneDe(m)) - 12 + 'px'
                      : `calc(${fatia}% - 12px)`,
                    '--cor': cor
                  }}
                  data-peca={m.id}
                  onPointerDown={pegar(m)}
                  title={`${m.nome} — entra em ${mmss(entraDe(m))}`}
                >
                  {o ? (
                    <Onda
                      onda={o.onda}
                      cor={cor}
                      de={iniDe(m) / (o.duracao || 1)}
                      ate={fimDe(m) / (o.duracao || 1)}
                    />
                  ) : null}
                  {/* ── A RAMPA É SÓ DESENHO; QUEM PEGA É A BOLINHA ──
                      Antes a rampa inteira era a área de pegar, e ela ocupava a
                      borda de cima a baixo — em cima da alça de encolher. O dono
                      não conseguia mais puxar a lateral da faixa: a rampa
                      roubava todo gesto na beirada, e ele teve que descobrir a
                      bolinha pra desviar dela.
                      A divisão agora é por ALTURA, que é como todo editor de
                      vídeo resolve: a bolinha da rampa manda no alto, a alça de
                      encolher manda no resto — que é a maior parte da faixa. */}
                  <span
                    className="fx-ponta fx-ponta-e"
                    style={{ width: Math.max(9, px(fadeInDe(m))) + 'px' }}
                    aria-hidden="true"
                  />
                  <span
                    className="fx-ponta fx-ponta-d"
                    style={{ width: Math.max(9, px(fadeOutDe(m))) + 'px' }}
                    aria-hidden="true"
                  />
                  <span className="fx-alca fx-alca-e" onPointerDown={pegarBorda(m, 'ini')}
                    title="puxe pra encolher ou esticar pela esquerda" />
                  <span className="fx-alca fx-alca-d" onPointerDown={pegarBorda(m, 'fim')}
                    title="puxe pra encolher ou esticar pela direita" />
                  {/* a bolinha mora no ALTO DA RAMPA — no ponto onde o volume
                      chega no máximo, que é o que ela controla */}
                  <span
                    className="fx-bolinha fx-bolinha-e"
                    style={{ left: (Math.max(9, px(fadeInDe(m))) - 6) + 'px' }}
                    onPointerDown={pegarPonta(m, 'in')}
                    title="puxe pra dentro: a faixa entra suave"
                  />
                  <span
                    className="fx-bolinha fx-bolinha-d"
                    style={{ right: (Math.max(9, px(fadeOutDe(m))) - 6) + 'px' }}
                    onPointerDown={pegarPonta(m, 'out')}
                    title="puxe pra dentro: a faixa sai suave"
                  />
                  <span className="fx-tarja">
                    {/* só o tipo, sem "passagem ·" na frente: a peça é curta e o
                        prefixo comia o nome inteiro numa faixa de dois segundos.
                        Quem diz que não é música é a borda tracejada, não a
                        palavra — e ela diz isso em qualquer largura. */}
                    <b>{m.vao || m.nome}</b>
                    <em>
                      {/* a passagem é curta: em minuto:segundo ela viraria
                          "0:02" e some a diferença entre 1,5s e 2,4s, que é
                          justamente o que se está ajustando nela */}
                      {mmss(entraDe(m))}
                      {dur ? ` · ${m.vao ? dur.toFixed(1) + 's' : mmss(dur)}` : ''}
                      {fadeInDe(m) > 0.05 || fadeOutDe(m) > 0.05
                        ? ` · rampa ${fadeInDe(m).toFixed(1)}s↗ ${fadeOutDe(m).toFixed(1)}s↘`
                        : ''}
                      {iniDe(m) > 0.05 || fimDe(m) < arquivoDe(m) - 0.05
                        ? ` · recorte ${mmss(iniDe(m))}→${mmss(fimDe(m))}`
                        : ''}
                      {an?.tom ? ` · ${an.tom}` : ''}
                    </em>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      </div>

      {/* ██ AS FERRAMENTAS ██
          O play é do medley inteiro; volume, velocidade, tom e BPM são DA FAIXA
          escolhida. Não é detalhe: num medley o que faz duas músicas caberem
          uma na outra é mexer numa delas, não nas duas. Sem faixa escolhida os
          controles somem e a barra diz por quê. */}
      <div className="fx-ferramentas">
        <button className="ed-tp ed-tp-play" onClick={() => (tocando ? parar() : tocar())}
          title={tocando ? 'parar' : 'tocar o medley'}>
          {tocando ? '\u25a0' : '\u25b6'}
        </button>
        {/* o loop do transporte: com trecho marcado repete o trecho, sem
            trecho repete o medley inteiro — a mesma regra do separador */}
        <button
          className={`fx-loop ${loopLigado ? 'on' : ''}`}
          aria-pressed={loopLigado}
          onClick={() => { loopAutoRef.current = false; setLoopLigado((v) => !v) }}
          title={trecho ? 'Loop: repete o trecho marcado' : 'Loop: repete o medley inteiro'}
        >{'\u21bb'}</button>

        <span className="mesa-relogio">
          <b ref={relogioRef}>{mmss(agulha)}</b><i>/ {mmss(fim)}</i>
        </span>

        <span className="fx-sep" />

        {sel ? (
          <>
            <span className="fx-alvo" style={{ '--cor': CORES[pecas.indexOf(sel) % CORES.length] }}>
              <i />{sel.nome}
            </span>

            <label className="fx-ctrl" title="volume desta faixa">
              volume
              <input type="range" min="0" max="200" step="5"
                value={Math.round(volDe(sel) * 100)}
                onChange={(e) => mexer('ganho', Number(e.target.value) / 100)} />
              <b>{Math.round(volDe(sel) * 100)}%</b>
            </label>

            <label className="fx-ctrl" title="velocidade desta faixa — o tom não desce junto">
              velocidade
              <input type="range" min="50" max="150" step="1"
                value={Math.round(velDe(sel) * 100)}
                onChange={(e) => mexer('velocidade', Number(e.target.value) / 100)} />
              <b>{Math.round(velDe(sel) * 100)}%</b>
            </label>

            <label className="fx-ctrl" title="sobe ou desce em semitons — a velocidade não muda junto">
              tom
              <input type="range" min="-12" max="12" step="1"
                value={tomDe(sel)}
                onChange={(e) => mexer('tom', Number(e.target.value))} />
              <b>{tomDe(sel) > 0 ? '+' : ''}{tomDe(sel)}{anSel && anSel.tom ? ' \u00b7 ' + anSel.tom : ''}</b>
            </label>

            {/* BPM NÃO É CONTROLE À PARTE: mudar o andamento É mudar a
                velocidade. Digitar o BPM é só dizer a mesma coisa no número que
                o músico usa — e é assim que se põe duas músicas no mesmo passo. */}
            <label className="fx-ctrl fx-bpm" title="digite o BPM que você quer — vira velocidade">
              bpm
              <input type="number" min="30" max="300"
                value={anSel && anSel.bpm ? Math.round(anSel.bpm * velDe(sel)) : ''}
                disabled={!(anSel && anSel.bpm)}
                onChange={(e) => {
                  const alvo = Number(e.target.value)
                  if (!(anSel && anSel.bpm) || !alvo) return
                  mexer('velocidade', Math.max(0.5, Math.min(1.5, alvo / anSel.bpm)))
                }} />
            </label>

            {(volDe(sel) !== 1 || velDe(sel) !== 1 || tomDe(sel) !== 0) && (
              <button className="mesa-icone" title="voltar esta faixa ao original"
                onClick={() => onMudar({
                  ...criacao,
                  musicas: criacao.musicas.map((x) => (x.id === sel.id
                    ? { ...x, ganho: 1, velocidade: 1, tom: 0 } : x))
                })}>{'\u21ba'}</button>
            )}
          </>
        ) : (
          <span className="fx-semalvo">
            clique numa faixa pra mexer no volume, na velocidade e no tom dela
          </span>
        )}
      </div>

      {/* o porta-sons: invisível, mas parte da página */}
      <div className="fx-sons" ref={sonsRef} aria-hidden="true" />

      <div className="fx-pe">
        {/* CRIAR A PASSAGEM DEMORA UM PISCAR, e um piscar sem aviso parece que o
            clique não pegou — aí a pessoa clica de novo e cria duas. */}
        {fazendoVao && <p className="em-passo">criando a {fazendoVao}…</p>}
        {recadoVao && <p className="em-erro">⚠ {recadoVao}</p>}
        {exportando && (
          <>
            <div className="em-barra"><div className="em-barra-in" style={{ width: pct + '%' }} /></div>
            <p className="em-passo">juntando… {pct}%</p>
          </>
        )}
        {erro && <p className="em-erro">⚠ {erro}</p>}
        {feito && (
          <div className="em-pronto">
            <b>Pronto: {feito.nome}</b>
            <div className="em-pronto-acoes">
              <button className="btn-secondary btn-small"
                onClick={() => window.mptrix.shell.showInFolder(feito.arquivo)}>ver na pasta</button>
              <button className="btn-secondary btn-small"
                onClick={() => window.mptrix.shell.openPath(feito.arquivo)}>ouvir</button>
            </div>
          </div>
        )}
        {!exportando && !feito && (
          <p className="fx-recado">
            Arraste as faixas pra onde quiser: <b>do lado</b> vira sequência,
            <b> por cima</b> as duas tocam juntas, <b>longe</b> deixa silêncio.
            Segure <b>Alt</b> pra soltar sem grudar — sem ele a peça encaixa
            <b> na batida</b> da música vizinha. Os <b>cantos de cima</b> puxam
            pra dentro e fazem a faixa entrar e sair suave. Na régua, <b>arraste</b> pra
            mover a linha; <b>dois toques e arraste</b> marca um trecho — marcar
            já manda repetir; um <b>clique</b> solta a marcação. Com um trecho marcado, o <b>botão direito</b> dentro dele
            duplica ou apaga aquele pedaço. <b>Botão direito num buraco</b> entre
            duas faixas preenche o vão com <b>cauda</b>, <b>puxada</b> ou <b>contagem</b> —
            e no botão direito da passagem dá pra trocar uma pela outra e comparar. O <b>tom</b> entra só no
            arquivo final — no play aqui ele ainda não é ouvido.
          </p>
        )}
      </div>
    </div>
  )
}

/* a onda da faixa, corpo cheio espelhado — no tamanho em que ela aparece,
   barrinha vira chuvisco e some */
function Onda({ onda, cor, de = 0, ate = 1 }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const desenhar = () => {
      const dpr = window.devicePixelRatio || 1
      const L = c.clientWidth
      const A = c.clientHeight
      if (!L || !A) return
      if (c.width !== Math.round(L * dpr) || c.height !== Math.round(A * dpr)) {
        c.width = Math.round(L * dpr); c.height = Math.round(A * dpr)
      }
      const g = c.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, L, A)
      if (!onda?.length) return
      const meio = A / 2
      const alt = A * 0.40
      // desenha SO A FATIA que toca: a peça é um recorte, e mostrar o arquivo
      // inteiro dentro dela seria desenhar som que não vai sair
      const a = Math.max(0, Math.floor(de * onda.length))
      const b = Math.max(a + 1, Math.floor(ate * onda.length))
      const em = (x) => onda[a + Math.floor((x / L) * (b - a))] || 0
      g.beginPath()
      g.moveTo(0, meio)
      for (let x = 0; x <= L; x++) g.lineTo(x, meio - em(x) * alt)
      for (let x = L; x >= 0; x--) g.lineTo(x, meio + em(x) * alt)
      g.closePath()
      g.fillStyle = cor
      g.globalAlpha = 0.6
      g.fill()
      g.globalAlpha = 1
    }
    desenhar()
    const ro = new ResizeObserver(desenhar)
    ro.observe(c)
    return () => ro.disconnect()
  }, [onda, cor, de, ate])
  return <canvas ref={ref} className="fx-onda" />
}
