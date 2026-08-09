# Design system MPTrix (obrigatório em todo o repo)

Fonte de verdade: `design_handoff_mptrix/README.md` (+ detalhes extraídos do protótipo).
Os tokens vivem no `:root` de `src/renderer/src/styles.css` — as telas consomem de lá.
**Não espalhe hex solto**: cor nova = variável nova no `:root`.

## Tokens
- Superfícies: app `#0B0C0F` (`--bg`), painel de pistas `#101216` (`--bg-tracks`), cards `#15171C`
  (`--bg-elev`), inset/canaletas `#0D0F13` (`--bg-inset`); bordas `rgba(255,255,255,0.07)` (`--border`).
- Texto: `#F2F4F7` / `#D1D5DB` / `#9BA3AF` / `#8A93A0` (mínimo permitido). **Nunca `#6B7280`** — reprova AA.
- Destaque único: `#B6FF3B` (`--accent`) — playhead, play, CTA, tint de progresso, estado ativo;
  hover `#C9FF66`. Texto sobre lima é SEMPRE escuro `#0B0C0F`. Mute ativo `#EAB308` (`--warn`).
- Stems, escala verde (`--stem-1..6`): Voz `#DFF9A0`, Bateria `#B4E85A`, Baixo `#7ED97A`,
  Guitarra `#4ECB8C`, Piano/Teclado `#27A08D`, Outros `#8FA57A`. Faixas extras ciclam a escala.
- Tipografia: Space Grotesk (`--font-ui`) + IBM Plex Mono (`--font-mono`) para timer, ruler,
  BPM/tom, percentuais e captions em caixa-alta (`letter-spacing 0.08–0.16em`). Fontes
  **auto-hospedadas** em `src/renderer/public/fonts/` — o app é 100% offline, nunca usar CDN.
- Forma: raio 8–16px (50% em transporte e marca), **flat, sem gradientes**.
  Brilhos só os da assinatura: play `var(--glow-play)`, playhead `var(--glow-playhead)`.

## Assinatura da interface (não negociável)
Playhead lima com marcador triangular (ruler) cruzando todas as pistas · tint da região já tocada ·
cor por stem (barra 4×16 + nome na cor + onda na cor) · loop no transporte · timer mono lima.

## Performance
Playhead, tint, timer e seek são atualizados **por frame via refs** (`style.left/width`,
`textContent`, `el.value`) no relógio único de `StudioView` — **nunca** re-render React por frame.
O estado `pos` atualiza ~4×/s só pro resto da UI. Waveforms: canvas com redesenho por
ResizeObserver, cor vinda do stem.

## Vocabulário visual (regra da casa)
**Borda em volta de texto = clicável.** Informação que não clica NUNCA usa forma de botão —
mentir pro dedo do usuário é bug de design. Pra destacar sem falsa affordance, use:
peso/tamanho da fonte, cor + halo (`text-shadow`), leitura de painel (número mono grande +
rótulo em caixa-alta, separados por hairlines — classe `.hud`), medidor segmentado
(`.pres-meter`, aceno ao carregador do Omnitrix), barra de cor lateral, ou hexágono
(`clip-path` + ampulheta) pra marcas. Neon só onde carrega informação — nunca decorativo.

## Acessibilidade
Contraste AA em texto e controles; alvos de toque generosos; `aria-pressed` em M/S quando mexer neles;
nunca `scrollIntoView` — use `scrollTo({ behavior: 'smooth' })`.

## Escopo real (decisões de adaptação do handoff)
- O app é Electron desktop: telas mobile/bottom sheets do handoff **não se aplicam**.
- Seções **não existem** no produto (fora de escopo por decisão do dono) — não construir; se um dia
  entrarem, seguir o visual do handoff.
- Cifra/acordes **entraram** (painel Acordes + Letra com cifra em cima dos versos).
- Metrônomo **entrou** (2026-08-08, pedido do pai do dono, que quer acertar o tempo). Ele é chip da
  barra de cima, colado no BPM. Duas maneiras de bater, e a diferença é medida, não estética:
  **seguindo** usa as batidas que o analisador achou na gravação (único jeito de ficar junto de banda
  humana, que acelera no refrão); **firme** é pulso constante, pra treinar precisão. O analisador só
  publica `analysis.grade` quando um pulso constante REALMENTE descreve a gravação (erro ≤ 8% do
  período) — Girlfriend/NSYNC encaixa com 34ms, Oceano e Samurai não encaixam (153 e 171ms). Sem
  grade, o modo firme continua disponível e a tela **avisa** que o clique vai se separar da música.
- Pan por faixa não existe (só volume + M/S + ↻ refazer).
- O loop do transporte usa o trecho marcado na onda como A-B; sem trecho, repete a música.
  Marcar (arrastar na onda) serve SÓ pra isso — clique seco solta a marcação.
- A **Lupa** ("Investigar trecho") **saiu** (2026-08-09, decisão do dono): perguntar "o que tem
  aqui?" num pedaço marcado é trabalho da dissecação, que varre a música inteira sozinha. Pedir
  pro usuário apontar era devolver pra ele a tarefa do sistema. Mesma razão que tirou o
  "aponta e separa" manual — **separar e investigar são obrigação do sistema, não tarefa do
  usuário**; o motor de apontar (`isolarTrecho`) vive na colheita automática.
- Biblioteca real = histórico com ações por item (lista, não grade) — reskin aplica os tokens
  mantendo TODAS as ações; features nunca são removidas por causa de visual.

## Regra de ouro
Só a camada visual/UX muda em reskins. Lógica de negócio, IPC, rotas de dados e nomes existentes
ficam intactos.
