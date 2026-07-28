# Design system MPTrix (obrigatório em todo o repo)

Fonte de verdade: `docs/design_handoff_mptrix/README.md`.

- Superfícies: app `#0B0C0F`, painel de pistas `#101216`, cards `#15171C`, inset `#0D0F13`; bordas `rgba(255,255,255,0.07)`.
- Texto: `#F2F4F7` / `#D1D5DB` / `#9BA3AF` / `#8A93A0` (mínimo). Nunca `#6B7280` — reprova AA.
- Destaque único: `#B6FF3B` (playhead, play, CTA, tint de progresso, estado ativo); hover `#C9FF66`. Mute `#EAB308`.
- Stems, escala verde: Vocais `#DFF9A0`, Bateria `#B4E85A`, Baixo `#7ED97A`, Guitarra `#4ECB8C`, Teclado `#27A08D`, Outro `#8FA57A`.
- Tipografia: Space Grotesk (UI) + IBM Plex Mono (timer, ruler, BPM/tom, cifras, captions em caixa-alta com letter-spacing 0.08–0.16em).
- Forma: raio 8–16px (50% em transporte e marca), flat, sem gradientes. Sombra de janela `0 30px 80px rgba(0,0,0,0.55)`.
- Marca: disco lima com ampulheta preta (aceno ao Omnitrix) e anel duplo lima.
- Assinatura da UI: playhead lima com marcador triangular cruzando todas as pistas, tint da região tocada, cor por stem, loop no transporte, letra cifrada + botão de tom.
- Acessibilidade: contraste AA em texto e controles; alvos de toque >=44px; sliders com teclado; M/S com `aria-pressed`.
- Performance: playhead/tint/timer atualizados por frame via refs (`style`/`textContent`), nunca por re-render.
- Nunca use `scrollIntoView`; use `scrollTo({behavior:'smooth'})`.
