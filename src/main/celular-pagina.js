import { STEM_META } from '../shared/instrumentos.js'

// ██████████ A PÁGINA QUE O CELULAR ABRE ██████████
//
// Uma página só, sem nada de fora: o app é offline por natureza e a rede de
// casa pode não ter internet. Tudo — estilo, letra, comportamento — vai aqui
// dentro.
//
// A LINGUAGEM É A MESMA DA CASA: fundo quase preto, destaque único em lima,
// mono nos números, quina cortada. Quem já usa o MPTRIX no computador não
// pode achar que abriu outro programa.
//
// TOCAR VÁRIAS FAIXAS JUNTAS num celular é a parte que pode doer, e o desenho
// já assume isso: cada faixa é um <audio> que TRANSMITE do computador em vez
// de ser baixado inteiro (por isso o servidor entende Range). Se o aparelho
// engasgar, o próximo passo é o computador mandar já misturado o que não está
// sendo mexido — mas isso só depois de medir no aparelho de verdade, não por
// suposição.
export function paginaCelular() {
  // OS NOMES VÊM DA LISTA ÚNICA. Eu tinha escrito uma segunda lista aqui, e o
  // mesmo som aparecia como "Sintetizador" no computador e "Teclado" no
  // celular — quem viu foi o dono. Agora a página é montada com a mesma tabela
  // que o estúdio usa: se um nome mudar lá, muda aqui junto.
  const nomes = {}
  for (const [id, m] of Object.entries(STEM_META)) nomes[id] = m.label

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0c0f">
<title>MPTRIX</title>
<!-- vira app na tela inicial, sem loja: o Android só precisa que a página diga
     como quer ser chamada, com que ícone e que abre em tela cheia -->
<link rel="manifest" href="/app.webmanifest">
<link rel="icon" href="/icone.png">
<link rel="apple-touch-icon" href="/icone.png">
<meta name="mobile-web-app-capable" content="yes">
<!-- AS FONTES DA CASA, servidas pelo computador. O app é offline: nunca puxa
     fonte de fora. São 248 KB, e é o que faz a tela do celular parecer o mesmo
     programa da tela do computador. -->
<link rel="stylesheet" href="/fonts/fonts.css">
<style>
:root {
  --bg: #0b0c0f; --painel: #101216; --card: #15171c; --cava: #08090c; --cava2: #050609;
  --linha: rgba(255,255,255,0.07); --linha2: rgba(255,255,255,0.14); --linha3: rgba(255,255,255,0.22);
  --txt: #f2f4f7; --txt2: #d1d5db; --mudo: #9ba3af; --mudo2: #8a93a0;
  --lima: #b6ff3b; --lima-b: rgba(182,255,59,0.3); --amarelo: #eab308; --ruim: #f87171;
  --ui: 'Space Grotesk', system-ui, -apple-system, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
  /* OS BRILHOS DA ASSINATURA. Neon só onde carrega informação — nunca
     decorativo. Aqui ele marca: o que está aceso, o que responde ao toque, e
     o número que manda na tela. */
  --brilho: 0 0 18px rgba(182,255,59,0.45);
  --brilho-forte: 0 0 26px rgba(182,255,59,0.65);
  --corte: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  --corte-sm: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body {
  margin: 0; background: var(--bg); color: var(--txt);
  font-family: var(--ui);
  padding-bottom: calc(18px + env(safe-area-inset-bottom));
  /* um respiro de cor no alto: a tela deixa de ser um retângulo preto chapado
     sem clarear o preto que é a base da casa */
  background-image: radial-gradient(120% 60% at 50% -10%, rgba(182,255,59,0.07), transparent 70%);
  background-attachment: fixed;
}
button, input { font-family: inherit; }

/* ── A MARCA. O hexágono com a ampulheta é a assinatura da casa: quem abre no
      celular precisa reconhecer o mesmo app, não achar que é outro site. ── */
/* ██████████ O CABEÇALHO ██████████
   O dono desenhou um cartaz e mandou: hexágono lima grande com a ampulheta,
   marca em letra pesada, trama de bolinhas se dissolvendo, lascas escuras
   anguladas. Isto aqui é a mesma abordagem no tamanho de um cabeçalho.
   A TRAMA é o achado dele: bolinha não é grão nem gradiente — é retícula de
   impressão. Ela dá superfície gráfica sem virar desenho, e some sozinha antes
   de encostar no conteúdo. */
header {
  position: sticky; top: 0; z-index: 6; overflow: hidden;
  display: flex; align-items: center; gap: 12px;
  padding: calc(14px + env(safe-area-inset-top)) 15px 14px;
  border-bottom: 1px solid var(--linha);
  background: var(--bg);
}
/* a retícula, entrando pela direita e morrendo antes do texto */
header::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background-image: radial-gradient(circle at center, rgba(182,255,59,.55) 1.1px, transparent 1.5px);
  background-size: 13px 13px;
  -webkit-mask-image: linear-gradient(255deg, #000 0%, rgba(0,0,0,.35) 34%, transparent 62%);
  mask-image: linear-gradient(255deg, #000 0%, rgba(0,0,0,.35) 34%, transparent 62%);
  opacity: .5;
}
/* a lasca escura angulada, atrás da marca — a mesma do cartaz dele */
header::after {
  content: ''; position: absolute; left: -30px; top: -20px; bottom: -20px; width: 118px;
  pointer-events: none; background: rgba(0,0,0,.55);
  clip-path: polygon(0 0, 100% 0, 74% 100%, 0 100%);
}
/* O HEXÁGONO CHEIO, como no cartaz: lima sólido com a ampulheta preta vazada
   dentro. Antes era contorno apagado com a ampulheta lima — marca tímida.
   A marca da casa não pede licença. */
.hex {
  position: relative; z-index: 1;
  width: 38px; height: 42px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--lima); color: #0b0c0f;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  box-shadow: 0 0 26px rgba(182,255,59,.35);
}
/* a marca em letra pesada e larga, como no cartaz */
.marca {
  position: relative; z-index: 1;
  font-weight: 700; letter-spacing: .01em; font-size: 21px; line-height: 1;
}
.marca { font-family: var(--ui); }
.marca b { color: var(--lima); text-shadow: 0 0 16px rgba(182,255,59,0.6), 0 0 34px rgba(182,255,59,0.25); }
.hex { box-shadow: 0 0 20px rgba(182,255,59,0.28); }
.marca span {
  display: block; margin-top: 5px;
  font-family: var(--mono); font-size: 8.5px; letter-spacing: .24em;
  text-transform: uppercase; color: var(--mudo2); font-weight: 400;
}
.voltar {
  background: none; border: none; color: var(--mudo); font-size: 21px;
  padding: 4px 8px 4px 0; cursor: pointer; line-height: 1; flex: none;
}
.cabeca-fim { position: relative; z-index: 1; margin-left: auto; display: flex; align-items: center; gap: 7px; }
.icone-btn {
  width: 34px; height: 34px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: none; border: none; box-shadow: inset 0 0 0 1px var(--linha2);
  color: var(--mudo); cursor: pointer; clip-path: var(--corte-sm);
}
.icone-btn.ativo { color: var(--lima); box-shadow: inset 0 0 0 1px var(--lima-b); }

/* ── BUSCA E FILTROS ── */
.peneira { padding: 12px 12px 0; display: flex; flex-direction: column; gap: 9px; }
.busca {
  display: flex; align-items: center; gap: 9px;
  padding: 0 12px; height: 42px;
  background: var(--cava2); box-shadow: inset 0 0 0 1px var(--linha2);
  clip-path: var(--corte-sm);
}
.busca input {
  flex: 1 1 auto; min-width: 0; height: 100%;
  background: none; border: none; outline: none; color: var(--txt); font-size: 15px;
}
.busca input::placeholder { color: var(--mudo2); }
.busca .limpar { background: none; border: none; color: var(--mudo2); font-size: 18px; padding: 0 2px; }
.chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.chip {
  flex: none; height: 30px; padding: 0 13px;
  background: none; border: none; box-shadow: inset 0 0 0 1px var(--linha2);
  color: var(--mudo); font-family: var(--mono); font-size: 9.5px;
  letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer;
  clip-path: var(--corte-sm);
}
.chip.on {
  background: var(--lima); color: #0b0c0f; font-weight: 700;
  box-shadow: 0 0 20px rgba(182,255,59,0.45);
}
.conta {
  font-family: var(--mono); font-size: 9px; letter-spacing: .16em;
  text-transform: uppercase; color: var(--mudo2); padding: 2px 1px 0;
}

/* ██████████ OS CARTÕES — A ESTRUTURA QUE O DONO DESENHOU ██████████
   Depois de quatro tentativas minhas recusadas, ele montou a estrutura e
   mandou. Está tudo aqui, e cada peça do desenho virou uma peça de
   informação — nenhuma ficou de enfeite:

     ponta à esquerda      → o formato do cartão
     lâmina escura         → a capa, cortada nas duas pontas
     dois fios brancos     → desencontrados de propósito, como no desenho dele
     hexágono com play     → o sinal de que o cartão abre
     barra de estado       → vazia / enchendo / cheia: onde a música está
     trama de hexágonos    → a mesma da tela do computador, à direita
     lâminas verdes        → o botão de levar pro celular

   Sem contorno em volta: o desenho dele é chapa cheia sobre fundo, e chapa
   cheia não precisa de fio. A sombra vai no <li> com drop-shadow porque
   sombra de caixa é RETANGULAR — num formato recortado ela some nas
   diagonais ou vaza pra fora delas. */
ul { list-style: none; margin: 0; padding: 10px 12px 0; }
li { margin-bottom: 10px; filter: drop-shadow(0 5px 15px rgba(0,0,0,.6)); }

.cartao-musica {
  --cor: #4a4f57;
  position: relative; isolation: isolate;
  display: flex; align-items: stretch; min-height: 104px;
  background: #14161b;
  clip-path: polygon(0 50%, 22px 0, 100% 0, 100% 100%, 22px 100%);
  transition: transform .12s ease;
}
.cartao-musica:active { transform: scale(.99); }

/* A PRÓPRIA CAPA COMO FUNDO, borrada e fora de foco — mais rica que tinta
   chapada e sem inventar nada. Morre da esquerda pro meio: onde a capa está a
   cor é forte, onde o nome está ela some. Texto sobre imagem só é legível
   assim. A cor média da capa serve de reserva pra quem não tem imagem. */
.cartao-musica::before {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(100deg, var(--cor) 0%, transparent 62%);
  opacity: .16;
}
.cartao-musica.comfundo::before {
  background-image: var(--fundo);
  background-size: 130% auto; background-position: left center;
  filter: blur(22px) saturate(1.6) brightness(.5);
  /* SÓ NO CANTO DA CAPA. Espalhada pelo cartão inteiro ela virava uma névoa
     colorida por cima de tudo, e o desenho do dono é chapa quase preta com o
     texto branco saltando. Agora ela morre antes do nome. */
  opacity: .32;
  -webkit-mask-image: linear-gradient(100deg, #000 0%, rgba(0,0,0,.24) 28%, transparent 50%);
  mask-image: linear-gradient(100deg, #000 0%, rgba(0,0,0,.24) 28%, transparent 50%);
  transform: scale(1.12);
}
/* A TRAMA no terço da direita, igual ao desenho — e é a mesma retícula de
   hexágonos da tela do computador, então celular e PC passam a falar a mesma
   língua. Cheio e vazado alternando, meia célula de deslocamento. */
.cartao-musica::after {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cpath d='M10 5.2 L14.3 7.6 L14.3 12.4 L10 14.8 L5.7 12.4 L5.7 7.6 Z' fill='%23b6ff3b'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cpath d='M10 4.4 L15 7.2 L15 12.8 L10 15.6 L5 12.8 L5 7.2 Z' fill='none' stroke='%23b6ff3b' stroke-width='1.2'/%3E%3C/svg%3E");
  background-size: 13px 13px, 13px 13px;
  background-position: 0 0, 6.5px 6.5px;
  -webkit-mask-image: linear-gradient(90deg, transparent 56%, rgba(0,0,0,.4) 80%, #000 100%);
  mask-image: linear-gradient(90deg, transparent 56%, rgba(0,0,0,.4) 80%, #000 100%);
  /* MUITO apagada: hexágono de 9px carrega bem mais tinta que bolinha, e na
     primeira foto o canto direito virou um muro de colmeia — de novo. */
  opacity: .13;
}

.abrir {
  position: relative; flex: 1 1 auto; min-width: 0;
  padding: 0; background: none; border: none; color: var(--txt);
  text-align: left; cursor: pointer; font: inherit;
}

/* A LÂMINA DA CAPA: cortada em ponta na esquerda (acompanhando o cartão) e em
   diagonal na direita. É a peça mais à esquerda do desenho dele. */
.lamina {
  position: absolute; left: 0; top: 0; bottom: 0; width: 92px;
  clip-path: polygon(0 50%, 20px 0, 100% 0, calc(100% - 22px) 100%, 20px 100%);
  background: #0d0f13; overflow: hidden; line-height: 0;
}
.lamina img { width: 100%; height: 100%; object-fit: cover; }
.capa-vazia {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,.14);
}

/* OS DOIS FIOS, DESENCONTRADOS. No desenho dele o de cima começa antes do
   texto (entra na lâmina) e para cedo; o de baixo começa depois e passa mais
   longe. É esse desencontro que dá o ar de painel — dois fios alinhados
   viravam moldura, e moldura em volta de texto mente pro dedo. */
.painel { display: block; margin-left: 100px; padding: 13px 10px 33px 0; min-width: 0; }
.fio { display: block; height: 1px; pointer-events: none; }
.fio-cima {
  margin-left: -42px; width: calc(100% - 22px); margin-bottom: 9px;
  background: linear-gradient(90deg, rgba(255,255,255,.1), rgba(255,255,255,.6) 24%, rgba(255,255,255,.6));
}
.fio-baixo {
  margin-left: 24px; width: calc(100% + 6px); margin-top: 9px;
  background: linear-gradient(90deg, rgba(255,255,255,.42), rgba(255,255,255,.42) 74%, transparent);
}

/* UMA LINHA SÓ pro nome: título que quebra em duas empurra o cartão, e lista
   irregular cansa de rolar. */
.corpo { display: block; min-width: 0; }
.corpo b {
  display: block; font-size: 15px; font-weight: 700; line-height: 1.3;
  letter-spacing: .005em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 5px;
}
.dados {
  display: block;
  font-family: var(--mono); font-size: 9px; letter-spacing: .07em;
  color: var(--mudo);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* tom e BPM em lima porque são os dois números que um músico procura */
.dados em { font-style: normal; color: var(--lima); font-weight: 500; }

/* O HEXÁGONO COM O PLAY, sentado na junta entre a lâmina e o painel — é onde
   ele está no desenho. Diz que o cartão abre; não é botão separado, então
   não recebe toque próprio. */
.tocar {
  position: absolute; left: 70px; bottom: 11px; z-index: 2;
  line-height: 0; pointer-events: none;
  filter: drop-shadow(0 3px 8px rgba(0,0,0,.85));
  transition: transform .12s ease;
}
.cartao-musica:active .tocar { transform: scale(.92); }

/* A BARRA DE ESTADO — a peça do desenho dele que eu não tinha. Ela responde
   "onde esta música está": vazia = só no computador, enchendo = vindo,
   cheia = toca sem o computador por perto.
   O progresso morava dentro do botão de baixar, como uma altura subindo de
   baixo pra cima. Barra que enche pro lado é a forma que todo mundo já sabe
   ler sem aprender. */
.estado {
  position: absolute; left: 104px; bottom: 15px; width: 40%; height: 8px; z-index: 1;
  background: rgba(182,255,59,.1);
  clip-path: polygon(0 0, 100% 0, calc(100% - 7px) 100%, 0 100%);
}
.estado i {
  display: block; height: 100%; width: 0; background: var(--lima);
  box-shadow: 0 0 14px rgba(182,255,59,.55);
  transition: width .35s ease;
}
.cartao-musica.aqui .estado i { width: 100%; }
.cartao-musica.indo .estado i { width: var(--quanto, 0%); background: var(--amarelo); box-shadow: none; }
.cartao-musica.ruim .estado i { width: 100%; background: var(--ruim); box-shadow: none; }

/* AS LÂMINAS VERDES = LEVAR PRO CELULAR. No desenho elas são o único verde
   aceso da peça, no canto direito — e levar é justamente a única coisa do
   cartão que muda o que dá pra fazer longe do computador.
   São dois triângulos apontando pra baixo: direção é o que faz "baixar" ser
   lido sem legenda. Apagados quando a música ainda não veio, acesos quando
   ela já está aqui. */
.levar {
  position: relative; flex: none; width: 48px; align-self: stretch;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  color: rgba(182,255,59,.42);
  transition: color .15s ease;
}
.levar:active { color: rgba(182,255,59,.85); }
.levar.tem { color: var(--lima); filter: drop-shadow(0 0 9px rgba(182,255,59,.5)); }
.levar.erro { color: var(--ruim); }
.levar.indo { color: var(--amarelo); }
/* a lasquinha do canto de baixo, do desenho dele */
.levar::after {
  content: ''; position: absolute; right: 0; bottom: 0;
  width: 17px; height: 17px; pointer-events: none;
  background: currentColor; opacity: .5;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

.vazio { padding: 44px 24px; text-align: center; color: var(--mudo); line-height: 1.65; font-size: 13.5px; }
.vazio b { display: block; color: var(--txt2); font-size: 15px; margin-bottom: 8px; }
.carregando {
  padding: 34px; text-align: center; color: var(--mudo);
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
}
.semrede {
  margin: 12px 12px 0; padding: 10px 12px;
  background: rgba(234,179,8,0.1); box-shadow: inset 2px 0 0 var(--amarelo);
  font-size: 12.5px; line-height: 1.5; color: var(--amarelo);
}

/* ── O ESTÚDIO ── */
.transporte {
  position: sticky; top: 55px; z-index: 5;
  background: var(--painel); border-bottom: 1px solid var(--linha); padding: 13px 14px;
}
.faixa-nome { font-size: 14px; font-weight: 600; margin-bottom: 9px; line-height: 1.3; }
.tempo {
  display: flex; align-items: baseline; gap: 8px;
  font-family: var(--mono); font-size: 27px; color: var(--lima);
  text-shadow: 0 0 22px rgba(182,255,59,0.5), 0 0 44px rgba(182,255,59,0.2);
  letter-spacing: 0.02em;
}
.tempo small { font-size: 12px; color: var(--mudo2); text-shadow: none; }
.tempo .hud { margin-left: auto; text-align: right; font-size: 10px; color: var(--mudo2); text-shadow: none; letter-spacing: 0.12em; }
.tempo .hud b { display: block; color: var(--txt2); font-size: 13px; }
.barra { width: 100%; margin: 10px 0 12px; height: 28px; background: none; -webkit-appearance: none; appearance: none; }
.barra::-webkit-slider-runnable-track { height: 4px; background: rgba(255,255,255,0.12); }
.barra::-webkit-slider-thumb {
  -webkit-appearance: none; width: 17px; height: 17px; margin-top: -6.5px;
  background: var(--lima); border-radius: 50%; box-shadow: 0 0 12px rgba(182,255,59,0.6);
}
.botoes { display: flex; align-items: center; gap: 10px; }
.play {
  width: 54px; height: 54px; border-radius: 50%; border: none; flex: none;
  background: var(--lima); color: #0b0c0f; font-size: 20px; cursor: pointer;
  box-shadow: 0 0 26px rgba(182,255,59,0.4);
  display: inline-flex; align-items: center; justify-content: center;
}
.zerar {
  height: 38px; padding: 0 15px; background: none; border: none;
  box-shadow: inset 0 0 0 1px var(--linha2); color: var(--mudo);
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.12em;
  text-transform: uppercase; cursor: pointer; clip-path: var(--corte-sm);
}

.faixas { padding: 12px 12px 30px; }
.faixa {
  display: flex; align-items: center; gap: 10px;
  background: var(--card); padding: 10px 12px; margin-bottom: 8px;
  box-shadow: inset 0 0 0 1px var(--linha); clip-path: var(--corte-sm);
}
.faixa.calada { opacity: 0.4; }
.cor { width: 4px; align-self: stretch; flex: none; }
.nome { flex: 1 1 auto; min-width: 0; }
.nome b { display: block; font-size: 13px; font-weight: 600; }
.vol { width: 100%; margin-top: 6px; height: 24px; -webkit-appearance: none; appearance: none; background: none; }
.vol::-webkit-slider-runnable-track { height: 3px; background: rgba(255,255,255,0.12); }
.vol::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5.5px; background: currentColor; border-radius: 50%; }
.ms { display: flex; gap: 5px; flex: none; }
.ms button {
  width: 36px; height: 34px; background: none; border: none;
  box-shadow: inset 0 0 0 1px var(--linha2); color: var(--mudo);
  font-family: var(--mono); font-size: 10px; font-weight: 700; cursor: pointer;
}
.ms button[aria-pressed="true"] { color: #0b0c0f; box-shadow: none; }
.ms .m[aria-pressed="true"] { background: var(--amarelo); }
.ms .s[aria-pressed="true"] { background: var(--lima); }
/* ██████████ AS ABAS ██████████
   Elas ficam EMBAIXO, e não em cima como no computador: o polegar alcança o
   pé da tela, não o topo. Copiar o trilho lateral do PC seria copiar a forma
   e perder a razão dela. */
.abas {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 8;
  display: flex; background: var(--painel);
  border-top: 1px solid var(--linha);
  padding-bottom: env(safe-area-inset-bottom);
}
.abas button {
  flex: 1 1 0; min-width: 0; padding: 9px 4px 10px;
  background: none; border: none; color: var(--mudo2);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.12em;
  text-transform: uppercase; cursor: pointer;
}
.abas button.on { color: var(--lima); }
.abas button.on svg { filter: drop-shadow(0 0 8px rgba(182,255,59,0.5)); }
.abas .n { font-size: 7px; opacity: 0.55; }
body { padding-bottom: calc(70px + env(safe-area-inset-bottom)); }

/* ██████████ A RODA ██████████
   A ampulheta fica parada até haver um link. Com link, ela bate — e batendo
   ela está DIZENDO que tem coisa pra fazer, não enfeitando. Tocar nela abre os
   caminhos.
   Os quatro atos são os mesmos do computador porque são as mesmas quatro
   coisas que existem pra fazer com um link. */
.palco-roda { padding: 18px 14px 10px; text-align: center; }
.ampulheta {
  width: 92px; height: 104px; margin: 6px auto 14px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(182,255,59,0.08); color: var(--lima);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  box-shadow: 0 0 30px rgba(182,255,59,0.12);
  border: none; cursor: pointer;
  transition: box-shadow 0.2s ease, background 0.2s ease;
}
.ampulheta.pronta {
  background: rgba(182,255,59,0.18);
  animation: bate 1.6s ease-in-out infinite;
}
@keyframes bate {
  0%, 70%, 100% { box-shadow: 0 0 24px rgba(182,255,59,0.25); }
  85% { box-shadow: 0 0 46px rgba(182,255,59,0.7); }
}
.ampulheta.parada {
  color: rgba(182,255,59,0.35); background: rgba(182,255,59,0.04);
  box-shadow: 0 0 22px rgba(182,255,59,0.06);
}
.roda-dica { font-size: 13px; color: var(--mudo); line-height: 1.6; margin: 0 0 14px; }
.roda-dica b { color: var(--txt2); }

.campo-link {
  display: flex; align-items: center; gap: 9px; margin: 0 0 12px;
  padding: 0 12px; height: 46px;
  background: var(--cava2); box-shadow: inset 0 0 0 1px var(--linha2);
  clip-path: var(--corte-sm);
}
.campo-link input {
  flex: 1 1 auto; min-width: 0; height: 100%;
  background: none; border: none; outline: none; color: var(--txt); font-size: 14px;
}
.campo-link input::placeholder { color: var(--mudo2); }
.campo-link button {
  flex: none; height: 32px; padding: 0 11px; background: none; border: none;
  box-shadow: inset 0 0 0 1px var(--linha2); color: var(--mudo);
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* OS ATOS. Cada um é uma coisa diferente de fazer com o mesmo link — não são
   variações do mesmo botão. */
.atos { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.ato {
  display: flex; flex-direction: column; align-items: flex-start; gap: 7px;
  padding: 14px 13px; text-align: left;
  background: var(--card); border: none; color: var(--txt);
  box-shadow: inset 0 0 0 1px var(--linha); clip-path: var(--corte);
  cursor: pointer;
}
.ato:disabled { opacity: 0.35; }
.ato svg { color: var(--lima); }
.ato b { font-size: 13.5px; font-weight: 600; }
.ato span { font-size: 11.5px; line-height: 1.45; color: var(--mudo2); }

/* AS TAREFAS. O trabalho é do computador: o celular pode travar, bloquear a
   tela ou sair do Wi-Fi que o download continua. Por isso a lista vem de lá. */
.tarefa {
  margin-top: 9px; padding: 11px 12px;
  background: var(--card); box-shadow: inset 0 0 0 1px var(--linha);
  clip-path: var(--corte-sm); text-align: left;
}
.tarefa b { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; word-break: break-all; }
.tarefa .estado { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--mudo2); }
.tarefa.pronto .estado { color: var(--lima); }
.tarefa.erro .estado { color: var(--ruim); }
.tarefa .trilha { height: 4px; margin-top: 8px; background: rgba(255,255,255,0.1); }
.tarefa .trilha i { display: block; height: 100%; background: var(--lima); transition: width 0.3s linear; }

/* ██████████ AS FERRAMENTAS ██████████
   Elas ficam numa faixa própria embaixo do transporte, e não escondidas: quem
   abre uma música num ensaio abre POR CAUSA delas. */
.ferramentas { display: flex; gap: 7px; margin-top: 11px; flex-wrap: wrap; }
.ferr {
  flex: 1 1 0; min-width: 78px; padding: 8px 6px;
  background: none; border: none; box-shadow: inset 0 0 0 1px var(--linha2);
  color: var(--mudo); cursor: pointer; clip-path: var(--corte-sm);
  display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.ferr b { font-family: var(--mono); font-size: 12px; color: var(--txt2); font-weight: 500; }
.ferr span { font-family: var(--mono); font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; }
.ferr.on { box-shadow: inset 0 0 0 1px var(--lima-b); background: rgba(182,255,59,0.07); }
.ferr.on b, .ferr.on span { color: var(--lima); }
.ferr:disabled { opacity: 0.35; }

/* A VELOCIDADE é a ferramenta que o amigo do dono precisava: o solo estava
   rápido demais pra acompanhar. O tom NÃO muda junto — quem estuda um solo
   precisa das mesmas notas, mais devagar. */
.velocidade { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.velocidade input { flex: 1 1 auto; height: 26px; -webkit-appearance: none; appearance: none; background: none; }
.velocidade input::-webkit-slider-runnable-track { height: 3px; background: rgba(255,255,255,0.12); }
.velocidade input::-webkit-slider-thumb {
  -webkit-appearance: none; width: 15px; height: 15px; margin-top: -6px;
  background: var(--lima); border-radius: 50%;
}
.velocidade b { font-family: var(--mono); font-size: 13px; color: var(--lima); flex: none; width: 46px; text-align: right; }
.velocidade .rot { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--mudo2); flex: none; }

/* CIFRA E LETRA rolam juntas com a música: o acorde do momento acende e a
   linha cantada acende. Ler cifra parada é ler partitura sem saber onde está. */
.painel-letra { padding: 4px 12px 20px; }
.linha-letra {
  padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: color 0.15s ease;
}
.linha-letra .acordes {
  font-family: var(--mono); font-size: 12px; color: var(--lima);
  letter-spacing: 0.06em; margin-bottom: 3px; min-height: 15px;
}
.linha-letra .frase { font-size: 15px; line-height: 1.45; color: var(--mudo); }
.linha-letra.agora .frase { color: var(--txt); font-weight: 600; }
.linha-letra.agora { background: rgba(182,255,59,0.05); box-shadow: inset 2px 0 0 var(--lima); padding-left: 10px; }
.so-cifra { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px 22px; }
.so-cifra span {
  font-family: var(--mono); font-size: 13px; padding: 6px 9px;
  color: var(--mudo); box-shadow: inset 0 0 0 1px var(--linha);
}
.so-cifra span.agora { color: #0b0c0f; background: var(--lima); box-shadow: none; font-weight: 700; }
.aviso-tom {
  margin: 10px 12px; padding: 9px 11px;
  background: rgba(234,179,8,0.1); box-shadow: inset 2px 0 0 var(--amarelo);
  font-size: 12px; line-height: 1.5; color: var(--amarelo);
}

/* ██████████ INSTALAR O APP ██████████
   O celular já está falando com o computador — é ele quem entrega o app. Ter
   que passar arquivo por WhatsApp ou cabo pra instalar o programa que já está
   aberto na sua frente é pedir trabalho onde não precisa.
   Fica no alto do APARELHO porque é a única coisa dessa tela que MUDA o que a
   pessoa tem; o resto é consulta. */
.convite {
  --chanfro: 12px;
  padding: 15px 14px; margin-bottom: 14px;
  background: rgba(182,255,59,0.06);
  box-shadow: inset 0 0 0 1px var(--lima-b);
  clip-path: var(--corte);
}
.convite b { display: block; font-size: 14.5px; margin-bottom: 5px; }
.convite p { margin: 0 0 12px; font-size: 12.5px; line-height: 1.55; color: var(--mudo); }
.convite a {
  display: flex; align-items: center; justify-content: center; gap: 9px;
  height: 46px; background: var(--lima); color: #0b0c0f;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.14em;
  text-transform: uppercase; font-weight: 700; text-decoration: none;
  clip-path: var(--corte-sm);
}
.convite small { display: block; margin-top: 10px; font-size: 11.5px; color: var(--mudo2); line-height: 1.5; }

/* ██████████ A BÚSSOLA ██████████
   Três pontinhos dizendo em qual das três telas você está. NÃO clica: borda em
   volta de texto é clicável nesta casa, e ponto que não faz nada não pode
   parecer botão. Ele informa; quem navega é o dedo. */
.bussola {
  position: fixed; left: 0; right: 0; bottom: calc(10px + env(safe-area-inset-bottom));
  z-index: 8; display: flex; justify-content: center; gap: 7px; pointer-events: none;
}
.bussola i {
  width: 6px; height: 6px; background: rgba(255,255,255,0.18);
  transform: rotate(45deg); transition: background 0.25s ease, box-shadow 0.25s ease;
}
.bussola i.on { background: var(--lima); box-shadow: 0 0 14px rgba(182,255,59,0.85); }
body { padding-bottom: calc(34px + env(safe-area-inset-bottom)); }

/* O DESLIZAR. A tela que sai e a que entra andam juntas — sem isso o conteúdo
   pisca e a pessoa perde a noção de para que lado foi. */
#tela { animation: entra-tela 0.22s ease; }
@keyframes entra-tela { from { opacity: 0; transform: translateX(var(--de, 18px)); } to { opacity: 1; transform: none; } }

/* ██████████ O CARTÃO DA MÚSICA ██████████
   Colar um link e apertar "baixar" é um salto no escuro: a pessoa não sabe se
   é a música certa, se é o clipe ou a versão ao vivo. Ver a capa e o nome
   antes custa segundos; baixar errado custa muito mais. */
.cartao {
  margin: 4px 0 14px; overflow: hidden;
  background: var(--card); box-shadow: inset 0 0 0 1px var(--linha);
  clip-path: var(--corte);
  animation: sobe 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
}
@keyframes sobe { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.cartao img { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; background: var(--cava2); }
.cartao .txt { padding: 12px 13px 14px; text-align: left; }
.cartao b { display: block; font-size: 14.5px; line-height: 1.35; margin-bottom: 6px; }
.cartao .quem {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--mudo2);
}
.cartao .quem em { font-style: normal; color: var(--lima); }
.olhando {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 22px; font-family: var(--mono); font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--mudo2);
}
.olhando i {
  width: 9px; height: 9px; background: var(--lima); display: inline-block;
  transform: rotate(45deg); animation: bate 1.1s ease-in-out infinite;
}

.diag {
  display: block; margin-top: 18px; padding: 12px;
  background: var(--cava2); box-shadow: inset 0 0 0 1px var(--linha);
  font-family: var(--mono); font-size: 11px; line-height: 1.9;
  color: var(--mudo2); text-align: left; word-break: break-all;
}
.preparando {
  margin-top: 10px; padding: 8px 10px;
  background: rgba(234,179,8,0.1); box-shadow: inset 2px 0 0 var(--amarelo);
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; color: var(--amarelo);
}

/* ── AJUSTES: uma folha que sobe, não outra página. O que ela mostra é o
      estado do APARELHO, e o estado do aparelho se consulta sem sair de onde
      você está. ── */
.folha-fundo { position: fixed; inset: 0; background: rgba(3,4,7,0.7); z-index: 20; }
.folha {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 21;
  background: var(--painel); border-top: 1px solid var(--linha2);
  padding: 16px 16px calc(20px + env(safe-area-inset-bottom));
  max-height: 82vh; overflow-y: auto;
}
.folha h3 { margin: 0 0 4px; font-size: 16px; }
.folha .olho {
  font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--mudo2); display: block; margin-bottom: 3px;
}
.folha p { font-size: 12.5px; line-height: 1.55; color: var(--mudo); margin: 10px 0; }
.linha-dado {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 12px; margin-top: 8px;
  background: var(--cava2); box-shadow: inset 0 0 0 1px var(--linha);
}
.linha-dado .rot { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--mudo2); }
.linha-dado b { margin-left: auto; font-family: var(--mono); font-size: 14px; color: var(--txt2); }
.linha-dado b.lima { color: var(--lima); }
.folha-btn {
  width: 100%; margin-top: 12px; height: 42px;
  background: none; border: none; box-shadow: inset 0 0 0 1px var(--linha2);
  color: var(--mudo); font-family: var(--mono); font-size: 10px;
  letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; clip-path: var(--corte-sm);
}
.folha-btn.perigo { color: var(--ruim); box-shadow: inset 0 0 0 1px rgba(248,113,113,0.4); }
.folha-fechar { width: 100%; margin-top: 8px; height: 44px; background: var(--lima); color: #0b0c0f; border: none; font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; }
</style>
</head>
<body>
<header>
  <button class="voltar" id="voltar" hidden aria-label="Voltar">&#8592;</button>
  <!-- o hexágono com a ampulheta: a assinatura da casa. Quem abre no celular
       tem que reconhecer o mesmo app, não achar que caiu noutro site. -->
  <span class="hex" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="19" height="19"><path fill="currentColor" d="M4.5 2H19.5L13.4 12L19.5 22H4.5L10.6 12Z"/></svg>
  </span>
  <span class="marca">MP<b>TRIX</b><span id="onde">acervo</span></span>
  <span class="cabeca-fim">
    <button class="icone-btn" id="btAjustes" aria-label="Ajustes">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
        <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>
      </svg>
    </button>
  </span>
</header>
<div id="tela"><p class="carregando">carregando…</p></div>

<!-- AS ABAS FICAM EMBAIXO: o polegar alcança o pé da tela, não o topo. Copiar
     o trilho lateral do computador seria copiar a forma e perder a razão. -->
<!-- AS ABAS SAIRAM. São três telas; arrastar de lado é mais rápido que mirar
     num botão pequeno, e devolve o rodapé inteiro pro conteúdo. O que fica é
     um indicador que não clica: ele diz onde você está, não pede toque. -->
<div class="bussola" id="bussola" aria-hidden="true">
  <i></i><i class="on"></i><i></i>
</div>

<script>
// A SENHA VIAJA EM TODO PEDIDO, e não num cookie.
// Eu tinha posto a senha só na URL da página e deixado um cookie tomar conta
// do resto. O celular do dono carregou a página e não conseguiu a lista: o
// Chrome do Android não guardou o cookie (página sem cadeado, endereço de IP).
// A página abria bonita e vazia, dizendo "não consegui falar com o
// computador" — quando o computador estava ali, respondendo.
// Depender de cookie é depender de uma decisão do navegador que eu não
// controlo. A senha eu controlo: ela está na barra de endereço, e vai junto.
// DENTRO DO APP OU NO NAVEGADOR? A mesma tela roda nos dois, e a diferença
// muda o que ela pode fazer: no navegador ela pede tudo ao computador; dentro
// do app ela vai ler o próprio telefone (ainda não sabe — é a Fase 1).
// Sem essa distinção, o app instalado dizia "não consegui falar com o
// computador", que é confuso: não é falha de rede, é função que ainda não
// existe. Erro que mente sobre a própria causa foi o defeito que mais custou
// tempo neste projeto.
var DENTRO_DO_APP = !!(window.Capacitor || location.protocol === 'capacitor:' ||
  (location.protocol === 'https:' && location.hostname === 'localhost'));

var S = (new URLSearchParams(location.search).get('s') || '');
function comSenha(u) {
  if (!S) return u;
  return u + (u.indexOf('?') >= 0 ? '&' : '?') + 's=' + encodeURIComponent(S);
}


// A ESCALA VERDE DAS FAIXAS é a mesma do computador. Cor por faixa não é
// enfeite: é como se acha a guitarra sem ler o nome.
var CORES = ['#dff9a0','#b4e85a','#7ed97a','#4ecb8c','#27a08d','#8fa57a'];
var NOMES = ${JSON.stringify(nomes)};
var S = (new URLSearchParams(location.search).get('s') || '');
function comSenha(u) {
  if (!S) return u;
  return u + (u.indexOf('?') >= 0 ? '&' : '?') + 's=' + encodeURIComponent(S);
}

// A ESCALA VERDE DAS FAIXAS é a mesma do computador. Cor por faixa não é
// enfeite: é como se acha a guitarra sem ler o nome.
var CORES = ['#dff9a0','#b4e85a','#7ed97a','#4ecb8c','#27a08d','#8fa57a'];
var NOMES = ${JSON.stringify(nomes)};
// ██████████ O MODO ENSAIO SÓ EXISTE COM CADEADO ██████████
//
// Service worker — o que faz tocar sem o computador — é proibido em endereço
// sem https. O nosso é http://192.168.x.x, endereço de casa, que não tem
// cadeado e não tem como ter. Então em muitos celulares o modo ensaio
// simplesmente NÃO EXISTE.
//
// E ele falhava CALADO: a pessoa apertava "levar pro ensaio", parecia guardar,
// e não guardava nada. Ela só descobriria na igreja, sem o computador por
// perto pra consertar. Silêncio nesse ponto é o pior defeito possível.
//
// Onde não dá, o caminho é outro e honesto: BAIXAR o arquivo pra pasta do
// celular. Perde o mixer (o tocador do telefone não sabe misturar faixas), mas
// a música fica no aparelho de verdade, e toca em qualquer lugar.
var GUARDA_DA = !!(window.isSecureContext && ('serviceWorker' in navigator));

// O GUARDADOR precisa estar de pé antes de tudo: é ele que responde quando o
// computador não está por perto.
var guardadas = {};
if (GUARDA_DA) {
  navigator.serviceWorker.register(comSenha('/sw.js')).catch(function () {});
  navigator.serviceWorker.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.tipo === 'guardadas') { d.chaves.forEach(function (k) { guardadas[k] = true; }); pintarLevar(); }
    if (d.tipo === 'levando') { marcarLevando(d.chave, d.feito, d.total); }
    if (d.tipo === 'levou') { guardadas[d.chave] = true; pintarLevar(); }
    if (d.tipo === 'largou') { delete guardadas[d.chave]; pintarLevar(); }
    if (d.tipo === 'falhou') { marcarFalhou(d.chave); }
  });
}
function aoGuardador(msg) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(msg);
  }
}

var tela = document.getElementById('tela');
var voltar = document.getElementById('voltar');
var onde = document.getElementById('onde');
var acervo = [];
var sessao = null; // { audios: [], mudos: {}, solos: {} }

function mmss(s) {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
}

var busca = '';
var filtro = 'todas';

function abrirAcervo() {
  sessao && pararTudo();
  voltar.hidden = true; onde.textContent = 'acervo';

  if (!acervo.length) {
    tela.innerHTML = '<p class="vazio"><b>Nada aqui ainda</b>' +
      'Baixe ou separe uma música no computador — ela aparece aqui sozinha.</p>';
    return;
  }

  // FILTRAR É O QUE SALVA UMA LISTA DE CEM. "no celular" é o filtro que
  // importa na hora do ensaio: é o único que responde "o que eu posso tocar
  // agora, sem o computador?".
  var lista = acervo.filter(function (m) {
    if (filtro === 'separadas' && m.inteira) return false;
    if (filtro === 'celular' && !guardadas[m.chave]) return false;
    if (busca && m.titulo.toLowerCase().indexOf(busca.toLowerCase()) < 0) return false;
    return true;
  });

  var html = '<div class="peneira">' +
    '<div class="busca">' +
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#8a93a0" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
      '<input id="qBusca" type="search" placeholder="procurar música" value="' + esc(busca) + '">' +
      (busca ? '<button class="limpar" id="qLimpar">&times;</button>' : '') +
    '</div>' +
    '<div class="chips">' +
      chip('todas', 'todas') + chip('separadas', 'com mixer') + chip('celular', 'no celular') +
    '</div>' +
    '<span class="conta">' + lista.length + (lista.length === 1 ? ' música' : ' músicas') +
      (lista.length !== acervo.length ? ' de ' + acervo.length : '') + '</span>' +
    '</div>';

  if (!lista.length) {
    html += '<p class="vazio"><b>Nada com esse filtro</b>' +
      (filtro === 'celular' ? 'Nenhuma música foi levada pro ensaio ainda.' : 'Tente outro nome.') + '</p>';
    tela.innerHTML = html;
    ligarPeneira();
    return;
  }

  html += '<ul>';
  for (var i = 0; i < lista.length; i++) {
    var m = lista[i], n = acervo.indexOf(m);
    var aqui = !!guardadas[m.chave];

    // SEM ENFEITE NENHUM. A onda saiu (o dono pediu duas vezes), saíram os
    // colchetes, o número de série e as células. O que sobrou é o que a pessoa
    // realmente usa pra escolher uma música: a imagem, o nome, e uma linha
    // dizendo o que ela é.
    //
    // Desenho que precisa de explicação não está pronto. Este não precisa.
    var info = m.inteira ? 'música completa' : m.faixas.length + ' faixas';
    if (m.tom) info += ' · <em>' + m.tom + '</em>';
    if (m.bpm) info += ' · <em>' + m.bpm + '</em> bpm';
    if (m.duracao) info += ' · ' + mmss(m.duracao);

    // A COR VEM DA PRÓPRIA CAPA. "Tudo com cor igual" foi a queixa, e cor
    // inventada seria enfeite — que já falhou duas vezes aqui. Esta é a média
    // da imagem daquela música: a variedade da lista passa a ser a variedade
    // das capas, não uma paleta que eu escolhi.
    // A CAPA VIRA O FUNDO DO PRÓPRIO CARTÃO, borrada e escura. É mais rica que
    // uma tinta chapada e não inventa nada: é a mesma imagem, fora de foco.
    // A cor média continua servindo de reserva pra quem não tem capa.
    var estilo = [];
    if (m.cor) estilo.push('--cor:' + m.cor);
    if (m.capa) estilo.push("--fundo:url('" + comSenha(m.capa) + "')");

    html += '<li><div class="cartao-musica' + (aqui ? ' aqui' : '') + (m.capa ? ' comfundo' : '') + '"' +
      (estilo.length ? ' style="' + estilo.join(';') + '"' : '') + '>' +
      '<button class="abrir" data-i="' + n + '">' +
        '<span class="lamina">' +
          (m.capa
            ? '<img src="' + comSenha(m.capa) + '" alt="">'
            : '<span class="capa-vazia"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>') +
        '</span>' +
          // O SINAL DE QUE ABRE, no lugar onde o dono desenhou: na junta
          // entre a lâmina e o painel.
          // O SELO É UM SVG INTEIRO, com o hexágono desenhado de verdade.
          // Antes era um quadrado recortado em hexágono com contorno "inset" —
          // e contorno inset desenha RETÂNGULO: o recorte comia as diagonais e
          // sobrava fio só nos lados retos. Ficava quebrado, e o dono viu.
          '<span class="tocar" aria-hidden="true">' +
            '<svg viewBox="0 0 26 30" width="27" height="31">' +
              '<path d="M13 1.2 24.5 7.9v14.2L13 28.8 1.5 22.1V7.9z" fill="rgba(9,10,13,.92)" stroke="rgba(182,255,59,.6)" stroke-width="1.4"/>' +
              '<path d="M10.4 9.6v10.8L19.4 15z" fill="#b6ff3b"/>' +
            '</svg>' +
          '</span>' +
        '<span class="painel"><span class="corpo">' +
          '<span class="fio fio-cima"></span>' +
          '<b>' + esc(m.titulo) + '</b>' +
          '<span class="dados">' + info + '</span>' +
          '<span class="fio fio-baixo"></span>' +
        '</span></span>' +
        '<span class="estado" aria-hidden="true"><i></i></span>' +
      '</button>' +
      // AS LÂMINAS VERDES do desenho dele. Dois triângulos apontando pra
      // baixo — direção é o que faz "baixar" ser lido sem legenda.
      '<button class="levar' + (aqui ? ' tem' : '') + '" data-levar="' + m.chave + '" data-i="' + n + '" aria-label="Levar pro celular">' +
        '<svg viewBox="0 0 24 26" width="21" height="23" fill="currentColor" aria-hidden="true">' +
        '<path d="M3 2h18l-9 10z"/><path d="M6 15h12l-6 8z" opacity=".78"/></svg>' +
      '</button>' +
    '</div></li>';
  }
  tela.innerHTML = html + '</ul>';

  ligarPeneira();
  tela.querySelectorAll('.abrir').forEach(function (b) {
    b.onclick = function () { abrirMusica(acervo[+b.dataset.i]); };
  });
  tela.querySelectorAll('.levar').forEach(function (b) {
    b.onclick = function () {
      var m = acervo[+b.dataset.i];
      var urls = m.faixas.map(function (f) { return comSenha('/audio/' + m.chave + '/' + encodeURIComponent(f.arquivo)); });
      if (!GUARDA_DA) { baixarPraPasta(m); return; }
      if (guardadas[m.chave]) { aoGuardador({ tipo: 'largar', chave: m.chave, urls: urls }); return; }
      b.className = 'levar indo';
      b.textContent = 'levando… 0 de ' + urls.length;
      aoGuardador({ tipo: 'levar', chave: m.chave, urls: urls });
    };
  });
  aoGuardador({ tipo: 'quais' });
  pintarLevar();
}

// ██████████ AS ABAS ██████████
var aba = 'baixar';
function abrirAba(nome) {
  aba = nome;
  pintarBussola();
  // reinicia a animação de entrada: sem isto a segunda troca não anima
  var t = document.getElementById('tela');
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  if (nome === 'acervo') abrirAcervo();
  if (nome === 'baixar') abrirBaixar();
  if (nome === 'ajustes') abrirAjustes();
}

// ██████████ A TELA DE BAIXAR ██████████
// A ampulheta fica parada até haver um link. Com link, ela bate — e batendo
// ela DIZ que tem coisa pra fazer, não enfeita. Os quatro atos são os mesmos
// do computador porque são as mesmas quatro coisas que existem pra fazer com
// um link.
//
// QUEM BAIXA É O COMPUTADOR. O celular manda e depois pergunta como está:
// assim a tela pode bloquear, o Wi-Fi pode cair um minuto, e o download
// continua. Se o andamento morasse aqui, tela bloqueada perderia a música.
var linkAtual = '';
var tarefas = [];
var relogioTarefas = null;

var ATOS = [
  { id: 'music', nome: 'Baixar música', txt: 'MP3 na melhor qualidade, com capa',
    icone: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  { id: 'video', nome: 'Baixar vídeo', txt: 'O vídeo inteiro, com imagem',
    icone: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 12h18"/>' },
  { id: 'fast', nome: 'Rápido', txt: 'MP3 direto, sem reconverter',
    icone: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>' },
  { id: 'audio_wav', nome: 'WAV', txt: 'Sem compressão, pra editar depois',
    icone: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' }
];

var EH_LINK = /^https?:\/\//i;

function abrirBaixar() {
  voltar.hidden = true;
  onde.textContent = 'baixar';
  if (sessao) pararTudo();
  var temLink = EH_LINK.test(linkAtual.trim());

  var html = '<div class="palco-roda">' +
    '<button class="ampulheta ' + (temLink ? 'pronta' : 'parada') + '" id="ampulheta" aria-label="Colar link">' +
      '<svg viewBox="0 0 24 24" width="44" height="44"><path fill="currentColor" d="M4.5 2H19.5L13.4 12L19.5 22H4.5L10.6 12Z"/></svg>' +
    '</button>' +
    '<p class="roda-dica">' + (temLink
      ? '<b>Achei um endereço.</b> Escolha o que fazer com ele.'
      : 'Copie o endereço de uma música no YouTube e toque na ampulheta.') + '</p>' +
    '<div class="campo-link">' +
      '<input id="campoLink" type="url" inputmode="url" placeholder="cole aqui o endereço" value="' + esc(linkAtual) + '">' +
      '<button id="colarLink">colar</button>' +
    '</div>' +
    cartaoDaMusica() +
    '<div class="atos">';

  for (var i = 0; i < ATOS.length; i++) {
    var a = ATOS[i];
    html += '<button class="ato" data-ato="' + a.id + '"' + (temLink ? '' : ' disabled') + '>' +
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + a.icone + '</svg>' +
      '<b>' + a.nome + '</b><span>' + a.txt + '</span></button>';
  }
  html += '</div>';

  // Sem esta frase a pessoa acha que o celular está baixando e desliga o
  // computador no meio.
  html += '<p class="roda-dica" style="margin-top:16px;font-size:11.5px">' +
    'Quem baixa é o computador. Você pode fechar isto — quando voltar, a música está no acervo.</p>';
  html += '<div id="listaTarefas"></div></div>';
  tela.innerHTML = html;

  var espera = null;
  document.getElementById('campoLink').oninput = function () {
    linkAtual = this.value;
    pintarRoda();
    // meio segundo depois da última tecla: quem cola termina de colar, e quem
    // digita não faz o computador falar com o YouTube a cada letra
    clearTimeout(espera);
    espera = setTimeout(olharLink, 500);
  };
  document.getElementById('colarLink').onclick = colarDoAparelho;
  document.getElementById('ampulheta').onclick = colarDoAparelho;
  tela.querySelectorAll('.ato').forEach(function (b) {
    b.onclick = function () { pedirDownload(b.dataset.ato); };
  });

  pintarTarefas();
  if (!relogioTarefas) relogioTarefas = setInterval(puxarTarefas, 1500);
  puxarTarefas();
}

// ██████████ VER A MÚSICA ANTES DE BAIXAR ██████████
// Colar um link e apertar "baixar" é um salto no escuro: a pessoa não sabe se
// é a música certa, se é o clipe, se é a versão ao vivo. Ver a capa, o nome e
// a duração custa segundos; baixar errado custa muito mais — e no celular,
// dados móveis.
var espiada = null;   // { url, titulo, capa, duracao, quem } ou { erro }
var espiando = false;

function cartaoDaMusica() {
  if (espiando) {
    return '<div class="cartao"><div class="olhando"><i></i> olhando a música…</div></div>';
  }
  if (!espiada) return '';
  if (espiada.erro) {
    return '<div class="cartao"><div class="txt"><b>Não consegui ver essa</b>' +
      '<span class="quem">' + esc(espiada.erro) + '</span></div></div>';
  }
  return '<div class="cartao">' +
    (espiada.capa ? '<img src="' + esc(espiada.capa) + '" alt="">' : '') +
    '<div class="txt"><b>' + esc(espiada.titulo) + '</b>' +
    '<span class="quem">' +
      (espiada.quem ? esc(espiada.quem) : '') +
      (espiada.duracao ? (espiada.quem ? ' · ' : '') + '<em>' + mmss(espiada.duracao) + '</em>' : '') +
    '</span></div></div>';
}

// Só olha quando o link MUDA: olhar a cada letra digitada seria mandar o
// computador conversar com o YouTube dez vezes por segundo.
var ultimoOlhado = '';
function olharLink() {
  var u = linkAtual.trim();
  if (!EH_LINK.test(u)) { espiada = null; ultimoOlhado = ''; return; }
  if (u === ultimoOlhado) return;
  ultimoOlhado = u;
  espiada = null;
  espiando = true;
  abrirBaixar();
  fetch(comSenha('/api/olhar') + '&url=' + encodeURIComponent(u)).then(function (r) { return r.json(); })
    .then(function (info) {
      espiando = false;
      if (u !== linkAtual.trim()) return;   // a pessoa já trocou o link
      espiada = info.erro
        ? { erro: info.erro }
        : { titulo: info.title, capa: info.thumbnail, duracao: info.duration, quem: info.uploader };
      if (aba === 'baixar') abrirBaixar();
    })
    .catch(function () {
      espiando = false;
      espiada = { erro: 'não consegui falar com o computador' };
      if (aba === 'baixar') abrirBaixar();
    });
}

// O navegador só entrega a área de transferência com permissão, e alguns nem
// com permissão. Quando não dá, o campo recebe o foco — que é o caminho que
// sempre funciona.
function colarDoAparelho() {
  var campo = document.getElementById('campoLink');
  if (!navigator.clipboard || !navigator.clipboard.readText) { campo.focus(); return; }
  navigator.clipboard.readText().then(function (t) {
    if (t && t.trim()) { linkAtual = t.trim(); olharLink(); abrirBaixar(); } else { campo.focus(); }
  }).catch(function () { campo.focus(); });
}

// TROCA SÓ O QUE MUDA: redesenhar a tela a cada letra digitada tira o foco do
// campo e o teclado do celular fecha sozinho.
function pintarRoda() {
  var temLink = EH_LINK.test(linkAtual.trim());
  var amp = document.getElementById('ampulheta');
  if (amp) amp.className = 'ampulheta ' + (temLink ? 'pronta' : 'parada');
  tela.querySelectorAll('.ato').forEach(function (b) { b.disabled = !temLink; });
}

function pedirDownload(preset) {
  var url = linkAtual.trim();
  if (!EH_LINK.test(url)) return;
  fetch(comSenha('/api/baixar'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url, preset: preset })
  }).then(function () {
    linkAtual = '';
    espiada = null;
    ultimoOlhado = '';
    abrirBaixar();
  }).catch(function () {});
}

function puxarTarefas() {
  if (aba !== 'baixar') {
    clearInterval(relogioTarefas);
    relogioTarefas = null;
    return;
  }
  fetch(comSenha('/api/tarefas')).then(function (r) { return r.json(); }).then(function (t) {
    var mudou = JSON.stringify(t) !== JSON.stringify(tarefas);
    tarefas = t;
    if (mudou) pintarTarefas();
    var terminou = false;
    for (var i = 0; i < t.length; i++) if (t[i].estado === 'pronto') terminou = true;
    if (terminou) recarregarAcervo();
  }).catch(function () {});
}

function pintarTarefas() {
  var alvo = document.getElementById('listaTarefas');
  if (!alvo) return;
  if (!tarefas.length) { alvo.innerHTML = ''; return; }
  var h = '';
  for (var i = 0; i < tarefas.length; i++) {
    var t = tarefas[i];
    h += '<div class="tarefa ' + t.estado + '"><b>' + esc(t.titulo || t.url) + '</b>' +
      '<span class="estado">' + (t.estado === 'erro' ? 'não deu: ' + esc(t.erro || '') : t.estado) +
      (t.estado === 'baixando' ? ' · ' + t.porcento + '%' : '') + '</span>' +
      (t.estado === 'baixando' ? '<span class="trilha"><i style="width:' + t.porcento + '%"></i></span>' : '') +
      '</div>';
  }
  alvo.innerHTML = h;
}

var recarregando = false;
function recarregarAcervo() {
  if (recarregando) return;
  recarregando = true;
  fetch(comSenha('/api/acervo')).then(function (r) { return r.json(); }).then(function (l) {
    acervo = l;
    recarregando = false;
  }).catch(function () { recarregando = false; });
}

// ── AS TRÊS QUE EU APAGUEI SEM QUERER ──
// Elas moravam logo abaixo do acervo, e quando reescrevi a tela levei o trecho
// inteiro. O app parou de funcionar no celular com "pintarLevar is not
// defined" — e a MINHA mensagem de erro dizia "não consegui falar com o
// computador", mandando o dono conferir a rede, o Wi-Fi e o roteador. A rede
// nunca teve nada. Erro engolido e reetiquetado como outro erro faz a pessoa
// procurar no lugar errado por meia hora.

// Sem o computador por perto, só o que foi levado toca. Dizer isso ANTES de a
// pessoa apertar play evita a conclusão errada ("quebrou") no meio do ensaio.
function pintarLevar() {
  var qualquer = false;
  document.querySelectorAll('.levar').forEach(function (b) {
    if (b.className.indexOf('indo') >= 0) return;
    var tem = !!guardadas[b.dataset.levar];
    if (tem) qualquer = true;
    b.className = 'levar' + (tem ? ' tem' : '');
    b.title = tem ? 'já está no celular' : 'levar pro celular';
    // a barra de estado vive no CARTÃO, então quem sabe do download precisa
    // avisar os dois: o botão e a peça que desenha o quanto
    var c = b.closest('.cartao-musica');
    if (c) { c.classList.toggle('aqui', tem); c.classList.remove('indo', 'ruim'); }
  });
  var aviso = document.querySelector('.semrede');
  if (!navigator.onLine && !aviso) {
    var d = document.createElement('div');
    d.className = 'semrede';
    d.textContent = qualquer
      ? 'Sem o computador por perto: só tocam as músicas marcadas "no celular".'
      : 'Sem o computador por perto e nenhuma música foi levada. Em casa, aperte "levar pro ensaio".';
    tela.insertBefore(d, tela.firstChild);
  }
}

// BAIXAR PRA PASTA DO CELULAR. Um clique por arquivo, com um respiro entre
// eles: o Android bloqueia downloads em rajada achando que é abuso.
// Na música separada isso baixa as faixas soltas — sem mixer, porque o tocador
// do telefone não sabe misturar. É dito na cara, não escondido.
function baixarPraPasta(m) {
  var b = document.querySelector('.levar[data-levar="' + m.chave + '"]');
  var i = 0;
  function proxima() {
    if (i >= m.faixas.length) {
      if (b) {
        b.className = 'levar tem'; b.title = 'baixado — veja em Downloads';
        var c = b.closest('.cartao-musica');
        if (c) { c.classList.remove('indo', 'ruim'); c.classList.add('aqui'); }
      }
      return;
    }
    var f = m.faixas[i++];
    var a = document.createElement('a');
    a.href = comSenha('/audio/' + m.chave + '/' + encodeURIComponent(f.arquivo));
    a.download = (m.faixas.length > 1 ? m.titulo + ' - ' + (NOMES[f.id] || f.id) : m.titulo) + '.m4a';
    document.body.appendChild(a);
    a.click();
    a.remove();
    marcarLevando(m.chave, i, m.faixas.length);
    setTimeout(proxima, 900);
  }
  proxima();
}

function marcarLevando(chave, feito, total) {
  var b = document.querySelector('.levar[data-levar="' + chave + '"]');
  if (!b) return;
  b.className = 'levar indo';
  var c = b.closest('.cartao-musica');
  if (c) {
    c.classList.add('indo'); c.classList.remove('aqui', 'ruim');
    c.style.setProperty('--quanto', Math.round(feito / total * 100) + '%');
  }
}

function marcarFalhou(chave) {
  var b = document.querySelector('.levar[data-levar="' + chave + '"]');
  if (!b) return;
  b.className = 'levar erro';
  b.title = 'não deu — toque pra tentar de novo';
  var c = b.closest('.cartao-musica');
  if (c) { c.classList.add('ruim'); c.classList.remove('indo'); }
}

function chip(id, rotulo) {
  return '<button class="chip' + (filtro === id ? ' on' : '') + '" data-chip="' + id + '">' + rotulo + '</button>';
}

// A BUSCA NÃO REDESENHA A LISTA A CADA LETRA sem guardar o cursor: redesenhar
// tira o foco do campo e o teclado do celular fecha na segunda letra.
function ligarPeneira() {
  var q = document.getElementById('qBusca');
  if (q) {
    q.oninput = function () {
      busca = q.value;
      var pos = q.selectionStart;
      abrirAcervo();
      var novo = document.getElementById('qBusca');
      if (novo) { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (e) {} }
    };
  }
  var l = document.getElementById('qLimpar');
  if (l) l.onclick = function () { busca = ''; abrirAcervo(); };
  tela.querySelectorAll('.chip').forEach(function (c) {
    c.onclick = function () { filtro = c.dataset.chip; abrirAcervo(); };
  });
}

function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return ({'<':'&lt;','>':'&gt;','&':'&amp;'})[c]; }); }

function abrirMusica(m) {
  voltar.hidden = false; onde.textContent = 'estúdio';
  var html = '<div class="transporte">' +
    '<div class="faixa-nome">' + esc(m.titulo) + '</div>' +
    '<div class="tempo"><span id="agora">0:00</span><small>/ ' + mmss(m.duracao) + '</small>' +
      ((m.tom || m.bpm) ? '<span class="hud">' +
        (m.tom ? 'TOM<b>' + m.tom + '</b>' : '') +
        (m.bpm ? 'BPM<b>' + m.bpm + '</b>' : '') + '</span>' : '') +
    '</div>' +
    '<input class="barra" id="seek" type="range" min="0" max="' + Math.floor(m.duracao) + '" value="0" step="1">' +
    '<div class="botoes">' +
      '<button class="play" id="play" aria-label="Tocar">&#9654;</button>' +
      '<button class="zerar" id="zerar">voltar ao início</button>' +
    '</div>' +
    // AS FERRAMENTAS. Metrônomo, repetir trecho e velocidade — o que faz
    // alguém abrir uma música num ensaio.
    '<div class="ferramentas">' +
      '<button class="ferr" id="btMetro"><b>' + (m.bpm || '--') + '</b><span>metrônomo</span></button>' +
      '<button class="ferr" id="btLoop"><b>A-B</b><span>repetir</span></button>' +
      '<button class="ferr" id="btLetra"' + ((m.letra || m.cifra) ? '' : ' disabled') + '><b>' +
        (m.letra ? 'LETRA' : (m.cifra ? 'CIFRA' : '--')) + '</b><span>' + (m.letra && m.cifra ? 'e cifra' : 'ver') + '</span></button>' +
    '</div>' +
    '<div class="velocidade">' +
      '<span class="rot">velocidade</span>' +
      '<input id="vel" type="range" min="50" max="100" step="5" value="100">' +
      '<b id="velTxt">100%</b>' +
    '</div>' +
    '</div><div class="faixas">';
  for (var i = 0; i < m.faixas.length; i++) {
    var f = m.faixas[i], cor = CORES[i % CORES.length];
    var nome = NOMES[f.id] || (f.id.charAt(0).toUpperCase() + f.id.slice(1));
    html += '<div class="faixa" data-id="' + f.id + '" style="color:' + cor + '">' +
      '<span class="cor" style="background:' + cor + '"></span>' +
      '<span class="nome"><b style="color:' + cor + '">' + nome + '</b>' +
      '<input class="vol" type="range" min="0" max="100" value="100" data-id="' + f.id + '"></span>' +
      '<span class="ms"><button class="m" data-id="' + f.id + '" aria-pressed="false">M</button>' +
      '<button class="s" data-id="' + f.id + '" aria-pressed="false">S</button></span></div>';
  }
  tela.innerHTML = html + '</div>';
  montarAudio(m);
}

function montarAudio(m) {
  pararTudo();
  sessao = { audios: [], mudos: {}, solos: {}, vols: {}, dur: m.duracao };
  for (var i = 0; i < m.faixas.length; i++) {
    var f = m.faixas[i];
    var a = new Audio('/audio/' + m.chave + '/' + encodeURIComponent(f.arquivo));
    a.preload = 'auto';
    a.dataset.id = f.id;
    sessao.audios.push(a);
    sessao.vols[f.id] = 1;
  }
  // PREPARANDO. Na PRIMEIRA vez que uma música é aberta no celular, o
  // computador está convertendo as faixas — alguns segundos. Sem dizer isso, a
  // pessoa aperta o play e não acontece nada, o que parece defeito. Depois da
  // primeira vez as faixas já estão prontas e este aviso mal aparece.
  var prontas = 0;
  var aviso = document.createElement('div');
  aviso.className = 'preparando';
  aviso.textContent = 'preparando as faixas… 0 de ' + sessao.audios.length;
  document.querySelector('.transporte').appendChild(aviso);
  sessao.audios.forEach(function (a) {
    a.addEventListener('canplay', function () {
      prontas++;
      if (prontas >= sessao.audios.length) { aviso.remove(); }
      else { aviso.textContent = 'preparando as faixas… ' + prontas + ' de ' + sessao.audios.length; }
    }, { once: true });
  });

  var play = document.getElementById('play');
  var seek = document.getElementById('seek');
  var agora = document.getElementById('agora');

  // O RELÓGIO SAI DE UMA FAIXA SÓ (a primeira). Ler o tempo de todas e tentar
  // conciliar daria números brigando entre si — uma manda, as outras seguem.
  var mestre = sessao.audios[0];
  // MÚSICA BAIXADA não tem duração no registro (ninguém a analisou). Quem
  // sabe é o próprio arquivo, e ele só conta depois de abrir.
  mestre.addEventListener('loadedmetadata', function () {
    if (!m.duracao && mestre.duration) {
      seek.max = Math.floor(mestre.duration);
      var total = document.querySelector('.tempo small');
      if (total) total.textContent = '/ ' + mmss(mestre.duration);
    }
  });
  mestre.addEventListener('timeupdate', function () {
    agora.textContent = mmss(mestre.currentTime);
    if (!arrastando) seek.value = Math.floor(mestre.currentTime);
  });

  var tocando = false;
  play.onclick = function () {
    tocando = !tocando;
    play.innerHTML = tocando ? '&#10073;&#10073;' : '&#9654;';
    sessao.audios.forEach(function (a) { tocando ? a.play().catch(function(){}) : a.pause(); });
  };
  document.getElementById('zerar').onclick = function () { irPara(0); };

  var arrastando = false;
  seek.addEventListener('input', function () { arrastando = true; agora.textContent = mmss(+seek.value); });
  seek.addEventListener('change', function () { arrastando = false; irPara(+seek.value); });

  function irPara(t) { sessao.audios.forEach(function (a) { try { a.currentTime = t; } catch (e) {} }); }

  tela.querySelectorAll('.vol').forEach(function (v) {
    v.oninput = function () { sessao.vols[v.dataset.id] = v.value / 100; aplicar(); };
  });
  tela.querySelectorAll('.ms .m').forEach(function (b) {
    b.onclick = function () {
      var on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      sessao.mudos[b.dataset.id] = !on; aplicar();
    };
  });
  tela.querySelectorAll('.ms .s').forEach(function (b) {
    b.onclick = function () {
      var on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', String(!on));
      sessao.solos[b.dataset.id] = !on; aplicar();
    };
  });
  ligarFerramentas(m, mestre, irPara);
  aplicar();
}

// ██████████ VELOCIDADE, METRÔNOMO, REPETIR E CIFRA ██████████
var loopA = null, loopB = null, metro = false, verLetra = false;
var audioCtx = null, ultimaBatida = -1;

function ligarFerramentas(m, mestre, irPara) {
  loopA = null; loopB = null; metro = false; verLetra = false; ultimaBatida = -1;

  // VELOCIDADE SEM MEXER NO TOM. Quem estuda um solo precisa das MESMAS notas,
  // mais devagar — se o tom cair junto, a pessoa aprende errado.
  var vel = document.getElementById('vel');
  var velTxt = document.getElementById('velTxt');
  vel.oninput = function () {
    var r = vel.value / 100;
    velTxt.textContent = vel.value + '%';
    sessao.audios.forEach(function (a) {
      a.preservesPitch = true;
      a.mozPreservesPitch = true;
      a.webkitPreservesPitch = true;
      a.playbackRate = r;
    });
  };

  // REPETIR TRECHO: primeiro toque marca onde começa, segundo onde termina,
  // terceiro solta. Marcar no relógio é o jeito que funciona sem desenho de
  // onda — e num celular a onda seria pequena demais pra acertar o dedo.
  var btLoop = document.getElementById('btLoop');
  btLoop.onclick = function () {
    if (loopA === null) { loopA = mestre.currentTime; pintarLoop(btLoop); return; }
    if (loopB === null) {
      loopB = mestre.currentTime;
      if (loopB <= loopA) { loopB = null; loopA = mestre.currentTime; }
      pintarLoop(btLoop); return;
    }
    loopA = null; loopB = null; pintarLoop(btLoop);
  };

  // METRÔNOMO. "Seguindo" usa as batidas que o analisador achou na gravação —
  // é o único jeito de ficar junto de banda humana, que acelera no refrão.
  var btMetro = document.getElementById('btMetro');
  btMetro.onclick = function () {
    metro = !metro;
    btMetro.className = 'ferr' + (metro ? ' on' : '');
    if (metro && !audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    }
    if (metro && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  };

  var btLetra = document.getElementById('btLetra');
  if (btLetra && !btLetra.disabled) {
    btLetra.onclick = function () {
      verLetra = !verLetra;
      btLetra.className = 'ferr' + (verLetra ? ' on' : '');
      pintarLetra(m, mestre.currentTime);
    };
  }

  // um relógio só, e ele cuida de tudo que anda com o tempo
  mestre.addEventListener('timeupdate', function () {
    var t = mestre.currentTime;
    if (loopA !== null && loopB !== null && t >= loopB) irPara(loopA);
    if (metro) baterMetro(m, t);
    if (verLetra) acenderLetra(t);
  });
}

function pintarLoop(b) {
  if (loopA === null) { b.className = 'ferr'; b.querySelector('b').textContent = 'A-B'; return; }
  b.className = 'ferr on';
  b.querySelector('b').textContent = loopB === null ? mmss(loopA) + '→?' : mmss(loopA) + '→' + mmss(loopB);
}

// O CLIQUE é um estalo curto, não um bipe: bipe longo se confunde com a
// música, e no ensaio o metrônomo tem que ser ouvido POR CIMA dela.
function baterMetro(m, t) {
  if (!audioCtx || !m.batidas) return;
  for (var i = ultimaBatida + 1; i < m.batidas.length; i++) {
    if (m.batidas[i] <= t && m.batidas[i] > t - 0.15) {
      ultimaBatida = i;
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = (i % 4 === 0) ? 1600 : 1100;
      g.gain.setValueAtTime(0.28, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.05);
      return;
    }
    if (m.batidas[i] > t) { ultimaBatida = i - 1; return; }
  }
}

// A CIFRA EM CIMA DO VERSO, como no computador: o acorde só serve se você sabe
// em que palavra ele entra.
function pintarLetra(m, t) {
  var velho = document.querySelector('.painel-letra, .so-cifra, .aviso-tom');
  if (velho) velho.remove();
  if (!verLetra) return;
  var alvo = document.querySelector('.faixas');
  var caixa = document.createElement('div');

  if (m.letra && m.letra.length) {
    caixa.className = 'painel-letra';
    var h = '';
    for (var i = 0; i < m.letra.length; i++) {
      var seg = m.letra[i];
      var acordes = '';
      if (m.cifra) {
        for (var c = 0; c < m.cifra.length; c++) {
          var ac = m.cifra[c];
          if (ac.t >= seg.t0 && ac.t < (seg.t1 || seg.t0 + 4)) acordes += (acordes ? '  ' : '') + ac.label;
        }
      }
      h += '<div class="linha-letra" data-t0="' + seg.t0 + '" data-t1="' + (seg.t1 || seg.t0 + 4) + '">' +
        '<div class="acordes">' + acordes + '</div>' +
        '<div class="frase">' + esc(seg.text || '') + '</div></div>';
    }
    caixa.innerHTML = h;
  } else if (m.cifra && m.cifra.length) {
    caixa.className = 'so-cifra';
    var g = '';
    for (var k = 0; k < m.cifra.length; k++) {
      g += '<span data-t0="' + m.cifra[k].t + '" data-t1="' + (m.cifra[k].end || m.cifra[k].t + 2) + '">' + esc(m.cifra[k].label) + '</span>';
    }
    caixa.innerHTML = g;
  }
  alvo.parentNode.insertBefore(caixa, alvo);
  acenderLetra(t);
}

// acender o trecho do momento é o que transforma texto em acompanhamento
function acenderLetra(t) {
  var linhas = document.querySelectorAll('.linha-letra, .so-cifra span');
  var achou = null;
  linhas.forEach(function (l) {
    var dentro = t >= +l.dataset.t0 && t < +l.dataset.t1;
    if (dentro && !achou) achou = l;
    if (l.className.indexOf('agora') >= 0 !== dentro) {
      l.className = l.className.replace(' agora', '') + (dentro ? ' agora' : '');
    }
  });
  if (achou && achou.getBoundingClientRect().top > window.innerHeight - 140) {
    achou.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

// SOLO MANDA NO MUDO: se alguma faixa está em solo, todas as outras calam,
// mesmo as que não foram mudadas. É como mesa de som funciona, e é o que a
// pessoa espera ao apertar S.
function aplicar() {
  if (!sessao) return;
  var temSolo = Object.keys(sessao.solos).some(function (k) { return sessao.solos[k]; });
  sessao.audios.forEach(function (a) {
    var id = a.dataset.id;
    var cala = temSolo ? !sessao.solos[id] : !!sessao.mudos[id];
    a.volume = cala ? 0 : (sessao.vols[id] != null ? sessao.vols[id] : 1);
    var linha = tela.querySelector('.faixa[data-id="' + id + '"]');
    if (linha) linha.classList.toggle('calada', cala);
  });
}

function pararTudo() {
  if (!sessao) return;
  sessao.audios.forEach(function (a) { try { a.pause(); a.src = ''; } catch (e) {} });
  sessao = null;
}

// ██████████ AJUSTES ██████████
// O que ela mostra é o estado do APARELHO: o que está guardado aqui, quanto
// ocupa, e se o computador está por perto. Nada de "configuração" — não há o
// que configurar; há o que CONFERIR antes de sair de casa.
var temApp = { tem: false, mb: 0 };

function abrirAjustes() {
  voltar.hidden = true; onde.textContent = 'aparelho';
  // pergunta uma vez se existe app pra instalar; se existir, redesenha com o
  // convite. Perguntar sempre faria a tela piscar a cada visita.
  if (!temApp.perguntei) {
    temApp.perguntei = true;
    fetch(comSenha('/api/tem-app')).then(function (r) { return r.json(); }).then(function (t) {
      temApp.tem = t.tem; temApp.mb = t.mb;
      if (t.tem && aba === 'ajustes') abrirAjustes();
    }).catch(function () {});
  }
  var levadas = acervo.filter(function (m) { return guardadas[m.chave]; });
  var bytes = 0;
  levadas.forEach(function (m) { m.faixas.forEach(function (f) { bytes += (f.bytes || 0) / 6; }); });
  var mb = Math.round(bytes / 1048576);

  var f = document.createElement('div');
  f.className = 'folha-fundo';
  f.innerHTML = '<div class="folha" onclick="event.stopPropagation()">' +
    (temApp.tem
      ? '<div class="convite"><b>Instalar o MPTRIX no celular</b>' +
        '<p>Vira um app de verdade: ícone na tela, abre sozinho, e depois funciona ' +
        'longe do computador.</p>' +
        '<a href="' + comSenha('/app.apk') + '" download="MPTRIX.apk">' +
          '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
          'baixar o app · ' + temApp.mb + ' MB</a>' +
        '<small>O Android vai avisar que não conhece o app e pedir permissão pra instalar ' +
        'fora da loja. É normal — libere e toque em instalar.</small></div>'
      : '') +
    '<span class="olho">este aparelho</span><h3>O que está no celular</h3>' +
    '<p>Só o que você levou toca sem o computador. O resto vem dele, pela rede de casa.</p>' +
    '<div class="linha-dado"><span class="rot">músicas levadas</span><b class="lima">' + levadas.length + '</b></div>' +
    '<div class="linha-dado"><span class="rot">espaço, mais ou menos</span><b>' + (mb || '<1') + ' MB</b></div>' +
    '<div class="linha-dado"><span class="rot">computador</span><b>' + (navigator.onLine ? 'por perto' : 'longe') + '</b></div>' +
    '<div class="linha-dado"><span class="rot">tocar sem o computador</span><b class="' + (GUARDA_DA ? 'lima' : '') + '">' +
      (GUARDA_DA ? 'dá' : 'não dá') + '</b></div>' +
    (GUARDA_DA ? '' :
      '<p>Este navegador não guarda música em endereço sem cadeado (o de casa não tem). ' +
      'Por isso o botão do acervo <b>baixa o arquivo</b> pra pasta do celular: a música fica no aparelho ' +
      'e toca em qualquer tocador, sem o computador — só sem o mixer.</p>') +
    (levadas.length ? '<button class="folha-btn perigo" id="tirarTudo">tirar todas do celular</button>' : '') +
    '<button class="folha-fechar" id="fecharFolha">fechar</button>' +
    '</div>';
  f.onclick = function () { f.remove(); };
  document.body.appendChild(f);
  document.getElementById('fecharFolha').onclick = function () { f.remove(); };
  var t = document.getElementById('tirarTudo');
  if (t) t.onclick = function () {
    levadas.forEach(function (m) {
      aoGuardador({ tipo: 'largar', chave: m.chave,
        urls: m.faixas.map(function (x) { return comSenha('/audio/' + m.chave + '/' + encodeURIComponent(x.arquivo)); }) });
    });
    f.remove();
  };
}
// A PRIMEIRA COISA QUE ALGUÉM FAZ AO ABRIR O MPTRIX É QUERER UMA MÚSICA.
// Por isso o app abre em BAIXAR, e não no acervo: o acervo é para onde se vai
// depois, e está a um deslize de distância.
var TELAS = ['baixar', 'acervo', 'ajustes'];

function pintarBussola() {
  var n = TELAS.indexOf(aba);
  document.querySelectorAll('.bussola i').forEach(function (p, k) {
    p.className = k === n ? 'on' : '';
  });
}

// DESLIZAR DE LADO. Com três telas, arrastar é mais rápido que mirar num botão
// pequeno — e devolve o rodapé inteiro para o conteúdo.
// O gesto só conta se for mais horizontal que vertical: senão, rolar a lista
// trocaria de tela sem querer, que é o pior tipo de defeito — o que acontece
// enquanto a pessoa faz outra coisa.
var x0 = null, y0 = null;
document.addEventListener('touchstart', function (e) {
  if (e.touches.length !== 1) { x0 = null; return; }
  // dentro de um controle deslizante (volume, tempo) o arrasto é DELE
  var alvo = e.target;
  if (alvo && (alvo.tagName === 'INPUT' || alvo.closest('.vol, .barra, .velocidade'))) { x0 = null; return; }
  x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', function (e) {
  if (x0 === null) return;
  var dx = e.changedTouches[0].clientX - x0;
  var dy = e.changedTouches[0].clientY - y0;
  x0 = null;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
  var n = TELAS.indexOf(aba) + (dx < 0 ? 1 : -1);
  if (n < 0 || n >= TELAS.length) return;
  document.getElementById('tela').style.setProperty('--de', (dx < 0 ? 18 : -18) + 'px');
  abrirAba(TELAS[n]);
}, { passive: true });

document.getElementById('btAjustes').onclick = function () { abrirAba('ajustes'); };

voltar.onclick = function () { abrirAba(aba === 'estudio' ? 'acervo' : aba); };

// A TELA PASSA A CONTAR O QUE ACONTECEU. "Não consegui falar" é a única
// informação que não ajuda ninguém: ela some com a diferença entre "a rede não
// chegou", "o computador recusou" e "veio coisa que eu não sei ler".
var ultimoErro = '';
fetch(comSenha('/api/acervo')).then(function (r) {
  if (!r.ok) { ultimoErro = 'o computador respondeu ' + r.status + (r.status === 403 ? ' (senha recusada)' : ''); throw new Error(ultimoErro); }
  return r.json();
}).then(function (lista) {
  acervo = lista; abrirAcervo();
}).catch(function (e) {
  if (!ultimoErro) ultimoErro = String(e && e.message ? e.message : e);
  if (DENTRO_DO_APP) {
    tela.innerHTML = '<p class="vazio"><b>Ainda estou aprendendo</b>' +
      'Este app ainda não lê a música guardada no seu celular — é a próxima parte a ser feita.<br><br>' +
      'Por enquanto, use pelo navegador: abra o endereço que aparece no MPTRIX do computador, ' +
      'na aba NUVEM.<br><br>' +
      '<span style="font-family:var(--mono);font-size:11px;color:var(--mudo2)">' +
      'o que você vê aqui é a tela pronta, esperando a música</span></p>';
    return;
  }
  tela.innerHTML = '<p class="vazio"><b>Não consegui falar com o computador</b>' +
    'Confira se o MPTRIX está aberto nele, se você apertou "Ligar agora",<br>' +
    'e se o celular está no mesmo Wi-Fi.' +
    '<span class="diag">' +
      'ERRO: ' + esc(ultimoErro) + '<br>' +
      'ENDERECO: ' + esc(location.host) + '<br>' +
      'SENHA: ' + (S ? 'presente (' + S.length + ' letras)' : 'AUSENTE') + '<br>' +
      'GUARDADOR: ' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'no comando' : 'fora') + '<br>' +
      'REDE: ' + (navigator.onLine ? 'o celular se diz online' : 'o celular se diz offline') +
    '</span>' +
    '<button class="folha-btn" id="tentarDeNovo" style="max-width:240px;margin:16px auto 0">tentar de novo</button>' +
    '</p>';
  var t = document.getElementById('tentarDeNovo');
  if (t) t.onclick = function () { location.reload(); };
});
</script>
</body>
</html>`
}
