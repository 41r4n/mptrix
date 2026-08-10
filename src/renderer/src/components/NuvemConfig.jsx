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
const CRIAR_CONTA = 'https://replicate.com/signin'

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
  // média medida NESTE computador. Sem histórico não invento número: o texto
  // vira uma faixa honesta em vez de uma promessa que eu não posso cumprir.
  const custoMedio = estado.musicasFeitas >= 3 ? porMusica : 0

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

              {/* ██████ O CAMINHO ██████
                  Antes isto era um parágrafo, um campo de senha e um link
                  dizendo "onde eu pego essa chave?". Quem já sabia, resolvia;
                  quem não sabia, parava ali — e quem não sabe é justamente
                  quem esta tela precisa atender.
                  Agora são quatro passos numerados, cada um com o PORQUÊ ao
                  lado do o quê. Sem o porquê a pessoa executa sem entender e
                  trava no primeiro imprevisto; com ele, ela sabe o que está
                  fazendo e consegue se virar quando a tela do Replicate mudar
                  de lugar — porque vai mudar. */}
              <ol className="passos">
                <li className="passo">
                  <span className="passo-n">01</span>
                  <div className="passo-txt">
                    <b>Criar uma conta no Replicate</b>
                    <i>É de graça e dá pra entrar com a conta do Google ou do GitHub. O Replicate é quem aluga a placa de vídeo — o MPTRIX não tem servidor nenhum.</i>
                    <button className="passo-ir" onClick={() => window.mptrix.shell.openExternal(CRIAR_CONTA)}>
                      abrir o Replicate
                    </button>
                  </div>
                </li>

                <li className="passo">
                  <span className="passo-n">02</span>
                  <div className="passo-txt">
                    <b>Botar crédito na conta</b>
                    <i>
                      Você paga direto a eles, não ao MPTRIX. {custoMedio
                        ? <>Pelo seu histórico, cada música sai por volta de <strong>{emDolar(custoMedio)}</strong> — US$ 5 dariam umas <strong>{Math.max(1, Math.floor(500 / custoMedio))}</strong> músicas.</>
                        : <>Em geral fica na casa de centavos por música; US$ 5 já dão pra experimentar bastante.</>}
                    </i>
                    <button className="passo-ir" onClick={() => window.mptrix.shell.openExternal(PAINEL_CREDITO)}>
                      abrir a página de crédito
                    </button>
                  </div>
                </li>

                <li className="passo">
                  <span className="passo-n">03</span>
                  <div className="passo-txt">
                    <b>Copiar a chave da conta</b>
                    <i>É uma senha que começa com <code>r8_</code>. Ela diz ao Replicate que o trabalho é seu e vai na sua conta — por isso ela não pode ser dividida com ninguém.</i>
                    <button className="passo-ir" onClick={() => window.mptrix.shell.openExternal(PAINEL_CHAVES)}>
                      abrir minhas chaves
                    </button>
                  </div>
                </li>

                <li className="passo">
                  <span className="passo-n">04</span>
                  <div className="passo-txt">
                    <b>Colar aqui embaixo</b>
                    <i>Ela vai pro cofre de senhas do Windows, não pra um arquivo. Depois de guardada, nem esta tela consegue ler de volta — ela só sabe que existe uma.</i>
                    <div className="nuvem-chave">
                      <input
                        type="password"
                        className="nuvem-campo"
                        placeholder="cole a chave aqui (começa com r8_)"
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
                  </div>
                </li>
              </ol>

              <p className="nuvem-texto miudo">
                Não quer mexer com isso agora? Tudo bem — sem chave o MPTRIX
                separa aqui no seu computador do mesmo jeito, só demora uns
                minutos em vez de meio minuto.
              </p>

              {/* ██████ AS PERGUNTAS ██████
                  Tem dinheiro envolvido e a pessoa está mexendo num serviço
                  que nunca viu. Ela VAI ter essas dúvidas — e dúvida sobre
                  dinheiro e privacidade que não é respondida na tela vira
                  desistência, ou pior, vira "vou clicando e torcendo".
                  Ficam fechadas por padrão porque seis respostas abertas
                  soterrariam os quatro passos, que são o assunto. Isto é o
                  oposto do acordeão que eu tirei daqui: aquele escondia o
                  ÚNICO conteúdo da tela; este esconde o apoio e deixa o
                  caminho à vista. */}
              <div className="duvidas">
                <p className="duvidas-titulo">perguntas que você deve estar fazendo</p>

                <details className="duvida">
                  <summary>Por que preciso de conta em outro site? O MPTRIX não faz isso sozinho?</summary>
                  <p>
                    Separar música rápido exige placa de vídeo cara. Se o MPTRIX
                    tivesse servidor próprio, alguém teria que pagar essa conta
                    todo mês — e aí o app seria pago, ou teria anúncio, ou
                    venderia seus dados. Com a sua chave, você aluga a máquina
                    só nos segundos em que usa, e o app continua de graça e sem
                    dono no meio.
                  </p>
                </details>

                <details className="duvida">
                  <summary>É seguro colocar minha chave aqui?</summary>
                  <p>
                    Ela vai pro cofre de senhas do Windows, embaralhada pelo
                    próprio Windows e amarrada à sua conta de usuário — não fica
                    num arquivo de texto que qualquer um abre. Depois de
                    guardada, <strong>nem esta tela consegue ler ela de volta</strong>:
                    só o motor do app usa, na hora de falar com o Replicate.
                    E se o seu computador não tivesse esse cofre, o MPTRIX se
                    recusaria a guardar em vez de gravar em texto puro.
                  </p>
                </details>

                <details className="duvida">
                  <summary>Minha música vai pra internet?</summary>
                  <p>
                    <strong>No modo "neste computador", não sai nada daqui.</strong>{' '}
                    No modo nuvem sim: o áudio é enviado pro Replicate, porque é
                    lá que a placa de vídeo separa. Eles guardam o arquivo por
                    <strong> 24 horas</strong> e apagam sozinhos — conferi isso na
                    conta de verdade. Se a música for algo que você não quer
                    mandar pra fora, use o modo local; ele faz o mesmo trabalho,
                    só mais devagar.
                  </p>
                </details>

                <details className="duvida">
                  <summary>Podem cobrar mais do que eu tenho? Vou levar susto na fatura?</summary>
                  <p>
                    O crédito é pré-pago: você põe US$ 5, e o serviço não tem
                    como gastar além do que está lá. Fora isso, o MPTRIX tem o
                    teto dele — chegando no valor que você marcar, ele volta a
                    separar aqui no computador sozinho. Não existe assinatura
                    nem cobrança recorrente.
                  </p>
                </details>

                <details className="duvida">
                  <summary>O MPTRIX fica com alguma parte do dinheiro?</summary>
                  <p>
                    Nenhuma. O app nunca toca no dinheiro — o pagamento é entre
                    você e o Replicate, direto. Por isso o número que aparece
                    aqui é uma <em>estimativa do que ele gastou</em>, e o valor
                    de verdade está no painel deles.
                  </p>
                </details>

                <details className="duvida">
                  <summary>E se eu me arrepender?</summary>
                  <p>
                    Tem um botão "Apagar chave" assim que você configurar. Ele
                    tira a chave deste computador e o app volta a separar
                    localmente. Nada do que você já separou se perde, e você pode
                    apagar a chave lá no Replicate também, quando quiser.
                  </p>
                </details>
              </div>
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
