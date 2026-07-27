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
