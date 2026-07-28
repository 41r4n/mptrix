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

## Acessibilidade
Contraste AA em texto e controles; alvos de toque generosos; `aria-pressed` em M/S quando mexer neles;
nunca `scrollIntoView` — use `scrollTo({ behavior: 'smooth' })`.

## Escopo real (decisões de adaptação do handoff)
- O app é Electron desktop: telas mobile/bottom sheets do handoff **não se aplicam**.
- Cifra/acordes, seções e metrônomo **não existem** no produto (fora de escopo por decisão do dono)
  — não construir; se um dia entrarem, seguir o visual do handoff.
- Pan por faixa não existe (só volume + M/S + ↻ refazer).
- O loop do transporte usa o trecho marcado na onda (Lupa) como A-B; sem trecho, repete a música.
- Biblioteca real = histórico com ações por item (lista, não grade) — reskin aplica os tokens
  mantendo TODAS as ações; features nunca são removidas por causa de visual.

## Regra de ouro
Só a camada visual/UX muda em reskins. Lógica de negócio, IPC, rotas de dados e nomes existentes
ficam intactos.
