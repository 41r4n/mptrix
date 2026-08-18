# design-sync — o que este repositório tem de diferente

O MPTRIX **não é uma biblioteca de componentes**: é um app Electron. Quase tudo
aqui embaixo sai dessa única diferença.

## O que precisou existir pra sincronizar

- **`design-system/index.jsx`** — a porta de entrada da biblioteca. Todo
  componente do app é `export default`, e um default não tem nome do lado de
  fora; num catálogo o nome É o endereço da peça. Este barril batiza cada uma
  uma vez só. É ele que vai em `--entry` (não existe `dist/`; o `main` do
  `package.json` aponta pro processo principal do Electron, que não serve).
- **`design-system/ponte-de-maquete.js`** — instala um `window.mptrix` vazio
  **só quando ele não existe**. Dentro do app real não encosta em nada. Sem ela,
  toda peça morre no primeiro efeito e o cartão sobe em branco.
- **`design-system/fontes-do-catalogo.css`** — cópia do `fonts.css` com `url()`
  relativo. O original usa `/fonts/f0.woff2` (certo dentro do app, onde a raiz é
  o app); o conversor resolve `url()` relativo ao arquivo CSS, então com o
  original as 19 woff2 ficavam pra trás — a regra `@font-face` subia, o arquivo
  não, e **todo desenho renderizaria na fonte de emergência sem ninguém notar**.
  Regenerar com `url(/fonts/` → `url(../src/renderer/public/fonts/` sempre que o
  original mudar.
- **`.mptrix-superficie`** (em `src/renderer/src/styles.css`) — a superfície da
  casa virada classe. O app pinta o fundo no `<body>` e nunca mais pensa nisso;
  fora do app não existe body do MPTRIX, e o molde do cartão força
  `background:#fff`. Sem essa classe **todas as peças apareceram com texto claro
  sobre branco**, ou seja, invisíveis. Toda prévia veste ela.

## Decisões de escopo

- **9 peças de vocabulário**, não as 26. O que entrou é peça de montar tela; o
  que ficou de fora são as telas (Estúdio, Acervo, Emendar) — tela é composição,
  e composição pertence a quem desenha.
- **`UpdateBanner` e `UpdateFooter` ficaram de fora de propósito.** As duas leem
  o estado real da atualização (`useUpdates`) e devolvem `null` quando não há
  uma. Peça que só existe em certo momento do app não se deixa fotografar. Pra
  trazer: exportar `UpdatesProvider` no barril, pôr em `cfg.provider`, e a ponte
  precisará devolver uma checagem com atualização disponível.
- **Omnitrix tem uma célula só.** Escrevi duas (`ligado` / `apagado`) e saíram
  idênticas: sem link na área de transferência não há diferença visível. Duas
  células iguais não mostram eixo de variação — mostram que quem escreveu não
  olhou. A coroa aberta (`.omni-palco`) não aparece: ela depende de estado
  interno que nenhuma prop alcança.

## Armadilhas já pagas

- **`PeriodPickerModal` lê `timestamp`, não `createdAt`.** Escrevi `createdAt`
  (o nome usado no resto do acervo) e o cartão saiu com "Nada registrado",
  parecendo peça quebrada quando era só a chave errada. O contrato em
  `dtsPropsFor` já diz isso por extenso.
- **`@types/react` não está no repo** (projeto JS puro) e não existe `.d.ts`
  nenhum: os contratos de props são **escritos à mão** em `cfg.dtsPropsFor`.
  Mexeu na assinatura de um componente? Atualize lá — ninguém vai avisar.
- **Captura com `--components` apaga as folhas das outras peças.** Depois de uma
  captura escopada, rode `package-capture.mjs` completo antes de dar nota, senão
  as folhas das outras não existem.
- **Playwright 1.61.x** é o que casa com o `chromium-1228` em cache nesta
  máquina. Outra versão falha com `Executable doesn't exist`.

## Known render warns (conferidos, benignos)

- `[RENDER_ERRORS] Guarda` — o erro é **de propósito**: a história é uma peça que
  quebra dentro da Guarda. Sem o erro, não há o que fotografar.
- `[RENDER_ERRORS] ConfirmDialog` — abrindo o cartão direto no chromium **não sai
  erro nenhum**; o `firstErr` relatado é o próprio texto do diálogo. Artefato do
  arnês, não da peça.
- `PeriodPickerModal` fica com o título "Período" cortado no topo do cartão: o
  modal é mais alto que a janela do cartão. O conteúdo todo é legível.

## Riscos pra próxima sincronização

- **`design-system/fontes-do-catalogo.css` é cópia.** Se alguém trocar as fontes
  em `src/renderer/public/fonts/fonts.css`, esta cópia não muda sozinha e o
  catálogo continua servindo as fontes velhas, calado.
- **A ponte de maquete envelhece.** Ela responde ao que as 9 peças usam hoje. Uma
  peça nova que fale com um caminho novo de `window.mptrix` renderiza vazia — o
  `Proxy` evita o estouro, mas não inventa conteúdo.
- **Os contratos são à mão.** São a única fonte de verdade sobre props, e não têm
  ninguém checando contra o código. Assinatura mudada = contrato mentiroso.
- **`BatchActionsDialog` usa emoji** (📤 🗑️) onde a regra da casa manda desenho.
  Não é problema do sync — é achado sobre o app, anotado aqui pra não se perder.
