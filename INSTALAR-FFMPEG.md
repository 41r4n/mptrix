## Os programas da pasta `resources/bin`

O MPTRIX usa dois programas de fora pra funcionar:

| arquivo | o que faz | tamanho |
|---|---|---|
| `yt-dlp.exe` | baixa o áudio e o vídeo | 17 MB |
| `ffmpeg.exe` | converte e corta o áudio | 195 MB |

**O `yt-dlp.exe` vem junto com o projeto.** O `ffmpeg.exe` não.

O GitHub recusa arquivo acima de 100 MB, e o ffmpeg passa disso sozinho. Ele
ficaria guardado em toda versão do histórico, então o projeto inteiro passaria
de 200 MB pra clonar — pra carregar um programa que não é nosso e que qualquer
um baixa pronto.

### Se você baixou este projeto num computador novo

O app vai abrir, mas **não vai converter áudio nenhum** até o ffmpeg estar no
lugar. Para resolver:

1. Baixe em <https://www.gyan.dev/ffmpeg/builds/> a versão **release essentials**
2. Abra o `.zip`, entre em `bin/` e tire de lá o `ffmpeg.exe`
3. Ponha em `resources/bin/ffmpeg.exe` aqui dentro do projeto

Pronto. O instalador gerado com `npm run build:win` leva o ffmpeg junto — quem
recebe o MPTRIX instalado não precisa fazer nada disso.
