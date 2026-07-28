# Handoff: MPTrix — Estúdio de separação de faixas com IA

## Overview
MPTrix é um web app desktop-first de separação de música com IA (concorrente do Moises), com versão
mobile complementar. O usuário envia um arquivo ou link do YouTube; a IA separa a música em 6 stems
(Vocais, Bateria, Baixo, Guitarra, Teclado, Outro) + uma linha de Metrônomo. A tela principal é um
estúdio multitrack estilo DAW, cujo elemento hero é um **playhead vertical lima cruzando todas as
pistas**.

O pacote cobre 4 telas: Estúdio desktop, Upload/Processamento, Biblioteca e Estúdio mobile — mais os
painéis secundários Letra cifrada, Acordes e Seções.

## About the Design Files
Os arquivos em `design/` são **referências de design escritas em HTML** — protótipos que mostram
aparência e comportamento pretendidos, **não código de produção para copiar**. A tarefa é
**recriar esses designs no ambiente já existente do seu sistema** (React, Vue, Svelte, Next, etc.),
usando os padrões, bibliotecas e convenções que o projeto já adota (roteamento, state, componentes,
tokens de tema, players de áudio). Se não houver ambiente definido, escolha o stack mais adequado e
implemente lá.

`design/MPTrix.dc.html` usa um runtime de prototipagem próprio (`support.js`, tags `<x-dc>`,
`<sc-for>`, `<sc-if>`, `{{ hole }}`). **Esse runtime não deve ser portado.** Leia-o como fonte de
verdade de layout, cores, tipografia, medidas e lógica, e reescreva em componentes nativos do seu
codebase. `design/ios-frame.jsx` é só a moldura de iPhone usada para apresentar o mobile — descartável.

## Fidelity
**Alta fidelidade (hifi).** Cores, tipografia, medidas e estados são finais e devem ser reproduzidos
com precisão usando as bibliotecas do codebase. Contraste verificado em AA para todos os textos.

## Design Tokens

### Cores — superfícies
| Token | Hex | Uso |
|---|---|---|
| `bg/app` | `#0B0C0F` | Fundo da aplicação, topbar |
| `bg/tracks` | `#101216` | Painel de pistas (área DAW) |
| `bg/card` | `#15171C` | Cards, coluna de controles da faixa, bottom sheets |
| `bg/inset` | `#0D0F13` | Ruler, canaletas de waveform, transporte, painel lateral |
| `border/subtle` | `rgba(255,255,255,0.07)` | Bordas de estrutura |
| `border/hairline` | `rgba(255,255,255,0.05)` | Divisória entre pistas |
| `border/control` | `rgba(255,255,255,0.10–0.16)` | Bordas de botões/inputs |

### Cores — texto
| Token | Hex | Contraste |
|---|---|---|
| `text/primary` | `#F2F4F7` | — |
| `text/secondary` | `#D1D5DB` | rótulos de botão |
| `text/tertiary` | `#9BA3AF` | 6.5:1 |
| `text/quaternary` | `#8A93A0` | 6.2:1 — menor tamanho permitido: 9px mono |

Não usar `#6B7280` (4.02:1, reprovado em AA) — foi removido do design.

### Cores — destaque e stems (paleta monocromática verde)
| Token | Hex | Uso |
|---|---|---|
| `accent/lime` | `#B6FF3B` | Playhead, play, CTA, tint de progresso, estado ativo, tom transposto |
| `accent/lime-hover` | `#C9FF66` | Hover de CTA |
| `warn/mute` | `#EAB308` | Botão M ativo |
| stem Vocais | `#DFF9A0` | |
| stem Bateria | `#B4E85A` | |
| stem Baixo | `#7ED97A` | |
| stem Guitarra | `#4ECB8C` | |
| stem Teclado | `#27A08D` | |
| stem Outro | `#8FA57A` | |

Seções: Intro/Saída `#8FA57A`, Verso `#7ED97A`, Refrão `#B6FF3B`, Ponte `#27A08D`.
Faixa de seção usa a cor em `rgba(c,0.10)` (inativa) / `rgba(c,0.30)` (ativa) + borda-esquerda 2px sólida.

### Tipografia
- **Space Grotesk** (400/500/600/700) — UI, títulos, letra.
- **IBM Plex Mono** (400/500/600) — números tabulares: timer, ruler, BPM/tom, acordes, captions em
  caixa-alta com `letter-spacing: 0.08–0.16em`.
- Escala usada: 9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 14.5 / 15 / 16 / 17 / 19 / 22 / 30px.
- Títulos com `letter-spacing:-0.01em`.

### Raio, sombra, espaçamento
- Raio: 5–6px (chips pequenos), 8–10px (botões/inputs), 11–12px (cards), 14–16px (containers/janela),
  18px topo dos bottom sheets, 50% (transporte, marca).
- Sombras: janela `0 30px 80px rgba(0,0,0,0.55)`; play `0 0 26px rgba(182,255,59,0.35)`;
  playhead `0 0 10px rgba(182,255,59,0.65)`; knob `0 1px 3px rgba(0,0,0,0.5)`.
- Espaçamento em passos de 4px (gaps reais usados: 3,4,5,6,7,8,9,10,12,13,14,16,18,22px).
- Sem gradientes. Flat.

### Marca (aceno ao Omnitrix)
Disco circular `#B6FF3B` com ampulheta preta centralizada
(`M5 4.5h14l-5.2 7.5L19 19.5H5l5.2-7.5z`, viewBox 24), anel duplo:
`box-shadow: 0 0 0 2px #0B0C0F, 0 0 0 3.5px rgba(182,255,59,0.35)` (28px na topbar; 40px com anel
3px/5px no cabeçalho).

---

## Screens / Views

### 1. Estúdio desktop — 1440×900, raio 14px, borda `border/subtle`
Coluna vertical: topbar 60px → área de pistas (flex) → transporte 84px.

**Topbar (60px, padding 0 16px, gap 13px, borda inferior `border/subtle`)**
- Botão voltar 34×34 raio 9, chevron 18px, hover `rgba(255,255,255,0.06)`.
- Marca: disco Omnitrix 28px + "MPTrix" 16px/700.
- Divisória 1×24px `rgba(255,255,255,0.09)`.
- Capa 34×34 raio 8 lima com iniciais mono 11px sobre `#0B0C0F`.
- Título: "Noite de Vidro" 14px/600 + "— Os Voltz" em `#8A93A0`/500; abaixo, ícone YouTube 12px
  (`#FF4E45`) + "YouTube · youtu.be/9tRxWm4Q" 11px `#8A93A0`.
- Chip BPM: 32px, raio 8, borda `rgba(255,255,255,0.1)`, label mono 10px + valor mono 13px/600.
- **Chip TOM com transposição**: label "TOM" + tom atual (mono 13px, largura fixa 26px, lima quando
  transposto) + botões − e + de 22×22 raio 6 (`rgba(255,255,255,0.06)`, hover
  `rgba(182,255,59,0.18)` + glifo lima) + badge de offset ("+2"/"−3") clicável que zera a
  transposição. Borda do chip fica `rgba(182,255,59,0.45)` quando transposto.
- Botão secundário "Separar faixas": 36px, raio 9, borda `rgba(255,255,255,0.12)`, ícone de linhas.
- CTA "Exportar": 36px, raio 9, `#B6FF3B` sobre `#0B0C0F`, 13px/700, ícone download; hover `#C9FF66`.

**Área de pistas** — duas colunas: rail de controles **264px** e canaleta de waveform (flex).
1. **Ruler 30px** — célula esquerda `bg/card` com captions mono 9px "PISTAS" e "6 STEMS + METR.";
   canaleta `bg/inset` com tick a cada **5s** (1×5px) e a cada **30s** (1×11px + label mono 9px
   `mm:ss`, deslocada 4px à direita), todos `rgba(255,255,255,0.18)`.
2. **Faixa Seções 24px** (opcional, toggle) — blocos absolutos por seção com nome 9.5px/600.
3. **6 pistas de stem** — `flex:1` (mín. 76px; modo compacto: `flex:0 0 auto`, 58px):
   - Rail: barra de cor 4×16 raio 2 + nome 13px/600 **na cor do stem** + botões **M** e **S**
     22×22 raio 6 mono 10px/600. M ativo = fundo `#EAB308`, glifo `#0B0C0F`. S ativo = fundo
     `#B6FF3B`, glifo `#0B0C0F`. Inativos = transparente, glifo `#9BA3AF`, borda
     `rgba(255,255,255,0.16)`; hover borda `rgba(255,255,255,0.45)`.
   - Linha inferior: ícone alto-falante 13px + **slider de volume** (trilha 3px
     `rgba(255,255,255,0.12)`, preenchimento na cor do stem com `opacity .7`, knob 10px `#E5E7EB`)
     + **pan** de 46px (trilha igual, marca de centro 1×7px, knob 9px `#9BA3AF`) + label mono 9.5px
     `C` / `L23` / `R40`.
   - Canaleta: linha de zero 1px `rgba(255,255,255,0.05)`; waveform em SVG `viewBox 0 0 1200 100`,
     `preserveAspectRatio="none"`, traços verticais `stroke-width:1.6` com
     `vector-effect:non-scaling-stroke`, cor do stem, `opacity .92` (264 barras no desktop, 110 no mobile).
4. **Linha Metrônomo 56px** — rail com ícone, rótulo 12px `#9BA3AF`, **switch** 30×18 (knob 14px,
   trilha lima quando ligado) e chips de velocidade **0.5x / 1x / 2x** (18px, raio 5, mono 10px;
   ativo = `rgba(182,255,59,0.14)` + texto lima + borda `rgba(182,255,59,0.55)`). Canaleta: pulsos a
   96 BPM, downbeat (cada 4º) `#E5E7EB` alto, subdivisões `#9BA3AF` curtas; opacidade 0.85 ligado / 0.2 desligado.

**Overlay de playhead** (absoluto sobre a canaleta, `left:264px`, `z-index:4`, cursor `crosshair`)
- Grade vertical a cada 30s `rgba(255,255,255,0.04)`.
- **Tint de progresso**: retângulo de 0 até a posição atual, `rgba(182,255,59,0.055)` + borda direita
  `rgba(182,255,59,0.16)`, começando abaixo do ruler.
- Região de loop: `rgba(182,255,59,0.05)` entre bordas tracejadas lima + tarja lima 3px no topo.
- **Playhead (hero)**: linha 2px `#B6FF3B` com brilho `0 0 10px rgba(182,255,59,0.65)`, do topo ao
  fundo, + marcador triangular 12×8 no topo (agulha de DAW).

**Painel lateral 340px** (Letra ou Acordes; borda esquerda `border/subtle`, fundo `bg/inset`)
- Header 52px: título 14px/700, "SYNC · <tom> · 96 BPM" mono 10px, stepper −/+ 24×24, fechar 28×28.
- **Acordes**: grade 3 colunas, gap 8, cards 62px raio 9 (`bg/card`, borda `border/subtle`) com
  acorde 16px/700 e timestamp mono 9.5px. Card ativo: fundo `rgba(182,255,59,0.12)`, borda
  `rgba(182,255,59,0.6)`, texto lima. Clique busca o tempo. Auto-scroll suave para a linha ativa.
- **Letra cifrada (estilo Cifra Club)**: cada verso é um bloco com borda-esquerda 2px (lima quando
  ativo). Acima do texto, faixa de 18px com os acordes do verso posicionados **absolutamente** em
  `left: (t_acorde − t_verso)/duração_verso × 100%` (limite 88%), mono 12.5px/600. Verso ativo:
  `#F2F4F7`/600 e acordes lima; já cantado: `#525B66` e acordes `#5B6B4A`; futuro: `#8A93A0` e
  acordes `#8FA57A`. Linhas instrumentais em itálico e sem cifra. Clique busca o verso.

**Transporte (84px, `bg/inset`, borda superior `border/subtle`, padding 0 20px, gap 14px)**
Volume master (150px: ícone + slider `#E5E7EB`) · divisória · −10s (40px circular, borda
`rgba(255,255,255,0.12)`) · **play/pause 52px circular lima** com brilho · +10s · **loop** (40px;
ativo = fundo `rgba(182,255,59,0.14)`, glifo lima, borda `rgba(182,255,59,0.55)`) · legenda mono
"LOOP / <SEÇÃO>" quando ativo · timer atual mono 14px/600 **lima** (44px, alinhado à direita) ·
barra de seek (trilha 4px, preenchimento lima, knob 12px com brilho) · duração total mono 14px
`#8A93A0` · divisória · botões **Letra**, **Acordes**, **Seções** (36px, raio 9; ativo = fundo
`rgba(182,255,59,0.14)` + texto lima + borda lima 45%).

### 2. Upload — 1440×720
Topbar reduzida (marca + "Nova separação" + botão "Biblioteca"). Conteúdo centralizado, 640px:
- **Idle**: dropzone raio 16, borda tracejada 1.5px `rgba(255,255,255,0.16)`, padding 44/40, ícone
  em círculo 52px `rgba(182,255,59,0.1)`, título 19px/600 "Arraste seu áudio aqui", sub 12.5px
  `#9BA3AF` "MP3, WAV ou M4A · até 20 minutos", botão "Escolher arquivo" 38px. Hover da zona:
  borda `rgba(182,255,59,0.5)` + fundo `rgba(182,255,59,0.02)`.
  Divisor "OU" (linhas 1px + mono 10px). Card YouTube: ícone 22px, campo mono 12.5px raio 10 (44px)
  e CTA lima "Separar stems" (44px).
- **Processando**: card `bg/card` raio 16, padding 24. Cabeçalho com capa 44px, título 15px/600,
  meta mono 11px "YOUTUBE · 3:47 · 96 BPM · Am DETECTADOS" e percentual total mono 22px lima.
  Seis linhas de progresso: bolinha 8px na cor do stem + nome 82px + trilha 6px raio 3
  (`rgba(255,255,255,0.08)`) preenchida na cor do stem + percentual mono 11px. Stems avançam em
  cascata (o próximo começa quando o anterior passa de ~38%). Status mono 11.5px lima
  "Separando <stem>… <n>%".
- **Concluído**: círculo lima 56px com check + "Separação concluída" 19px/700 + "6 stems +
  metrônomo prontos para mixar" + CTA "Abrir no estúdio" e botão "Nova separação". Fade-in 0.3s.

### 3. Biblioteca — 1440×800
Topbar com busca 290×38 (raio 10, `bg/card`, ícone lupa, placeholder `#4E5560`) e CTA "Nova música".
Faixa de filtros: chips **Todas / YouTube / Arquivo** (30px, raio 8) + contagem mono à direita
("8 músicas"). Grade de 4 colunas, gap 16: card raio 12 com capa 148px na cor verde da música
(iniciais mono 30px `#0B0C0F`), badge de origem (pill preta 50%, mono 9px) e badge "ABERTA" lima
quando é a música em edição (borda do card `rgba(182,255,59,0.45)`). Corpo: título 14px/600, artista
12px `#9BA3AF`, meta mono 10.5px, e 6 quadradinhos 6px com as cores dos stems. Hover:
`translateY(-3px)` + borda `rgba(255,255,255,0.25)`. Empty state centralizado quando o filtro/busca
não retorna nada.

### 4. Estúdio mobile — 402×874 (moldura iOS apenas para apresentação)
- Header 46px: voltar 44×44, título 14.5px/600 + meta mono 9.5px "OS VOLTZ · 96 BPM · <tom>",
  exportar 44×44 lima.
- Pistas: mesmo conceito, **rail esquerdo de 64px** — nome do stem 10.5px/700 na cor do stem com
  chevron (abre bottom sheet) + botões M/S de 24×24. Ruler 18px com ticks a cada 10s e labels a cada
  60s. Linha de metrônomo 34px. Playhead 1.5px + triângulo 10×7 cruzando todas as pistas, com o
  mesmo tint de progresso; arrastar na área das pistas busca.
- Barra de seek: timer mono 11.5px lima + trilha 4px (área de toque 32px) + total.
- Transporte 84px centralizado: metrônomo 46px, −10s 46px, **play 60px lima**, +10s 46px, loop 46px.
- Linha inferior 52px: chips **0.5x/1x/2x** (34px de altura, mín. 44px de largura) + ícones
  **Letra**, **Acordes**, **Seções** (44×38, raio 9, borda `rgba(255,255,255,0.1)`).
- Todos os alvos ≥44px e todo o transporte na metade inferior (alcance de uma mão).

**Bottom sheets** (fundo `bg/card`, topo raio 18, alça 40×4, scrim `rgba(0,0,0,0.55)`, animação
`sheetUp` 0.22s ease — `translateY(28px)`/opacity 0.4 → 0):
- **Faixa** (toque no nome): barra de cor + nome 17px/700 + botões MUTE/SOLO (34px, mín. 44px de
  largura) + sliders de **Volume** (trilha 5px, knob 20px, área de toque 44px) e **Pan** (marca de
  centro) com valores mono à direita + botão "Pronto" 46px.
- **Letra cifrada** (topo em 180px): header com título, stepper −/+ 34×34 e tom mono 13px; lista com
  acordes posicionados sobre os versos e auto-scroll.
- **Acordes**: grade de 4 colunas, cards 54px, header mostrando "<tom> · 96 BPM".
- **Seções**: lista de 8 linhas 46px (barra de cor 4×20, nome 14px/600, intervalo mono 11px); ativa
  com fundo `rgba(182,255,59,0.08)` e borda lima 40%. Clique busca o início da seção.

---

## Interactions & Behavior
- **Transporte de tempo**: relógio único a `requestAnimationFrame`, `dt` limitado a 100ms,
  multiplicado pela velocidade (0.5/1/2). Duração da demo: 227s (3:47). Ao chegar ao fim, volta a 0.
- **Seek**: `pointerdown` captura o ponteiro (`setPointerCapture`) e `pointermove` arrasta;
  `t = (clientX − rect.left)/rect.width × duração`. Vale no ruler, em qualquer pista, no overlay do
  playhead e na barra de seek (desktop e mobile).
- **Loop**: ao ativar, trava na seção onde o playhead está (A = início da seção, B = início da
  próxima); ao passar de B, volta para A. Desativar não move o playhead.
- **Mute/Solo**: Mute esmaece a própria pista (waveform `opacity .22`, rail `.45`). Com qualquer
  Solo ativo, todas as pistas sem solo ficam esmaecidas. Transição 0.25s.
- **Sliders**: mesma mecânica de captura de ponteiro; volume 0–100, pan −50…+50 (label C/L/R).
- **Transposição**: −11…+11 semitons; transpõe a grade de acordes, as cifras da letra e o rótulo do
  tom (raiz + sufixo, bemóis normalizados para sustenidos). Badge de offset zera.
- **Auto-scroll**: painel/sheet de acordes rola para a linha do acorde atual; letra rola mantendo o
  verso ativo ~150px do topo (`behavior:'smooth'`) — implementar com `scrollTo`, **nunca**
  `scrollIntoView`.
- **Atalho**: barra de espaço alterna play/pause (ignorada em inputs).
- **Upload**: progresso simulado a cada 90ms com avanço aleatório em cascata; ao completar todos os
  stems, transita para o estado "concluído".
- **Busca/filtros** da biblioteca filtram por título+artista (case-insensitive) e origem.
- **Hover** em todos os controles (borda/fundo mais claros); CTAs lima escurecem para `#C9FF66`.
- **Animações declaradas**: `sheetUp` 0.22s ease, `fadeIn` 0.18–0.3s ease. Sem mais nada — a
  interface é estática exceto o playhead.

## State Management
Estado global de reprodução (recomendo um store/contexto compartilhado + hook `useTransport`):
- `t` (segundos, **fora do estado do React** — mutável por frame, escrito direto no DOM para o
  playhead/tint/timer; só índices derivados vão para o estado, evitando re-render por frame)
- `playing`, `speed` (0.5|1|2), `metroOn`, `master` (0–100)
- `tracks[6]`: `{ vol, pan, mute, solo }`
- `loopOn`, `loopA`, `loopB`
- `tr` (semitons de transposição)
- índices ativos derivados de `t`: `aSec`, `aCh`, `aLy` (só atualizam quando mudam → disparam o
  auto-scroll)
- UI: painel lateral (`nenhum|letra|acordes`), faixa de seções visível, densidade das pistas,
  bottom sheet mobile (`track|letra|acordes|secoes` + índice da faixa)
- Upload: `up` (`idle|proc|done`), `upP[6]`
- Biblioteca: `q`, `fil`

**Dados reais a plugar**: waveform (picos por stem — o protótipo gera picos sintéticos por seção),
BPM/tom detectados, grade de acordes com timestamps, letra com timestamps por verso, marcações de
seção, URLs de áudio por stem (o protótipo não toca áudio; use um `AudioContext` com um
`GainNode`+`StereoPannerNode` por stem, master gain, e o `currentTime` como fonte do playhead).

## Performance (importante)
O playhead, o tint e o timer são atualizados **imperativamente** por frame (`style.left`,
`style.width`, `textContent`) em nós guardados por ref — nunca via re-render do React. Waveforms são
SVG com `preserveAspectRatio="none"` + `vector-effect:non-scaling-stroke`, então escalam sem
recalcular caminhos. Mantenha esse padrão ou o app engasga com 7 pistas.

## Accessibility
- Contraste AA verificado: menor texto `#8A93A0` (6.2:1). Não reintroduzir `#6B7280`.
- Alvos de toque mobile ≥44px; play 60px.
- Botões M/S precisam de `aria-pressed` e rótulo acessível ("Silenciar Bateria", "Solo Bateria") na
  implementação — o protótipo usa divs.
- Sliders devem virar `role="slider"`/`<input type=range>` estilizado com teclado (setas ±1, Home/End).

## Assets
Nenhum bitmap. Ícones são SVGs inline (stroke 1.7–2.6, viewBox 24) — troque pela biblioteca de
ícones do seu projeto (Lucide/Feather cobrem todos: chevron, download, volume, skip-back/forward,
repeat, play/pause, list, grid, search, plus, check, triangle). O glifo do YouTube e a ampulheta da
marca estão embutidos no HTML. Fontes: Space Grotesk e IBM Plex Mono (Google Fonts) — auto-hospede
no build.

## Files
- `design/MPTrix.dc.html` — todas as 4 telas + painéis (fonte de verdade de estilo e lógica).
  Template no bloco `<x-dc>`; lógica na classe `Component` (waveforms, transposição, cifras,
  cronômetro, loop, filtros).
- `design/ios-frame.jsx` — moldura de iPhone usada só para apresentar o mobile (descartar).
- `design/support.js` — runtime do protótipo (**não portar**).

## Como retomar com o Claude Code (VS Code)
1. Descompacte esta pasta na raiz do seu repositório (ex.: `docs/design_handoff_mptrix/`) e faça commit.
2. No VS Code, abra o repositório e rode `claude` no terminal integrado (ou use a extensão do Claude Code).
3. Primeiro prompt sugerido:
   > Leia `docs/design_handoff_mptrix/README.md` e o HTML em `docs/design_handoff_mptrix/design/`.
   > Antes de codar, me diga o plano: quais componentes do nosso codebase você vai reutilizar, quais
   > vai criar, e onde entram os tokens de cor/tipo. Depois implemente a tela do estúdio desktop
   > seguindo nossos padrões — sem copiar o HTML do protótipo.
4. Crie um `CLAUDE.md` na raiz do repo com as regras que devem valer para todo o sistema, para o
   Claude aplicar o mesmo padrão em qualquer tela nova. Sugestão de conteúdo:
   > **Design system MPTrix** — dark mode `#0B0C0F`/`#101216`/`#15171C`, bordas
   > `rgba(255,255,255,0.07)`, destaque único `#B6FF3B`, stems na escala verde
   > (`#DFF9A0 #B4E85A #7ED97A #4ECB8C #27A08D #8FA57A`), Space Grotesk + IBM Plex Mono (números
   > tabulares em timers, ruler, cifras), raio 8–16px, flat, sem gradientes, contraste AA (texto
   > secundário mínimo `#8A93A0`), alvos de toque ≥44px. Playhead lima com marcador triangular e
   > tint da região tocada são a assinatura da interface. Fonte de verdade:
   > `docs/design_handoff_mptrix/README.md`.
5. Vá tela por tela (estúdio → upload → biblioteca → mobile), revisando cada uma antes de seguir.
