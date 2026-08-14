// GERA A TELA DO APP a partir da MESMA fonte que o computador serve.
//
// A tela do celular existe em um lugar so: src/main/celular-pagina.js. Ela e
// servida pelo computador (modo "perto de casa") e tambem vira o arquivo que
// vai dentro do app Android. Duas copias da mesma tela seria o erro que mais me
// pegou neste projeto — conserto feito de um lado e esquecido do outro.
//
// O que muda entre as duas: DE ONDE vem a musica. Isso e resolvido dentro da
// propria pagina, olhando se existe o mundo nativo por perto — nao com dois
// arquivos parecidos.
import { mkdtempSync, copyFileSync, mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath, pathToFileURL } from 'url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = join(aqui, '..')

// mesma manha dos outros conferidores: .js em projeto sem "type": "module" e
// lido como CommonJS, e o import nomeado falha
const tmp = mkdtempSync(join(tmpdir(), 'mptrix-tela-'))
writeFileSync(join(tmp, 'package.json'), '{"type":"module"}')
mkdirSync(join(tmp, 'main')); mkdirSync(join(tmp, 'shared'))
copyFileSync(join(raiz, 'src', 'main', 'celular-pagina.js'), join(tmp, 'main', 'celular-pagina.js'))
copyFileSync(join(raiz, 'src', 'shared', 'instrumentos.js'), join(tmp, 'shared', 'instrumentos.js'))
const { paginaCelular } = await import(pathToFileURL(join(tmp, 'main', 'celular-pagina.js')).href)

const destino = join(raiz, 'celular', 'www')
if (!existsSync(destino)) mkdirSync(destino, { recursive: true })
const html = paginaCelular()
writeFileSync(join(destino, 'index.html'), html, 'utf8')

console.log('tela do app gerada:', Math.round(html.length / 1024), 'KB')
console.log('  de   src/main/celular-pagina.js')
console.log('  para celular/www/index.html')
