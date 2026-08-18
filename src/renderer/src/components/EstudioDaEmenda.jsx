import { useEffect, useState } from 'react'
import EscolherMusicas from './EscolherMusicas.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import Ico from './Icones.jsx'
import FaixasDaEmenda from './FaixasDaEmenda.jsx'

/* ██████████ O ESTÚDIO DA EMENDA ██████████
 *
 * Pedido do dono, com estas palavras: no momento em que ele confirma as
 * músicas, era pra ir direto pro estúdio — uma aba separada de tudo, igual
 * acontece com o separador. A tela do meio, que listava as músicas dentro da
 * aba EMENDAR, não devia nem existir.
 *
 * Ele está certo, e o motivo é do app inteiro, não desta tela: o MPTRIX já tem
 * essa gramática. Separar uma música tira você de tudo e te põe numa tela que
 * só faz aquilo, com a marca no canto e um botão de voltar. Montar um medley é
 * o mesmo tipo de trabalho — começa, dura, termina num arquivo — e trabalho
 * desse tipo pede tela própria. Fazer isso dentro de uma aba, espremido entre o
 * trilho e o rodapé, é dizer que a coisa é menor do que é.
 *
 * Por isso este arquivo veste `studio-overlay`, `studio-header`, `brand-hex` e
 * `topbar-icon-btn` — as mesmas peças do estúdio de separação. Não é economia
 * de CSS: é as duas telas se reconhecerem como o mesmo aplicativo.
 *
 * O QUE ELE FAZ POR DENTRO ainda é o que o dono pediu antes: nenhuma edição.
 * As músicas entram inteiras, na ordem, e saem num arquivo só.
 */
export default function EstudioDaEmenda({ criacao, history, analises, onMudar, onJogarFora, onFechar }) {
  // DUAS FASES, e a diferenca entre elas foi a bronca do dono: 'escolha' e onde
  // se decide QUAIS musicas e em que ordem; 'faixas' e o estudio de verdade,
  // onde elas aparecem desenhadas. Antes nao havia a segunda: o botao "juntar"
  // gerava o mp3 na hora, sem a pessoa ter mexido em nada.
  const [fase, setFase] = useState('escolha')
  const [escolhendo, setEscolhendo] = useState(false)
  const [confirmandoLixo, setConfirmandoLixo] = useState(false)
  const [fazendo, setFazendo] = useState(false)
  const [pct, setPct] = useState(0)
  const [feito, setFeito] = useState(null)
  const [erro, setErro] = useState(null)

  // Esc volta, como em qualquer tela que toma a tela inteira. Sem isso a
  // pessoa fica presa procurando o botão quando ela só queria sair.
  useEffect(() => {
    const t = (e) => {
      if (e.key !== 'Escape') return
      if (escolhendo || confirmandoLixo || fazendo) return
      if (fase === 'faixas') { setFase('escolha'); return }
      onFechar()
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [escolhendo, confirmandoLixo, fazendo, fase, onFechar])

  const musicas = criacao.musicas
  const iniciais = (criacao.nome || 'MP').split(/\s+/).slice(0, 2)
    .map((w) => (w[0] || '').toUpperCase()).join('')

  const mover = (i, d) => {
    const j = i + d
    if (j < 0 || j >= musicas.length) return
    const n = [...musicas]
    ;[n[i], n[j]] = [n[j], n[i]]
    onMudar({ ...criacao, musicas: n })
  }
  const tirar = (mid) => onMudar({ ...criacao, musicas: musicas.filter((m) => m.id !== mid) })

  const receber = (hs) => {
    setEscolhendo(false)
    onMudar({
      ...criacao,
      musicas: [...musicas, ...hs.map((h, k) => ({
        id: h.id + ':' + k + ':' + Date.now(),
        nome: h.customName || h.displayName || h.title || 'música',
        arquivo: h.primaryFile
      }))]
    })
  }

  const juntar = async () => {
    setErro(null); setFeito(null); setPct(0); setFazendo(true)
    const off = window.mptrix.emenda.onProgresso((i) => setPct(i.percent || 0))
    const r = await window.mptrix.emenda.fazer({
      // MÚSICA INTEIRA, SEMPRE — e 1 segundo de passagem em cada emenda, que é
      // o que faz uma acabar dentro da outra em vez de estancar. Sem controle
      // na tela, de propósito: controle é edição.
      // `entra` e a hora em que a peca entra no medley — e o que faz uma ficar
      // do lado, por cima ou longe da outra. Sem ela, o motor voltaria a
      // empilhar tudo em zero e as musicas sairiam todas tocando juntas.
      // MUDO E ISOLAR VALEM NO ARQUIVO. Calar uma linha e ela reaparecer no
      // mp3 seria a pior traição possível: a pessoa ouviu uma coisa e recebeu
      // outra. A regra é a mesma da tela — isolar ganha de mudo.
      pecas: musicas.filter((m) => {
        const ps = criacao.pistas || []
        const isolado = ps.some((x) => x && x.solo)
        const info = ps[Number(m.lane) || 0] || {}
        return isolado ? !!info.solo : !info.mudo
      }).map((m) => ({
        arquivo: m.arquivo,
        // o RECORTE da peça, que agora existe: sem isto o motor tocaria a
        // gravação inteira e o que foi apagado ou encolhido na tela voltaria
        inicio: Number(m.ini) || 0,
        fim: Number(m.fim) || 0,
        entra: Number(m.entra) || 0,
        ganho: m.ganho === undefined ? 1 : Number(m.ganho),
        velocidade: m.velocidade === undefined ? 1 : Number(m.velocidade),
        tom: Number(m.tom) || 0,
        // as pontas: sem elas a emenda estala, por mais no lugar que esteja
        fadeIn: Number(m.fadeIn) || 0,
        fadeOut: Number(m.fadeOut) || 0
      })),
      titulo: criacao.nome
    })
    off?.()
    setFazendo(false)
    if (r?.erro) { setErro(r.erro); return }
    setFeito(r)
  }

  return (
    <div className="studio-overlay em-estudio">
      <header className="studio-header">
        <button className="topbar-icon-btn" onClick={onFechar} title="Voltar">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        {/* a mesma marca hexagonal do estúdio de separação: as duas telas
            precisam se reconhecer como o mesmo aplicativo */}
        <span className="brand-hex" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 4.5h14l-5.2 7.5L19 19.5H5l5.2-7.5z" fill="#0b0c0f" /></svg>
        </span>
        <span className="brand-name">MPTrix</span>
        <span className="topbar-divider" />
        <span className="studio-cover" aria-hidden="true">{iniciais}</span>

        <input
          className="ee-nome"
          value={criacao.nome}
          onChange={(e) => onMudar({ ...criacao, nome: e.target.value })}
          aria-label="nome desta criação"
        />
        <span className="ee-conta">
          {musicas.length} {musicas.length === 1 ? 'música' : 'músicas'}
        </span>

        {/* O BOTAO FINAL MORA AQUI, e pequeno.
            Ele era uma barra lima da largura da tela, escancarada embaixo das
            faixas — e o dono reclamou com razao: gerar o arquivo e a ULTIMA
            coisa que se faz, quando tudo ja esta pronto. Um botao desse tamanho
            no meio do caminho nao e enfase, e pressa: ele empurra pro fim quem
            acabou de chegar. Aqui em cima ele continua a vista e para de mandar. */}
        {fase === 'faixas' && musicas.length >= 2 && (
          <button className="ee-gerar" onClick={juntar} disabled={fazendo}
            title="gera o mp3 do medley — o único passo que grava arquivo">
            {fazendo ? `gerando… ${pct}%` : 'gerar o arquivo'}
          </button>
        )}

        <button className="jm-lixo" onClick={() => setConfirmandoLixo(true)}
          title={`jogar fora ${criacao.nome}`} aria-label={`jogar fora ${criacao.nome}`}>
          <Ico nome="lixeira" tamanho={18} />
        </button>
      </header>

      <div className="ee-corpo">
        {fase === 'faixas' ? (
          <FaixasDaEmenda
            criacao={criacao}
            analises={analises}
            onMudar={onMudar}
            onVoltar={() => setFase('escolha')}
            exportando={fazendo}
            pct={pct}
            feito={feito}
            erro={erro}
          />
        ) : (
        <div className="ee-coluna">
          <p className="ee-linha">
            As músicas entram inteiras, na ordem que você puser aqui, e saem num
            arquivo só.
          </p>

          {musicas.length === 0 ? (
            <button className="em-comecar" onClick={() => setEscolhendo(true)}>
              <span className="em-mais" aria-hidden="true">+</span>
              <b>Escolha as músicas</b>
              <span>elas entram na ordem em que você marcar</span>
            </button>
          ) : (
            <>
              <span className="em-rot">na ordem em que entram</span>
              <ol className="jm-lista">
                {musicas.map((m, i) => {
                  const an = analises[m.arquivo]
                  return (
                    <li key={m.id}>
                      <span className="jm-num">{i + 1}</span>
                      <span className="jm-nome">{m.nome}</span>
                      {/* leitura de painel: não clica, então não tem forma de
                          botão — informação com cara de botão mente pro dedo */}
                      <span className="jm-dados">
                        {an?.tom && <em>{an.tom}</em>}
                        {an?.bpm && <em>{an.bpm} BPM</em>}
                      </span>
                      <span className="jm-acoes">
                        <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="subir">↑</button>
                        <button onClick={() => mover(i, 1)} disabled={i === musicas.length - 1} aria-label="descer">↓</button>
                        <button className="jm-tirar" onClick={() => tirar(m.id)}>tirar</button>
                      </span>
                    </li>
                  )
                })}
              </ol>
              <button className="jm-mais" onClick={() => setEscolhendo(true)}>
                + trazer outra música
              </button>
            </>
          )}

          {musicas.length >= 2 && (
            <div className="em-fim">
              {/* ESTE BOTAO NAO GERA ARQUIVO. Ele abre o estudio com as faixas.
                  A versao anterior dizia "juntar as 2 num arquivo so" e fazia
                  exatamente isso — e estava errada mesmo dizendo a verdade:
                  depois de escolher, o que a pessoa quer e VER as musicas, nao
                  receber um mp3 que ela nao pediu. */}
              <button className="btn-primary em-exportar" onClick={() => setFase('faixas')}>
                juntar {musicas.length === 2 ? 'as 2' : `as ${musicas.length}`} no estúdio
              </button>
              <p className="jm-garantia">
                Nada é gerado ainda — o estúdio abre com as faixas pra você trabalhar.
              </p>
            </div>
          )}
        </div>
        )}
      </div>

      {escolhendo && (
        <EscolherMusicas
          history={history}
          jaNaFila={musicas.length}
          onFechar={() => setEscolhendo(false)}
          onConfirmar={receber}
        />
      )}

      <ConfirmDialog
        open={confirmandoLixo}
        danger
        title={`Jogar fora "${criacao.nome}"?`}
        message="A criação sai da lista. As músicas do seu acervo e os arquivos já exportados continuam onde estão."
        list={musicas.map((m) => m.nome)}
        confirmLabel="Jogar fora"
        cancelLabel="Cancelar"
        onConfirm={() => { setConfirmandoLixo(false); onJogarFora(criacao.id) }}
        onCancel={() => setConfirmandoLixo(false)}
      />
    </div>
  )
}
