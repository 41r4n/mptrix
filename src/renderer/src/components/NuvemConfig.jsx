import { useEffect, useState } from 'react'

// Configuração da separação na nuvem.
//
// A chave é do usuário e gasta dinheiro dele, então esta tela tem uma regra:
// nunca esconder número. Quanto já gastou, quantas músicas, e o teto — tudo
// visível sem clicar em nada. E a chave, uma vez guardada, NÃO volta pra cá
// nem mascarada: a tela só sabe que existe uma.

const PAINEL_CHAVES = 'https://replicate.com/account/api-tokens'

function centavosDolar(segundos) {
  return Math.round((segundos || 0) * 0.0014 * 100 * 100) / 100
}

export default function NuvemConfig() {
  const [estado, setEstado] = useState(null)
  const [chave, setChave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [recado, setRecado] = useState(null)
  const [aberto, setAberto] = useState(false)

  const recarregar = async () => setEstado(await window.mptrix.nuvem.estado())
  useEffect(() => { recarregar() }, [])

  if (!estado) return null

  const gastoC = centavosDolar(estado.segundosGastos)
  const porMusica = estado.musicasFeitas ? gastoC / estado.musicasFeitas : 0

  const guardar = async () => {
    setOcupado(true)
    setRecado(null)
    const r = await window.mptrix.nuvem.salvarChave(chave.trim())
    setOcupado(false)
    if (!r.ok) { setRecado({ tipo: 'erro', txt: r.erro }); return }
    setChave('')
    setRecado({ tipo: 'ok', txt: `Chave guardada — conta ${r.conta}.` })
    await window.mptrix.nuvem.ligar(true)
    recarregar()
  }

  const apagar = async () => {
    setEstado(await window.mptrix.nuvem.apagarChave())
    setRecado({ tipo: 'ok', txt: 'Chave apagada deste computador.' })
  }

  const alternar = async () => setEstado(await window.mptrix.nuvem.ligar(!estado.ligada))

  return (
    <section className="nuvem">
      <button
        className="nuvem-cabeca"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span className="nuvem-titulo">Separação na nuvem</span>
        <span className={`nuvem-selo ${estado.ligada && estado.temChave ? 'on' : ''}`}>
          {estado.temChave ? (estado.ligada ? 'ligada' : 'desligada') : 'não configurada'}
        </span>
        <span className="nuvem-seta">{aberto ? '▲' : '▼'}</span>
      </button>

      {aberto && (
        <div className="nuvem-corpo">
          <p className="nuvem-texto">
            Separar uma música aqui no computador leva minutos. Numa placa de vídeo
            alugada leva cerca de <strong>30 segundos</strong>. O MPTRIX não tem servidor
            nem cobra nada — você põe sua própria chave do Replicate e paga direto a eles,
            centavos por música. Sem chave, tudo continua funcionando aqui mesmo, do mesmo jeito.
          </p>

          {!estado.temChave && (
            <>
              {!estado.podeGuardar && (
                <p className="nuvem-texto aviso">
                  Este computador não tem cofre de senhas disponível, então eu não vou
                  guardar sua chave — ela ficaria legível em disco. A separação segue local.
                </p>
              )}
              <div className="nuvem-chave">
                <input
                  type="password"
                  className="nuvem-campo"
                  placeholder="Cole aqui sua chave (começa com r8_)"
                  value={chave}
                  onChange={(e) => setChave(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && chave.trim() && guardar()}
                  disabled={!estado.podeGuardar || ocupado}
                  spellCheck={false}
                />
                <button
                  className="btn-primary"
                  onClick={guardar}
                  disabled={!chave.trim() || ocupado || !estado.podeGuardar}
                >
                  {ocupado ? 'Conferindo…' : 'Guardar'}
                </button>
              </div>
              <button
                className="nuvem-link"
                onClick={() => window.mptrix.shell.openExternal(PAINEL_CHAVES)}
              >
                Onde eu pego essa chave?
              </button>
            </>
          )}

          {estado.temChave && (
            <>
              <div className="nuvem-linha">
                <button
                  className={`nuvem-chave-btn ${estado.ligada ? 'on' : ''}`}
                  onClick={alternar}
                  aria-pressed={estado.ligada}
                >
                  {estado.ligada ? 'Usando a nuvem' : 'Usando este computador'}
                </button>
                <button className="btn-secondary" onClick={apagar}>Apagar chave</button>
              </div>

              {/* leitura de painel: número grande mono + rótulo em caixa-alta.
                  Sem borda, porque não clica — borda aqui mentiria pro dedo. */}
              <div className="hud nuvem-hud">
                <div className={`hud-cell ${gastoC > 0 ? 'on' : ''}`}>
                  <span className="hud-num">{gastoC.toFixed(2)}</span>
                  <span className="hud-cap">centavos de dólar</span>
                </div>
                <div className="hud-cell">
                  <span className="hud-num">{estado.musicasFeitas}</span>
                  <span className="hud-cap">músicas</span>
                </div>
                <div className="hud-cell">
                  <span className="hud-num">{porMusica ? porMusica.toFixed(2) : '—'}</span>
                  <span className="hud-cap">por música</span>
                </div>
              </div>

              <p className="nuvem-texto miudo">
                Estimativa por cima, pela placa mais cara — o valor certo aparece no
                painel do Replicate, em Billing. Quando o gasto chegar ao teto, o MPTRIX
                volta a separar aqui sozinho, sem avisar você depois do estrago.
              </p>

              <div className="nuvem-linha">
                <label className="nuvem-teto">
                  <span>Teto de gasto</span>
                  <input
                    type="number"
                    className="nuvem-campo curto"
                    min="0"
                    step="50"
                    value={estado.tetoCentavos}
                    onChange={async (e) => setEstado(await window.mptrix.nuvem.teto(e.target.value))}
                  />
                  <span className="nuvem-unidade">centavos de dólar (0 = sem teto)</span>
                </label>
                <button className="btn-secondary" onClick={async () => setEstado(await window.mptrix.nuvem.zerarGasto())}>
                  Zerar contador
                </button>
              </div>
            </>
          )}

          {recado && <p className={`nuvem-recado ${recado.tipo}`}>{recado.txt}</p>}
        </div>
      )}
    </section>
  )
}
