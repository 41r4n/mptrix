// LER E RECORTAR PNG SEM TELA.
// O Chromium morria ao abrir janela grande, e eu preciso das medidas e das
// cores EXATAS da arte do dono — nao de uma impressao. Aqui o PNG e decodificado
// na unha: cabecalho, zlib, desfazer os filtros de linha.
const zlib = require('zlib')
const { readFileSync, writeFileSync } = require('fs')

function ler(caminho) {
  const b = readFileSync(caminho)
  let p = 8, largura = 0, altura = 0, prof = 0, tipo = 0
  const pedacos = []
  while (p < b.length) {
    const tam = b.readUInt32BE(p)
    const nome = b.toString('ascii', p + 4, p + 8)
    const dados = b.slice(p + 8, p + 8 + tam)
    if (nome === 'IHDR') {
      largura = dados.readUInt32BE(0); altura = dados.readUInt32BE(4)
      prof = dados[8]; tipo = dados[9]
    } else if (nome === 'IDAT') pedacos.push(dados)
    else if (nome === 'IEND') break
    p += 12 + tam
  }
  if (prof !== 8) throw new Error('profundidade ' + prof + ' nao tratada')
  const canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipo]
  if (!canais) throw new Error('tipo ' + tipo + ' nao tratado')
  const cru = zlib.inflateSync(Buffer.concat(pedacos))
  const bpp = canais
  const passo = largura * bpp
  const px = Buffer.alloc(altura * passo)
  let q = 0
  for (let y = 0; y < altura; y++) {
    const filtro = cru[q++]
    const linha = cru.slice(q, q + passo); q += passo
    const saida = px.slice(y * passo, (y + 1) * passo)
    const cima = y > 0 ? px.slice((y - 1) * passo, y * passo) : null
    for (let i = 0; i < passo; i++) {
      const a = i >= bpp ? saida[i - bpp] : 0
      const c = cima ? cima[i] : 0
      const d = cima && i >= bpp ? cima[i - bpp] : 0
      let v = linha[i]
      if (filtro === 1) v += a
      else if (filtro === 2) v += c
      else if (filtro === 3) v += (a + c) >> 1
      else if (filtro === 4) {
        const pp = a + c - d
        const pa = Math.abs(pp - a), pb = Math.abs(pp - c), pc = Math.abs(pp - d)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? c : d
      }
      saida[i] = v & 255
    }
  }
  return { largura, altura, canais, px }
}

function escrever(caminho, largura, altura, canais, px) {
  const passo = largura * canais
  const cru = Buffer.alloc(altura * (passo + 1))
  for (let y = 0; y < altura; y++) {
    cru[y * (passo + 1)] = 0
    px.copy(cru, y * (passo + 1) + 1, y * passo, (y + 1) * passo)
  }
  const pedaco = (nome, dados) => {
    const b = Buffer.alloc(12 + dados.length)
    b.writeUInt32BE(dados.length, 0); b.write(nome, 4, 'ascii')
    dados.copy(b, 8)
    b.writeUInt32BE(crc(Buffer.concat([Buffer.from(nome, 'ascii'), dados])) >>> 0, 8 + dados.length)
    return b
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8; ihdr[9] = canais === 4 ? 6 : canais === 3 ? 2 : 0
  writeFileSync(caminho, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pedaco('IHDR', ihdr), pedaco('IDAT', zlib.deflateSync(cru)), pedaco('IEND', Buffer.alloc(0))
  ]))
}

let TAB = null
function crc(buf) {
  if (!TAB) {
    TAB = new Int32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TAB[n] = c }
  }
  let c = -1
  for (let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return c ^ -1
}

function recortar(img, x, y, w, h, zoom) {
  const z = zoom || 1
  const canais = img.canais
  const saida = Buffer.alloc(w * z * h * z * canais)
  for (let j = 0; j < h * z; j++) {
    for (let i = 0; i < w * z; i++) {
      const sx = x + Math.floor(i / z), sy = y + Math.floor(j / z)
      const de = (sy * img.largura + sx) * canais
      const pra = (j * w * z + i) * canais
      for (let c = 0; c < canais; c++) saida[pra + c] = img.px[de + c]
    }
  }
  return { largura: w * z, altura: h * z, canais, px: saida }
}

function cor(img, x, y) {
  const i = (y * img.largura + x) * img.canais
  const h = (v) => v.toString(16).padStart(2, '0')
  return '#' + h(img.px[i]) + h(img.px[i + 1]) + h(img.px[i + 2])
}

module.exports = { ler, escrever, recortar, cor }
