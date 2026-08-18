// A rede de segurança.
//
// Só existe uma composição honesta pra ela: uma peça que quebra de verdade
// dentro. Mostrar a Guarda "em repouso" seria mostrar o filho, não a Guarda —
// o cartão pareceria certo e não teria fotografado nada.
import { Guarda } from 'mptrix'

const Superficie = ({ children }: { children: any }) => (
  <div className="mptrix-superficie" style={{ padding: 20, borderRadius: 12, minHeight: 260 }}>
    {children}
  </div>
)

function PecaQueQuebra(): any {
  throw new Error("Cannot read properties of undefined (reading 'stems')")
}

export const QuandoAlgoQuebra = () => (
  <Superficie>
    <Guarda>
      <PecaQueQuebra />
    </Guarda>
  </Superficie>
)

// Em repouso ela é invisível de propósito: entrega o filho e sai da frente.
export const EmRepouso = () => (
  <Superficie>
    <Guarda>
      <p style={{
        fontFamily: 'var(--font-ui)', color: 'var(--text-2)', margin: 0,
        padding: '18px 20px', border: '1px solid var(--border)', borderRadius: 10,
        background: 'var(--bg-elev)'
      }}>
        A tela roda normalmente — a Guarda só aparece quando algo quebra.
      </p>
    </Guarda>
  </Superficie>
)
