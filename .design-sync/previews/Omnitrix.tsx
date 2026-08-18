// A roda — a marca da casa virada instrumento.
//
// Duas coisas desta peça só se entendem vendo o app, e por isso estão ditas
// aqui: ela é `position: fixed` e fica JOGADA PRO LADO, grande, como marca
// d'água da tela do estúdio — não é um selo centralizado. E ela é apagada em
// repouso de propósito: acende quando aparece um link na área de transferência.
//
// UMA CÉLULA SÓ. Eu tinha escrito duas, `ligado` e `apagado`, e as duas saíram
// idênticas na foto: sem link copiado não há diferença nenhuma pra ver. Duas
// células iguais não mostram um eixo de variação — mostram que quem escreveu
// não olhou.
import { Omnitrix } from 'mptrix'

export const AMarcaDoEstudio = () => (
  <div
    className="mptrix-superficie"
    style={{ position: 'relative', overflow: 'hidden', minHeight: 380, borderRadius: 12 }}
  >
    <Omnitrix ligado onEscolher={() => {}} />
  </div>
)
