// CONFERE ONDE MORA O MOTOR — rodar com: npm run confere:motor
//
// O yt-dlp e o que baixa as musicas, e o YouTube muda o tempo todo. Se ele
// congelar na versao do dia da instalacao, em alguns meses o app para de
// baixar — e quem recebeu o app de presente nao vai nem saber por que.
//
// Ele so consegue se atualizar se morar em pasta gravavel. Isto aqui mede as
// tres decisoes com pastas de verdade, porque "eu acho que copia" e o tipo de
// certeza que so quebra no computador dos outros.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath, pathToFileURL } from 'url'

// binpath.js ja e ESM, mas os arquivos de src/main sao .js num projeto sem
// "type": "module" — o Node os le como CommonJS e recusa o import nomeado.
// Quem resolve isso normalmente e o empacotador; aqui, uma copia com extensao
// .mjs basta, e sem transpilar nada: o codigo testado e byte a byte o mesmo que
// vai pro app.
const aqui = dirname(fileURLToPath(import.meta.url))
const copia = join(mkdtempSync(join(tmpdir(), 'mptrix-bin-')), 'binpath.mjs')
copyFileSync(join(aqui, '..', 'src', 'main', 'binpath.js'), copia)
const { resolverYtDlp } = await import(pathToFileURL(copia).href)

const casos = []
const caso = (nome, f) => casos.push([nome, f])
const novaPasta = () => mkdtempSync(join(tmpdir(), 'mptrix-motor-'))

caso('rodando do codigo: usa a pasta do projeto, sem copiar nada', () => {
  const base = novaPasta()
  const pacote = join(base, 'resources', 'bin')
  mkdirSync(pacote, { recursive: true })
  writeFileSync(join(pacote, 'yt-dlp.exe'), 'do pacote')
  const dados = join(base, 'dados')

  const r = resolverYtDlp({ noPacote: join(pacote, 'yt-dlp.exe'), pastaDeDados: dados, empacotado: false })
  return [
    [r.motivo === 'fonte', 'motivo=' + r.motivo],
    [!existsSync(join(dados, 'bin')), 'nao criou pasta de dados a toa']
  ]
})

caso('instalado, primeira vez: copia pra pasta gravavel', () => {
  const base = novaPasta()
  const pacote = join(base, 'programa', 'resources', 'bin')
  mkdirSync(pacote, { recursive: true })
  writeFileSync(join(pacote, 'yt-dlp.exe'), 'versao do instalador')
  const dados = join(base, 'dados')

  const r = resolverYtDlp({ noPacote: join(pacote, 'yt-dlp.exe'), pastaDeDados: dados, empacotado: true })
  return [
    [r.motivo === 'copiei', 'motivo=' + r.motivo],
    [r.caminho === join(dados, 'bin', 'yt-dlp.exe'), 'foi pra pasta de dados'],
    [readFileSync(r.caminho, 'utf8') === 'versao do instalador', 'copia tem o mesmo conteudo']
  ]
})

caso('segunda vez: usa a que ja esta la, sem copiar por cima', () => {
  const base = novaPasta()
  const pacote = join(base, 'programa', 'resources', 'bin')
  mkdirSync(pacote, { recursive: true })
  writeFileSync(join(pacote, 'yt-dlp.exe'), 'versao do instalador')
  const dados = join(base, 'dados')
  mkdirSync(join(dados, 'bin'), { recursive: true })
  // esta e a copia que o botao "Atualizar" ja deixou mais nova
  writeFileSync(join(dados, 'bin', 'yt-dlp.exe'), 'versao NOVA baixada do github')

  const r = resolverYtDlp({ noPacote: join(pacote, 'yt-dlp.exe'), pastaDeDados: dados, empacotado: true })
  return [
    [r.motivo === 'ja-estava', 'motivo=' + r.motivo],
    [readFileSync(r.caminho, 'utf8') === 'versao NOVA baixada do github',
      'NAO rebaixou pra versao do instalador']
  ]
})

caso('a pasta gravavel e o alvo do atualizador (da pra escrever nela)', () => {
  const base = novaPasta()
  const pacote = join(base, 'programa', 'resources', 'bin')
  mkdirSync(pacote, { recursive: true })
  writeFileSync(join(pacote, 'yt-dlp.exe'), 'do pacote')
  const dados = join(base, 'dados')

  const r = resolverYtDlp({ noPacote: join(pacote, 'yt-dlp.exe'), pastaDeDados: dados, empacotado: true })
  let escreveu = false
  try {
    // e isto que o botao "Atualizar" faz: trocar o arquivo no lugar
    writeFileSync(r.caminho, 'versao recem baixada')
    escreveu = readFileSync(r.caminho, 'utf8') === 'versao recem baixada'
  } catch { escreveu = false }
  return [[escreveu, 'o atualizador consegue trocar o arquivo']]
})

caso('sem yt-dlp no pacote: devolve o caminho do pacote, nao inventa', () => {
  const base = novaPasta()
  const pacote = join(base, 'programa', 'resources', 'bin')
  mkdirSync(pacote, { recursive: true })
  const dados = join(base, 'dados')

  const r = resolverYtDlp({ noPacote: join(pacote, 'yt-dlp.exe'), pastaDeDados: dados, empacotado: true })
  return [
    [r.motivo === 'sem-origem', 'motivo=' + r.motivo],
    [r.caminho === join(pacote, 'yt-dlp.exe'), 'o erro que aparece fala da pasta que a pessoa conhece']
  ]
})

caso('pasta de dados impossivel: cai pro pacote em vez de quebrar', () => {
  const base = novaPasta()
  const pacote = join(base, 'programa', 'resources', 'bin')
  mkdirSync(pacote, { recursive: true })
  writeFileSync(join(pacote, 'yt-dlp.exe'), 'do pacote')
  // um ARQUIVO onde deveria haver pasta: mkdir vai falhar
  const dados = join(base, 'dados')
  writeFileSync(dados, 'nao sou pasta')

  const r = resolverYtDlp({ noPacote: join(pacote, 'yt-dlp.exe'), pastaDeDados: dados, empacotado: true })
  return [
    [r.motivo === 'falhou', 'motivo=' + r.motivo],
    [r.caminho === join(pacote, 'yt-dlp.exe'), 'o app continua baixando musica'],
    [!!r.erro, 'guardou o erro pra registrar']
  ]
})

let tudo = true
console.log('ONDE MORA O MOTOR QUE BAIXA AS MUSICAS\n')
for (const [nome, f] of casos) {
  let checks
  try { checks = f() } catch (e) { checks = [[false, 'explodiu: ' + e.message]] }
  const passou = checks.every(([ok]) => ok)
  if (!passou) tudo = false
  console.log((passou ? 'ok   ' : 'ERRO ') + nome)
  for (const [ok, txt] of checks) console.log('       ' + (ok ? '·' : '✗') + ' ' + txt)
}
console.log()
process.exit(tudo ? 0 : 1)
