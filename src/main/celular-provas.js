// ██████████ AS PROVAS DO CARTÃO ██████████
//
// Mudar uma coisa por vez, com o dono olhando e eu no escuro, custa uma rodada
// inteira por ideia — e cada rodada é ele reiniciando, recarregando, tirando
// foto. Seis versões na mesma tela, com as músicas dele, custam uma.
//
// Todas usam os MESMOS dados: mesma capa, mesma onda, mesmo tom e BPM. O que
// muda é só o desenho, que é o que está em questão.
//
// Quando ele escolher, esta tela morre. Ela é andaime.
export function paginaProvas(musicas) {
  const m = (musicas || []).filter((x) => x.titulo).slice(0, 3)
  if (!m.length) m.push({ titulo: 'Nenhuma música ainda', faixas: [], inteira: true })

  const esc = (t) => String(t || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
  const mmss = (x) => { const n = Math.floor(x || 0); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0') }
  const capa = (x, cls) => x.capa
    ? `<img class="${cls}" src="${esc(x.capa)}" alt="">`
    : `<span class="${cls} vazia"></span>`
  const onda = (x, n) => {
    if (!x.onda || !x.onda.length) return ''
    const passo = Math.max(1, Math.floor(x.onda.length / n))
    let h = ''
    for (let i = 0; i < x.onda.length; i += passo) h += `<i style="height:${Math.max(8, Math.round(x.onda[i] * 100))}%"></i>`
    return h
  }
  const tag = (x) => x.inteira ? 'MÚSICA COMPLETA' : `${x.faixas.length} FAIXAS`
  const meta = (x) => [x.tom, x.bpm ? x.bpm + ' BPM' : null, x.duracao ? mmss(x.duracao) : null].filter(Boolean)

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0c0f">
<title>MPTRIX — provas do cartão</title>
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
  padding:calc(14px + env(safe-area-inset-top)) 12px calc(40px + env(safe-area-inset-bottom))}
h1{font-size:18px;margin:0 0 5px}
.sub{font-size:12.5px;color:var(--mudo);line-height:1.55;margin:0 0 8px;max-width:44ch}
.sub b{color:var(--lima)}
h2{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:10px;
  letter-spacing:.2em;text-transform:uppercase;color:var(--mudo2);margin:30px 0 11px}
h2 b{color:#0b0c0f;background:var(--lima);padding:3px 7px;font-weight:700}
h2 i{flex:1 1 auto;height:1px;background:var(--linha);font-style:normal}
.nota{font-size:11.5px;color:var(--mudo2);line-height:1.55;margin:9px 2px 0}
img{display:block}
.vazia{background:#000;display:block}

/* ═══ A ─ LIMPO: só o essencial, respiro grande, sem onda ═══ */
.a{display:flex;gap:12px;align-items:center;padding:12px;margin-bottom:8px;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--linha);clip-path:var(--corte)}
.a .c{width:56px;height:56px;flex:none;object-fit:cover;clip-path:var(--corte-sm)}
.a .in{min-width:0;flex:1 1 auto}
.a b{display:block;font-size:15px;line-height:1.3;margin-bottom:5px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.a .m{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--mudo2)}
.a .m s{text-decoration:none;color:var(--lima)}
.a .d{flex:none;width:34px;height:34px;display:flex;align-items:center;justify-content:center;
  box-shadow:inset 0 0 0 1px var(--linha2);color:var(--mudo2);clip-path:var(--corte-sm)}

/* ═══ B ─ CAPA GRANDE: a imagem manda, texto por cima ═══ */
.b{position:relative;height:96px;margin-bottom:9px;overflow:hidden;
  background:var(--cava2);clip-path:var(--corte)}
.b .c{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42}
.b .sombra{position:absolute;inset:0;background:linear-gradient(90deg,#0b0c0f 18%,rgba(11,12,15,.6) 60%,transparent)}
.b .in{position:absolute;inset:0;padding:13px 14px;display:flex;flex-direction:column;justify-content:center;gap:7px}
.b b{font-size:15.5px;line-height:1.25;max-width:70%;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.b .m{font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;color:var(--lima)}
.b .d{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:38px;height:38px;
  display:flex;align-items:center;justify-content:center;background:rgba(11,12,15,.75);
  box-shadow:inset 0 0 0 1px var(--linha2);color:var(--txt2);clip-path:var(--corte-sm)}

/* ═══ C ─ FITA: barra de cor lateral, denso, sem capa grande ═══ */
.c2{display:flex;align-items:stretch;margin-bottom:7px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--linha)}
.c2 .fita{width:4px;flex:none;background:var(--lima);box-shadow:0 0 12px rgba(182,255,59,.5)}
.c2 .fita.uni{background:var(--mudo2);box-shadow:none}
.c2 .in{flex:1 1 auto;min-width:0;padding:10px 12px}
.c2 b{display:block;font-size:14px;line-height:1.3;margin-bottom:4px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c2 .m{font-family:var(--mono);font-size:9px;letter-spacing:.13em;color:var(--mudo2)}
.c2 .m s{text-decoration:none;color:var(--lima)}
.c2 .d{flex:none;width:44px;display:flex;align-items:center;justify-content:center;
  border-left:1px solid var(--linha);color:var(--mudo2)}

/* ═══ D ─ ONDA DE FUNDO, discreta de verdade ═══ */
.d2{position:relative;display:flex;gap:11px;align-items:center;padding:11px;margin-bottom:8px;
  overflow:hidden;background:var(--card);box-shadow:inset 0 0 0 1px var(--linha),0 6px 16px rgba(0,0,0,.5);
  clip-path:var(--corte)}
.d2 .o{position:absolute;left:0;right:0;bottom:0;height:34px;display:flex;align-items:flex-end;
  gap:1px;opacity:.09;pointer-events:none}
.d2 .o i{flex:1 1 auto;background:var(--lima)}
.d2 .c{width:54px;height:54px;flex:none;object-fit:cover;clip-path:var(--corte-sm);position:relative}
.d2 .in{position:relative;min-width:0;flex:1 1 auto}
.d2 b{display:block;font-size:14.5px;line-height:1.3;margin-bottom:5px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.d2 .m{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:var(--mudo2)}
.d2 .m s{text-decoration:none;color:var(--lima)}
.d2 .d{position:relative;flex:none;width:34px;height:34px;display:flex;align-items:center;
  justify-content:center;box-shadow:inset 0 0 0 1px var(--linha2);color:var(--mudo2);clip-path:var(--corte-sm)}

/* ═══ E ─ PLACA: número grande, tipografia pesada, dois tons ═══ */
.e{display:flex;align-items:stretch;margin-bottom:8px;background:var(--cava);
  box-shadow:inset 0 0 0 1px var(--linha2);clip-path:var(--corte)}
.e .n{flex:none;width:46px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:var(--card);border-right:1px solid var(--linha2);font-family:var(--mono)}
.e .n b{font-size:18px;color:var(--lima);line-height:1}
.e .n i{font-style:normal;font-size:7px;letter-spacing:.16em;color:var(--mudo2);margin-top:3px}
.e .c{width:50px;height:50px;flex:none;align-self:center;margin:0 0 0 10px;object-fit:cover;clip-path:var(--corte-sm)}
.e .in{flex:1 1 auto;min-width:0;padding:11px 12px}
.e b{display:block;font-size:15px;font-weight:700;line-height:1.25;letter-spacing:-.01em;margin-bottom:5px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.e .m{font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--mudo2)}
.e .d{flex:none;width:44px;display:flex;align-items:center;justify-content:center;
  border-left:1px solid var(--linha2);color:var(--mudo2)}

/* ═══ F ─ VIDRO: fundo translúcido, contorno aceso, sem peso ═══ */
.f{display:flex;gap:12px;align-items:center;padding:12px;margin-bottom:9px;
  background:linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.02));
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 10px 26px rgba(0,0,0,.5);
  backdrop-filter:blur(6px);clip-path:var(--corte)}
.f .c{width:56px;height:56px;flex:none;object-fit:cover;clip-path:var(--corte-sm);
  box-shadow:0 0 0 1px rgba(255,255,255,.14)}
.f .in{min-width:0;flex:1 1 auto}
.f b{display:block;font-size:15px;line-height:1.3;margin-bottom:5px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.f .m{font-family:var(--mono);font-size:9.5px;letter-spacing:.12em;color:rgba(255,255,255,.5)}
.f .m s{text-decoration:none;color:var(--lima)}
.f .d{flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);
  color:var(--txt2);clip-path:var(--corte-sm)}
</style></head><body>

<h1>Seis cartões, as suas músicas</h1>
<p class="sub">Rola tudo e me diz <b>a letra</b> que te agradou. Se gostar de
pedaços de dois ("o B com o número do E"), também vale.</p>

<h2><b>A</b> LIMPO <i></i></h2>
${m.map((x) => `<div class="a">${capa(x, 'c')}<div class="in"><b>${esc(x.titulo)}</b>
<div class="m">${tag(x)}${meta(x).length ? ' · <s>' + meta(x).join('</s> · <s>') + '</s>' : ''}</div></div>
<div class="d">↓</div></div>`).join('')}
<p class="nota">Só o essencial, uma linha de dados, respiro grande. Aguenta lista
longa sem cansar — e é o que menos "chama".</p>

<h2><b>B</b> CAPA GRANDE <i></i></h2>
${m.map((x) => `<div class="b">${capa(x, 'c')}<div class="sombra"></div>
<div class="in"><b>${esc(x.titulo)}</b><div class="m">${tag(x)}${meta(x).length ? ' · ' + meta(x).join(' · ') : ''}</div></div>
<div class="d">↓</div></div>`).join('')}
<p class="nota">A imagem manda e o texto vem por cima. É o mais bonito de
todos — e o que mostra menos música por tela.</p>

<h2><b>C</b> FITA <i></i></h2>
${m.map((x) => `<div class="c2"><div class="fita${x.inteira ? ' uni' : ''}"></div>
<div class="in"><b>${esc(x.titulo)}</b><div class="m">${tag(x)}${meta(x).length ? ' · <s>' + meta(x).join('</s> · <s>') + '</s>' : ''}</div></div>
<div class="d">↓</div></div>`).join('')}
<p class="nota">Sem capa, com uma barra de cor dizendo se tem mixer. É o mais
denso: cabe o dobro de música na tela. Perde o reconhecimento pela imagem.</p>

<h2><b>D</b> ONDA DE FUNDO <i></i></h2>
${m.map((x) => `<div class="d2"><div class="o">${onda(x, 40)}</div>${capa(x, 'c')}
<div class="in"><b>${esc(x.titulo)}</b><div class="m">${tag(x)}${meta(x).length ? ' · <s>' + meta(x).join('</s> · <s>') + '</s>' : ''}</div></div>
<div class="d">↓</div></div>`).join('')}
<p class="nota">A onda da música atrás, bem apagada — o que eu tentei antes,
agora discreto de verdade. Custa zero espaço.</p>

<h2><b>E</b> PLACA <i></i></h2>
${m.map((x, i) => `<div class="e"><div class="n"><b>${String(i + 1).padStart(2, '0')}</b><i>${x.inteira ? 'UNI' : 'MIX'}</i></div>
${capa(x, 'c')}<div class="in"><b>${esc(x.titulo)}</b>
<div class="m">${tag(x)}${meta(x).length ? ' · ' + meta(x).join(' · ') : ''}</div></div>
<div class="d">↓</div></div>`).join('')}
<p class="nota">Número grande, letra pesada, dois tons de fundo. Cara de
equipamento — o mais "máquina" dos seis.</p>

<h2><b>F</b> VIDRO <i></i></h2>
${m.map((x) => `<div class="f">${capa(x, 'c')}<div class="in"><b>${esc(x.titulo)}</b>
<div class="m">${tag(x)}${meta(x).length ? ' · <s>' + meta(x).join('</s> · <s>') + '</s>' : ''}</div></div>
<div class="d">↓</div></div>`).join('')}
<p class="nota">Fundo translúcido e contorno aceso, sem peso de sombra.
Moderno e leve — e o que menos combina com o preto duro do resto do app.</p>

<h2>escolhe <i></i></h2>
<p class="sub">Me diz a letra. E se nenhum servir, diz o que <b>especificamente</b>
te incomoda em cada um — isso vale mais que "não gostei".</p>
</body></html>`
}
