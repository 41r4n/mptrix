import { useEffect, useState } from 'react'
import Ico from './Icones.jsx'

// ██████████ ENSAIAR PELO CELULAR ██████████
//
// O computador serve uma página; o celular abre pelo navegador, na rede de
// casa. Sem loja, sem instalar nada.
//
// SAI DESLIGADO, e isso é decisão: abrir uma porta na rede é coisa que o dono
// manda fazer, não que o programa faça por conta própria porque acha que seria
// útil. Enquanto está desligado, não existe porta nenhuma.
export default function Celular() {
  const [estado, setEstado] = useState(null)
  const [copiado, setCopiado] = useState(false)
  // O QUE O CELULAR PEDIU. Enquanto ligado, esta lista se atualiza sozinha:
  // é a única maneira de saber, do lado do computador, se o pedido do telefone
  // chegou — e o que foi respondido a ele.
  const [pedidos, setPedidos] = useState([])

  useEffect(() => { window.mptrix.celular?.estado().then(setEstado) }, [])
  useEffect(() => {
    if (!estado?.ligado) return
    const puxar = () => window.mptrix.celular.pedidos().then(setPedidos).catch(() => {})
    puxar()
    const t = setInterval(puxar, 1500)
    return () => clearInterval(t)
  }, [estado?.ligado])
  if (!estado) return null

  const ligar = async () => setEstado(await window.mptrix.celular.ligar())
  const desligar = async () => { setEstado(await window.mptrix.celular.desligar()); setCopiado(false) }

  const copiar = async (url) => {
    await window.mptrix.clipboard.copiarTexto(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 4000)
  }

  return (
    <section className="celular">
      <div className="celular-cab">
        <span className="celular-olho">ensaiar sem o computador</span>
        <h3>Abrir o estúdio no celular</h3>
        <p className="celular-sub">
          O celular toca puxando daqui, pela rede de casa — <strong>sem ocupar espaço nele</strong> e
          sem instalar nada. Você mexe no mixer, tira a voz, isola a guitarra e repete o
          trecho, com o computador fazendo o trabalho.
        </p>
      </div>

      {!estado.ligado ? (
        <div className="celular-acao">
          <button className="btn-primary celular-ir" onClick={ligar}>
            <Ico nome="sair" tamanho={15} /> Ligar agora
          </button>
          <span className="celular-nota">
            Fica valendo só enquanto o MPTRIX estiver aberto, e só dentro da sua rede.
          </span>
        </div>
      ) : (
        <>
          {/* UM ENDEREÇO POR REDE. O computador pode estar no cabo e no Wi-Fi ao
              mesmo tempo, e só um dos dois é o que o celular enxerga. Escolher
              por conta própria seria dar o endereço errado metade das vezes —
              melhor mostrar os dois e deixar a pessoa tentar. */}
          <ol className="celular-passos">
            <li><span>1</span><div>Deixe o celular na <strong>mesma rede Wi-Fi</strong> deste computador</div></li>
            <li><span>2</span><div>Abra o navegador do celular e digite o endereço abaixo</div></li>
            <li><span>3</span><div>Pronto — o seu acervo separado aparece lá</div></li>
          </ol>

          {estado.enderecos.length === 0 ? (
            <p className="celular-aviso">
              <Ico nome="aviso" tamanho={14} />
              <span>Não achei nenhuma rede neste computador. Ele está conectado no Wi-Fi ou no cabo?</span>
            </p>
          ) : estado.enderecos.map((e) => (
            <div className="celular-endereco" key={e.url}>
              <span className="celular-rede">{e.nome}</span>
              <code>{e.url}</code>
              <button className="celular-copiar" onClick={() => copiar(e.url)}>copiar</button>
            </div>
          ))}

          {copiado && <p className="celular-ok">Endereço copiado. Mande pra você mesmo e abra no celular.</p>}

          {/* O DIÁRIO DE BORDO. Vazio significa uma coisa muito específica: o
              pedido do celular não chegou aqui — problema de rede, não de
              senha nem de programa. Cheio, cada linha diz o que ele pediu e o
              que respondi. */}
          <div className="celular-diario">
            <span className="celular-rede">o que o celular pediu</span>
            {pedidos.length === 0 ? (
              <p className="celular-nada">
                Nada ainda. Se o celular já tentou abrir e isto continua vazio,
                o pedido não está chegando até aqui — é a rede entre os dois.
              </p>
            ) : (
              <ul>
                {pedidos.slice(0, 8).map((p, i) => (
                  <li key={i} className={p.resposta >= 400 ? 'ruim' : ''}>
                    <b>{p.resposta}</b>
                    <span>{p.caminho}</span>
                    <i>{p.de} · {p.quando}</i>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="celular-acao">
            <button className="btn-secondary" onClick={desligar}>Desligar</button>
            <span className="celular-nota">
              O endereço é sempre este, mesmo fechando e abrindo o app — por isso o
              que o celular levou pro ensaio continua valendo.
            </span>
          </div>
        </>
      )}
    </section>
  )
}
