// CONFERE O AVISO DE VERSAO NOVA — rodar com: npm run confere:atualizacao
//
// O app finge ter uma versao e pergunta ao GitHub DE VERDADE: mesma URL, mesmo
// latest.yml, mesma biblioteca que vai no app instalado. So NAO baixa — o
// objetivo e provar que ele ENXERGA, e puxar 141 MB pra isso seria gastar a
// internet do dono a toa.
//
// Precisa morar DENTRO do projeto: rodando de fora, o Electron nao acha o
// electron-updater em node_modules e o teste morre antes de testar nada.
//
// UMA VERSAO POR RODADA. Tentar trocar currentVersion depois de uma consulta
// quebra: a biblioteca converte o texto num objeto proprio na primeira vez, e
// o segundo texto nao tem os metodos que ela espera. Era erro do teste, nao do
// app — mas teste que quebra sozinho nao prova nada.
const { app } = require('electron')
const { autoUpdater } = require('electron-updater')
const { writeFileSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')

app.disableHardwareAcceleration()

// o mesmo arquivo que vai dentro do app instalado
const conf = join(tmpdir(), 'mptrix-app-update.yml')
writeFileSync(conf, [
  'owner: 41r4n',
  'repo: mptrix',
  'provider: github',
  'updaterCacheDirName: mptrix-updater-teste'
].join('\n'), 'utf8')

const versao = process.argv[2] || '0.3.9'
const esperado = process.argv[3] || 'tem-nova'

app.whenReady().then(async () => {
  autoUpdater.autoDownload = false
  autoUpdater.forceDevUpdateConfig = true
  autoUpdater.updateConfigPath = conf
  // TEM QUE SER O SemVer DELE, e isso custou duas tentativas:
  //   texto              -> "currentVersion.format is not a function"
  //   SemVer da raiz     -> "Must be a string. Got type object"
  // O electron-updater tem uma COPIA PROPRIA do semver dentro dele
  // (node_modules/electron-updater/node_modules/semver), e objeto de uma copia
  // nao passa no teste de identidade da outra. Duas copias da mesma biblioteca
  // e o mesmo problema de sempre: duas fontes pra mesma coisa.
  // O app de verdade nunca esbarra nisto — ele usa app.getVersion(), que ja vem
  // no formato certo. Quem precisava era o teste, que finge a versao.
  const semverDele = require(require.resolve('semver', { paths: [require.resolve('electron-updater')] }))
  autoUpdater.currentVersion = new semverDele.SemVer(versao)
  autoUpdater.logger = null

  let evento = null
  autoUpdater.on('update-available', () => { evento = 'tem-nova' })
  autoUpdater.on('update-not-available', () => { evento = 'em-dia' })

  console.log('EU SOU A VERSAO ' + versao + ' E VOU PERGUNTAR AO GITHUB DE VERDADE')
  try {
    const r = await autoUpdater.checkForUpdates()
    const arq = r && r.updateInfo && r.updateInfo.files && r.updateInfo.files[0]
    console.log('  versao publicada la :', r && r.updateInfo && r.updateInfo.version)
    console.log('  o que ele disparou  :', evento || '(nada)')
    if (evento === 'tem-nova' && arq) {
      console.log('  baixaria            :', arq.url, '(' + (arq.size / 1048576).toFixed(1) + ' MB)')
    }
    const ok = evento === esperado
    if (ok && esperado === 'tem-nova') console.log('\nok   quem esta atrasado RECEBE o aviso')
    else if (ok) console.log('\nok   quem esta em dia NAO e incomodado')
    else console.log('\nERRO esperava ' + esperado + ' e veio ' + evento)
    app.exit(ok ? 0 : 1)
  } catch (err) {
    console.log('  FALHOU:', String(err.message || err).slice(0, 200))
    app.exit(1)
  }
})
