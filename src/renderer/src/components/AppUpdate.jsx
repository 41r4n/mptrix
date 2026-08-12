import { useEffect, useState } from 'react'
import Ico from './Icones.jsx'

function tamanho(b) {
  if (!b) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let v = b, i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 || i < 2 ? 0 : 1)} ${u[i]}`
}

// ██████████ O MPTRIX SE ATUALIZANDO ██████████
//
// O dono não tem lista de quem instalou o app, e não vai ter: ele é offline por
// escolha e não manda nada pra lugar nenhum. Então o recado não vai dele pras
// pessoas — o app de cada pessoa é que olha e avisa.
//
// Esta peça tem UMA regra: nada acontece sem clique além de olhar. Baixar é
// botão, instalar é botão. Um app que se troca sozinho no meio de uma separação
// estraga o trabalho de alguém pra ficar em dia.
export default function AppUpdate() {
  const [e, setE] = useState(null)

  useEffect(() => {
    let vivo = true
    window.mptrix.app.atualizacao.estado().then((v) => { if (vivo) setE(v) })
    const off = window.mptrix.app.atualizacao.onEstado((v) => { if (vivo) setE(v) })
    return () => { vivo = false; off() }
  }, [])

  if (!e) return null

  const procurar = () => window.mptrix.app.atualizacao.procurar()
  const baixar = () => window.mptrix.app.atualizacao.baixar()
  const instalar = () => window.mptrix.app.atualizacao.instalar()

  // RODANDO DO CÓDIGO ele fica de fora e DIZ que está de fora. Sem isso, a tela
  // mostraria "não consegui verificar" e o dono caçaria um defeito que não
  // existe — só não dá pra trocar um app que não foi instalado.
  if (e.fase === 'so-instalado') {
    return (
      <div className="appup appup-fora">
        <span className="appup-versao">MPTRIX <b>{e.versaoInstalada}</b></span>
        <span className="appup-nota">rodando do código — atualização só no app instalado</span>
      </div>
    )
  }

  const baixando = e.fase === 'baixando'
  const pct = Math.round(e.progresso?.porcento || 0)

  return (
    <div className={`appup fase-${e.fase}`}>
      <span className="appup-luz" aria-hidden="true" />
      <span className="appup-versao">MPTRIX <b>{e.versaoInstalada}</b></span>

      <span className="appup-txt">
        {e.fase === 'procurando' && 'procurando versão nova…'}
        {e.fase === 'em-dia' && 'está na versão mais nova'}
        {e.fase === 'tem-nova' && <>saiu a versão <b>{e.versaoNova}</b></>}
        {e.fase === 'baixando' && (
          e.progresso?.total
            ? <>baixando · {tamanho(e.progresso.recebido)} de {tamanho(e.progresso.total)}</>
            : 'baixando…'
        )}
        {e.fase === 'baixada' && <>versão <b>{e.versaoNova}</b> pronta pra instalar</>}
        {e.fase === 'erro' && e.erro}
        {e.fase === 'parado' && 'ainda não verifiquei'}
      </span>

      {baixando && e.progresso?.total > 0 && (
        <span className="appup-barra"><i style={{ width: `${pct}%` }} /></span>
      )}

      <span className="appup-espaco" />

      {/* O BOTÃO MUDA COM A SITUAÇÃO em vez de virar três botões enfileirados:
          em cada momento só existe uma coisa sensata a fazer. */}
      {e.fase === 'tem-nova' && (
        <button className="appup-ir" onClick={baixar}>
          <Ico nome="baixar" tamanho={14} /> baixar agora
        </button>
      )}
      {e.fase === 'baixada' && (
        <button className="appup-ir forte" onClick={instalar}>
          <Ico nome="certo" tamanho={14} /> instalar e reabrir
        </button>
      )}
      {(e.fase === 'em-dia' || e.fase === 'erro' || e.fase === 'parado') && (
        <button className="appup-link" onClick={procurar}>verificar de novo</button>
      )}
      {e.fase === 'procurando' && <span className="appup-link mudo">verificando…</span>}
      {baixando && <span className="appup-link mudo">{pct}%</span>}
    </div>
  )
}
