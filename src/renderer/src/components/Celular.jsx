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

  useEffect(() => { window.mptrix.celular?.estado().then(setEstado) }, [])
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

          <div className="celular-acao">
            <button className="btn-secondary" onClick={desligar}>Desligar</button>
            <span className="celular-nota">
              O endereço muda toda vez que você liga — quem tinha o antigo perde o acesso.
            </span>
          </div>
        </>
      )}
    </section>
  )
}
