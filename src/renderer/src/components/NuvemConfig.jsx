import { useEffect, useRef, useState } from 'react'
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

// data e hora curtas, do jeito que a gente fala
function quandoFoi(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function NuvemConfig() {
  const [estado, setEstado] = useState(null)
  const [chave, setChave] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [recado, setRecado] = useState(null)
  // RASCUNHO DO CAMPO. Antes cada tecla ia direto pro motor: digitar "100"
  // gravava 1, depois 10, depois 100 — três cargas no livro pra uma só de
  // verdade, e o contador zerando três vezes no caminho. Valor de dinheiro
  // se confirma, não se transmite letra por letra.
  const [rascunho, setRascunho] = useState(null)
  const [verLivro, setVerLivro] = useState(false)
  const [verApagar, setVerApagar] = useState(false)
  // linhas escolhidas no livro. Some ao fechar a janela: seleção que sobrevive
  // fechada volta a existir sem a pessoa lembrar do que marcou.
  const [linhasMarcadas, setLinhasMarcadas] = useState(() => new Set())
  const [simValor, setSimValor] = useState('1')
  // o que está marcado pra ir embora. A chave começa DESMARCADA de propósito:
  // ela é o acesso, não um dado — apagar por descuido custa refazer todo o
  // caminho do Replicate.
  const [aApagar, setAApagar] = useState({ livro: true, credito: true, contadores: true, chave: false })

  const recarregar = async () => setEstado(await window.mptrix.nuvem.estado())
  useEffect(() => { recarregar() }, [])

  // Esc fecha a janela do histórico. Clicar fora também, pelo overlay.
  useEffect(() => {
    if (!verLivro) return
    const tecla = (e) => { if (e.key === 'Escape') setVerLivro(false) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [verLivro])

  if (!estado) return null

  // gasto real, calculado no processo principal pelo preço de cada máquina
  // OS DOIS NÚMEROS GRANDES SAEM DO MESMO CICLO. Antes o "já gastou" era o
  // total do MÊS e o "você tem" era do ciclo de crédito — dois períodos
  // diferentes lado a lado, que nunca fechavam entre si. O gasto do mês
  // continua existindo, mas embaixo, dito pelo nome.
  const gastoC = estado.gastoDesdeCredito || 0
  const gastoDoMes = estado.centavosGastos || 0
  const porMusica = estado.musicasFeitas ? gastoC / estado.musicasFeitas : 0
  // EM DÓLAR, não em centavo. "1356.29 centavos de dólar" obriga a pessoa a
  // dividir por cem de cabeça pra saber se gastou muito — e é justamente o
  // número que ela mais quer ler rápido.
  const emDolar = (c) => `US$ ${(c / 100).toFixed(2).replace('.', ',')}`
  // média medida NESTE computador. Sem histórico não invento número: o texto
  // vira uma faixa honesta em vez de uma promessa que eu não posso cumprir.
  const custoMedio = estado.musicasFeitas >= 3 ? porMusica : 0

  // ██████ O JORNAL DO CRÉDITO ██████
  //
  // Número sozinho não é notícia. "US$ 4,20" não diz se é muito ou pouco —
  // quem nunca usou não tem régua pra saber. A frase dá a régua: traduz o
  // mesmo número em "dá pra continuar" ou "é hora de comprar", e diz o que
  // acontece se ignorar.
  // QUAL USO ENCOSTOU NA MARCA.
  //
  // O fim do crédito não é um evento — é uma propriedade do uso que cruzou os
  // 85%. Como linha separada ele ficava inerte (apagar não mudava nada,
  // porque a conta vem das cargas e dos usos) e ainda assim tinha a cara de um
  // registro de peso. Aqui ele volta pra onde pertence: grudado no uso que o
  // causou, e some junto se aquele uso for apagado.
  const idQueEncostou = (() => {
    if (!estado.creditoInformado) return null
    const livro = estado.livro || []
    const iCarga = livro.findIndex((l) => l && l.tipo === 'carga')
    const doCiclo = (iCarga >= 0 ? livro.slice(0, iCarga) : livro).filter((l) => l && l.tipo === 'uso')
    // do mais VELHO pro mais novo: o primeiro que faz o acumulado cruzar é ele
    let soma = 0
    for (const l of [...doCiclo].reverse()) {
      soma += l.valor || 0
      if (soma >= estado.creditoInformado * 0.85) return l.id
    }
    return null
  })()

  const jornal = (() => {
    if (!estado.creditoInformado) {
      return {
        nivel: 'mudo',
        titulo: 'não sei quanto você tem',
        txt: 'Me diga quanto pôs de crédito e eu passo a avisar antes de acabar. Sem esse número eu não tenho como frear — e o que passar do crédito vira dívida lá.'
      }
    }
    const sobra = Math.max(0, estado.creditoInformado - estado.gastoDesdeCredito)
    const fracao = sobra / estado.creditoInformado
    const musicas = custoMedio ? Math.floor(sobra / custoMedio) : null
    const quantas = musicas != null ? ` Dá pra mais ou menos ${musicas} música${musicas !== 1 ? 's' : ''}.` : ''

    if (estado.paradaPor) {
      return {
        nivel: 'parou',
        titulo: 'sem crédito — nuvem trancada',
        txt: `Sobrou ${emDolar(sobra)} do que você informou, e eu parei antes de encostar: se passasse viraria dívida e o Replicate suspende a conta até quitar. A nuvem fica trancada até você comprar crédito e atualizar o valor aqui embaixo — aí eu religo sozinho. Enquanto isso tudo continua funcionando neste computador.`
      }
    }
    if (fracao <= 0.25) {
      return {
        nivel: 'pouco',
        titulo: 'está acabando',
        txt: `Sobra mais ou menos ${emDolar(sobra)}.${quantas} Vou parar sozinho em ${emDolar(estado.creditoInformado * 0.15)} de sobra, pra não virar dívida — então já vale comprar mais.`
      }
    }
    if (fracao <= 0.6) {
      return {
        nivel: 'meio',
        titulo: 'na metade',
        txt: `Sobra mais ou menos ${emDolar(sobra)}.${quantas} Ainda dá pra trabalhar tranquilo; eu aviso quando estiver perto do fim.`
      }
    }
    return {
      nivel: 'cheio',
      titulo: 'tem bastante',
      txt: `Sobra mais ou menos ${emDolar(sobra)}.${quantas} Pode usar à vontade — eu conto e aviso antes de apertar.`
    }
  })()

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

  // A NUVEM FICA TRANCADA enquanto o motivo da parada existir. Sem isto o
  // botão "Na nuvem" continuava clicável: a pessoa ligava, o motor desligava
  // de novo na primeira separação, e ela ficava achando que o botão estava
  // quebrado. Botão que aceita o clique e desfaz sozinho é pior que botão
  // desligado — ele mente sobre o que pode fazer.
  const trancada = !!estado.paradaPor
  const porQueTrancada = estado.paradaPor === 'teto-do-mes'
    ? 'Você chegou no teto deste mês. Suba o teto aí embaixo pra liberar.'
    : 'Sem crédito não dá pra usar a nuvem. Compre crédito e me diga o valor aí embaixo — eu religo sozinho.'

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
                    Não existe assinatura nem cobrança recorrente — você paga o
                    que usar. Mas atenção numa coisa que eu já vi acontecer:{' '}
                    <strong>o crédito acabar não trava o serviço na hora.</strong>{' '}
                    O que passar do crédito vira uma dívida pequena na conta do
                    Replicate, e eles suspendem o acesso até você quitar. Foram
                    25 centavos de dólar no caso que eu vi — pouco dinheiro, mas
                    a conta fica parada até resolver.
                  </p>
                  <p>
                    Por isso o <strong>teto de gasto aqui embaixo importa de
                    verdade</strong>: ele é o freio que está do SEU lado. Quando
                    o MPTRIX chega no valor que você marcar, ele volta a separar
                    aqui no computador sozinho, antes de encostar no limite lá.
                    Com o teto em zero não existe freio nenhum.
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
              {/* A NUVEM SE DESLIGOU SOZINHA. Antes o app detectava a recusa
                  por falta de crédito, parava aquele trabalho e não fazia mais
                  nada: a próxima separação tentava de novo, esperava e falhava
                  de novo. Agora ele desliga, volta a separar aqui, e diz por
                  quê — que é a única forma dessa proteção não depender de
                  alguém configurar coisa nenhuma. */}
              {estado.paradaPor && (
                <div className="nuvem-parou">
                  <b>desliguei a nuvem sozinho</b>
                  {estado.paradaPor === 'freio-credito' && (
                    <p>
                      Seu crédito estava quase no fim, então parei <strong>antes</strong> de
                      acabar e voltei a separar aqui no seu computador. É pra isso que
                      serve o número que você me deu — assim você não fica devendo e a
                      conta não é suspensa. Comprou mais? Atualize o valor aí embaixo que
                      eu volto sozinho.
                    </p>
                  )}
                  {estado.paradaPor === 'sem-credito' && (
                    <p>
                      O Replicate recusou o último trabalho por falta de crédito, então
                      parei de pedir e voltei a separar aqui no seu computador — sem isso
                      cada separação ia esperar e falhar de novo. Quando puser crédito lá,
                      me diga o valor aí embaixo que eu volto sozinho.
                    </p>
                  )}
                  {estado.paradaPor === 'teto-do-mes' && (
                    <p>
                      Você chegou no teto que marcou pra este mês, então voltei a separar
                      aqui no computador. No dia 1º o contador zera e a nuvem volta
                      sozinha — ou você sobe o teto agora, se quiser continuar.
                    </p>
                  )}
                </div>
              )}

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
                    className={`${estado.ligada ? 'on' : ''} ${trancada ? 'trancada' : ''}`}
                    onClick={() => !estado.ligada && !trancada && alternar()}
                    aria-pressed={estado.ligada}
                    disabled={trancada}
                    title={trancada ? porQueTrancada : 'Separar na nuvem, em cerca de 30 segundos'}
                  >
                    Na nuvem
                    {trancada && <span className="trava" aria-hidden="true">·</span>}
                  </button>
                </div>
                <button className="btn-secondary" onClick={apagar}>Apagar chave</button>
              </div>

              {/* SIMULADOR. Existe pra dar pra ver o freio, o jornal, a trava e
                  o livro reagindo — coisas que só acontecem quando o dinheiro
                  anda, e que de outro jeito só se testaria gastando de
                  verdade. Ele passa pelo mesmo caminho do gasto real; se fosse
                  um caminho paralelo, provaria o comportamento dele mesmo. */}
              <div className="sim">
                <span className="sim-rot">simulador · só pra teste</span>
                <div className="sim-linha">
                  <em>US$</em>
                  <input
                    type="number"
                    className="nuvem-campo curto"
                    min="0"
                    step="0.5"
                    value={simValor}
                    onChange={(e) => setSimValor(e.target.value)}
                  />
                  <button
                    className="sim-ir"
                    type="button"
                    onClick={async () => {
                      const d = Number(String(simValor).replace(',', '.')) || 0
                      if (d <= 0) return
                      setEstado(await window.mptrix.nuvem.simular(Math.round(d * 100)))
                    }}
                  >
                    gastar
                  </button>
                  <span className="sim-txt">
                    finge um gasto sem tocar na nuvem — a linha nasce marcada como
                    simulada, pra não sujar o registro do dinheiro de verdade
                  </span>
                </div>
              </div>

              {/* ▸ O CRÉDITO.
                  O saldo NÃO aparece aqui, e isso não é esquecimento: a API do
                  Replicate não entrega esse número — o endereço de conta
                  devolve só tipo, usuário, nome e link do GitHub. Inventar uma
                  estimativa de saldo seria errar justamente na hora que
                  importa, que é quando está acabando. Então o painel mostra o
                  que o MPTRIX SABE (quanto ele mesmo gastou) e leva você ao
                  lugar que sabe o resto, num clique. */}
              {/* ██████ UM PAINEL SÓ ██████
                  Eram dois cartões falando do mesmo dinheiro — um com o gasto,
                  outro com a sobra — e a informação mais importante, quanto
                  AINDA TEM, aparecia depois da menos importante. Duas caixas
                  pro mesmo assunto obrigam a pessoa a juntar as pontas de
                  cabeça.
                  Agora é um: à esquerda o que você tem (verde, e primeiro
                  porque é o que decide se dá pra continuar), à direita o que já
                  foi (vermelho, porque é dinheiro que saiu). Nada se perdeu —
                  músicas, custo por música e mês passado seguem ali, no tamanho
                  de apoio que é o deles. */}
              <div className={`painel ${jornal.nivel}`}>
                <span className="jornal-canto tl" aria-hidden="true" />
                <span className="jornal-canto br" aria-hidden="true" />

                <div className="jornal-cab">
                  <span className="jornal-luz" aria-hidden="true" />
                  <b>{jornal.titulo}</b>
                  <span className="jornal-risco" aria-hidden="true" />
                  <span className="jornal-hachura" aria-hidden="true" />
                </div>

                <div className="painel-numeros">
                  {/* TEM — verde, e primeiro. TRANCADO = ZERO UTILIZÁVEL: o que
                      sobrou continua na conta lá, mas pra este app é dinheiro
                      que não pode ser tocado. */}
                  <div className="painel-tem">
                    <span className="painel-rot">você tem</span>
                    <b>
                      {estado.creditoInformado
                        ? (estado.paradaPor ? emDolar(0) : emDolar(Math.max(0, estado.creditoInformado - estado.gastoDesdeCredito)))
                        : '—'}
                    </b>
                    <i>
                      {!estado.creditoInformado
                        ? 'não sei ainda'
                        : estado.paradaPor
                          ? <>utilizável · {emDolar(Math.max(0, estado.creditoInformado - estado.gastoDesdeCredito))} parados lá</>
                          : <>de {emDolar(estado.creditoInformado)}</>}
                    </i>
                  </div>

                  <span className="painel-fio" aria-hidden="true" />

                  {/* JÁ GASTOU — vermelho: é dinheiro que saiu. */}
                  <div className="painel-gastou">
                    <span className="painel-rot">já gastou</span>
                    <b>{emDolar(gastoC)}</b>
                    <i>
                      {estado.musicasFeitas} música{estado.musicasFeitas !== 1 ? 's' : ''}
                      {porMusica ? <> · {emDolar(porMusica)} cada</> : null}
                      {gastoDoMes > 0 ? <> · {emDolar(gastoDoMes)} no mês</> : null}
                      {estado.gastoMesPassado > 0 ? <> · {emDolar(estado.gastoMesPassado)} mês passado</> : null}
                    </i>
                  </div>

                  <span className="painel-espaco" />

                  {/* o botão PEDE quando aperta: cor de aviso e batida devagar */}
                  <button
                    className={`btn-primary credito-ir ${jornal.nivel === 'parou' || jornal.nivel === 'pouco' ? 'pedindo' : ''}`}
                    onClick={() => window.mptrix.shell.openExternal(PAINEL_CREDITO)}
                  >
                    <Ico nome="baixar" tamanho={15} />
                    Ver saldo e comprar crédito
                  </button>
                </div>

                <p className="painel-frase">{jornal.txt}</p>

                {estado.creditoInformado > 0 && (
                  <div className="jornal-barra" title={`${emDolar(estado.gastoDesdeCredito)} gastos de ${emDolar(estado.creditoInformado)}`}>
                    <span
                      className="jornal-cheio"
                      style={{ width: `${Math.min(100, (estado.gastoDesdeCredito / estado.creditoInformado) * 100)}%` }}
                    />
                    <span className="jornal-marca" style={{ left: '85%' }}>
                      <i>paro aqui</i>
                    </span>
                  </div>
                )}
              </div>

              {/* SEMPRE VISÍVEL, mesmo sem nenhuma linha: esta janela deixou de
                  ser só o histórico — ela é a porta de "o que aconteceu e como
                  limpar". Escondê-la quando não há registro trancaria a
                  limpeza junto. */}
              <div className="livro">
                  {/* o botão abre uma JANELA, não uma gaveta: histórico é coisa
                      que se lê com atenção, e a janela trava o resto pra isso */}
                  <button
                    className="livro-abrir"
                    onClick={() => setVerLivro(true)}
                    type="button"
                  >
                    <span className="livro-ico" aria-hidden="true" />
                    histórico e limpeza
                    <span className="livro-conta">{estado.livro?.length || 0}</span>
                  </button>
                </div>

              <p className="nuvem-texto miudo">
                <strong>O saldo fica com o Replicate.</strong> A conta deles não
                deixa o MPTRIX ler quanto sobrou, então o número acima é só o que
                ELE gastou — estimado pelo preço da máquina de cada trabalho, com
                folga pros modelos próprios (a nuvem cobra o tempo de ligar deles).
                O valor exato e o saldo estão no botão acima.
              </p>

              {/* DUAS AÇÕES, CADA UMA COM NOME PRÓPRIO.
                  A pergunta "quanto você tem agora" é a certa — o número está
                  na página deles e corrige qualquer desvio da minha conta. Só
                  que ela pegou o dono duas vezes: sobrava US$1, ele comprou
                  US$10 e digitou 10 esperando ver 11. Ninguém pensa em SALDO,
                  pensa em RECARGA.
                  Uma pergunta só, por melhor escrita que seja, não vence o
                  jeito de pensar de quem usa. Então o mesmo número serve pras
                  duas, e o botão diz qual delas é. */}
              <div className="freio">
                <label className="freio-campo">
                  <span>quanto de crédito?</span>
                  <div className="freio-linha">
                    <em>US$</em>
                    <input
                      type="number"
                      className="nuvem-campo curto"
                      min="0"
                      step="0.01"
                      value={rascunho ?? ''}
                      placeholder="0,00"
                      onChange={(e) => setRascunho(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    />
                    <button
                      type="button"
                      className="freio-ok"
                      disabled={!Number(String(rascunho ?? '').replace(',', '.'))}
                      onClick={async () => {
                        const d = Number(String(rascunho ?? '').replace(',', '.')) || 0
                        if (d <= 0) return
                        setRascunho(null)
                        setEstado(await window.mptrix.nuvem.somarCredito(Math.round(d * 100)))
                      }}
                    >
                      acabei de comprar
                    </button>
                    <button
                      type="button"
                      className="freio-alt"
                      disabled={!String(rascunho ?? '').length}
                      onClick={async () => {
                        const d = Number(String(rascunho ?? '').replace(',', '.')) || 0
                        setRascunho(null)
                        setEstado(await window.mptrix.nuvem.credito(Math.round(d * 100)))
                      }}
                    >
                      tenho isso no total
                    </button>
                  </div>
                </label>

                <p className="nuvem-texto miudo">
                  {estado.creditoInformado > 0
                    ? <>
                      <strong>“Acabei de comprar”</strong> soma ao que sobrou — hoje sobram{' '}
                      <strong>{emDolar(Math.max(0, estado.creditoInformado - estado.gastoDesdeCredito))}</strong>,
                      então comprando US$ 10 você fica com{' '}
                      {emDolar(Math.max(0, estado.creditoInformado - estado.gastoDesdeCredito) + 1000)}.{' '}
                      <strong>“Tenho isso no total”</strong> troca a conta pelo número que está na
                      página do Replicate, em <em>Crédito restante</em> — use esse quando quiser
                      corrigir a minha estimativa pelo valor de verdade.
                    </>
                    : <><strong>Sem esse número não existe freio.</strong> O crédito acabar não trava
                      o serviço: o que passar vira dívida e eles suspendem a conta até quitar. Com
                      ele, o MPTRIX para antes e volta a separar aqui.</>}
                </p>
              </div>

            </>
          )}

        {recado && <p className={`nuvem-recado ${recado.tipo}`}>{recado.txt}</p>}
      </div>

      {/* JANELA DE VERDADE, no meio da tela, com o resto travado atrás. A
          caixa flutuante ainda deixava clicar no que estava embaixo — e
          histórico é coisa que se lê com atenção, não de canto de olho.
          Usa a mesma janela das outras telas do app: quem já fechou uma sabe
          fechar esta. */}

      {/* APAGAR POR PARTES. Um botão só de "apagar tudo" obriga quem queria
          limpar uma coisa a jogar fora as outras — e aqui as coisas têm pesos
          bem diferentes: histórico é memória, contador é conta, e a chave é o
          acesso. Escolher o que vai embora é o que separa faxina de estrago. */}
      {verApagar && (
        <div className="modal-overlay" onClick={() => setVerApagar(false)}>
          <div className="modal modal-apagar" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <span className="modal-etiqueta">limpeza</span>
                <h3>Apagar dados</h3>
                <p className="modal-sub">
                  Escolha o que vai embora. Nada disso apaga música, faixa separada
                  ou download — só o que esta tela guarda sobre a nuvem.
                </p>
              </div>
              <button className="btn-close" onClick={() => setVerApagar(false)} aria-label="Fechar">×</button>
            </header>
            <div className="modal-body">
              <ul className="apagar-lista">
                {[
                  { id: 'livro', nome: 'Histórico do crédito', quanto: `${estado.livro?.length || 0} linha${(estado.livro?.length || 0) !== 1 ? 's' : ''}`, txt: 'As cargas, os usos e os fins registrados. Some a memória de para onde o dinheiro foi.' },
                  { id: 'credito', nome: 'Crédito informado', quanto: estado.creditoInformado ? emDolar(estado.creditoInformado) : 'nenhum', txt: 'O valor que você me disse que tem. Sem ele eu volto a não ter freio até você informar de novo.' },
                  { id: 'contadores', nome: 'Contadores de gasto', quanto: `${emDolar(gastoC)} · ${estado.musicasFeitas} música${estado.musicasFeitas !== 1 ? 's' : ''}`, txt: 'Quanto gastei e quantas músicas fiz. Zerar não devolve dinheiro nenhum — só apaga a minha conta.' },
                  { id: 'chave', nome: 'Chave do Replicate', quanto: 'guardada', txt: 'O acesso. Apagando, a nuvem desliga e você precisa pegar a chave lá de novo.', perigo: true }
                ].map((it) => (
                  <li key={it.id} className={`${aApagar[it.id] ? 'on' : ''} ${it.perigo ? 'perigo' : ''}`}>
                    <button
                      type="button"
                      className="apagar-item"
                      onClick={() => setAApagar((v) => ({ ...v, [it.id]: !v[it.id] }))}
                      aria-pressed={aApagar[it.id]}
                    >
                      <span className="apagar-marca" aria-hidden="true" />
                      <span className="apagar-txt">
                        <span className="apagar-nome">{it.nome} <i>{it.quanto}</i></span>
                        <span className="apagar-desc">{it.txt}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setAApagar({ livro: true, credito: true, contadores: true, chave: true })}
                >
                  Marcar tudo
                </button>
                <button className="btn-secondary" onClick={() => setVerApagar(false)}>Cancelar</button>
                <button
                  className="btn-danger"
                  disabled={!Object.values(aApagar).some(Boolean)}
                  onClick={async () => {
                    setEstado(await window.mptrix.nuvem.apagarDados(aApagar))
                    setVerApagar(false)
                    setRecado({ tipo: 'ok', txt: 'Apagado.' })
                  }}
                >
                  Apagar o que está marcado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {verLivro && (
        <div className="modal-overlay" onClick={() => { setVerLivro(false); setLinhasMarcadas(new Set()) }}>
          <div className="modal modal-livro" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <span className="modal-etiqueta">crédito</span>
                <h3>O que já aconteceu</h3>
                <p className="modal-sub">
                  Cada entrada de crédito e cada uso, com hora e valores.
                  <strong>O saldo sai daqui</strong> — apagar uma linha refaz a conta
                  sem ela. A linha vermelha é o uso que encostou no limite: ela some
                  junto se você apagar aquele uso.
                </p>
              </div>
              <button className="btn-close" onClick={() => setVerLivro(false)} aria-label="Fechar">×</button>
            </header>
            <div className="modal-body">
              {(estado.livro?.length || 0) === 0 && (
                <p className="livro-vazio">
                  Nada registrado ainda. As linhas aparecem aqui assim que você
                  informar um crédito ou separar uma música na nuvem.
                </p>
              )}
              <ul className="livro-lista">

                    {estado.livro.map((l, i) => (
                      <li
                        key={l.id || i}
                        className={`${l.tipo} ${linhasMarcadas.has(l.id) ? 'marcada' : ''} ${l.id && l.id === idQueEncostou ? 'encostou' : ''}`}
                      >
                        <button
                          type="button"
                          className="livro-toque"
                          aria-pressed={linhasMarcadas.has(l.id)}
                          onClick={() => setLinhasMarcadas((v) => {
                            const n = new Set(v)
                            if (n.has(l.id)) n.delete(l.id); else n.add(l.id)
                            return n
                          })}
                        >
                          <span className="livro-marca" aria-hidden="true" />
                        </button>
                        <span className="livro-quando">{quandoFoi(l.quando)}</span>
                        <span className="livro-txt">
                          {l.tipo === 'carga'
                            ? (l.adicionado
                              ? <><b>adicionou</b> {emDolar(l.adicionado)} · ficou com {emDolar(l.valor)}{l.sobrava > 0 ? <> (tinha {emDolar(l.sobrava)})</> : null}</>
                              : <><b>informou</b> {emDolar(l.valor)} no total{l.sobrava > 0 ? <> · tinha {emDolar(l.sobrava)} antes</> : null}</>)
                            : l.tipo === 'uso'
                              ? <>
                                {l.miudo
                                  ? <><b>sondas, letra e cifra</b> · {emDolar(l.valor)}</>
                                  : <><b>separou</b> {l.titulo ? <>“{l.titulo}”</> : 'uma música'} · {emDolar(l.valor)}</>}
                                {l.simulado ? <span className="livro-selo">simulado</span> : null}
                                {l.id === idQueEncostou && (
                                  <span className="livro-fim">
                                    foi aqui que o crédito acabou · sobraram{' '}
                                    {emDolar(Math.max(0, estado.creditoInformado - estado.gastoDesdeCredito))}
                                  </span>
                                )}
                              </>
                              : <>
                              <b>{l.motivo === 'sem-credito' ? 'o serviço recusou' : l.motivo === 'teto-do-mes' ? 'bateu no teto do mês' : 'crédito no fim'}</b>
                              {' '}· usei {emDolar(l.gasto)} de {emDolar(l.informado)} · sobraram {emDolar(l.sobra)}
                              {l.motivo === 'sem-credito' ? ' · pode haver saldo pendente lá' : ''}
                              </>}
                        </span>
                      </li>
                ))}
              </ul>
              {/* a limpeza mora AQUI dentro: esta janela é sobre esses dados,
                  então o botão de apagá-los é vizinho deles, não de um menu
                  do outro lado da tela. */}
              <div className="modal-actions">
                {/* o botão do que está marcado só existe quando há marcação:
                    botão de apagar sempre à mostra, sem alvo, é convite ao
                    clique errado */}
                {linhasMarcadas.size > 0 ? (
                  <button
                    className="btn-danger"
                    onClick={async () => {
                      setEstado(await window.mptrix.nuvem.apagarLinhas([...linhasMarcadas]))
                      setLinhasMarcadas(new Set())
                    }}
                  >
                    Apagar {linhasMarcadas.size} linha{linhasMarcadas.size !== 1 ? 's' : ''}
                  </button>
                ) : (
                  <button
                    className="btn-danger"
                    onClick={() => { setVerLivro(false); setVerApagar(true) }}
                  >
                    Apagar dados…
                  </button>
                )}
                {linhasMarcadas.size > 0 && (
                  <span className="livro-nota">
                    a conta é refeita sem elas
                  </span>
                )}
                <span className="modal-espaco" />
                {linhasMarcadas.size > 0 && (
                  <button className="btn-secondary" onClick={() => setLinhasMarcadas(new Set())}>
                    Desmarcar
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => { setVerLivro(false); setLinhasMarcadas(new Set()) }}
                >Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
