import { useEffect, useState } from 'react'
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

const FORMAS = [
  { id: 'music', rot: 'MP3', sub: 'música' },
  { id: 'playlist', rot: 'LISTA', sub: 'playlist' },
  { id: 'fast', rot: 'RÁPIDO', sub: 'mp3 leve' },
  { id: 'audio_m4a', rot: 'M4A', sub: 'áudio' },
  { id: 'audio_wav', rot: 'WAV', sub: 'sem perda' },
  { id: 'video', rot: 'VÍDEO', sub: 'mp4' }
]

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

// A silhueta, uma vez só, pra marca e núcleo desenharem a MESMA ampulheta.
const AMPULHETA = 'M5.4 2h13.2c0 4.6-4.6 7.6-4.6 10s4.6 5.4 4.6 10H5.4c0-4.6 4.6-7.6 4.6-10S5.4 6.6 5.4 2Z'

export default function Omnitrix({ ligado, onEscolher }) {
  const [link, setLink] = useState(null)
  const [aberta, setAberta] = useState(false)
  const [sobre, setSobre] = useState(null)

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

  const armada = !!link && ligado

  // playlist copiada abre já apontando pro formato de playlist: baixar 40
  // músicas uma a uma seria castigo
  const sugerido = link?.playlist ? 'playlist' : 'music'
  const escolhida = FORMAS.find((f) => f.id === (sobre || sugerido)) || FORMAS[0]

  const escolher = (id) => {
    const url = link.url
    setAberta(false)
    setLink(null)
    onEscolher?.(id, url)
  }

  return (
    <>
      {/* A MARCA. Fica no mesmo lugar da antiga marca d'água do palco. */}
      <button
        className={`marca ${armada ? 'armada' : ''}`}
        type="button"
        onClick={() => armada && setAberta(true)}
        disabled={!armada}
        title={armada ? `Link copiado de ${link.host} — escolher formato` : 'Copie um link de música ou vídeo e ele aparece aqui'}
      >
        <svg className="marca-svg" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            {/* A AREIA. Duas ampulhetas iguais, empilhadas: a de baixo é o
                fantasma apagado, a de cima é lima cheia e só aparece dentro
                deste retângulo. Encher é subir o retângulo.
                Não usei degradê com o ponto de corte animado porque "offset"
                não é propriedade que o navegador saiba animar em parada de
                degradê — no Chromium esse nome pertence ao caminho de
                movimento. Altura de retângulo ele anima. */}
            <clipPath id="marca-areia" clipPathUnits="userSpaceOnUse">
              <rect className="marca-nivel" x="0" width="24" />
            </clipPath>
          </defs>
          <path d={AMPULHETA} className="marca-fantasma" />
          <path d={AMPULHETA} className="marca-cheia" clipPath="url(#marca-areia)" />
        </svg>
        {armada && <span className="marca-fala">{link.host}</span>}
      </button>

      {aberta && (
        <div className="omni-palco" onClick={() => setAberta(false)}>
          <div className="omni-roda-caixa" onClick={(e) => e.stopPropagation()}>
            <svg className="omni-roda" viewBox="0 0 440 440">
              {FORMAS.map((f, i) => {
                const ativa = (sobre || sugerido) === f.id
                const [tx, ty] = meio(i, FORMAS.length, (R_EXT + R_INT) / 2)
                return (
                  <g
                    key={f.id}
                    className={`omni-fatia ${ativa ? 'on' : ''} ${f.id === sugerido ? 'sugerida' : ''}`}
                    onMouseEnter={() => setSobre(f.id)}
                    onClick={() => escolher(f.id)}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <path d={fatia(i, FORMAS.length)} />
                    <text x={tx} y={ty - 4} className="omni-rot">{f.rot}</text>
                    <text x={tx} y={ty + 14} className="omni-sub">{f.sub}</text>
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

            <p className="omni-legenda">{link?.host} · Esc pra fechar</p>
          </div>
        </div>
      )}
    </>
  )
}
