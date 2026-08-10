import { useEffect, useState } from 'react'

// ██████ O TÍTULO QUE TROCA ██████
//
// A tela dizia uma coisa só — "Separar instrumentos" — e o app faz oito. As
// outras sete estavam ali embaixo, em etiquetas de 9px que ninguém lê antes
// de já saber o que procurar.
//
// Aqui o título passa a percorrer o que o app sabe fazer, e a etiqueta
// correspondente acende junto. Não é enfeite: é a mesma informação, dita no
// tamanho em que ela é lida. E amarrar as duas evita o pior resultado
// possível, que seria o título repetir em letra grande o que a etiqueta já
// diz em letra pequena, do lado.
//
// A lista é feita pra ser mexida: cada linha é um verbo, um complemento e a
// etiqueta que ela acende (ou nada, quando não existe etiqueta pra aquilo).
export const FALAS = [
  { verbo: 'Separar', resto: 'instrumentos', tag: 'dissecação' },
  { verbo: 'Baixar', resto: 'música', tag: null },
  { verbo: 'Baixar', resto: 'vídeo', tag: null },
  { verbo: 'Abrir', resto: 'do computador', tag: null },
  { verbo: 'Mudar', resto: 'o tom', tag: 'tom' },
  { verbo: 'Deixar', resto: 'mais lento', tag: 'velocidade' },
  { verbo: 'Marcar', resto: 'o compasso', tag: 'metrônomo' },
  { verbo: 'Ver', resto: 'a cifra', tag: 'cifra' },
  { verbo: 'Ler', resto: 'a letra', tag: 'letra' }
]

const PAUSA = 3200

export function useFalaDaVez() {
  const [i, setI] = useState(0)

  useEffect(() => {
    // quem pediu menos movimento no sistema não recebe troca automática: a
    // frase fica na primeira e o resto continua nas etiquetas
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (quieto) return
    const t = setInterval(() => setI((v) => (v + 1) % FALAS.length), PAUSA)
    return () => clearInterval(t)
  }, [])

  return FALAS[i]
}

export default function TituloVivo({ fala }) {
  return (
    // a chave muda a cada troca: é ela que faz a animação de entrada rodar de
    // novo, sem precisar de estado nenhum pra controlar isso
    <h1 className="palco-titulo vivo">
      <span key={`v${fala.verbo}${fala.resto}`} className="titulo-verbo">{fala.verbo}</span>
      <br />
      <span key={`r${fala.verbo}${fala.resto}`} className="titulo-resto">{fala.resto}</span>
    </h1>
  )
}
