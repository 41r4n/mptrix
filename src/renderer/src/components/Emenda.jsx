import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import EscolherMusicas from './EscolherMusicas.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import EstudioDaEmenda from './EstudioDaEmenda.jsx'
import Ico from './Icones.jsx'

/* ██████████ EMENDAR — a porta ██████████
 *
 * Uma amiga do dono perguntou se dava pra juntar duas músicas. Vai ter
 * festividade na igreja dele, e lá o pessoal pega um louvor e emenda no outro.
 *
 * ESTA ABA É SÓ A PORTA. Ela mostra as criações e o "+", e mais nada: no
 * momento em que as músicas são confirmadas, o trabalho abre em tela própria
 * (EstudioDaEmenda), do mesmo jeito que separar uma música abre o estúdio.
 *
 * Isso foi pedido do dono, e ele estava lendo o app melhor do que eu: montar um
 * medley começa, dura e termina num arquivo — é o mesmo tipo de trabalho que a
 * separação. Trabalho desse tipo pede tela própria; espremer dentro de uma aba,
 * entre o trilho e o rodapé, diz que a coisa é menor do que é.
 *
 * ── AS CRIAÇÕES ──
 *
 * O "+" começa uma edição NOVA, nunca acrescenta na de antes. Enquanto havia
 * uma fila só, o medley era rascunho que sumia ao trocar de aba; agora cada um
 * existe, tem nome, e continua existindo quando o app fecha.
 *
 * E porque existe, precisa poder ser jogado fora — com o lixo À VISTA, não
 * escondido atrás de passar o mouse. Quem monta seis medleys de festa vai
 * querer apagar quatro.
 *
 * Onde ficam guardadas: no próprio app (localStorage). É o bastante pra algo
 * que é lista de escolhas, não arquivo — o que vale de verdade é o mp3
 * exportado, que vai pra pasta do acervo.
 */
const GAVETA = 'mptrix.emendas.v1'

const lerGaveta = () => {
  try {
    const cru = JSON.parse(localStorage.getItem(GAVETA) || '[]')
    return Array.isArray(cru) ? cru : []
  } catch { return [] }
}
const gravarGaveta = (cs) => {
  try { localStorage.setItem(GAVETA, JSON.stringify(cs)) } catch { /* gaveta cheia */ }
}

const quando = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

export default function Emenda({ history }) {
  const [criacoes, setCriacoes] = useState(lerGaveta)
  const [abertaId, setAbertaId] = useState(null)
  const [escolhendo, setEscolhendo] = useState(false)
  const [praJogarFora, setPraJogarFora] = useState(null)
  const [analises, setAnalises] = useState({})

  useEffect(() => { gravarGaveta(criacoes) }, [criacoes])

  const aberta = criacoes.find((c) => c.id === abertaId) || null

  // o tom e o BPM já foram descobertos quando a música entrou no acervo. Não
  // servem pra mexer em nada — servem pra pessoa reconhecer a música.
  useEffect(() => {
    let vivo = true
    const alvos = [...new Set(criacoes.flatMap((c) => c.musicas.map((m) => m.arquivo)))]
      .filter((a) => !analises[a])
    if (!alvos.length) return
    Promise.all(alvos.map((a) => window.mptrix.emenda.analiseDe({ path: a }).catch(() => null)))
      .then((rs) => {
        if (!vivo) return
        const m = {}
        alvos.forEach((a, i) => { if (rs[i]) m[a] = rs[i] })
        setAnalises((x) => ({ ...x, ...m }))
      })
    return () => { vivo = false }
  }, [criacoes]) // eslint-disable-line react-hooks/exhaustive-deps

  const nomeNovo = () => {
    let k = criacoes.length + 1
    let nome = `Medley ${k}`
    while (criacoes.some((c) => c.nome === nome)) nome = `Medley ${++k}`
    return nome
  }

  // CONFIRMAR AS MÚSICAS ABRE O ESTÚDIO. Não há tela no meio: a criação nasce
  // já aberta, em tela cheia, como acontece ao separar uma música.
  const receberMusicas = (hs) => {
    const nova = {
      id: 'c' + Date.now(),
      nome: nomeNovo(),
      criadaEm: Date.now(),
      musicas: hs.map((h, k) => ({
        id: h.id + ':' + k + ':' + Date.now(),
        nome: h.customName || h.displayName || h.title || 'música',
        arquivo: h.primaryFile
      }))
    }
    setCriacoes((cs) => [nova, ...cs])
    setEscolhendo(false)
    setAbertaId(nova.id)
  }

  const jogarFora = (id) => {
    setCriacoes((cs) => cs.filter((c) => c.id !== id))
    if (abertaId === id) setAbertaId(null)
    setPraJogarFora(null)
  }

  return (
    <div className="palco-in">
      <p className="palco-olho">04 / EMENDAR</p>
      <h1 className="palco-titulo">Juntar<br />músicas</h1>
      <p className="palco-linha">
        Cada medley é uma criação sua. O <b>+</b> começa uma nova — e o que você
        não quiser mais, joga fora no lixo.
      </p>

      <div className="em-palco">
        <div className="em-lado em-fila-lado">
          <button className="em-comecar" onClick={() => setEscolhendo(true)}>
            <span className="em-mais" aria-hidden="true">+</span>
            <b>Nova edição</b>
            <span>escolha as músicas e o estúdio abre</span>
          </button>

          {criacoes.length > 0 && (
            <>
              <span className="em-rot">suas criações</span>
              <ul className="jm-criacoes">
                {criacoes.map((c) => (
                  <li key={c.id}>
                    <button className="jm-abrir" onClick={() => setAbertaId(c.id)}>
                      <b>{c.nome}</b>
                      <span>
                        {c.musicas.length} {c.musicas.length === 1 ? 'música' : 'músicas'}
                        {' · '}{quando(c.criadaEm)}
                      </span>
                    </button>
                    {/* O LIXO FICA À VISTA, sempre — não só quando o mouse
                        passa por cima. Caçar o botão de apagar é o atrito que
                        faz a pessoa parar de usar. */}
                    <button className="jm-lixo" onClick={() => setPraJogarFora(c)}
                      title={`jogar fora ${c.nome}`} aria-label={`jogar fora ${c.nome}`}>
                      <Ico nome="lixeira" tamanho={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {escolhendo && (
        <EscolherMusicas
          history={history}
          jaNaFila={0}
          onFechar={() => setEscolhendo(false)}
          onConfirmar={receberMusicas}
        />
      )}

      {/* O ESTÚDIO, EM TELA CHEIA POR CIMA DE TUDO — e por um portal, direto no
          corpo da página.
          `position: fixed` promete "em relação à janela", mas essa promessa
          quebra quando QUALQUER ancestral tem transform, filter ou perspective:
          o elemento passa a se medir por esse ancestral. A aba EMENDAR vive
          dentro do palco, que tem transform — então o estúdio nascia preso ao
          tamanho do conteúdo da aba, com o trilho aparecendo do lado.
          O portal tira ele da árvore da aba sem tirar do componente que é dono
          do estado, que é o melhor dos dois. É também onde o estúdio de
          separação já mora: no topo, ao lado do App. */}
      {aberta && createPortal(
        <EstudioDaEmenda
          criacao={aberta}
          history={history}
          analises={analises}
          onMudar={(c) => setCriacoes((cs) => cs.map((x) => (x.id === c.id ? c : x)))}
          onJogarFora={jogarFora}
          onFechar={() => setAbertaId(null)}
        />,
        document.body
      )}

      {/* jogar fora é irreversível: pergunta uma vez, e diz o que vai embora */}
      <ConfirmDialog
        open={!!praJogarFora}
        danger
        title={`Jogar fora "${praJogarFora?.nome}"?`}
        message="A criação sai da lista. As músicas do seu acervo e os arquivos já exportados continuam onde estão."
        list={praJogarFora?.musicas.map((m) => m.nome)}
        confirmLabel="Jogar fora"
        cancelLabel="Cancelar"
        onConfirm={() => jogarFora(praJogarFora.id)}
        onCancel={() => setPraJogarFora(null)}
      />
    </div>
  )
}
