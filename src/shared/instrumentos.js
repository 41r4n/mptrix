// ██████████ COMO CADA INSTRUMENTO SE CHAMA ██████████
//
// ESTA É A ÚNICA LISTA. Ela vive fora do estúdio porque o celular também
// precisa dela — e quando eu escrevi uma segunda lista pro celular, deu no que
// tinha que dar: o mesmo som aparecia como "Sintetizador" no computador e
// "Teclado" no telefone, e o dono foi quem viu. A tabela do PC tinha 44
// instrumentos; a que eu inventei tinha 13.
//
// Duas listas pra mesma coisa é o erro que mais me pegou neste projeto. Se um
// nome mudar, ele muda AQUI e muda nos dois lugares.
//
// Os desenhinhos são usados só pelo estúdio do computador. A tela do celular
// usa cor por faixa, que é como se acha a guitarra sem ler o nome.
export const STEM_META = {
  vocals: { label: 'Voz', icon: '🎤' },
  drums: { label: 'Bateria', icon: '🥁' },
  bass: { label: 'Baixo', icon: '🎸' },
  guitar: { label: 'Guitarra', icon: '🎸' },
  piano: { label: 'Piano/Teclado', icon: '🎹' },
  other: { label: 'Outros', icon: '🎼' },
  trumpet: { label: 'Trompete', icon: '🎺' },
  saxophone: { label: 'Sax', icon: '🎷' },
  violin: { label: 'Violino', icon: '🎻' },
  strings: { label: 'Cordas', icon: '🎻' },
  organ: { label: 'Órgão', icon: '⛪' },
  accordion: { label: 'Acordeon', icon: '🪗' },
  flute: { label: 'Flauta', icon: '🪈' },
  harmonica: { label: 'Gaita', icon: '🎵' },
  'acoustic-guitar': { label: 'Violão', icon: '🎸' },
  'electric-guitar': { label: 'Guitarra elétrica', icon: '🎸' },
  brass: { label: 'Metais (trompete, trombone…)', icon: '🎺' },
  banjo: { label: 'Banjo', icon: '🪕' },
  mandolin: { label: 'Bandolim', icon: '🎸' },
  woodwind: { label: 'Madeiras (grupo)', icon: '🪈' },
  percussion: { label: 'Percussão', icon: '🥁' },
  clarinet: { label: 'Clarinete', icon: '🪈' },
  oboe: { label: 'Oboé', icon: '🪈' },
  bassoon: { label: 'Fagote', icon: '🪈' },
  trombone: { label: 'Trombone', icon: '🎺' },
  'french-horn': { label: 'Trompa', icon: '📯' },
  tuba: { label: 'Tuba', icon: '📯' },
  viola: { label: 'Viola de orquestra', icon: '🎻' },
  cello: { label: 'Violoncelo', icon: '🎻' },
  'double-bass': { label: 'Contrabaixo acústico', icon: '🎻' },
  harp: { label: 'Harpa', icon: '🎼' },
  ukulele: { label: 'Ukulele', icon: '🪕' },
  dobro: { label: 'Dobro (slide)', icon: '🎸' },
  sitar: { label: 'Sitar', icon: '🪕' },
  synth: { label: 'Sintetizador', icon: '🎹' },
  harpsichord: { label: 'Cravo', icon: '🎹' },
  marimba: { label: 'Marimba/Xilofone', icon: '🎶' },
  glockenspiel: { label: 'Glockenspiel (sinos)', icon: '🔔' },
  timpani: { label: 'Tímpanos', icon: '🥁' },
  tambourine: { label: 'Pandeirola', icon: '🪘' },
  triangle: { label: 'Triângulo', icon: '🔺' },
  congas: { label: 'Congas', icon: '🪘' },
  instrumental: { label: 'Resto da música', icon: '🎵' },
  song: { label: 'Música completa', icon: '🎵' }
}
