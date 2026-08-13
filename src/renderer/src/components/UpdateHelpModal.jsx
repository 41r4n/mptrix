import Ico from './Icones.jsx'

// ██████████ A AJUDA DAS ATUALIZAÇÕES ██████████
//
// Ela estava desatualizada em tudo que importa, e o pior é que estava
// desatualizada com CONFIANÇA — descrevia cores que não existem ("azul
// piscando", "banner azul-violeta") e um app que só tinha uma coisa pra
// atualizar. Ajuda errada é pior que ajuda nenhuma: quem lê procura na tela o
// que ela descreve, não acha, e conclui que quebrou.
//
// Agora ela separa as DUAS coisas que se atualizam, porque confundir as duas é
// o engano natural: o motor é peça de dentro e o MPTRIX é o app inteiro.
export default function UpdateHelpModal({ open, onClose }) {
  if (!open) return null

  const handleKey = (e) => { if (e.key === 'Escape') onClose() }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-help" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <header className="edit-header">
          {/* desenhado, nunca emoji: emoji chega com a paleta dele e muda de
              forma conforme o Windows */}
          <div className="edit-header-icon"><Ico nome="tempo" tamanho={20} /></div>
          <div className="edit-header-text">
            <h3>Como funcionam as atualizações</h3>
            <p className="modal-sub">São duas coisas diferentes, e nenhuma delas mexe em nada sem você mandar.</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="modal-body help-body">
          <section className="help-section">
            <h4>São duas coisas, não uma</h4>
            <ul className="help-status-list">
              <li>
                <span className="status-dot status-ok">●</span>
                <div>
                  <strong>O MPTRIX</strong>
                  <p>
                    O app inteiro: as telas, o estúdio, o acervo. Quando sai versão nova, ela
                    traz melhorias e correções. Fica na <strong>primeira linha</strong> do rodapé.
                  </p>
                </div>
              </li>
              <li>
                <span className="status-dot status-ok">●</span>
                <div>
                  <strong>O motor que baixa</strong>
                  <p>
                    Chama <code>yt-dlp</code>. É a peça que conversa com o YouTube. Fica na
                    <strong> segunda linha</strong>, junto do <code>ffmpeg</code>.
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section className="help-section">
            <h4>Por que o motor precisa atualizar</h4>
            <p>
              O YouTube muda coisas nos servidores dele de vez em quando. Quando isso acontece,
              o motor velho <strong>para de baixar</strong> — e o erro que aparece na tela quase
              nunca diz que o problema é esse.
            </p>
            <p>
              Por isso o MPTRIX olha sozinho toda vez que abre. Se seus downloads pararam de
              funcionar do nada, atualizar o motor é a primeira coisa a tentar.
            </p>
          </section>

          <section className="help-section">
            <h4>O que cada cor significa</h4>
            <ul className="help-status-list">
              <li>
                <span className="status-dot status-ok">●</span>
                <div>
                  <strong>Verde parado — está em dia</strong>
                  <p>Não tem nada pra fazer. A cor é parada de propósito: ela não pede nada de você.</p>
                </div>
              </li>
              <li>
                <span className="status-dot status-update">●</span>
                <div>
                  <strong>Verde-limão piscando — tem versão nova</strong>
                  <p>
                    É o único estado que se mexe, porque é o único que pede alguma coisa.
                    Você <em>não</em> é obrigado a atualizar na hora.
                  </p>
                </div>
              </li>
              <li>
                <span className="status-dot status-error">●</span>
                <div>
                  <strong>Vermelho — não deu pra verificar</strong>
                  <p>
                    Quase sempre é internet fora. O MPTRIX continua funcionando offline do mesmo
                    jeito — só não consegue saber se saiu versão nova.
                  </p>
                </div>
              </li>
              <li>
                <span className="status-dot status-unknown">●</span>
                <div>
                  <strong>Cinza — verificando agora</strong>
                  <p>Está consultando. Leva alguns segundos.</p>
                </div>
              </li>
            </ul>
          </section>

          <section className="help-section">
            <h4>Nada acontece sozinho</h4>
            <p>
              O app só <strong>olha</strong> sozinho. Baixar e instalar são sempre um clique seu —
              nenhuma versão se troca no meio de uma separação ou de um ensaio.
            </p>
            <ol className="help-passos">
              <li>Abra o app e desça até o rodapé.</li>
              <li>Se tiver versão nova, aparece o botão <strong>“baixar agora”</strong>.</li>
              <li>Espere a barra encher. Não feche o app no meio.</li>
              <li>Aperte <strong>“instalar e reabrir”</strong>: ele fecha e volta já na versão nova.</li>
            </ol>
            <p>
              Quando quiser conferir na hora, o botão <strong>“verificar de novo”</strong> está
              sempre ali, para o app e para o motor.
            </p>
          </section>

          <section className="help-section">
            <h4>E o ffmpeg?</h4>
            <p>
              O <code>ffmpeg</code> é o outro programa interno — ele converte e junta o áudio.
              Ele muda <em>muito</em> menos que o motor de baixar, e a atualização dele ainda é
              manual. Se um dia for preciso, o instalador novo já traz a versão nova dentro.
            </p>
          </section>

          <section className="help-section help-tip">
            <Ico nome="aviso" tamanho={15} />
            <span>
              <strong>Resumo:</strong> se alguma coisa parar de funcionar do nada, desça até o
              rodapé e aperte <strong>“verificar de novo”</strong>. A maioria dos problemas de
              download é motor desatualizado.
            </span>
          </section>
        </div>

        <div className="period-footer">
          <span className="muted small">Você pode reabrir esta ajuda pelo botão “?” no rodapé.</span>
          <button className="btn-primary" onClick={onClose}>Entendi</button>
        </div>
      </div>
    </div>
  )
}
