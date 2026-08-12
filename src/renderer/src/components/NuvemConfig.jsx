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

  // ██████ O JORNAL DO CRÉDITO ██████
  //
  // Número sozinho não é notícia. "US$ 4,20" não diz se é muito ou pouco —
  // quem nunca usou não tem régua pra saber. A frase dá a régua: traduz o
  // mesmo número em "dá pra continuar" ou "é hora de comprar", e diz o que
  // acontece se ignorar.
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
                  <i>gastos este mês</i>
                </div>
                <span className="credito-fio" aria-hidden="true" />
                <div className="credito-lado">
                  <span><b>{estado.musicasFeitas}</b> músicas</span>
                  <span><b>{porMusica ? emDolar(porMusica) : '—'}</b> cada</span>
                  {estado.gastoMesPassado > 0 && (
                    <span><b>{emDolar(estado.gastoMesPassado)}</b> mês passado</span>
                  )}
                </div>
                <span className="credito-espaco" />
                {/* o botão PEDE quando aperta: cor de aviso e batida devagar.
                    Botão que muda de comportamento conforme a situação é o
                    jeito de a tela falar sem escrever mais uma linha. */}
                <button
                  className={`btn-primary credito-ir ${jornal.nivel === 'parou' || jornal.nivel === 'pouco' ? 'pedindo' : ''}`}
                  onClick={() => window.mptrix.shell.openExternal(PAINEL_CREDITO)}
                >
                  <Ico nome="baixar" tamanho={15} />
                  Ver saldo e comprar crédito
                </button>
              </div>

              {/* O JORNAL é um CARTÃO, não uma linha de texto. Ele estava
                  escrito no mesmo peso do resto e sumia entre parágrafos — e
                  ele é a única peça da tela que responde "posso continuar
                  usando?". Informação que decide comportamento não pode ter o
                  mesmo peso de informação que só contextualiza. */}
              <div className={`jornal ${jornal.nivel}`}>
                <span className="jornal-canto tl" aria-hidden="true" />
                <span className="jornal-canto br" aria-hidden="true" />
                <div className="jornal-cab">
                  <span className="jornal-luz" aria-hidden="true" />
                  <b>{jornal.titulo}</b>
                  <span className="jornal-risco" aria-hidden="true" />
                  <span className="jornal-hachura" aria-hidden="true" />
                </div>

                {estado.creditoInformado > 0 && (
                  <div className="jornal-medida">
                    {/* TRANCADO = ZERO UTILIZÁVEL. O que sobrou continua na
                        conta lá, mas pra este app é dinheiro que não pode ser
                        tocado — mostrar a sobra como se fosse saldo daria a
                        entender que ainda dá pra usar. O valor real aparece do
                        lado, dito pelo nome certo. */}
                    <span className="jornal-sobra">
                      {estado.paradaPor ? emDolar(0) : emDolar(Math.max(0, estado.creditoInformado - estado.gastoDesdeCredito))}
                    </span>
                    <span className="jornal-de">
                      {estado.paradaPor
                        ? <>utilizável · sobraram {emDolar(Math.max(0, estado.creditoInformado - estado.gastoDesdeCredito))} parados lá</>
                        : <>de {emDolar(estado.creditoInformado)}</>}
                    </span>
                  </div>
                )}

                <p>{jornal.txt}</p>

                {/* a barra mora AQUI, não no campo: ela é estado, não entrada.
                    Número é preciso, barra é imediata — dá pra ver de longe que
                    está apertando, sem ler nada. */}
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

              {estado.livro?.length > 0 && (
                <div className="livro">
                  {/* fechado por padrão: o histórico é consulta, não leitura de
                      todo dia — e aberto ele empurrava pra fora da tela o
                      campo e o jornal, que são o assunto */}
                  <button
                    className="livro-abrir"
                    onClick={() => setVerLivro((v) => !v)}
                    aria-expanded={verLivro}
                    type="button"
                  >
                    <span className={`livro-seta ${verLivro ? 'on' : ''}`} aria-hidden="true" />
                    ver histórico
                    <span className="livro-conta">{estado.livro.length}</span>
                  </button>
                  {verLivro && (
                  <ul>
                    {estado.livro.slice(0, 8).map((l, i) => (
                      <li key={i} className={l.tipo === 'carga' ? 'carga' : 'fim'}>
                        <span className="livro-quando">{quandoFoi(l.quando)}</span>
                        <span className="livro-txt">
                          {l.tipo === 'carga'
                            ? <><b>carregou</b> {emDolar(l.valor)}{l.sobrava > 0 ? <> · sobravam {emDolar(l.sobrava)} antes</> : null}</>
                            : <>
                              <b>{l.motivo === 'sem-credito' ? 'o serviço recusou' : l.motivo === 'teto-do-mes' ? 'bateu no teto do mês' : 'crédito no fim'}</b>
                              {' '}· usei {emDolar(l.gasto)} de {emDolar(l.informado)} · sobraram {emDolar(l.sobra)}
                              {l.motivo === 'sem-credito' ? ' · pode haver saldo pendente lá' : ''}
                            </>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  )}
                </div>
              )}

              <p className="nuvem-texto miudo">
                <strong>O saldo fica com o Replicate.</strong> A conta deles não
                deixa o MPTRIX ler quanto sobrou, então o número acima é só o que
                ELE gastou — estimado pelo preço da máquina de cada trabalho, com
                folga pros modelos próprios (a nuvem cobra o tempo de ligar deles).
                O valor exato e o saldo estão no botão acima.
              </p>

              {/* ██████ O FREIO ██████
                  A pergunta mudou, e é isso que faz ela ter resposta.
                  Antes: "quanto deixo gastar?" — ninguém sabe responder, e
                  quem não sabe deixa em zero, que é ficar sem freio nenhum.
                  Agora: "quanto você pôs de crédito?" — número que a pessoa
                  acabou de digitar no cartão e tem na cabeça.
                  Com ele o app faz a conta que o Replicate não deixa fazer:
                  sobra = o que você pôs menos o que eu gastei desde então. E
                  para em 85%, antes de encostar, porque o gasto daqui é
                  ESTIMADO — parar em cima do valor exato deixaria a dívida
                  acontecer justamente por erro de arredondamento. */}
              {/* A PERGUNTA É "QUANTO VOCÊ TEM", não "quanto você pôs".
                  Parece a mesma coisa e não é. "Quanto pôs" quebra quando a
                  pessoa recarrega antes de acabar: ela tinha 10, gastou 4,
                  compra mais 10 e digita 20 — mas tem 16, e o app passaria a
                  achar que tem 4 a mais do que tem.
                  "Quanto tem agora" resolve dois problemas de uma vez: o
                  número está escrito na página do Replicate, então é fácil de
                  responder; e cada atualização CORRIGE qualquer desvio que a
                  minha estimativa tenha acumulado, porque o contador
                  recomeça do valor real em vez de continuar de um chute. */}
              {/* RECADO GRANDE, e não nota de rodapé. Se a pessoa não
                  atualizar o número depois de recarregar, TODO o resto vira
                  mentira: o jornal mostra sobra errada, o freio para na hora
                  errada, e o app perde a única informação que ele não tem como
                  descobrir sozinho. É a instrução mais importante desta tela,
                  então tem o peso da mais importante. */}
              <div className="mandamento">
                <span className="mandamento-luz" aria-hidden="true" />
                <div>
                  <b>sempre atualize seu crédito</b>
                  <p>
                    Toda vez que comprar ou recarregar, venha aqui e escreva{' '}
                    <strong>exatamente quanto você tem agora</strong> no Replicate — o
                    número que aparece lá em <em>Crédito restante</em>, com centavos
                    (ex.: 153,85). É só assim que eu sei a sua carga de verdade: eu não
                    consigo ler esse valor sozinho.
                  </p>
                </div>
              </div>

              <div className="freio">
                <label className="freio-campo">
                  <span>Quanto você tem de crédito agora?</span>
                  <div className="freio-linha">
                    <em>US$</em>
                    <input
                      type="number"
                      className="nuvem-campo curto"
                      min="0"
                      step="0.01"
                      value={rascunho ?? (estado.creditoInformado ? (estado.creditoInformado / 100) : '')}
                      placeholder="0,00"
                      onChange={(e) => setRascunho(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      onBlur={async () => {
                        if (rascunho === null) return
                        const dolares = Number(String(rascunho).replace(',', '.')) || 0
                        setRascunho(null)
                        // não incomoda o motor se o número não mudou
                        if (Math.round(dolares * 100) === estado.creditoInformado) return
                        setEstado(await window.mptrix.nuvem.credito(Math.round(dolares * 100)))
                      }}
                    />
                    {rascunho !== null && (
                      <button
                        className="freio-ok"
                        onClick={(e) => e.currentTarget.previousElementSibling?.blur()}
                        type="button"
                      >confirmar</button>
                    )}
                    <span className="nuvem-unidade">
                      {estado.creditoInformado
                        ? <>o número está na página do Replicate, em <strong>Crédito restante</strong> — sempre que você recarregar, atualize aqui</>
                        : <>o número está na página do Replicate, em <strong>Crédito restante</strong></>}
                    </span>
                  </div>
                </label>

                <p className="nuvem-texto miudo">
                  {estado.creditoInformado
                    ? <>Sempre que atualizar esse número, meu contador recomeça do zero e
                      passa a medir a partir dele — então não precisa somar nada de
                      cabeça, e qualquer erro que eu tenha acumulado se corrige junto.</>
                    : <><strong>Sem esse número não existe freio.</strong> O crédito acabar
                      não trava o serviço: o que passar vira dívida e eles suspendem a conta
                      até quitar. Com ele, o MPTRIX para antes e volta a separar aqui.</>}
                </p>
              </div>
            </>
          )}

        {recado && <p className={`nuvem-recado ${recado.tipo}`}>{recado.txt}</p>}
      </div>
    </section>
  )
}
