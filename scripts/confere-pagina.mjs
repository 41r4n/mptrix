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

// ── A TRAVA DO BACKTICK ──
// A CSS da pagina mora dentro de uma template string do JavaScript. Um
// backtick solto num comentario de CSS FECHA a string, e o arquivo inteiro
// vira lixo de sintaxe — o app do celular simplesmente nao carrega.
// Ja me pegou duas vezes na mesma sessao: escrevendo comentario sobre
// drop-shadow e sobre width:auto. Comentario e a hora em que a gente relaxa,
// e e exatamente por isso que ele precisa de trava.
{
  // A pagina INTEIRA mora na template string — CSS e script juntos. A primeira
  // versao desta trava so olhava o <style>, e na mesma tarde um backtick num
  // comentario do SCRIPT passou por baixo dela. Guarda que cobre meio caminho
  // da a sensacao de estar guardado, que e pior que nao ter guarda.
  const fonte = readFileSync(new URL('../src/main/celular-pagina.js', import.meta.url), 'utf8')
  const abre = fonte.indexOf('<!doctype')
  const fecha = fonte.lastIndexOf('</html>')
  const corpo = abre >= 0 && fecha > abre ? fonte.slice(abre, fecha) : ''
  const cravo = corpo.indexOf(String.fromCharCode(96))
  if (cravo >= 0) {
    const linha = fonte.slice(0, abre + cravo).split(String.fromCharCode(10)).length
    console.log('ERRO backtick dentro da pagina, na linha ' + linha + ' — ele fecha a template string')
    process.exitCode = 1
  } else {
    console.log('ok   nenhum backtick solto na pagina')
  }
}

// ── A TRAVA DA BARRA INVERTIDA ──
// A pagina inteira mora numa template string, e template string COME a barra:
// \s chega como s, \] como ], \. como ponto-qualquer. Uma funcao de limpeza
// de nome escrita com \s e \] chegou no celular como outra expressao e
// quebrou a tela inteira com "Cannot read properties of undefined".
// Escrever a barra dobrada resolveria, mas fica ilegivel; a saida da casa e
// nao precisar dela: [ ] no lugar de \s, [|] no lugar de \|, [.] no lugar
// de \., e ] sozinho fora de classe, que ja e literal.
{
  const fonte = readFileSync(new URL('../src/main/celular-pagina.js', import.meta.url), 'utf8')
  const abre = fonte.indexOf('<!doctype')
  const fecha = fonte.lastIndexOf('</html>')
  const corpo = abre >= 0 && fecha > abre ? fonte.slice(abre, fecha) : ''
  // varredura letra a letra, sem expressao regular: montar uma expressao que
  // procura barra invertida com barra invertida foi o caminho de errar de novo
  const B = String.fromCharCode(92)
  const PERIGO = 'sdwbSDWB.|()[]+*?^$/-'
  const achados = []
  for (let k = 0; k < corpo.length - 1; k++) {
    if (corpo[k] !== B) continue
    if (k > 0 && corpo[k - 1] === B) { k++; continue }   // dobrada: sobrevive
    if (PERIGO.includes(corpo[k + 1])) achados.push({ index: k, trecho: B + corpo[k + 1] })
  }
  if (achados.length) {
    const onde = achados.slice(0, 4).map((m) => {
      const linha = fonte.slice(0, abre + m.index).split(String.fromCharCode(10)).length
      return 'linha ' + linha + ' (' + m.trecho + ')'
    })
    console.log('ERRO barra invertida solta na pagina — a template string come ela: ' + onde.join(', '))
    process.exitCode = 1
  } else {
    console.log('ok   nenhuma barra invertida solta na pagina')
  }
}

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
  'decodeURIComponent', 'isNaN', 'Promise', 'Error', 'Set', 'Map', 'requestAnimationFrame',
  'getComputedStyle', 'FormData', 'Blob'
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
  // a capa do cartao virou 'lamina' quando o dono desenhou a estrutura nova:
  // e uma chapa cortada nas duas pontas, nao mais um quadrado emoldurado
  ['class="lamina"', 'a capa da musica'],
  ['class="estado"', 'a barra de onde a musica esta'],
  ['class="ampulheta', 'a ampulheta da roda'],
  ['/api/baixar', 'mandar o computador baixar'],
  ['/api/tarefas', 'acompanhar o download'],
  ['/api/olhar', 'ver a musica antes de baixar'],
  ['class="bussola"', 'a bussola das tres telas'],
  ['touchend', 'deslizar de lado pra trocar de tela']
]) {
  const tem = html.includes(marca)
  if (!tem) ok = false
  console.log((tem ? 'ok   ' : 'ERRO ') + oque)
}

process.exit(ok ? 0 : 1)
