// O título que percorre o que o app sabe fazer.
//
// A peça troca de frase sozinha a cada 5s. Num cartão parado isso não aparece,
// então cada célula fixa uma fala diferente — é assim que dá pra ver a forma
// (verbo em destaque + complemento) com comprimentos de texto diferentes, que
// é onde um título grande costuma quebrar feio.
import { TituloVivo, FALAS } from 'mptrix'

// A SUPERFÍCIE VEM JUNTO. O molde do cartão pinta o fundo de branco e o MPTRIX
// é escuro: sem vestir a superfície da casa, o texto claro destas peças some no
// branco e o cartão mente dizendo que está tudo bem.
const Superficie = ({ children, alto }: { children: any; alto?: boolean }) => (
  <div
    className="mptrix-superficie"
    style={
      alto
        ? { padding: 20, borderRadius: 12, minHeight: 300, display: 'grid', placeItems: 'center' }
        : { padding: 20, borderRadius: 12 }
    }
  >
    {children}
  </div>
)

export const Separar = () => (
  <Superficie><TituloVivo fala={FALAS[0]} /></Superficie>
)

export const MudarOTom = () => (
  <Superficie><TituloVivo fala={FALAS[4]} /></Superficie>
)

export const MarcarOCompasso = () => (
  <Superficie><TituloVivo fala={FALAS[6]} /></Superficie>
)

// Sem etiqueta: metade das falas não acende etiqueta nenhuma, e o título tem
// que continuar equilibrado sem ela.
export const SemEtiqueta = () => (
  <Superficie><TituloVivo fala={FALAS[1]} /></Superficie>
)
