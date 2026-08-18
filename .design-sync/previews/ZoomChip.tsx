// O controle de tamanho da janela.
import { ZoomChip } from 'mptrix'

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

export const Padrao = () => (
  <Superficie><ZoomChip /></Superficie>
)
