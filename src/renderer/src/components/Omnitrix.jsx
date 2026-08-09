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
// Agora: copiou lá fora, a ampulheta acende aqui, aponta e escolhe a forma.
//
// A roda abre NO CENTRO DA TELA, não no canto. Na primeira versão ela nascia
// grudada no selo e o canto da janela comia um pedaço dela — e, pior, uma
// coroa de escolha espremida no rodapé não é o gesto do desenho. No Omniverse
// o relógio TOMA a tela: tudo escurece e sobram as formas. É o que ela faz.

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

export default function Omnitrix({ ligado, onEscolher }) {
  const [link, setLink] = useState(null)
  const [aberta, setAberta] = useState(false)
  const [sobre, setSobre] = useState(null)

  useEffect(() => {
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

  if (!link || !ligado) return null

  // playlist copiada abre já apontando pro formato de playlist: baixar 40
  // músicas uma a uma seria castigo
  const sugerido = link.playlist ? 'playlist' : 'music'
  const escolhida = FORMAS.find((f) => f.id === (sobre || sugerido))

  const escolher = (id) => {
    const url = link.url
    setAberta(false)
    setLink(null)
    onEscolher?.(id, url)
  }

  return (
    <>
      {/* O SELO: hexágono com a ampulheta. Fechado ele pulsa pra dizer "achei
          um link" e fica no canto, discreto — quem está no meio de outra
          coisa não pode ter a tela tomada sem pedir. */}
      <div className="omni-selo-caixa">
        <button
          className="omni-selo"
          type="button"
          onMouseEnter={() => setAberta(true)}
          onClick={() => setAberta(true)}
        >
          <span className="omni-hex" aria-hidden="true"><Ico nome="ampulheta" tamanho={20} /></span>
          <span className="omni-fala">
            <b>link copiado</b>
            <i>{link.host}</i>
          </span>
        </button>
        <button
          className="omni-x"
          type="button"
          title="Dispensar"
          onClick={() => setLink(null)}
        >
          <Ico nome="apagar" tamanho={12} />
        </button>
      </div>

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

            {/* O NÚCLEO: a ampulheta grande no buraco da coroa, como no
                relógio. Ele não clica — é mostrador: diz o que está sob o
                ponteiro e de onde veio o link. */}
            <div className="omni-nucleo" aria-hidden="true">
              <span className="omni-nucleo-hex"><Ico nome="ampulheta" tamanho={46} /></span>
              <b>{escolhida.rot}</b>
              <i>{escolhida.sub}</i>
            </div>

            <p className="omni-legenda">{link.host} · Esc pra fechar</p>
          </div>
        </div>
      )}
    </>
  )
}
