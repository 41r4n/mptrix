import { useEffect, useState } from 'react'
import Ico from './Icones.jsx'

// Configuração da separação na nuvem.
//
// A chave é do usuário e gasta dinheiro dele, então esta tela tem uma regra:
// nunca esconder número. Quanto já gastou, quantas músicas, e o teto — tudo
// visível sem clicar em nada. E a chave, uma vez guardada, NÃO volta pra cá
// nem mascarada: a tela só sabe que existe uma.

const PAINEL_CHAVES = 'https://replicate.com/account/api-tokens'
// Onde o saldo mora de verdade. A API do Replicate NÃO entrega esse número —
// o endpoint de conta devolve só tipo, usuário, nome e link do GitHub. Então
// o MPTRIX não tem como mostrar quanto sobrou: o honesto é dizer isso e
// levar a pessoa até lá num clique, em vez de inventar uma estimativa de
// saldo que pode estar errada justamente na hora que importa.
const PAINEL_CREDITO = 'https://replicate.com/account/billing'

export default function NuvemConfig() {
  const [estado, setEstado] = useState(null)
  const [chave, setChave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [recado, setRecado] = useState(null)

  const recarregar = async () => setEstado(await window.mptrix.nuvem.estado())
  useEffect(() => { recarregar() }, [])

  if (!estado) return null

  // gasto real, calculado no processo principal pelo preço de cada máquina
  const gastoC = estado.centavosGastos || 0
  const porMusica = estado.musicasFeitas ? gastoC / estado.musicasFeitas : 0
  // EM DÓLAR, não em centavo. "1356.29 centavos de dólar" obriga a pessoa a
  // dividir por cem de cabeça pra saber se gastou muito — e é justamente o
  // número que ela mais quer ler rápido.
  const emDolar = (c) => `US$ ${(c / 100).toFixed(2).replace('.', ',')}`

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
    /* O ACORDEÃO SAIU. Ele fazia sentido quando isto era um bloco dentro de
       outra tela; numa aba inteira só pra ele, o cabeçalho repetia o título
       da tela e ainda começava fechado — escondendo o assunto atrás de um
       clique sem motivo. */
    <section className="nuvem">
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
              {/* Escolha entre duas, não um botão que alterna. Antes o botão
                  mostrava o estado ("Usando a nuvem"), e isso se lê como
                  ORDEM: quem clicava achando que estava mandando usar a nuvem
                  na verdade desligava. Aqui os dois lados ficam à vista e o
                  aceso é o que vale — não dá pra errar o que o clique faz. */}
              <div className="nuvem-linha">
                <div className="nuvem-escolha" role="group" aria-label="Onde separar">
                  <button
                    className={!estado.ligada ? 'on' : ''}
                    onClick={() => estado.ligada && alternar()}
                    aria-pressed={!estado.ligada}
                  >
                    Neste computador
                  </button>
                  <button
                    className={estado.ligada ? 'on' : ''}
                    onClick={() => !estado.ligada && alternar()}
                    aria-pressed={estado.ligada}
                  >
                    Na nuvem
                  </button>
                </div>
                <button className="btn-secondary" onClick={apagar}>Apagar chave</button>
              </div>

              {/* ▸ O CRÉDITO.
                  O saldo NÃO aparece aqui, e isso não é esquecimento: a API do
                  Replicate não entrega esse número — o endereço de conta
                  devolve só tipo, usuário, nome e link do GitHub. Inventar uma
                  estimativa de saldo seria errar justamente na hora que
                  importa, que é quando está acabando. Então o painel mostra o
                  que o MPTRIX SABE (quanto ele mesmo gastou) e leva você ao
                  lugar que sabe o resto, num clique. */}
              <div className="credito">
                <div className="credito-num">
                  <b>{emDolar(gastoC)}</b>
                  <i>gastos por aqui</i>
                </div>
                <span className="credito-fio" aria-hidden="true" />
                <div className="credito-lado">
                  <span><b>{estado.musicasFeitas}</b> músicas</span>
                  <span><b>{porMusica ? emDolar(porMusica) : '—'}</b> cada</span>
                </div>
                <span className="credito-espaco" />
                <button
                  className="btn-primary credito-ir"
                  onClick={() => window.mptrix.shell.openExternal(PAINEL_CREDITO)}
                >
                  <Ico nome="baixar" tamanho={15} />
                  Ver saldo e comprar crédito
                </button>
              </div>

              <p className="nuvem-texto miudo">
                <strong>O saldo fica com o Replicate.</strong> A conta deles não
                deixa o MPTRIX ler quanto sobrou, então o número acima é só o que
                ELE gastou — estimado pelo preço da máquina de cada trabalho, com
                folga pros modelos próprios (a nuvem cobra o tempo de ligar deles).
                O valor exato e o saldo estão no botão acima.
              </p>

              <div className="nuvem-linha">
                <label className="nuvem-teto">
                  <span>Parar ao gastar</span>
                  {/* EM DÓLAR: pedir o teto em centavos obrigava a pessoa a
                      multiplicar por cem de cabeça pra dizer "cinco dólares" */}
                  <input
                    type="number"
                    className="nuvem-campo curto"
                    min="0"
                    step="1"
                    value={estado.tetoCentavos ? (estado.tetoCentavos / 100) : 0}
                    onChange={async (e) => {
                      const dolares = Number(e.target.value) || 0
                      setEstado(await window.mptrix.nuvem.teto(Math.round(dolares * 100)))
                    }}
                  />
                  <span className="nuvem-unidade">dólares (0 = sem limite)</span>
                </label>
                <button className="btn-secondary" onClick={async () => setEstado(await window.mptrix.nuvem.zerarGasto())}>
                  Zerar contador
                </button>
              </div>
              <p className="nuvem-texto miudo">
                Chegando no teto, o MPTRIX volta a separar aqui no computador
                sozinho — sem te avisar depois do estrago.
              </p>
            </>
          )}

        {recado && <p className={`nuvem-recado ${recado.tipo}`}>{recado.txt}</p>}
      </div>
    </section>
  )
}
