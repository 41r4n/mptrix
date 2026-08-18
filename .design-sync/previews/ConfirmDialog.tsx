// A conversa antes de uma decisão sem volta.
//
// O conteúdo aqui é repertório de igreja de verdade, não "Item 1 / Item 2". O
// cartão é lido por gente e imitado por quem desenha com a biblioteca — nome
// falso ensina composição falsa, e a lista com quatro nomes longos é justamente
// onde se descobre se o diálogo aguenta texto real sem estourar.
import { ConfirmDialog } from 'mptrix'

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

export const Destrutivo = () => (
  <Superficie alto>
    <ConfirmDialog
      open
      danger
      title="Apagar 4 músicas do acervo?"
      message="Os arquivos saem do computador. Isso não tem como desfazer."
      list={[
        'Reine em Mim — Ao Vivo',
        'Nada Além do Sangue',
        'Vaso Que Lhe Apraz',
        'Oceano'
      ]}
      note="As faixas separadas dessas músicas também vão junto."
      confirmLabel="Apagar"
      cancelLabel="Deixa pra lá"
    />
  </Superficie>
)

export const Pergunta = () => (
  <Superficie alto>
    <ConfirmDialog
      open
      title="Separar esta música de novo?"
      message="A separação anterior será substituída. Leva alguns minutos."
      confirmLabel="Separar"
      cancelLabel="Cancelar"
    />
  </Superficie>
)

export const ComCaixaDeMarcar = () => (
  <Superficie alto>
    <ConfirmDialog
      open
      danger
      title="Limpar o histórico?"
      message="A lista some, mas os arquivos ficam onde estão."
      checkbox={{
        label: 'Apagar também os arquivos baixados',
        checked: false,
        onChange: () => {}
      }}
      confirmLabel="Limpar"
      cancelLabel="Cancelar"
    />
  </Superficie>
)
