# MPTRIX — como construir com esta biblioteca

Estúdio de ensaio offline, Electron desktop, **tema escuro único** (não há tema
claro). Superfícies chapadas, sem gradiente, um só destaque: o lima `#B6FF3B`.

## 1. Vista a superfície — sem isso nada é legível

Não há provider React a instalar: a biblioteca já se vira sozinha. O que **é**
obrigatório é a superfície, porque o texto da casa é claro:

```jsx
<div className="mptrix-superficie">
  {/* tudo aqui dentro */}
</div>
```

`.mptrix-superficie` aplica `--bg`, `--text` e `--font-ui`. Sem ela o conteúdo
cai em cima do branco do host e **some**. Aplique no elemento mais externo do
que você montar (ou no `<body>`, que a folha já pinta).

## 2. O idioma: variáveis CSS, nunca hex solto

Cor nova = variável nova. Nunca escreva `#15171C` — escreva `var(--bg-elev)`.
Os 45 tokens vivem no `:root` de `styles.css`. Os que você mais vai usar:

| Família | Tokens |
|---|---|
| Superfícies | `--bg` (app) · `--bg-tracks` (painel) · `--bg-elev` (card) · `--bg-elev-2` (hover) · `--bg-inset` (canaleta/régua) |
| Bordas | `--border` · `--border-hair` · `--border-strong` · `--border-control` |
| Texto | `--text` · `--text-2` · `--muted` · `--muted-2` (o mais apagado que passa AA) |
| Destaque | `--accent` · `--accent-hover` · `--accent-border` · `--accent-dim` |
| Sinais | `--ok` · `--warn` (mute ativo) · `--bad` |
| Faixas | `--stem-1` … `--stem-6` (escala verde: voz → outros) |
| Fontes | `--font-ui` (Space Grotesk) · `--font-mono` (IBM Plex Mono) |
| Brilhos | `--glow-play` · `--glow-playhead` · `--glow-painel` |

**Texto sobre lima é SEMPRE escuro (`--bg`)** — lima com texto branco reprova
contraste. Nunca use `#6B7280`: reprova AA.

`--font-mono` não é decorativo: ele marca **número medido** — tempo, BPM, tom,
porcentagem — e legendas em caixa-alta (`letter-spacing: .08–.16em`).

## 3. Classes que já existem — use antes de inventar

`.btn-primary` (lima, ação principal) · `.btn-secondary` · `.btn-small`
· `.link-btn` (ação terciária, sem caixa) · `.card` · `.chip` · `.modal-overlay`
+ `.modal` / `.modal-small` (diálogos) · `.hud` (leitura de painel: número mono
grande + rótulo caixa-alta, separados por fio) · `.pres-meter` (medidor
segmentado) · `.muted` / `.small`.

## 4. A regra que mais quebra desenho aqui

**Borda em volta de texto = clicável.** Informação que não clica NUNCA usa forma
de botão — mentir pro dedo do usuário é bug de design. Pra destacar sem falsa
affordance: peso/tamanho da fonte, cor + halo (`text-shadow`), `.hud`,
`.pres-meter`, barra de cor lateral, ou hexágono. Neon só onde carrega
informação, nunca decorativo.

Raio 8–16px (50% em transporte e marca). Ícone é **desenhado** (`<Ico nome=…>`),
nunca emoji. Alvos de toque generosos; `aria-pressed` em botões de estado.

## 5. A verdade está na folha

Antes de estilizar, leia `styles.css` e o que ela `@import`a — são 336 KB de
vocabulário real, muito além do resumo acima. Cada peça tem seu `.prompt.md`
com as props.

## 6. Exemplo idiomático

```jsx
<div className="mptrix-superficie" style={{ padding: 24 }}>
  <p style={{
    fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.16em',
    textTransform: 'uppercase', color: 'var(--muted-2)', margin: 0
  }}>04 / emendar</p>

  <div className="card" style={{ marginTop: 16, padding: 16 }}>
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--accent)' }}>
      11:56
    </span>
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <button className="btn-primary">Juntar</button>
      <button className="btn-secondary">Cancelar</button>
      <Ico nome="ampulheta" tamanho={20} />
    </div>
  </div>
</div>
```
