// CONFERE A PAGINA DO CELULAR — rodar com: npm run confere:pagina
//
// A pagina do celular e um texto dentro de um arquivo .js: nenhum verificador
// olha pra ela, nenhum build reclama, e um erro so aparece no telefone de
// alguem. Foi o que aconteceu — eu reescrevi a tela do acervo e levei junto
// tres funcoes que moravam logo abaixo. O app quebrou com "pintarLevar is not
// defined" e a MINHA mensagem de erro dizia "nao consegui falar com o
// computador", mandando o dono conferir Wi-Fi e roteador por meia hora. A rede
// nunca teve nada.
//
// Este script le o miolo do <script>, tira comentarios e textos, e cobra: toda
// funcao chamada existe? Toda funcao definida e usada?
import { readFileSync, mkdtempSync, copyFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath, pathToFileURL } from 'url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = mkdtempSync(join(tmpdir(), 'mptrix-pg-'))
writeFileSync(join(raiz, 'package.json'), '{"type":"module"}')
mkdirSync(join(raiz, 'main')); mkdirSync(join(raiz, 'shared'))
copyFileSync(join(aqui, '..', 'src', 'main', 'celular-pagina.js'), join(raiz, 'main', 'celular-pagina.js'))
copyFileSync(join(aqui, '..', 'src', 'shared', 'instrumentos.js'), join(raiz, 'shared', 'instrumentos.js'))
const { paginaCelular } = await import(pathToFileURL(join(raiz, 'main', 'celular-pagina.js')).href)

const html = paginaCelular()
const bruto = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))

// tira comentarios e textos: sem isto, uma palavra seguida de parenteses
// dentro de um comentario vira "funcao inexistente"
const js = bruto
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
  .replace(/'(?:\\.|[^'\\])*'/g, "''")
  .replace(/"(?:\\.|[^"\\])*"/g, '""')

const DO_NAVEGADOR = new Set([
  'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Audio',
  'URL', 'URLSearchParams', 'Math', 'JSON', 'String', 'Number', 'Object', 'Array',
  'Date', 'Response', 'parseInt', 'parseFloat', 'encodeURIComponent',
  'decodeURIComponent', 'isNaN', 'Promise', 'Error', 'Set', 'Map', 'requestAnimationFrame'
])
const PALAVRAS = /^(if|for|while|switch|catch|return|typeof|function|new|else|do|var|const|let|try|throw|delete|in|of|instanceof)$/

const definidas = new Set([...js.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))
const chamadas = [...js.matchAll(/(?<![.\w$])([a-zA-Z_$][\w$]*)\s*\(/g)].map((m) => m[1])

const faltando = [...new Set(chamadas)]
  .filter((n) => !definidas.has(n) && !DO_NAVEGADOR.has(n) && !PALAVRAS.test(n))

const usadas = new Set(chamadas)
const orfas = [...definidas].filter((n) => !usadas.has(n))

console.log('A PAGINA DO CELULAR\n')
console.log('  funcoes definidas :', definidas.size)
console.log('  tamanho da pagina :', Math.round(html.length / 1024), 'KB\n')

let ok = true
if (faltando.length) {
  ok = false
  console.log('ERRO chamadas sem funcao (a pagina quebra ao rodar):')
  faltando.forEach((f) => console.log('       ' + f + '()'))
} else {
  console.log('ok   toda funcao chamada existe')
}

if (orfas.length) {
  console.log('aviso funcoes definidas e nunca usadas: ' + orfas.join(', '))
} else {
  console.log('ok   nenhuma funcao sobrando')
}

// as pecas que a tela precisa ter
for (const [marca, oque] of [
  ['id="tela"', 'a area onde tudo e desenhado'],
  ['comSenha(', 'a senha viajando nos pedidos'],
  ['serviceWorker.register', 'o guardador do modo ensaio'],
  ['levar pro ensaio', 'o botao de levar'],
  ['class="capa"', 'a capa da musica'],
  ['class="abas"', 'as abas embaixo'],
  ['class="ampulheta', 'a ampulheta da roda'],
  ['/api/baixar', 'mandar o computador baixar'],
  ['/api/tarefas', 'acompanhar o download']
]) {
  const tem = html.includes(marca)
  if (!tem) ok = false
  console.log((tem ? 'ok   ' : 'ERRO ') + oque)
}

process.exit(ok ? 0 : 1)
