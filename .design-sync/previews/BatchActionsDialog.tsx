// O que fazer com o que está marcado.
import { BatchActionsDialog } from 'mptrix'

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
  <Superficie alto>
    <BatchActionsDialog open count={7} onClose={() => {}} onDelete={() => {}} onShare={() => {}} />
  </Superficie>
)

// Um item só: o mesmo diálogo tem que ler bem no singular — é o caso mais
// comum e o que mais denuncia texto escrito só pro plural.
export const UmItemSo = () => (
  <Superficie alto>
    <BatchActionsDialog open count={1} onClose={() => {}} onDelete={() => {}} onShare={() => {}} />
  </Superficie>
)
