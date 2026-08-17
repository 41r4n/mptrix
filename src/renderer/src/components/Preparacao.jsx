import { useEffect, useState } from 'react'

/* ██████████ A PREPARAÇÃO ██████████
 *
 * A primeira tela de quem acabou de instalar. Ela existe porque o MPTRIX
 * instalado tem 145 MB e já faz quase tudo — mas as inteligências artificiais
 * que ele usa pesam mais de 2 GB juntas e nunca caberiam no instalador.
 *
 * O dono levou o MPTRIX pro computador do pai, foi usar, e foi interrompido no
 * meio por um pedido de instalação sem explicação. A frase dele:
 *
 *   "eu fiquei irritado quando entrei no acervo e tive que instalar uma coisa
 *    de novo, sendo que era pra instalar tudo de uma vez no instalador"
 *
 * Então: o que dá pra instalar de uma vez, se instala aqui. E o que fica pra
 * depois é DITO aqui, agora, com o tamanho na frente — porque a surpresa é
 * que irrita, não o download.
 */
export default function Preparacao({ onEntrar }) {
  const [pacotes, setPacotes] = useState(null)
  const [marcados, setMarcados] = useState(null)
  const [fazendo, setFazendo] = useState(null)
  const [andamento, setAndamento] = useState({})
  const [erros, setErros] = useState({})

  useEffect(() => {
    window.mptrix.studio.pacotes().then((lista) => {
      const l = lista || []
      setPacotes(l)
      // os recomendados já vêm marcados: quem abriu o MPTRIX quer o MPTRIX
      // inteiro, e quem não quiser desmarca em um clique
      setMarcados(new Set(l.filter((p) => !p.instalado && p.recomendado).map((p) => p.id)))
    })
  }, [])

  const virar = (id) => setMarcados((s) => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const instalarTudo = async () => {
    const fila = (pacotes || []).filter((p) => !p.instalado && marcados.has(p.id))
    const off = window.mptrix.studio.onPacoteProgresso?.((info) =>
      setAndamento((a) => ({ ...a, [info.id]: info })))
    for (const p of fila) {
      setFazendo(p.id)
      const r = await window.mptrix.studio.instalarPacote(p.id)
      if (r?.erro) setErros((e) => ({ ...e, [p.id]: r.erro }))
    }
    off?.()
    setFazendo(null)
    setAndamento({})
    setPacotes(await window.mptrix.studio.pacotes())
  }

  if (!pacotes) return null

  const faltando = pacotes.filter((p) => !p.instalado)
  const vaoFicar = pacotes.filter((p) => !p.instalado && !marcados.has(p.id))
  const tamanho = (mb) => mb >= 1000 ? (mb / 1000).toFixed(1).replace('.', ',') + ' GB' : mb + ' MB'

  return (
    <div className="prep">
      <div className="prep-in">
        <span className="prep-hex" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path fill="currentColor" d="M4.5 2H19.5L13.4 12L19.5 22H4.5L10.6 12Z" />
          </svg>
        </span>
        <span className="prep-olho">preparando o mptrix</span>
        <h1>{faltando.length ? 'Falta escolher o que instalar' : 'Tudo pronto'}</h1>

        <p className="prep-texto">
          O MPTRIX já está instalado e funciona. O que vem aqui são as
          inteligências artificiais que ele usa — elas pesam muito mais que o
          programa, então ficam de fora do instalador e você escolhe quais quer.
        </p>

        <ul className="prep-lista">
          {pacotes.map((p) => {
            const and = andamento[p.id]
            return (
              <li key={p.id} className={p.instalado ? 'feito' : ''}>
                <button
                  className="prep-marca"
                  disabled={p.instalado || !!fazendo}
                  onClick={() => virar(p.id)}
                  aria-pressed={p.instalado || marcados.has(p.id)}
                >
                  {p.instalado ? '✓' : marcados.has(p.id) ? '✓' : ''}
                </button>
                <div className="prep-item">
                  <b>{p.nome}</b>
                  <span>{p.oque}</span>
                  {and && (
                    <div className="prep-barra">
                      <div className="prep-barra-in" style={{ width: `${and.percent || 0}%` }} />
                    </div>
                  )}
                  {and && (
                    <em>{and.etapa === 'instalando'
                      ? 'abrindo o pacote'
                      : `${and.mb || 0}${and.totalMb ? ' de ' + and.totalMb : ''} MB`}</em>
                  )}
                  {erros[p.id] && <em className="prep-erro">⚠ {erros[p.id]}</em>}
                </div>
                <span className="prep-mb">{p.instalado ? 'instalado' : tamanho(p.mb)}</span>
              </li>
            )
          })}
        </ul>

        {/* O RECADO, escrito pelo dono quase com estas palavras. Ele é o que
            transforma "faltou coisa" em "isto é assim de propósito". */}
        {!fazendo && vaoFicar.length > 0 && (
          <p className="prep-aviso">
            O MPTRIX está pronto pra usar, mas ainda há pacotes que ficarão pra
            instalar enquanto você usa — seria peso demais pro seu computador
            baixar tudo de uma vez. <b>Não são obrigatórios, são recomendados.</b>{' '}
            Quando você esbarrar em algum deles, o MPTRIX explica o que é, pra
            que serve e o que muda se você não instalar.
          </p>
        )}

        <div className="prep-acoes">
          {faltando.length > 0 && marcados.size > 0 && (
            <button className="btn-primary" disabled={!!fazendo} onClick={instalarTudo}>
              {fazendo ? 'instalando…' : `instalar ${marcados.size === 1 ? 'o marcado' : 'os ' + marcados.size + ' marcados'}`}
            </button>
          )}
          <button className="btn-secondary" disabled={!!fazendo} onClick={onEntrar}>
            entrar no MPTRIX
          </button>
        </div>
      </div>
    </div>
  )
}
