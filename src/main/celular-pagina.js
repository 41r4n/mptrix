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
<style>
:root {
  --bg: #0b0c0f; --painel: #101216; --card: #15171c; --cava: #08090c; --cava2: #050609;
  --linha: rgba(255,255,255,0.07); --linha2: rgba(255,255,255,0.14); --linha3: rgba(255,255,255,0.22);
  --txt: #f2f4f7; --txt2: #d1d5db; --mudo: #9ba3af; --mudo2: #8a93a0;
  --lima: #b6ff3b; --lima-b: rgba(182,255,59,0.3); --amarelo: #eab308; --ruim: #f87171;
  --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  --corte: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  --corte-sm: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body {
  margin: 0; background: var(--bg); color: var(--txt);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  padding-bottom: calc(18px + env(safe-area-inset-bottom));
}
button, input { font-family: inherit; }

/* ── A MARCA. O hexágono com a ampulheta é a assinatura da casa: quem abre no
      celular precisa reconhecer o mesmo app, não achar que é outro site. ── */
header {
  display: flex; align-items: center; gap: 11px;
  padding: calc(12px + env(safe-area-inset-top)) 15px 12px;
  border-bottom: 1px solid var(--linha);
  position: sticky; top: 0; background: var(--bg); z-index: 6;
}
.hex {
  width: 30px; height: 30px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(182,255,59,0.12); color: var(--lima);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.marca { font-weight: 700; letter-spacing: 0.06em; font-size: 15px; line-height: 1; }
.marca b { color: var(--lima); text-shadow: 0 0 14px rgba(182,255,59,0.45); }
.marca span {
  display: block; margin-top: 3px;
  font-family: var(--mono); font-size: 8px; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--mudo2); font-weight: 400;
}
.voltar {
  background: none; border: none; color: var(--mudo); font-size: 21px;
  padding: 4px 8px 4px 0; cursor: pointer; line-height: 1; flex: none;
}
.cabeca-fim { margin-left: auto; display: flex; align-items: center; gap: 7px; }
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
.chip.on { background: var(--lima); color: #0b0c0f; font-weight: 700; box-shadow: none; }
.conta {
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--mudo2); padding: 0 1px;
}

/* ── OS CARTÕES DO ACERVO ── */
ul { list-style: none; margin: 0; padding: 10px 12px 0; }
li { margin-bottom: 9px; }
.musica {
  display: flex; align-items: stretch; gap: 11px; width: 100%;
  text-align: left; cursor: pointer; padding: 10px;
  background: var(--card); border: none; color: var(--txt);
  box-shadow: inset 0 0 0 1px var(--linha);
  clip-path: var(--corte);
}
/* A CAPA dá o reconhecimento antes da leitura: numa lista de trinta nomes
   parecidos, a pessoa acha pela imagem, não pelo texto. */
.capa {
  width: 62px; height: 62px; flex: none; object-fit: cover;
  background: var(--cava2); clip-path: var(--corte-sm);
}
.capa-vazia {
  width: 62px; height: 62px; flex: none;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--cava2); color: var(--linha3); clip-path: var(--corte-sm);
}
.corpo { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.corpo b { font-size: 14px; font-weight: 600; line-height: 1.3; }
.marcas { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.tag {
  font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.1em;
  text-transform: uppercase; padding: 3px 6px; color: var(--mudo2);
  box-shadow: inset 0 0 0 1px var(--linha);
}
.tag.faixas { color: var(--lima); box-shadow: inset 0 0 0 1px var(--lima-b); }
.tag.tom, .tag.bpm { color: var(--txt2); }
.tag.aqui { background: var(--lima); color: #0b0c0f; font-weight: 700; box-shadow: none; }

/* LEVAR: fica colado na música, não num menu — é a decisão que se toma antes
   de sair de casa, e ela precisa ser vista de relance. */
.levar {
  display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
  margin-top: -3px; padding: 9px 10px;
  background: none; border: none; color: var(--mudo);
  box-shadow: inset 0 0 0 1px var(--linha2);
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.12em;
  text-transform: uppercase; cursor: pointer;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px));
}
.levar.tem { color: var(--lima); box-shadow: inset 0 0 0 1px var(--lima-b); background: rgba(182,255,59,0.06); }
.levar.indo { color: var(--amarelo); box-shadow: inset 0 0 0 1px rgba(234,179,8,0.5); }

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
  font-family: var(--mono); font-size: 26px; color: var(--lima);
  text-shadow: 0 0 20px rgba(182,255,59,0.35); letter-spacing: 0.02em;
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
    <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M4.5 2H19.5L13.4 12L19.5 22H4.5L10.6 12Z"/></svg>
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

<script>
// A SENHA VIAJA EM TODO PEDIDO, e não num cookie.
// Eu tinha posto a senha só na URL da página e deixado um cookie tomar conta
// do resto. O celular do dono carregou a página e não conseguiu a lista: o
// Chrome do Android não guardou o cookie (página sem cadeado, endereço de IP).
// A página abria bonita e vazia, dizendo "não consegui falar com o
// computador" — quando o computador estava ali, respondendo.
// Depender de cookie é depender de uma decisão do navegador que eu não
// controlo. A senha eu controlo: ela está na barra de endereço, e vai junto.
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
// O GUARDADOR precisa estar de pé antes de tudo: é ele que responde quando o
// computador não está por perto.
var guardadas = {};
if ('serviceWorker' in navigator) {
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
    html += '<li><button class="musica" data-i="' + n + '">' +
      (m.capa
        ? '<img class="capa" src="' + comSenha(m.capa) + '" alt="">'
        : '<span class="capa-vazia"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>') +
      '<span class="corpo"><b>' + esc(m.titulo) + '</b><span class="marcas">' +
        (m.inteira
          ? '<span class="tag">música completa</span>'
          : '<span class="tag faixas">' + m.faixas.length + ' faixas</span>') +
        (m.tom ? '<span class="tag tom">tom ' + m.tom + '</span>' : '') +
        (m.bpm ? '<span class="tag bpm">' + m.bpm + ' bpm</span>' : '') +
        (m.duracao ? '<span class="tag">' + mmss(m.duracao) + '</span>' : '') +
        '<span class="tag aqui" data-selo="' + m.chave + '" hidden>no celular</span>' +
      '</span></span></button>' +
      '<button class="levar" data-levar="' + m.chave + '" data-i="' + n + '">levar pro ensaio</button></li>';
  }
  tela.innerHTML = html + '</ul>';

  ligarPeneira();
  tela.querySelectorAll('.musica').forEach(function (b) {
    b.onclick = function () { abrirMusica(acervo[+b.dataset.i]); };
  });
  tela.querySelectorAll('.levar').forEach(function (b) {
    b.onclick = function () {
      var m = acervo[+b.dataset.i];
      var urls = m.faixas.map(function (f) { return comSenha('/audio/' + m.chave + '/' + encodeURIComponent(f.arquivo)); });
      if (guardadas[m.chave]) { aoGuardador({ tipo: 'largar', chave: m.chave, urls: urls }); return; }
      b.className = 'levar indo';
      b.textContent = 'levando… 0 de ' + urls.length;
      aoGuardador({ tipo: 'levar', chave: m.chave, urls: urls });
    };
  });
  aoGuardador({ tipo: 'quais' });
  pintarLevar();
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
    '</div></div><div class="faixas">';
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
  aplicar();
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
function abrirAjustes() {
  var levadas = acervo.filter(function (m) { return guardadas[m.chave]; });
  var bytes = 0;
  levadas.forEach(function (m) { m.faixas.forEach(function (f) { bytes += (f.bytes || 0) / 6; }); });
  var mb = Math.round(bytes / 1048576);

  var f = document.createElement('div');
  f.className = 'folha-fundo';
  f.innerHTML = '<div class="folha" onclick="event.stopPropagation()">' +
    '<span class="olho">este aparelho</span><h3>O que está no celular</h3>' +
    '<p>Só o que você levou toca sem o computador. O resto vem dele, pela rede de casa.</p>' +
    '<div class="linha-dado"><span class="rot">músicas levadas</span><b class="lima">' + levadas.length + '</b></div>' +
    '<div class="linha-dado"><span class="rot">espaço, mais ou menos</span><b>' + (mb || '<1') + ' MB</b></div>' +
    '<div class="linha-dado"><span class="rot">computador</span><b>' + (navigator.onLine ? 'por perto' : 'longe') + '</b></div>' +
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
document.getElementById('btAjustes').onclick = abrirAjustes;

voltar.onclick = abrirAcervo;

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
