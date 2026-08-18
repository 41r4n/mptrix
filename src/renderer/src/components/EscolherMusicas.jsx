import { useEffect, useState } from 'react'

/* ██████████ ESCOLHER MÚSICAS PRA EMENDA ██████████
 *
 * A primeira versão desta escolha era uma coluna de texto ao lado da fila. O
 * dono olhou e pediu outra coisa: começar com um "+" grande, e ao clicar abrir
 * uma tela igual à do acervo — com as capas, o tom e o BPM — pra marcar várias
 * e confirmar de uma vez.
 *
 * Ele tem razão por um motivo que não é estética: quem vai montar um medley
 * está ESCOLHENDO REPERTÓRIO, e repertório se reconhece pela capa e pelo tom,
 * não por uma linha de texto cortada no meio. A lista de texto obrigava a ler;
 * esta deixa reconhecer.
 *
 * Marcar VÁRIAS antes de confirmar também é dele, e também é certo: montar um
 * medley é um pensamento só ("estas quatro"), não quatro decisões separadas.
 */
export default function EscolherMusicas({ history, jaNaFila, onConfirmar, onFechar }) {
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState([])
  const [capas, setCapas] = useState({})
  const [analises, setAnalises] = useState({})

  const lista = (history || [])
    .filter((h) => h.primaryFile)
    .filter((h) => !busca || (h.customName || h.displayName || h.title || '')
      .toLowerCase().includes(busca.toLowerCase()))

  // capa e análise vêm em fila, algumas de cada vez: pedir as 102 de uma vez
  // trava a tela por segundos, e a pessoa vê uma janela congelada ao abrir
  useEffect(() => {
    let vivo = true
    const alvos = lista.slice(0, 80).map((h) => h.primaryFile)
    ;(async () => {
      for (const f of alvos) {
        if (!vivo) return
        if (!capas[f]) {
          const url = await window.mptrix.history.capa(f).catch(() => null)
          if (vivo && url) setCapas((c) => ({ ...c, [f]: url }))
        }
        if (!analises[f]) {
          const an = await window.mptrix.emenda.analiseDe({ path: f }).catch(() => null)
          if (vivo && an) setAnalises((a) => ({ ...a, [f]: an }))
        }
      }
    })()
    return () => { vivo = false }
  }, [busca]) // eslint-disable-line react-hooks/exhaustive-deps

  // AQUI SÓ SE ESCOLHE QUAIS. Clicar marca, clicar de novo desmarca.
  //
  // Duas vezes eu errei nesta função. Primeiro fiz o clique SOMAR, pra que a
  // mesma música pudesse entrar duas vezes no medley — o dono clicou tentando
  // desmarcar e chegou a 16 cópias. Depois pus um controle "− 1× +" no canto da
  // capa, e ele perguntou o que aquilo significava. Controle que precisa ser
  // explicado é controle errado.
  //
  // O problema não era o desenho do controle, era o LUGAR: escolhendo, a pessoa
  // pensa "quais músicas". Repetir é decisão de ORDEM, e ordem se decide na
  // fila, depois — lá "repetir" quer dizer alguma coisa, porque já existe uma
  // sequência na frente dos olhos.
  const marcada = (id) => marcadas.includes(id)
  const virar = (id) => setMarcadas((m) =>
    m.includes(id) ? m.filter((x) => x !== id) : [...m, id])

  const confirmar = () => {
    const porId = new Map((history || []).map((h) => [h.id, h]))
    onConfirmar(marcadas.map((id) => porId.get(id)).filter(Boolean))
  }

  return (
    <div className="esc-fundo" onClick={onFechar}>
      <div className="esc-caixa" onClick={(e) => e.stopPropagation()}>
        <div className="esc-topo">
          <div>
            <span className="esc-olho">do seu acervo</span>
            <h3>Escolha as músicas do medley</h3>
          </div>
          <input
            className="esc-busca"
            placeholder="procurar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
          />
        </div>

        <ul className="esc-grade">
          {lista.map((h) => {
            const escolhida = marcada(h.id)
            const an = analises[h.primaryFile]
            return (
              <li key={h.id} className={escolhida ? 'marcada' : ''}>
                <button
                  className="esc-card"
                  onClick={() => virar(h.id)}
                  aria-pressed={escolhida}
                >
                  <span className="esc-capa">
                    {capas[h.primaryFile]
                      ? <img src={capas[h.primaryFile]} alt="" loading="lazy" />
                      : <span className="esc-semcapa" />}
                    {escolhida && <span className="esc-visto">✓</span>}
                  </span>
                  <span className="esc-nome">{h.customName || h.displayName || h.title}</span>
                  {/* LEITURA DE PAINEL, não texto solto: rótulo em caixa-alta
                      por cima, número mono embaixo, separados por fios finos.
                      Sem caixa em volta — nesta casa borda em volta de texto
                      quer dizer "clica", e isto não clica. */}
                  {an?.tom || an?.bpm ? (
                    <span className="esc-hud">
                      <span className="esc-cel">
                        <i>tom</i>
                        <b>{an?.tom || '—'}</b>
                      </span>
                      <span className="esc-cel">
                        <i>bpm</i>
                        <b>{an?.bpm || '—'}</b>
                      </span>
                    </span>
                  ) : (
                    <span className="esc-hud esc-hud-sem">
                      <span className="esc-cel"><i>ainda não ouvida</i></span>
                    </span>
                  )}
                </button>

              </li>
            )
          })}
          {!lista.length && <li className="esc-vazio">nada encontrado</li>}
        </ul>

        <div className="esc-pe">
          <span className="esc-conta-pe">
            {marcadas.length === 0 ? 'nenhuma marcada'
              : marcadas.length === 1 ? '1 marcada · precisa de pelo menos 2'
                : `${marcadas.length} marcadas, nesta ordem`}
          </span>
          <div className="esc-acoes">
            <button className="btn-secondary" onClick={onFechar}>cancelar</button>
            <button className="btn-primary" disabled={marcadas.length + jaNaFila < 2} onClick={confirmar}>
              confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
