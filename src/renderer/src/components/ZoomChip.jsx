import { useEffect, useState } from 'react'
import Ico from './Icones.jsx'

// ██████████ O TAMANHO DA TELA ██████████
//
// Os atalhos (Ctrl+ aproxima, Ctrl− afasta, Ctrl 0 volta ao normal) já
// funcionam sozinhos e não dependem disto. Então por que o botão existe?
// Porque atalho de teclado é invisível: quem não sabe que existe não descobre.
// Este app é usado pelo pai do dono, e "aumenta a letra" não pode depender de
// alguém ter ensinado uma combinação de teclas.
//
// ELE PAROU DE FLUTUAR. Vivia grudado no canto de baixo à direita, por cima de
// tudo — e o rodapé cresceu até esbarrar nele: a lupa ficou desenhada em cima
// do "verificar atualizações". Coisa que flutua não tem vizinho, então nunca
// se acerta com ninguém; é sempre questão de tempo até cobrir alguma coisa.
// Aqui dentro do rodapé ele tem lugar, e o lugar se ajusta junto com o resto.
export default function ZoomChip() {
  const [z, setZ] = useState(1)

  useEffect(() => {
    window.mptrix.ui?.zoomGet?.().then((v) => setZ(v || 1)).catch(() => {})
    const off = window.mptrix.ui?.onZoom?.((v) => setZ(v || 1))
    return off
  }, [])

  if (!window.mptrix.ui) return null

  return (
    <div className="zoom-chip" title="Tamanho da tela — atalhos: Ctrl+= aproxima, Ctrl+- afasta, Ctrl+0 normal">
      <span className="zoom-lupa" aria-hidden="true"><Ico nome="buscar" tamanho={12} /></span>
      <button className="zoom-btn" onClick={() => window.mptrix.ui.zoom(-1)} aria-label="Diminuir tela">−</button>
      <button className="zoom-pct" onClick={() => window.mptrix.ui.zoom(0)} title="Clique pra voltar ao tamanho normal">
        {Math.round(z * 100)}%
      </button>
      <button className="zoom-btn" onClick={() => window.mptrix.ui.zoom(1)} aria-label="Aumentar tela">+</button>
    </div>
  )
}
