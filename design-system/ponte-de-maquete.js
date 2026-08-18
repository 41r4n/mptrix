// ██████████ A PONTE DE MAQUETE ██████████
//
// As peças do MPTRIX foram escritas pra viver dentro do Electron: elas
// conversam com o computador por `window.mptrix` — a área de transferência, o
// zoom da janela, a sondagem de um link. Fora do app esse objeto não existe, e
// a peça morre na primeira linha do primeiro efeito.
//
// Esta ponte responde no lugar dele, e SÓ QUANDO ELE NÃO ESTÁ LÁ. Dentro do
// MPTRIX de verdade, `window.mptrix` já existe e este arquivo não encosta em
// nada — a checagem embaixo é a coisa mais importante do arquivo.
//
// Ela existe pro catálogo de design (claude.ai/design), onde as peças precisam
// aparecer inteiras pra alguém poder julgar o visual. Uma peça que renderiza em
// branco não é "quase certa": ela é invisível pra quem vai desenhar com ela.
//
// O que responde aqui é vazio de propósito. Não é pra fingir que o app está
// funcionando — é pra a peça conseguir se DESENHAR. Conteúdo de mentira vira
// print de mentira, e print de mentira é pior que nenhum.

// O NADA CHAMÁVEL. Metade dessas funções devolve uma promessa; a outra metade
// devolve um `off()` que o React chama quando a peça sai da tela. Um valor que
// serve pros dois evita ter que adivinhar qual é qual.
function nada() {
  const eco = () => eco
  eco.then = (ok) => { if (typeof ok === 'function') ok(undefined); return eco }
  eco.catch = () => eco
  eco.finally = () => eco
  return eco
}

const PONTE = {
  // a roda (Omnitrix) vigia a área de transferência
  clipboard: {
    atual: async () => null,
    onLink: () => () => {}
  },
  // ela também pergunta o que é o link antes de abrir as formas
  video: { probe: async () => null },
  playlist: { probe: async () => null },
  // o chip de zoom só aparece se `ui` existir — sem isto ele devolve null e
  // some do catálogo, que é justamente a peça que queríamos mostrar
  ui: {
    zoomGet: async () => 1,
    zoom: () => {},
    onZoom: () => () => {}
  }
}

// qualquer caminho não escrito acima ainda responde: `mptrix.x.y()` não pode
// estourar, senão uma peça nova quebra o catálogo inteiro sem aviso
const porta = (alvo) => new Proxy(alvo, {
  get: (t, k) => (k in t ? t[k] : nada())
})

if (typeof window !== 'undefined' && !window.mptrix) {
  const raiz = {}
  for (const [k, v] of Object.entries(PONTE)) raiz[k] = porta(v)
  window.mptrix = porta(raiz)
}

export default PONTE
