# Pendências conhecidas

## 1. Botão direito (context menu) não abre na janela

**Status:** Não funciona em modo dev. Atalhos de teclado (`Ctrl+C/V/X/A`) **funcionam** normalmente.

**Já tentamos:**
- `electron-context-menu` v4 → erro `ERR_REQUIRE_ESM` (lib é ESM-only, nosso main é CommonJS)
- `electron-context-menu` v3 → sem erro, mas sem efeito visual
- Implementação manual com `mainWindow.webContents.on('context-menu', …)` + `Menu.buildFromTemplate(...).popup({ window })` → também sem efeito visual

**Implementação atual:** função `attachContextMenu(window)` em [src/main/index.js](src/main/index.js), chamada logo após `mainWindow.on('ready-to-show', ...)`.

**Próximos passos pra investigar:**
- Adicionar `console.log` no callback do `context-menu` pra confirmar se o evento sequer dispara
- Verificar se algo no renderer está chamando `event.preventDefault()` no contextmenu DOM event
- Testar com o app empacotado (`npm run build:win` + instalar) — pode ser específico do dev mode
- Conferir se algum CSS tem `pointer-events: none` ou `user-select: none` em escopo amplo demais

## 2. Mensagem de erro avulsa (não reproduzida)

Usuário relatou ter visto uma vez algo como "não está sendo possível entrar no vídeo" em algum momento aleatório durante uso. Sem repro consistente. Pedir print/texto exato se reaparecer.

## 3. O MP3 do editor sai diferente do que a tela toca (diagnosticado, não consertado)

**Status:** a causa está achada. Não é defeito do exportador — `emendar()` em
[src/main/emenda.js](src/main/emenda.js) está certo. É a tela que toca uma **aproximação**.

A prévia usa um `<audio>` por faixa ([FaixasDaEmenda.jsx](src/renderer/src/components/FaixasDaEmenda.jsx)),
e um `<audio>` não faz o que o ffmpeg faz. Quatro diferenças, medidas lendo os dois lados:

| o quê | na tela | no MP3 |
|---|---|---|
| tom (semitons) | não aplica | `rubberband=pitch` |
| rampas de entrada/saída | desenhadas, nunca ouvidas — o laço que toca não mexe nelas | `afade` |
| ganho acima de 100% | `a.volume` trava em 1, e o controle vai até 200% | `volume=` até 4× |
| limitador do cruzamento | não existe | `alimiter=0.97` |

Só a primeira estava avisada (letra miúda). As outras três surpreendem calado — e é a soma delas
que faz o arquivo "soar um pouco diferente".

**Caminho pro conserto:** trocar o `<audio>.volume` por um grafo de Web Audio (`GainNode`), que
resolve rampa e ganho acima de 100% de uma vez — a rampa vira desenho de ganho no tempo, e o
ganho deixa de ter teto em 1. O tom continua sendo a exceção honesta (mudar tom ao vivo no
navegador é conta pesada); **mas o aviso tem que sair da letra miúda e ir pra tela**, junto do
botão de exportar.

**Não medido:** nada disso foi ouvido. A causa foi achada lendo os dois caminhos e comparando
filtro por filtro; falta ouvir na máquina do dono.
