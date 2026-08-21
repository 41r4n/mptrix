import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, basename } from 'path'

// ██████████ ONDE MORA O yt-dlp ██████████
//
// Ele vinha morando junto do app instalado. Só que o app instalado pode estar
// em "C:\Program Files", que é pasta trancada do Windows — e trancada de
// verdade: MEDIDO na máquina do dono, escrever ali é negado. O botão
// "Atualizar" tentava trocar o arquivo e o Windows recusava, calado.
//
// O efeito é o pior possível pra este app: o yt-dlp é o que baixa as músicas, e
// o YouTube muda o tempo todo. Um yt-dlp congelado no dia da instalação vira,
// em alguns meses, um app que simplesmente não baixa mais nada — e o dono, que
// quer dar isto pros amigos, não ia nem ficar sabendo.
//
// Então ele passa a morar na pasta de dados do usuário, que é sempre gravável,
// não importa onde o app foi instalado.
//
// Isto vive em arquivo separado, sem depender do electron, porque assim dá pra
// MEDIR: as três decisões abaixo (copiar, não rebaixar, não quebrar) são o tipo
// de coisa que a gente jura que está certa e só descobre errada no computador
// de outra pessoa.
export function resolverYtDlp({ noPacote, pastaDeDados, empacotado }) {
  // Rodando do código-fonte a pasta do projeto é gravável — não há o que
  // resolver, e copiar só criaria uma segunda cópia pra confundir.
  if (!empacotado) return { caminho: noPacote, motivo: 'fonte' }

  try {
    const casa = join(pastaDeDados, 'bin')
    if (!existsSync(casa)) mkdirSync(casa, { recursive: true })
    // O NOME VEM DO PRÓPRIO PACOTE, não escrito aqui: no Windows é
    // `yt-dlp.exe`, em Mac e Linux é `yt-dlp` sem sufixo. Copiar com nome fixo
    // deixaria, num Mac, uma cópia chamada `.exe` que ninguém executa — e o app
    // acharia que se atualizou.
    const destino = join(casa, basename(noPacote))

    if (existsSync(destino)) return { caminho: destino, motivo: 'ja-estava' }

    // Sem o do pacote não há o que copiar. Devolver o caminho do pacote deixa o
    // resto do app dar o erro certo ("yt-dlp não encontrado") em vez de um erro
    // sobre uma pasta que a pessoa nunca viu.
    if (!existsSync(noPacote)) return { caminho: noPacote, motivo: 'sem-origem' }

    copyFileSync(noPacote, destino)
    return { caminho: destino, motivo: 'copiei' }
  } catch (err) {
    // Se der errado, o app continua baixando música com o que veio no pacote.
    // Perder a atualização é ruim; deixar de baixar seria pior.
    return { caminho: noPacote, motivo: 'falhou', erro: err.message }
  }
}

// NÃO SOBRESCREVEMOS uma cópia que já existe, e isso é decisão, não descuido:
// se o app for atualizado e trouxer um yt-dlp mais novo no pacote, copiar por
// cima seria capaz de REBAIXAR a cópia que o atualizador já deixou mais nova.
// E não precisa — quem manda no assunto é o GitHub do yt-dlp, e a próxima
// verificação alcança sozinha.
//
// O ffmpeg não se muda de lugar: são 200 MB, ele não é atualizado por aqui, e
// ler de pasta trancada sempre funcionou. Copiar por simetria custaria 200 MB
// de disco a troco de nada.
