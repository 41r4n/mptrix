import { useEffect, useState } from 'react'
import Ico from './Icones.jsx'

function formatBytes(b) {
  if (!b) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let v = b, i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return v.toFixed(v >= 10 || i < 2 ? 0 : 1) + ' ' + u[i]
}

const dia = (ms) =>
  new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// "há 15 dias" responde a pergunta que a data crua não responde: isto é velho?
function faz(ms) {
  const d = Math.floor((Date.now() - ms) / 86400000)
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  const m = Math.floor(d / 30)
  return m === 1 ? 'há 1 mês' : `há ${m} meses`
}

export default function ShareApp() {
  const [installer, setInstaller] = useState(null)
  const [zipping, setZipping] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    window.mptrix.app.findInstaller().then(setInstaller)
  }, [])

  if (!installer) return null

  // O CÓDIGO ANDOU DEPOIS DESTE INSTALADOR? Só dá pra saber rodando do fonte;
  // no app empacotado a pasta src não existe e a tela fica calada, porque
  // palpite sobre atualidade é pior do que silêncio.
  const velho = installer.codigoEm && installer.feitoEm && installer.codigoEm > installer.feitoEm
  const diasAtras = velho ? Math.round((installer.codigoEm - installer.feitoEm) / 86400000) : 0

  const copyToClipboard = async () => {
    const r = await window.mptrix.shell.copyFilesToClipboard([installer.path])
    if (r?.error) setStatus({ kind: 'error', text: r.error })
    else setStatus({ kind: 'ok', text: 'Instalador copiado! Cola onde quiser com Ctrl+V (WhatsApp Web, Discord, email…)' })
    setTimeout(() => setStatus(null), 5000)
  }

  const showInExplorer = () => window.mptrix.shell.showInFolder(installer.path)

  const openInstaller = () => window.mptrix.shell.openPath(installer.path)

  const zipIt = async () => {
    setZipping(true)
    setStatus(null)
    const r = await window.mptrix.shell.zipFile(installer.path)
    setZipping(false)
    if (r?.error) {
      setStatus({ kind: 'error', text: 'Erro ao compactar: ' + r.error })
    } else {
      setStatus({ kind: 'ok', text: `ZIP criado (${formatBytes(r.size)}). Mostrando no Explorer…` })
      window.mptrix.shell.showInFolder(r.zipPath)
    }
    setTimeout(() => setStatus(null), 5000)
  }

  const openDrive = async () => {
    setStatus(null)
    const r = await window.mptrix.shell.copyFilesToClipboard([installer.path])
    if (r?.error) {
      setStatus({ kind: 'error', text: 'Erro ao copiar o arquivo: ' + r.error })
      setTimeout(() => setStatus(null), 5000)
      return
    }
    window.mptrix.shell.openExternal('https://drive.google.com/drive/my-drive')
    setStatus({
      kind: 'ok',
      text: 'Drive aberto! Entra em qualquer pasta e aperta Ctrl+V pra colar o instalador. Vai subir como anexo.'
    })
    setTimeout(() => setStatus(null), 8000)
  }

  const acoes = [
    { id: 'copiar', ico: 'copiar', titulo: 'Copiar arquivo', txt: 'Cola em WhatsApp Web, Discord, email… com Ctrl+V', ir: copyToClipboard },
    { id: 'pasta', ico: 'pasta', titulo: 'Mostrar no Explorer', txt: 'Abre a pasta com o instalador selecionado', ir: showInExplorer },
    { id: 'zip', ico: 'caixa', titulo: zipping ? 'Compactando…' : 'Compactar em ZIP', txt: 'Cria um .zip ao lado, pra subir onde .exe é barrado', ir: zipIt, ocupado: zipping },
    { id: 'drive', ico: 'sair', titulo: 'Copiar + abrir Drive', txt: 'Copia o instalador e abre o Drive. Cola com Ctrl+V em qualquer pasta.', ir: openDrive },
    { id: 'rodar', ico: 'tocar', titulo: 'Executar instalador', txt: 'Testa você mesmo antes de mandar', ir: openInstaller }
  ]

  return (
    <section className="share-app">
      <div className="share-cab">
        <span className="share-olho">compartilhar</span>
        <h3>Mandar o MPTRIX pra alguém</h3>
      </div>

      {/* O ARQUIVO COMO LEITURA DE PAINEL, não como frase. Nome, tamanho e data
          são três fatos diferentes sobre a mesma coisa — em linha corrida a
          data desaparecia no meio, e a data é justamente o que decide se vale
          mandar. Sem borda em volta: isto não clica. */}
      <div className="share-arquivo">
        <span className="share-arq-nome">{installer.name}</span>
        <span className="share-arq-fio" aria-hidden="true" />
        <span className="share-arq-dado"><i>tamanho</i><b>{formatBytes(installer.size)}</b></span>
        <span className="share-arq-fio" aria-hidden="true" />
        <span className="share-arq-dado"><i>feito em</i><b>{installer.feitoEm ? dia(installer.feitoEm) : '—'}</b></span>
        {installer.feitoEm && (
          <span className={`share-idade ${velho ? 'velho' : ''}`}>{faz(installer.feitoEm)}</span>
        )}
      </div>

      {/* O AVISO DE INSTALADOR VELHO.
          Ele não impede nada — o dono pode ter motivo pra mandar essa versão.
          Mas mandar sem saber que ela está 15 dias atrás do app é o programa
          mentindo pela boca dele: quem recebe vai achar que tem o MPTRIX, e
          tem o MPTRIX de duas semanas atrás. */}
      {velho && (
        <p className="share-aviso">
          <Ico nome="aviso" tamanho={14} />
          <span>
            <strong>Este instalador está {diasAtras} dias atrás do app.</strong> Tudo que
            você mexeu depois de {dia(installer.feitoEm)} não está nele — quem receber vai
            instalar a versão antiga. Pra mandar o de agora, gere um novo com{' '}
            <em>npm run build:win</em>.
          </span>
        </p>
      )}

      <div className="share-grade">
        {acoes.map((a) => (
          <button key={a.id} className="share-tile" onClick={a.ir} disabled={a.ocupado}>
            <span className="share-tile-ico"><Ico nome={a.ico} tamanho={18} /></span>
            <span className="share-tile-titulo">{a.titulo}</span>
            <span className="share-tile-txt">{a.txt}</span>
          </button>
        ))}
      </div>

      {status && (
        <div className={`share-status share-status-${status.kind}`}>{status.text}</div>
      )}
    </section>
  )
}
