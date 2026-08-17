import { useEffect, useState } from 'react'

/* ██████████ O PEDIDO DE INSTALAÇÃO ██████████
 *
 * O dono instalou o MPTRIX no computador do pai, entrou no acervo e foi
 * interrompido por um pedido de instalação sem explicação. Ele ficou irritado,
 * e a irritação estava certa: um pedido que não diz o que é nem por quê é um
 * pedágio, não uma escolha.
 *
 * A regra que ele deu, e que este componente cumpre — sempre as quatro:
 *
 *   1. O QUE É aquilo
 *   2. PRA QUE serve
 *   3. O QUE ACONTECE se não instalar
 *   4. Que a mensagem VAI VOLTAR num momento parecido
 *
 * O item 4 é o menos óbvio e o mais importante: sem ele, "agora não" parece
 * "nunca mais", e a pessoa decide com medo de perder a chance. Sabendo que
 * volta, ela decide com calma — e "agora não" vira uma resposta legítima em
 * vez de uma desistência.
 *
 * Ele NÃO tem botão de fechar no canto. As duas saídas são explícitas —
 * instalar ou agora não — porque um X no canto deixa a pessoa sair sem saber
 * o que acabou de recusar.
 */
export default function PedidoDePacote({ id, onPronto, onAgoraNao }) {
  const [pac, setPac] = useState(null)
  const [andamento, setAndamento] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let vivo = true
    window.mptrix.studio.pacotes().then((lista) => {
      if (!vivo) return
      setPac((lista || []).find((p) => p.id === id) || null)
    })
    return () => { vivo = false }
  }, [id])

  const instalar = async () => {
    setErro(null)
    setAndamento({ etapa: 'baixando', percent: 0, mb: 0 })
    const off = window.mptrix.studio.onPacoteProgresso?.((info) => {
      if (info.id === id) setAndamento(info)
    })
    const r = await window.mptrix.studio.instalarPacote(id)
    off?.()
    setAndamento(null)
    if (r?.erro) { setErro(r.erro); return }
    onPronto?.()
  }

  if (!pac) return null

  return (
    <div className="pacote-fundo">
      <div className="pacote-caixa">
        <span className="pacote-olho">pacote de instalação</span>
        <h3>{pac.nome}</h3>

        {/* 1. o que é */}
        <p className="pacote-oque">{pac.oque}</p>

        {/* 2. pra que serve */}
        <div className="pacote-linha">
          <span className="pacote-rot">pra que serve</span>
          <p>{pac.porque}</p>
        </div>

        {/* 3. o que acontece se não instalar — a parte que faltava em todo
              pedido de instalação que eu já vi */}
        <div className="pacote-linha">
          <span className="pacote-rot">se você não instalar</span>
          <p>{pac.sem}</p>
        </div>

        <div className="pacote-peso">
          <b>{pac.mb >= 1000 ? (pac.mb / 1000).toFixed(1).replace('.', ',') + ' GB' : pac.mb + ' MB'}</b>
          <span>baixado uma vez · fica guardado no computador</span>
        </div>

        {andamento && (
          <>
            <div className="pacote-barra">
              <div className="pacote-barra-in" style={{ width: `${andamento.percent || 0}%` }} />
            </div>
            <p className="pacote-passo">
              {andamento.etapa === 'instalando'
                ? 'abrindo o pacote — não feche o MPTRIX'
                : `${andamento.mb || 0}${andamento.totalMb ? ' de ' + andamento.totalMb : ''} MB · pode deixar rodando e usar o computador`}
            </p>
          </>
        )}

        {erro && <p className="pacote-erro">⚠ {erro}</p>}

        {!andamento && (
          <div className="pacote-acoes">
            <button className="btn-primary" onClick={instalar}>
              {erro ? 'tentar de novo' : 'instalar agora'}
            </button>
            <button className="btn-secondary" onClick={onAgoraNao}>agora não</button>
          </div>
        )}

        {/* 4. a mensagem volta — sem isto, "agora não" parece "nunca mais" */}
        <p className="pacote-volta">
          Escolhendo <b>agora não</b>, o MPTRIX segue funcionando sem isto. Este
          aviso volta na próxima vez que você fizer algo que precise dele.
        </p>
      </div>
    </div>
  )
}
