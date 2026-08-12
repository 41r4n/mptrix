# De quem é cada pedaço

O MPTRIX é meu, mas ele não é feito só por mim. Vários programas de outras
pessoas vão dentro dele, e cada um vem com uma condição de uso. Esta página
existe pra dizer quais são — porque usar o trabalho dos outros e não dar o nome
é o que a gente não faz aqui.

Todos são livres e de graça. Nenhum deles cobra nada, de mim ou de você.

## O MPTRIX é AGPL, e o motivo é este

O MPTRIX é distribuído sob a **GNU Affero General Public License v3** (o arquivo
`LICENSE` aqui do lado).

Não foi escolha de gosto: dois programas que vão dentro dele já são desse
tipo de licença, e ela é "grudenta" de propósito — quem usa esses programas
precisa oferecer o próprio trabalho nas mesmas condições. Na prática, pra você
que usa, isso quer dizer:

- **Pode usar à vontade**, pra qualquer coisa, inclusive pra ganhar dinheiro
  tocando.
- **Pode dar cópia** pra quem quiser.
- **Pode mexer** e fazer a sua versão.
- **Se você distribuir a sua versão**, tem que deixar o código dela disponível
  também. É o que garante que ninguém pegue isto aqui, feche e venda.

## O que vai dentro

| programa | pra que serve | licença | onde achar o código |
|---|---|---|---|
| **essentia.js** | acha o tom e o andamento da música | AGPL v3 | <https://github.com/MTG/essentia.js> |
| **ffmpeg** | converte e corta o áudio | GPL v3 | <https://ffmpeg.org/download.html> · o build usado é o do gyan.dev, com `--enable-gpl` |
| **yt-dlp** | baixa o áudio e o vídeo | Unlicense (domínio público) | <https://github.com/yt-dlp/yt-dlp> |
| **Electron** | é a janela do app | MIT | <https://github.com/electron/electron> |
| **React** | monta as telas | MIT | <https://github.com/facebook/react> |
| **electron-store**, **electron-updater** | guardam ajustes e cuidam da atualização | MIT | <https://github.com/electron-userland> |
| **Dicionário pt-BR** (projeto Vero) | corrige a letra das músicas | LGPL v3 e MPL | <https://pt-br.libreoffice.org> · Raimundo Santos Moura e equipe |
| **Space Grotesk** | a letra dos títulos | SIL Open Font License 1.1 | <https://github.com/floriankarsten/space-grotesk> |
| **IBM Plex Mono** | os números e o relógio | SIL Open Font License 1.1 | <https://github.com/IBM/plex> |

O `ffmpeg` **não vem junto com o código** aqui do repositório — ele tem 195 MB e
o GitHub não aceita arquivo desse tamanho. Ele vai dentro do instalador pronto.
Quem quiser montar o app a partir do código encontra as instruções em
`INSTALAR-FFMPEG.md`.

## Separação na nuvem

Se você ligar a separação na nuvem, o áudio é enviado para o **Replicate**, com
a sua chave e paga por você. Isso é opcional e vem desligado. Sem chave, tudo
acontece no seu computador e nada sai dele.

## Sobre baixar música

O MPTRIX é uma ferramenta. O que você baixa, e o direito que você tem sobre
aquilo, é responsabilidade sua — do mesmo jeito que um gravador não decide o
que você grava.
