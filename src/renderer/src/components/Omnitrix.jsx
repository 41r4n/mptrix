import { useEffect, useRef, useState } from 'react'
import Ico from './Icones.jsx'

// ██████ A RODA ██████
//
// Aceno direto ao Omnitrix do Ben 10 Omniverse: o relógio abre uma roleta com
// as formas em volta e você gira até a que quer. Aqui as "formas" são os
// formatos de download.
//
// Mas ela não é enfeite temático — ela existe porque encurta o caminho. Antes:
// copiar o link no navegador, voltar pro MPTRIX, abrir BAIXAR, escolher o
// formato, colar o link, confirmar. O passo de colar é trabalho que o
// computador já podia fazer sozinho, porque ele sabe o que está na área de
// transferência. Agora: copiou lá fora, a ampulheta acende aqui, você aponta e
// escolhe a forma.
//
// Por isso ela SÓ aparece quando há link copiado. Roda vazia seria um botão
// bonito que não faz nada — e o app já tem a aba BAIXAR pro caminho normal.

const FORMAS = [
  { id: 'music', rot: 'MP3', sub: 'música' },
  { id: 'playlist', rot: 'LISTA', sub: 'playlist' },
  { id: 'fast', rot: 'RÁPIDO', sub: 'mp3 leve' },
  { id: 'audio_m4a', rot: 'M4A', sub: 'áudio' },
  { id: 'audio_wav', rot: 'WAV', sub: 'sem perda' },
  { id: 'video', rot: 'VÍDEO', sub: 'mp4' }
]

const R_EXT = 132   // raio de fora da coroa
const R_INT = 62    // raio de dentro (o buraco onde mora a ampulheta)
const CENTRO = 150  // metade do lado do svg

// Fatia da coroa em coordenadas do svg. Uma fatia por forma, com uma folga
// entre elas — sem a folga a roleta vira um anel só e some a leitura de
// "são seis coisas separadas".
function fatia(i, total, folgaGrau = 3) {
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
  const fechaRef = useRef(null)

  useEffect(() => {
    return window.mptrix.clipboard.onLink((achado) => {
      setLink(achado)
      setAberta(false)
    })
  }, [])

  // fechar com Esc: roda aberta cobre a tela inteira, e quem abriu sem querer
  // precisa de uma saída que não exija mirar em nada
  useEffect(() => {
    if (!aberta) return
    const aoTeclar = (e) => { if (e.key === 'Escape') setAberta(false) }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberta])

  if (!link || !ligado) return null

  // fecha com atraso: a roda abre no ponteiro e o caminho até a fatia passa
  // por fora do selo. Sem a folga, ela fecharia no meio do gesto.
  const adiarFechar = () => {
    clearTimeout(fechaRef.current)
    fechaRef.current = setTimeout(() => { setAberta(false); setSobre(null) }, 260)
  }
  const cancelarFechar = () => clearTimeout(fechaRef.current)

  // playlist copiada abre já apontando pro formato de playlist: baixar 40
  // músicas uma a uma seria castigo
  const sugerido = link.playlist ? 'playlist' : 'music'
  const escolhida = FORMAS.find((f) => f.id === (sobre || sugerido))

  return (
    <div
      className={`omni ${aberta ? 'aberta' : ''}`}
      onMouseEnter={() => { cancelarFechar(); setAberta(true) }}
      onMouseLeave={adiarFechar}
    >
      {aberta && (
        <svg className="omni-roda" viewBox="0 0 300 300" aria-hidden="true">
          {FORMAS.map((f, i) => {
            const ativa = (sobre || sugerido) === f.id
            const [tx, ty] = meio(i, FORMAS.length, (R_EXT + R_INT) / 2)
            return (
              <g
                key={f.id}
                className={`omni-fatia ${ativa ? 'on' : ''} ${f.id === sugerido ? 'sugerida' : ''}`}
                onMouseEnter={() => setSobre(f.id)}
                onClick={() => { setAberta(false); setLink(null); onEscolher?.(f.id, link.url) }}
                style={{ animationDelay: `${i * 26}ms` }}
              >
                <path d={fatia(i, FORMAS.length)} />
                <text x={tx} y={ty - 3} className="omni-rot">{f.rot}</text>
                <text x={tx} y={ty + 11} className="omni-sub">{f.sub}</text>
              </g>
            )
          })}
        </svg>
      )}

      {/* O SELO: hexágono com a ampulheta, a marca da casa. Fechado ele pulsa
          pra dizer "achei um link"; aberto ele vira o mostrador do que está
          sob o ponteiro. */}
      <button className="omni-selo" type="button" onClick={() => setAberta((v) => !v)}>
        <span className="omni-hex" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="omni-ampulheta">
            <path d="M7 3h10M7 21h10M8 3v3.2c0 1 .4 1.9 1.1 2.6L12 12l-2.9 3.2c-.7.7-1.1 1.6-1.1 2.6V21M16 3v3.2c0 1-.4 1.9-1.1 2.6L12 12l2.9 3.2c.7.7 1.1 1.6 1.1 2.6V21" />
          </svg>
        </span>
        <span className="omni-fala">
          <b>{aberta ? escolhida.rot : 'link copiado'}</b>
          <i>{aberta ? escolhida.sub : link.host}</i>
        </span>
      </button>

      {!aberta && (
        <button
          className="omni-x"
          type="button"
          title="Dispensar"
          onClick={(e) => { e.stopPropagation(); setLink(null) }}
        >
          <Ico nome="apagar" tamanho={12} />
        </button>
      )}
    </div>
  )
}
