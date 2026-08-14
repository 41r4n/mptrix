// ██████████ AS PROVAS DE DESENHO ██████████
//
// O dono pediu referência de "fantasia tecnológica" — o nome disso na
// indústria é FUI, Fantasy User Interface: as telas de filme de ficção
// científica. Em vez de mandar ele garimpar em site de design, as opções são
// montadas aqui, com as músicas dele, na tela do próprio celular.
//
// É como tudo funcionou hoje: ele não precisa saber explicar por que gostou —
// precisa ver. Cada prova é uma família diferente, não uma variação de cor:
//
//   1 CHASSI     equipamento de estúdio: quina cortada, hairline, mono
//   2 HOLOGRAMA  luz por baixo, contorno que acende, varredura
//   3 CARTUCHO   bloco de cor, número grande, tipografia pesada
//   4 TERMINAL   linha de comando, colchetes, tudo em letra de máquina
//
// Depois que ele escolher, esta tela morre — ela é andaime, não peça.
export function paginaProvas(musicas) {
  const m = (musicas || []).slice(0, 3)
  if (!m.length) {
    m.push({ titulo: 'Nenhuma música separada ainda', faixas: [], inteira: true })
  }

  const capa = (x) => x.capa ? `<img src="${x.capa}" alt="">` : '<span class="semcapa"></span>'
  const dados = (x) => [
    x.inteira ? 'música completa' : `${x.faixas.length} faixas`,
    x.tom ? `tom ${x.tom}` : null,
    x.bpm ? `${x.bpm} bpm` : null
  ].filter(Boolean)

  const esc = (t) => String(t || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b0c0f">
<title>MPTRIX — provas</title>
<link rel="stylesheet" href="/fonts/fonts.css">
<style>
:root{
  --bg:#0b0c0f;--card:#15171c;--cava:#08090c;--cava2:#050609;
  --linha:rgba(255,255,255,.07);--linha2:rgba(255,255,255,.14);
  --txt:#f2f4f7;--txt2:#d1d5db;--mudo:#9ba3af;--mudo2:#8a93a0;
  --lima:#b6ff3b;--ambar:#eab308;
  --ui:'Space Grotesk',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace;
  --corte:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));
  --corte-sm:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font-family:var(--ui);
  padding:calc(14px + env(safe-area-inset-top)) 12px calc(30px + env(safe-area-inset-bottom));
  background-image:radial-gradient(120% 55% at 50% -8%,rgba(182,255,59,.07),transparent 70%);background-attachment:fixed}
h1{font-size:17px;margin:0 0 4px}
.sub{font-size:12.5px;color:var(--mudo);line-height:1.55;margin:0 0 22px;max-width:46ch}
.sub b{color:var(--lima)}
h2{display:flex;align-items:center;gap:9px;font-family:var(--mono);font-size:9.5px;
  letter-spacing:.2em;text-transform:uppercase;color:var(--mudo2);margin:26px 0 10px}
h2 i{flex:1 1 auto;height:1px;background:var(--linha);font-style:normal}
h2 b{color:var(--lima);font-weight:400}
.nota{font-size:11.5px;color:var(--mudo2);line-height:1.5;margin:8px 2px 0}

/* ══════════ 1. CHASSI — equipamento de estúdio ══════════ */
.p1{display:flex;gap:11px;padding:10px;margin-bottom:8px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--linha),0 6px 18px rgba(0,0,0,.45);clip-path:var(--corte)}
.p1 img,.p1 .semcapa{width:66px;height:66px;flex:none;object-fit:cover;background:var(--cava2);clip-path:var(--corte-sm)}
.p1 .in{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:7px}
.p1 b{font-size:14.5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.p1 .l{display:flex;align-items:center;gap:7px;font-family:var(--mono);font-size:9.5px;
  letter-spacing:.1em;color:var(--mudo2)}
.p1 .l s{text-decoration:none;color:var(--lima)}
.p1 .l u{text-decoration:none;width:1px;height:9px;background:var(--linha2)}

/* ══════════ 2. HOLOGRAMA — luz por baixo ══════════ */
.p2{position:relative;display:flex;gap:11px;padding:12px 11px;margin-bottom:9px;overflow:hidden;
  background:linear-gradient(150deg,rgba(182,255,59,.1),rgba(182,255,59,.02) 45%,transparent 70%),var(--cava);
  box-shadow:inset 0 0 0 1px rgba(182,255,59,.22),0 0 26px rgba(182,255,59,.07);clip-path:var(--corte)}
.p2::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px)}
.p2 img,.p2 .semcapa{width:62px;height:62px;flex:none;object-fit:cover;background:var(--cava2);
  clip-path:var(--corte-sm);box-shadow:0 0 0 1px rgba(182,255,59,.3)}
.p2 .in{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:6px}
.p2 b{font-size:14.5px;line-height:1.3;text-shadow:0 0 16px rgba(182,255,59,.3)}
.p2 .l{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:rgba(182,255,59,.75)}

/* ══════════ 3. CARTUCHO — bloco de cor e número ══════════ */
.p3{display:flex;align-items:stretch;margin-bottom:9px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--linha);clip-path:var(--corte);overflow:hidden}
.p3 .num{flex:none;width:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:2px;background:var(--lima);color:#0b0c0f}
.p3 .num b{font-family:var(--mono);font-size:21px;font-weight:700;line-height:1}
.p3 .num i{font-style:normal;font-family:var(--mono);font-size:7px;letter-spacing:.16em}
.p3 .in{flex:1 1 auto;min-width:0;padding:11px 12px;display:flex;flex-direction:column;justify-content:center;gap:6px}
.p3 .in b{font-size:15px;font-weight:700;line-height:1.25;letter-spacing:-.01em}
.p3 .l{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--mudo2)}
.p3 img,.p3 .semcapa{width:52px;height:52px;flex:none;align-self:center;margin-right:10px;
  object-fit:cover;background:var(--cava2);clip-path:var(--corte-sm)}

/* ══════════ 4. TERMINAL — tudo em letra de máquina ══════════ */
.p4{padding:11px 12px;margin-bottom:8px;background:var(--cava2);
  box-shadow:inset 0 0 0 1px var(--linha2);font-family:var(--mono)}
.p4 .cab{display:flex;align-items:center;gap:8px;font-size:9px;letter-spacing:.16em;color:var(--mudo2);margin-bottom:7px}
.p4 .cab s{text-decoration:none;color:var(--lima)}
.p4 b{display:block;font-family:var(--ui);font-size:14.5px;line-height:1.3;margin-bottom:7px}
.p4 .l{font-size:10px;letter-spacing:.06em;color:var(--mudo);line-height:1.7}
.p4 .l em{font-style:normal;color:var(--lima)}
</style></head><body>

<h1>Quatro caminhos pro cartão</h1>
<p class="sub">Todos com as <b>suas músicas</b>. Olha, escolhe um número, e eu levo
o app inteiro pra essa língua — acervo, estúdio, tudo.</p>

<h2><b>01</b> CHASSI <i></i></h2>
${m.map((x) => `<div class="p1">${capa(x)}<div class="in"><b>${esc(x.titulo)}</b>
<div class="l">${dados(x).map((d, i) => (i ? '<u></u>' : '') + (d.includes('tom') || d.includes('bpm') ? `<s>${d}</s>` : d)).join('')}</div>
</div></div>`).join('')}
<p class="nota">Equipamento de estúdio: quina cortada, fio fino, números em letra de máquina.
É a língua que o MPTRIX do computador já fala.</p>

<h2><b>02</b> HOLOGRAMA <i></i></h2>
${m.map((x) => `<div class="p2">${capa(x)}<div class="in"><b>${esc(x.titulo)}</b>
<div class="l">${dados(x).join(' · ')}</div></div></div>`).join('')}
<p class="nota">Luz vindo de dentro, contorno aceso e varredura fina por cima.
É o mais "ficção científica" dos quatro — e o que mais cansa se a lista for longa.</p>

<h2><b>03</b> CARTUCHO <i></i></h2>
${m.map((x, i) => `<div class="p3"><div class="num"><b>${String(i + 1).padStart(2, '0')}</b><i>${x.inteira ? 'UNI' : 'MIX'}</i></div>
${capa(x)}<div class="in"><b>${esc(x.titulo)}</b><div class="l">${dados(x).join(' · ')}</div></div></div>`).join('')}
<p class="nota">Bloco de cor forte na lateral, número grande, letra pesada.
Lembra fita cassete e cartucho de videogame — acha rápido, mas grita mais alto.</p>

<h2><b>04</b> TERMINAL <i></i></h2>
${m.map((x, i) => `<div class="p4"><div class="cab">[<s>${String(i + 1).padStart(3, '0')}</s>] ${x.inteira ? 'FAIXA UNICA' : 'MULTIFAIXA'}</div>
<b>${esc(x.titulo)}</b><div class="l">${dados(x).map((d) => `> <em>${d}</em>`).join('<br>')}</div></div>`).join('')}
<p class="nota">Tudo em letra de máquina, como um painel de comando.
O mais sóbrio — e o que menos depende de imagem, se a capa faltar.</p>

<h2>e agora <i></i></h2>
<p class="sub">Me diz o número. Se gostar de pedaços de mais de um
("o 1 com o número do 3"), também vale — dá pra misturar.</p>
</body></html>`
}
