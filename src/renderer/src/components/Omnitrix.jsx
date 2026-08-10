import { useEffect, useRef, useState } from 'react'
import Ico from './Icones.jsx'

// ██████ A RODA ██████
//
// Aceno direto ao Omnitrix do Omniverse: o relógio abre uma coroa com as
// formas em volta e você gira até a que quer. Aqui as "formas" são os
// formatos de download.
//
// Ela não é enfeite temático — existe porque encurta o caminho. Antes: copiar
// o link no navegador, voltar pro MPTRIX, abrir BAIXAR, escolher o formato,
// colar o link, confirmar. O passo de colar é trabalho que o computador já
// podia fazer sozinho, porque ele sabe o que está na área de transferência.
// Agora: copiou lá fora, a ampulheta enche aqui, aperta e escolhe a forma.
//
// A AMPULHETA É A MARCA DA TELA, não um selo no canto. Ela já ocupava aquele
// lugar como marca d'água — só que era desenho morto, enfeite pra dar peso ao
// palco. Agora o mesmo desenho é o relógio: parado quando não há nada, batendo
// quando acha um link, enchendo quando a mão chega perto. A marca virou o
// instrumento, e é isso que faz a tela parecer o Omnitrix em vez de parecer um
// aplicativo com um adesivo do Ben 10.
//
// Três estados, e cada um só diz o que é verdade:
//   parada  — nada copiado. Não pisca, não convida, não promete.
//   armada  — achou link. Bate devagar: chama sem gritar.
//   cheia   — mão em cima. A areia sobe até encher, e aí pode apertar.

// OS ALIENS. Quatro, e cada um faz uma coisa que os outros não fazem.
//
// Antes eram sete, e seis deles eram o mesmo alien de roupa diferente: MP3,
// LISTA, RÁPIDO, M4A, WAV e VÍDEO são todos "baixar" — mudava o formato, não
// o ato. Formato é ajuste técnico, e ajuste técnico é obrigação do sistema:
// o app sabe que MP3 serve pra ouvir, que M4A é o material limpo pra separar,
// e que "list=" sem "v=" quer dizer lista inteira. Perguntar isso era devolver
// pra pessoa uma conta que a máquina já sabia fazer.
//
// O que sobrou são atos de verdade — e é isso que faz a roda ser rápida como
// o relógio do desenho: liga, olha, escolhe. Sem submenu, sem menu de menu.
const FORMAS = [
  { id: 'baixar', rot: 'MÚSICA', sub: 'baixar' },
  { id: 'video', rot: 'VÍDEO', sub: 'baixar' },
  { id: 'separar', rot: 'SEPARAR', sub: 'instrumentos', destino: true },
  { id: 'arquivo', rot: 'DO PC', sub: 'já é sua' }
]

// A explicação de cada um. Ela muda com o que está na área de transferência,
// porque o mesmo alien faz coisa diferente conforme o que encontra — que é
// exatamente como o relógio do desenho se comporta.
function explicar(id, { temLink, soLista }) {
  if (id === 'baixar') {
    if (soLista) return 'Abre a lista pra você escolher quais músicas quer, e baixa em MP3.'
    if (temLink) return 'Baixa a música em MP3, com qualidade máxima e capa do vídeo.'
    return 'Baixa uma música em MP3. Como não tem link copiado, ele vai pedir o endereço.'
  }
  if (id === 'video') {
    if (temLink) return 'Baixa o vídeo na qualidade que você escolher (até 8K).'
    return 'Baixa um vídeo. Como não tem link copiado, ele vai pedir o endereço.'
  }
  if (id === 'separar') {
    if (temLink) return 'Baixa o áudio na qualidade nativa (sem reconverter) e abre direto no Estúdio pra separar os instrumentos.'
    return 'Escolhe uma música do seu computador e abre no Estúdio pra separar os instrumentos.'
  }
  return 'Abre uma música que já está no seu computador — gravação, pen drive, qualquer arquivo de som.'
}

const R_EXT = 200   // raio de fora da coroa
const R_INT = 96    // raio de dentro (o buraco onde mora a ampulheta)
const CENTRO = 220  // metade do lado do svg

// Fatia da coroa. Uma por forma, com folga entre elas — sem a folga a roleta
// vira um anel só e some a leitura de "são seis coisas separadas".
function fatia(i, total, folgaGrau = 2.6) {
  const passo = 360 / total
  const ini = (i * passo - 90 + folgaGrau / 2) * (Math.PI / 180)
  const fim = ((i + 1) * passo - 90 - folgaGrau / 2) * (Math.PI / 180)
  const p = (r, a) => [CENTRO + r * Math.cos(a), CENTRO + r * Math.sin(a)]
  const [x1, y1] = p(R_EXT, ini)
  const [x2, y2] = p(R_EXT, fim)
  const [x3, y3] = p(R_INT, fim)
  const [x4, y4] = p(R_INT, ini)
  const grande = passo > 180 ? 1 : 0
  return `M${x1} ${y1} A${R_EXT} ${R_EXT} 0 ${grande} 1 ${x2} ${y2} L${x3} ${y3} A${R_INT} ${R_INT} 0 ${grande} 0 ${x4} ${y4} Z`
}

// centro da fatia, pra pendurar o rótulo
function meio(i, total, raio) {
  const ang = ((i + 0.5) * (360 / total) - 90) * (Math.PI / 180)
  return [CENTRO + raio * Math.cos(ang), CENTRO + raio * Math.sin(ang)]
}

// A MARCA, desenhada como o relógio de verdade.
//
// Eu tinha feito ao contrário: ampulheta lima desenhada no escuro. No
// Omnitrix é o oposto — a CHAPA acende e a ampulheta é o vazio preto por
// cima dela. Essa inversão é a marca inteira: sem a chapa acesa a silhueta
// vira um risco verde no escuro, que foi exatamente o que ficou.
//
// Então a chapa é um hexágono (a forma da casa) e a ampulheta é um furo nela,
// feito com máscara. O que "enche" agora é a CHAPA, subindo de baixo pra
// cima — que é o carregador do relógio, não areia de ampulheta. O furo fica
// preto o tempo todo, e é por isso que a marca se lê de longe.
const HEX = 'M50 4 L93 29 L93 81 L50 106 L7 81 L7 29 Z'
// Aresta reta, não curva. A primeira versão tinha as laterais em curva e
// ficava com cara de taça — o símbolo do relógio é anguloso: duas cunhas
// retas se encontrando num pescoço fino. Curva suaviza, e o que dá
// personalidade a essa marca é justamente a quina.
const AMPULHETA_D = 'M4.5 2H19.5L13.4 12L19.5 22H4.5L10.6 12Z'
// leva a ampulheta de 24x24 pro meio do hexágono de 100x110
const AMPULHETA_POSE = 'translate(17.6 22.6) scale(2.7)'

// mm:ss — duração só ajuda se for legível de relance.
// (Esta função já existia e eu a apaguei sem querer ao trocar o bloco da
// marca: ela morava colada nele. Como só é chamada quando há informação
// carregada, o erro ficou escondido até alguém abrir a roda com um nome já
// buscado na memória — que é justamente o caso que quebrou.)
function relogio(seg) {
  if (!seg && seg !== 0) return null
  const m = Math.floor(seg / 60)
  const s = Math.round(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Omnitrix({ ligado = true, onEscolher }) {
  const [link, setLink] = useState(null)
  const [aberta, setAberta] = useState(false)
  const [sobre, setSobre] = useState(null)
  // o que foi copiado, por extenso. O endereço do site diz de onde veio, não
  // O QUE é — e "youtube.com" não ajuda ninguém a confirmar que copiou a
  // música certa.
  const [info, setInfo] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const infoCache = useRef({})

  useEffect(() => {
    // pergunta o que já está na área ANTES de passar a escutar: a marca só
    // existe na tela do estúdio, e o motor avisa uma vez por link. Quem
    // copiou estando no acervo teria o aviso perdido no ar e chegaria aqui
    // com a marca parada e um link válido na mão.
    window.mptrix.clipboard.atual?.().then((achado) => {
      if (achado) setLink((atual) => atual || achado)
    })
    return window.mptrix.clipboard.onLink((achado) => {
      setLink(achado)
      setAberta(false)
      setSobre(null)
    })
  }, [])

  // Esc fecha: a roda cobre a tela inteira, e quem abriu sem querer precisa de
  // uma saída que não exija mirar em nada
  useEffect(() => {
    if (!aberta) return
    const aoTeclar = (e) => { if (e.key === 'Escape') setAberta(false) }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberta])

  // BUSCA O NOME SÓ QUANDO A RODA ABRE, nunca ao detectar o link. Descobrir o
  // título custa uma chamada de rede pelo yt-dlp; fazer isso a cada link
  // copiado seria gastar banda por conta própria pra 90% dos links que a
  // pessoa nem vai baixar. Abrir a roda é intenção declarada.
  //
  // E A PERGUNTA MUDA CONFORME O LINK. A consulta de vídeo roda com
  // "--no-playlist": num endereço de playlist pura não existe vídeo nenhum
  // pra ela descrever, e ela voltava de mãos vazias — era por isso que o
  // mostrador dizia "não deu pra ler o nome" numa playlist inteira. Playlist
  // tem consulta própria, que devolve o nome da lista e quantas músicas tem.
  useEffect(() => {
    // sem link, a ficha do que foi copiado tem que sumir junto: senão o
    // mostrador continuaria exibindo a música da vez passada, dizendo que
    // ela está copiada quando não está mais
    if (!link) { setInfo(null); setBuscando(false); return }
    if (!aberta) return
    const url = link.url
    const guardado = infoCache.current[url]
    // "thumbnail" AUSENTE não é o mesmo que "thumbnail vazio": ausente quer
    // dizer que este endereço foi consultado quando eu ainda nem guardava a
    // capa, e o guardado velho ficaria pra sempre sem ela. Cache tem que se
    // curar sozinho quando o que a gente guarda muda de forma.
    if (guardado && 'thumbnail' in guardado) { setInfo(guardado); return }
    setInfo(null)
    setBuscando(true)
    let vivo = true

    const guardar = (i) => {
      if (!vivo) return
      if (i) infoCache.current[url] = i
      setInfo(i)
    }

    const pedido = soLista
      ? window.mptrix.playlist.probe(url).then((r) => {
        const pl = r?.playlist || r?.info || r
        if (!pl?.title) return null
        const n = pl.totalCount || pl.entries?.length || 0
        return {
          title: pl.title,
          uploader: n ? `${n} música${n !== 1 ? 's' : ''}` : null,
          duration: null,
          // a capa da lista é a capa da primeira música: playlist não tem
          // imagem própria, e a primeira é a que a pessoa viu ao copiar
          thumbnail: pl.entries?.[0]?.thumbnail || null,
          lista: true
        }
      })
      : window.mptrix.video.probe(url).then((r) => (r?.info
        ? { title: r.info.title, uploader: r.info.uploader, duration: r.info.duration, thumbnail: r.info.thumbnail }
        : null))

    pedido
      .then(guardar)
      .catch(() => { /* sem nome: o endereço do site continua ali */ })
      .finally(() => { if (vivo) setBuscando(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, link])

  // ARMADA quer dizer "tem link copiado" — não quer dizer "pode usar". A roda
  // existe sempre: sem link ela ainda abre música do computador e ainda pede
  // o endereço pra baixar. Antes ela só nascia com link, e aí metade do que
  // ela faz não tinha porta nenhuma.
  const armada = !!link

  // playlist PURA: endereço de lista sem nenhum vídeo apontado. Se tem "v=",
  // é uma música que por acaso está dentro de uma lista — e aí quem a pessoa
  // copiou foi a música.
  const soLista = (() => {
    if (!link?.playlist) return false
    try { return !new URL(link.url).searchParams.get('v') } catch { return false }
  })()

  // playlist copiada abre já apontando pro formato de playlist: baixar 40
  // músicas uma a uma seria castigo
  const sugerido = 'baixar'
  const escolhida = FORMAS.find((f) => f.id === (sobre || sugerido)) || FORMAS[0]
  // a explicação vem do próprio motor: texto copiado pra cá divergiria do que
  // o download realmente faz na primeira vez que alguém mexesse num preset
  const explica = (id) => explicar(id, { temLink: !!link, soLista })


  const escolher = (id) => {
    const url = link?.url || null
    setAberta(false)
    // o link só é consumido por quem precisa dele: "do PC" não mexe na área
    // de transferência, e apagá-lo ali faria a marca parar de bater sem
    // motivo nenhum
    if (id !== 'arquivo') setLink(null)
    onEscolher?.(id, url)
  }

  return (
    <>
      {/* A MARCA. Fica no mesmo lugar da antiga marca d'água do palco. */}
      <button
        className={`marca ${armada ? 'armada' : ''}`}
        type="button"
        onClick={() => setAberta(true)}
        title={armada
          ? `Link copiado de ${link.host} — escolher o que fazer`
          : 'Abrir a roda. Com um link copiado ela já vem carregada.'}
      >
        <svg className="marca-svg" viewBox="0 0 100 110" aria-hidden="true">
          <defs>
            {/* A ampulheta é um FURO na chapa, não um desenho por cima: é
                assim no relógio, e é o que faz a marca ser reconhecida. */}
            <mask id="marca-chapa">
              <path d={HEX} fill="#fff" />
              <path d={AMPULHETA_D} transform={AMPULHETA_POSE} fill="#000" />
            </mask>
            {/* O NÍVEL DA CARGA. Vazio = retângulo de altura zero no pé.
                Chromium anima y e height de retângulo como propriedade de
                estilo, então encher é transição normal — nada de contar
                quadro no JavaScript.
                Não usei degradê com o ponto de corte animado porque "offset"
                não é propriedade animável em parada de degradê: no Chromium
                esse nome pertence ao caminho de movimento. */}
            <clipPath id="marca-carga">
              <rect className="marca-nivel" x="0" width="100" />
            </clipPath>
          </defs>

          <g mask="url(#marca-chapa)">
            <rect className="marca-fantasma" x="0" y="0" width="100" height="110" />
            <rect className="marca-cheia" x="0" y="0" width="100" height="110" clipPath="url(#marca-carga)" />
          </g>
          {/* aro por fora: dá borda à chapa e sobrevive mesmo com ela apagada,
              então a marca nunca some de vez */}
          <path d={HEX} className="marca-aro" />
        </svg>
        {armada && <span className="marca-fala">{link.host}</span>}
      </button>

      {aberta && (
        <div className="omni-palco" onClick={() => setAberta(false)}>
          {/* coroa e mostrador empilhados numa coluna. Antes o mostrador era
              pendurado com posição absoluta e um número na mão — e bastava o
              texto crescer uma linha pra ele subir por cima das fatias de
              baixo. Empilhar deixa a conta com o navegador. */}
          <div className="omni-conjunto" onClick={(e) => e.stopPropagation()}>
          <div className="omni-roda-caixa">
            <svg className="omni-roda" viewBox="0 0 440 440">
              {FORMAS.map((f, i) => {
                const ativa = (sobre || sugerido) === f.id
                // sem yt-dlp/ffmpeg só o arquivo do computador funciona; as
                // outras três apagam em vez de prometer o que não podem fazer
                const morta = !ligado && f.id !== 'arquivo'
                const [tx, ty] = meio(i, FORMAS.length, (R_EXT + R_INT) / 2)
                return (
                  <g
                    key={f.id}
                    className={`omni-fatia ${ativa ? 'on' : ''} ${f.id === sugerido ? 'sugerida' : ''} ${f.destino ? 'destino' : ''} ${morta ? 'morta' : ''}`}
                    onMouseEnter={() => setSobre(f.id)}
                    onClick={() => { if (!morta) escolher(f.id) }}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    {/* tooltip nativo além do mostrador: quem para em cima
                        esperando explicação recebe nos dois lugares */}
                    <title>{explica(f.id)}</title>
                    <path d={fatia(i, FORMAS.length)} />
                    {/* o mesmo alien muda de nome conforme o que encontrou:
                        link de lista faz "MÚSICA" virar "PLAYLIST" */}
                    <text x={tx} y={ty - 4} className="omni-rot">
                      {f.id === 'baixar' && soLista ? 'PLAYLIST' : f.rot}
                    </text>
                    <text x={tx} y={ty + 14} className="omni-sub">
                      {f.id === 'baixar' && soLista ? `${info?.uploader || 'a lista inteira'}` : f.sub}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* O NÚCLEO: a ampulheta cheia no buraco da coroa, feito no
                relógio. Ele não clica — é mostrador: diz o que está sob o
                ponteiro. */}
            <div className="omni-nucleo" aria-hidden="true">
              <span className="omni-nucleo-hex"><Ico nome="ampulheta" tamanho={46} /></span>
              <b>{escolhida.rot}</b>
              <i>{escolhida.sub}</i>
            </div>

          </div>

            {/* O MOSTRADOR.
                O NOME DO QUE FOI COPIADO VEM PRIMEIRO, e em cima. Antes ele
                estava no rodapé, abaixo da explicação do formato — e isso
                invertia a ordem da dúvida: quem abre a roda precisa confirmar
                que copiou a música certa ANTES de escolher em que formato
                levar. Formato errado se refaz num clique; baixar a música
                errada inteira, não.
                O nome também não pode ser classe "hud": esse nome já é da
                leitura de painel do estúdio, e o display:flex dela jogava tudo
                numa linha só. */}
            <div className="mostra">
              <div className="mostra-alvo">
                {/* A CAPA. O painel perguntava "é isso mesmo que você copiou?"
                    sem mostrar nada — e a imagem é justamente como a pessoa
                    reconhece uma música antes de ler o nome. Ela já vinha na
                    mesma resposta que trouxe o título; eu é que estava
                    jogando fora. */}
                <span className={`mostra-capa ${info?.thumbnail ? 'tem' : ''}`}>
                  {info?.thumbnail
                    ? <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" />
                    : <Ico nome="ampulheta" tamanho={26} />}
                  <i className="mostra-mira tl" aria-hidden="true" />
                  <i className="mostra-mira br" aria-hidden="true" />
                  {buscando && <i className="mostra-varredura" aria-hidden="true" />}
                </span>
                <span className="mostra-alvo-txt">
                  <b className={!info?.title && buscando ? 'mostra-piscando' : ''}>
                    {info?.title
                      || (buscando ? 'lendo o endereço…'
                        : link?.host
                          ? link.host
                          : 'nada copiado')}
                  </b>
                  <i>
                    {/* a lanterninha mora na linha da ficha: lima achou o
                        nome, âmbar procurando, apagada não deu */}
                    <span className={`mostra-led ${info?.title ? 'ok' : buscando ? 'busca' : ''}`} aria-hidden="true" />
                    {info?.title
                      ? [info.uploader, relogio(info.duration), link?.host].filter(Boolean).join('  ·  ')
                      : buscando ? 'buscando nome, canal e duração'
                        : link
                          ? 'não deu pra ler o nome — o download funciona igual'
                          : 'copie um link e ele aparece aqui'}
                  </i>
                </span>
                {/* Aqui morava um "esc fecha" que ninguém precisava ler:
                    clicar fora já fecha, e Esc continua funcionando pra quem
                    usa teclado. Sobrou uma marca de canto — fio e hachura, em
                    branco fraco. É estrutura, não neon: ela fecha o bloco no
                    canto direito e não diz nada, então não pode gastar
                    lima. */}
                <span className="mostra-selo" aria-hidden="true">
                  <i /><i /><i />
                </span>
              </div>

              <div className="mostra-forma">
                <b>{escolhida.rot}</b>
                <span className="mostra-regua" aria-hidden="true" />
                <span className="mostra-hachura" aria-hidden="true" />
              </div>
              <p className="mostra-corpo">{explica(escolhida.id)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
