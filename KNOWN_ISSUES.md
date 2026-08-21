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

## 3. O MP3 do editor sai diferente do que a tela toca (três quartos resolvido)

**Status em 2026-08-20:** o diagnóstico abaixo estava certo, e **três das quatro diferenças foram
consertadas e medidas** na máquina do dono no mesmo dia. Sobra uma. O editor está rebaixado (veja o
CLAUDE.md), então o que sobrou não é urgente — mas quem voltar aqui precisa saber o que **já está
feito**, senão gasta os dias de novo no mesmo lugar.

Nunca foi defeito do exportador. `emendar()` em [src/main/emenda.js](src/main/emenda.js) está
certo, e agora isso está **medido**, não suposto: cruzando o MP3 gerado com a gravação original em
cada corte, o desencontro é de **5 milissegundos** — que é o atraso do próprio codificador MP3, não
erro de recorte. Era a tela que tocava uma **aproximação**.

| o quê | como estava | agora |
|---|---|---|
| tom (semitons) | não aplicava | **soa.** `previaComTom()` fabrica o pedaço com o pitch aplicado e o play toca esse arquivo. Medido por autocorrelação: prévia 495,5 Hz, MP3 495,5 Hz |
| rampas de entrada/saída | desenhadas, nunca ouvidas | **soam.** O envelope é calculado por quadro no mesmo relógio que move a linha |
| ganho acima de 100% | `a.volume` trava em 1 | **proporção fiel.** Todas as faixas são divididas pelo maior ganho da mesa: o conjunto toca mais baixo e a relação entre elas fica idêntica à do arquivo. A tela avisa por escrito quando está atenuando |
| limitador do cruzamento | não existe | **continua sem existir** — a única que sobrou |

**O que falta, e só isso:** onde duas músicas se cruzam, o MP3 passa por `alimiter=0.97` e o play
não. O arquivo sai mais comprimido no cruzamento do que se ouviu. É a menor das quatro (só aparece
em sobreposição, e só quando a soma passa do teto), e o caminho continua sendo o que estava escrito
aqui: **Web Audio** (`GainNode` + `DynamicsCompressorNode`), que resolveria isso e ainda tiraria a
gambiarra de dividir todo mundo pelo maior ganho.

**Uma coisa tentada e desfeita, pra ninguém repetir:** a posição do play tem tolerância larga
(350 ms) antes de se corrigir, e isso é uma diferença real em relação ao arquivo. Tentei trocar por
correção contínua, puxando a velocidade em 1,5% até encaixar — a ideia é a que tocadores de verdade
usam, mas aqui **piorou**: mexer no `playbackRate` a cada quadro obriga o navegador a refazer o
esticamento o tempo todo e o som ondula. O dono ouviu e mandou reverter. Largo e estável ganhou de
exato e ondulado; se alguém for tentar de novo, o caminho é Web Audio, não `playbackRate`.

**O que ainda não foi ouvido:** os consertos foram medidos em arquivo (frequência, nível, alinhamento),
e o dono não confirmou por escuta que a queixa original sumiu.
