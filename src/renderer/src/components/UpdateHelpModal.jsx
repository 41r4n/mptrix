export default function UpdateHelpModal({ open, onClose }) {
  if (!open) return null

  const handleKey = (e) => { if (e.key === 'Escape') onClose() }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-help" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <header className="edit-header">
          <div className="edit-header-icon">📘</div>
          <div className="edit-header-text">
            <h3>Como funcionam as atualizações</h3>
            <p className="modal-sub">Entenda por que precisa atualizar e o que cada cor significa.</p>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="modal-body help-body">
          <section className="help-section">
            <h4>Por que precisa atualizar?</h4>
            <p>
              O MPTRIX usa um programa interno chamado <code>yt-dlp</code> pra baixar do YouTube.
              O YouTube muda coisas nos servidores deles de vez em quando — quando isso acontece,
              o yt-dlp precisa de uma versão nova pra continuar funcionando.
            </p>
            <p>
              A boa notícia: o time do yt-dlp é rapidíssimo. Quase sempre tem versão nova
              em poucos dias. Por isso o MPTRIX checa a versão automaticamente toda vez que abre.
            </p>
          </section>

          <section className="help-section">
            <h4>O que cada cor significa</h4>
            <ul className="help-status-list">
              <li>
                <span className="status-dot status-ok">●</span>
                <div>
                  <strong>Verde — está em dia</strong>
                  <p>Tudo certo, não precisa fazer nada. Você tem a versão mais nova disponível.</p>
                </div>
              </li>
              <li>
                <span className="status-dot status-update">●</span>
                <div>
                  <strong>Azul (piscando) — atualização disponível</strong>
                  <p>
                    Tem uma versão mais nova publicada no GitHub. Você não é <em>obrigado</em> a atualizar
                    na hora, mas se algum download parar de funcionar (vídeo que não baixa, erro
                    estranho), atualizar quase sempre resolve.
                  </p>
                </div>
              </li>
              <li>
                <span className="status-dot status-error">●</span>
                <div>
                  <strong>Vermelho — não consegui verificar</strong>
                  <p>
                    Algum problema pra falar com o GitHub — pode ser sem internet, ou o GitHub
                    fora do ar. Cheque sua conexão e clica em <em>"verificar atualizações"</em> de novo.
                  </p>
                </div>
              </li>
              <li>
                <span className="status-dot status-unknown">●</span>
                <div>
                  <strong>Cinza — ainda checando</strong>
                  <p>O app está consultando agora mesmo. Espera alguns segundos.</p>
                </div>
              </li>
            </ul>
          </section>

          <section className="help-section">
            <h4>Como atualizar (passo a passo)</h4>
            <ol className="help-steps">
              <li>
                Quando o app abre, se tiver atualização, aparece um <strong>banner azul-violeta no topo</strong>
                dizendo "Nova versão do yt-dlp disponível".
              </li>
              <li>
                Clica em <strong>"Atualizar agora"</strong>. Aparece uma janela de progresso.
              </li>
              <li>
                Espera uns segundos (depende da sua internet). Não fecha o app no meio.
              </li>
              <li>
                Quando termina, aparece <strong>"Atualizado!"</strong> e pronto — seu próximo download
                já usa a versão nova.
              </li>
            </ol>
            <p className="muted small">
              Se você quiser checar manualmente quando der vontade, é só clicar em
              "<strong>verificar atualizações</strong>" no rodapé do app.
            </p>
          </section>

          <section className="help-section">
            <h4>E o ffmpeg?</h4>
            <p>
              O <code>ffmpeg</code> é outro programa interno (ele junta vídeo + áudio nos downloads de vídeo).
              Ele muda <em>muito</em> menos que o yt-dlp e raramente precisa de atualização.
              Por enquanto, atualização dele é manual — quando precisar, é só me avisar.
            </p>
          </section>

          <section className="help-section help-tip">
            <strong>💡 Resumo rápido:</strong>{' '}
            Se algo parar de funcionar do nada, primeira coisa a fazer é
            clicar em "verificar atualizações" e depois "Atualizar agora" se aparecer o banner.
            90% dos problemas se resolvem assim.
          </section>
        </div>

        <div className="period-footer">
          <span className="muted small">📍 Você pode reabrir essa ajuda a qualquer momento pelo botão "?" no rodapé.</span>
          <button className="btn-primary" onClick={onClose}>Entendi</button>
        </div>
      </div>
    </div>
  )
}
