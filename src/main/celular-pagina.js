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
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0c0f">
<title>MPTRIX</title>
<style>
  :root {
    --bg: #0b0c0f; --painel: #101216; --card: #15171c; --cava: #08090c;
    --linha: rgba(255,255,255,0.07); --linha2: rgba(255,255,255,0.14);
    --txt: #f2f4f7; --txt2: #d1d5db; --mudo: #9ba3af; --mudo2: #8a93a0;
    --lima: #b6ff3b; --amarelo: #eab308;
    --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; background: var(--bg); color: var(--txt);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    padding-bottom: env(safe-area-inset-bottom);
  }
  header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px; border-bottom: 1px solid var(--linha);
    position: sticky; top: 0; background: var(--bg); z-index: 5;
  }
  .marca { font-weight: 700; letter-spacing: 0.04em; font-size: 15px; }
  .marca b { color: var(--lima); }
  .voltar {
    background: none; border: none; color: var(--mudo); font-size: 22px;
    padding: 0 6px 0 0; cursor: pointer; line-height: 1;
  }
  .rot {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--mudo2);
  }

  /* ── lista de músicas ── */
  ul { list-style: none; margin: 0; padding: 10px 12px; }
  li + li { margin-top: 8px; }
  .musica {
    display: block; width: 100%; text-align: left; cursor: pointer;
    background: var(--card); border: none; color: var(--txt);
    padding: 13px 14px; font: inherit;
    box-shadow: inset 0 0 0 1px var(--linha);
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  }
  .musica b { display: block; font-size: 14.5px; font-weight: 600; line-height: 1.3; }
  .musica .dados {
    margin-top: 6px; font-family: var(--mono); font-size: 10px;
    letter-spacing: 0.1em; color: var(--mudo2);
  }
  .musica .dados i { font-style: normal; color: var(--lima); }
  .vazio { padding: 40px 20px; text-align: center; color: var(--mudo); line-height: 1.6; }

  /* ── o estúdio ── */
  .transporte {
    position: sticky; top: 53px; z-index: 4;
    background: var(--painel); border-bottom: 1px solid var(--linha);
    padding: 12px 14px;
  }
  .tempo {
    display: flex; align-items: baseline; gap: 8px;
    font-family: var(--mono); font-size: 22px; color: var(--lima);
    text-shadow: 0 0 18px rgba(182,255,59,0.35);
  }
  .tempo small { font-size: 12px; color: var(--mudo2); text-shadow: none; }
  .barra {
    width: 100%; margin: 10px 0 12px; height: 26px;
    background: none; -webkit-appearance: none; appearance: none;
  }
  .barra::-webkit-slider-runnable-track { height: 4px; background: rgba(255,255,255,0.12); }
  .barra::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px;
    background: var(--lima); border-radius: 50%;
    box-shadow: 0 0 12px rgba(182,255,59,0.6);
  }
  .botoes { display: flex; align-items: center; gap: 10px; }
  .play {
    width: 52px; height: 52px; border-radius: 50%; border: none; flex: none;
    background: var(--lima); color: #0b0c0f; font-size: 20px; cursor: pointer;
    box-shadow: 0 0 24px rgba(182,255,59,0.4);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .zerar {
    height: 36px; padding: 0 14px; background: none; border: none;
    box-shadow: inset 0 0 0 1px var(--linha2); color: var(--mudo);
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
    text-transform: uppercase; cursor: pointer;
  }
  .info { margin-left: auto; text-align: right; font-family: var(--mono); font-size: 10px; color: var(--mudo2); }
  .info b { color: var(--txt2); }

  /* ── as faixas ── */
  .faixas { padding: 12px 12px 30px; }
  .faixa {
    display: flex; align-items: center; gap: 10px;
    background: var(--card); padding: 10px 12px; margin-bottom: 8px;
    box-shadow: inset 0 0 0 1px var(--linha);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .faixa.calada { opacity: 0.42; }
  .cor { width: 4px; align-self: stretch; flex: none; border-radius: 2px; }
  .nome { flex: 1 1 auto; min-width: 0; }
  .nome b { display: block; font-size: 13px; font-weight: 600; }
  .vol { width: 100%; margin-top: 6px; height: 22px; -webkit-appearance: none; appearance: none; background: none; }
  .vol::-webkit-slider-runnable-track { height: 3px; background: rgba(255,255,255,0.12); }
  .vol::-webkit-slider-thumb {
    -webkit-appearance: none; width: 13px; height: 13px; margin-top: -5px;
    background: currentColor; border-radius: 50%;
  }
  .ms { display: flex; flex-direction: column; gap: 5px; flex: none; }
  .ms button {
    width: 34px; height: 26px; background: none; border: none;
    box-shadow: inset 0 0 0 1px var(--linha2); color: var(--mudo);
    font-family: var(--mono); font-size: 10px; font-weight: 700; cursor: pointer;
  }
  .ms button[aria-pressed="true"] { color: #0b0c0f; }
  .ms .m[aria-pressed="true"] { background: var(--amarelo); box-shadow: none; }
  .ms .s[aria-pressed="true"] { background: var(--lima); box-shadow: none; }

  .carregando { padding: 30px; text-align: center; color: var(--mudo); font-family: var(--mono); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
</style>
</head>
<body>
<header>
  <button class="voltar" id="voltar" hidden aria-label="Voltar">&#8592;</button>
  <span class="marca">MP<b>TRIX</b></span>
  <span class="rot" id="onde">acervo</span>
</header>
<div id="tela"><p class="carregando">carregando…</p></div>

<script>
// A ESCALA VERDE DAS FAIXAS é a mesma do computador. Cor por faixa não é
// enfeite: é como se acha a guitarra sem ler o nome.
var CORES = ['#dff9a0','#b4e85a','#7ed97a','#4ecb8c','#27a08d','#8fa57a'];
var NOMES = {
  vocals:'Voz', drums:'Bateria', bass:'Baixo', guitar:'Guitarra', piano:'Piano',
  other:'Outros', synth:'Teclado', organ:'Órgão', accordion:'Sanfona',
  strings:'Cordas', brass:'Sopros', flute:'Flauta', sax:'Sax'
};
var tela = document.getElementById('tela');
var voltar = document.getElementById('voltar');
var onde = document.getElementById('onde');
var acervo = [];
var sessao = null; // { audios: [], mudos: {}, solos: {} }

function mmss(s) {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
}

function abrirAcervo() {
  sessao && pararTudo();
  voltar.hidden = true; onde.textContent = 'acervo';
  if (!acervo.length) {
    tela.innerHTML = '<p class="vazio">Nenhuma música separada ainda.<br><br>' +
      'Separe no computador e ela aparece aqui sozinha.</p>';
    return;
  }
  var html = '<ul>';
  for (var i = 0; i < acervo.length; i++) {
    var m = acervo[i];
    html += '<li><button class="musica" data-i="' + i + '"><b>' + esc(m.titulo) + '</b>' +
      '<span class="dados">' + m.faixas.length + ' faixas · ' + mmss(m.duracao) +
      (m.tom ? ' · tom <i>' + m.tom + '</i>' : '') +
      (m.bpm ? ' · <i>' + m.bpm + '</i> bpm' : '') + '</span></button></li>';
  }
  tela.innerHTML = html + '</ul>';
  tela.querySelectorAll('.musica').forEach(function (b) {
    b.onclick = function () { abrirMusica(acervo[+b.dataset.i]); };
  });
}

function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return ({'<':'&lt;','>':'&gt;','&':'&amp;'})[c]; }); }

function abrirMusica(m) {
  voltar.hidden = false; onde.textContent = 'estúdio';
  var html = '<div class="transporte">' +
    '<div class="tempo"><span id="agora">0:00</span><small>/ ' + mmss(m.duracao) + '</small></div>' +
    '<input class="barra" id="seek" type="range" min="0" max="' + Math.floor(m.duracao) + '" value="0" step="1">' +
    '<div class="botoes">' +
      '<button class="play" id="play" aria-label="Tocar">&#9654;</button>' +
      '<button class="zerar" id="zerar">voltar ao início</button>' +
      '<div class="info">' + (m.tom ? '<b>' + m.tom + '</b> · ' : '') + (m.bpm ? '<b>' + m.bpm + '</b> bpm' : '') + '</div>' +
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
  var play = document.getElementById('play');
  var seek = document.getElementById('seek');
  var agora = document.getElementById('agora');

  // O RELÓGIO SAI DE UMA FAIXA SÓ (a primeira). Ler o tempo de todas e tentar
  // conciliar daria números brigando entre si — uma manda, as outras seguem.
  var mestre = sessao.audios[0];
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

voltar.onclick = abrirAcervo;

fetch('/api/acervo').then(function (r) { return r.json(); }).then(function (lista) {
  acervo = lista; abrirAcervo();
}).catch(function () {
  tela.innerHTML = '<p class="vazio">Não consegui falar com o computador.<br>' +
    'Ele precisa estar ligado e na mesma rede.</p>';
});
</script>
</body>
</html>`
}
