// ██████████ O VOCABULÁRIO VISUAL DO MPTRIX ██████████
//
// Esta é a porta de entrada da biblioteca — a lista do que o MPTRIX considera
// uma PEÇA, e não uma tela. Ela existe pro catálogo de design (claude.ai/design)
// poder importar as peças de verdade em vez de alguém redesenhar cópias delas.
//
// Por que um arquivo só pra isso: cada componente do app é `export default`, e
// um arquivo de default não tem nome do lado de fora — quem importa é que
// batiza. Pra um catálogo isso é fatal, porque o nome É o endereço da peça.
// Aqui cada uma ganha o nome pelo qual a casa a chama, uma vez só, no lugar
// certo.
//
// O QUE ENTRA AQUI: peça de vocabulário — coisa que se usa pra montar tela.
// O QUE NÃO ENTRA: a tela em si (Estúdio, Acervo, Emendar). Tela é composição,
// e composição pertence a quem desenha, não à biblioteca.
//
// A ordem embaixo é de leitura, não de importância: marca, depois texto, depois
// os avisos, depois as conversas com o usuário.

// A ponte entra ANTES de tudo. Ela é um efeito de import, e a posição é o
// contrato: as peças abaixo chamam `window.mptrix` já no primeiro efeito, então
// a ponte tem que estar de pé antes de qualquer uma delas acordar.
import './ponte-de-maquete.js'

// ── a marca ──
// A roda: o hexágono com a ampulheta, que é a marca da casa virada
// instrumento. Ela abre uma coroa com os formatos de download em volta.
export { default as Omnitrix } from '../src/renderer/src/components/Omnitrix.jsx'

// Os ícones. `Ico` é o nome que a casa usa — um componente só, que escolhe o
// desenho pelo `nome`, em vez de um export por ícone.
export { default as Ico } from '../src/renderer/src/components/Icones.jsx'

// ── o texto que se move ──
// O título vivo do palco, e as falas que ele rotaciona.
export { default as TituloVivo, FALAS, useFalaDaVez } from '../src/renderer/src/components/TituloVivo.jsx'

// ── a rede de segurança ──
// (UpdateBanner e UpdateFooter ficaram de fora: as duas leem o estado real da
// atualizacao e devolvem nulo quando nao ha uma. Peca que so existe em certo
// momento do app nao se deixa fotografar no catalogo.)
// A rede de segurança: quando uma tela quebra, é isto que a pessoa vê no lugar
// de uma janela branca.
export { default as Guarda } from '../src/renderer/src/components/Guarda.jsx'

// ── as conversas ──
export { default as ConfirmDialog } from '../src/renderer/src/components/ConfirmDialog.jsx'
export { default as BatchActionsDialog } from '../src/renderer/src/components/BatchActionsDialog.jsx'
export { default as PeriodPickerModal } from '../src/renderer/src/components/PeriodPickerModal.jsx'
export { default as UpdateHelpModal } from '../src/renderer/src/components/UpdateHelpModal.jsx'

// ── os controles ──
export { default as ZoomChip } from '../src/renderer/src/components/ZoomChip.jsx'
