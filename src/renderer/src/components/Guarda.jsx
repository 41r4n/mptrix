import { Component } from 'react'

// ██████ A GUARDA ██████
//
// Quando alguma coisa quebra no meio da tela, o React desmonta a árvore
// inteira — e o que sobra é uma janela preta, sem uma palavra. Foi o que
// aconteceu ao abrir a roda: tela preta, e nenhum jeito de saber o que tinha
// estourado sem abrir as ferramentas de desenvolvedor.
//
// Tela preta é o pior modo de falhar: ela não diz o que houve, não diz o que
// fazer, e some com o trabalho de quem estava usando. Aqui a queda passa a
// ter rosto — o que quebrou, onde, e um botão pra voltar.
//
// Ela não conserta bug nenhum. Ela transforma "sumiu tudo" em "quebrou isto
// aqui", que é a diferença entre eu adivinhar e eu consertar.
export default class Guarda extends Component {
  constructor(props) {
    super(props)
    this.state = { erro: null, onde: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    this.setState({ onde: info?.componentStack || null })
    // eslint-disable-next-line no-console
    console.error('[MPTRIX] a tela quebrou:', erro, info)
  }

  render() {
    if (!this.state.erro) return this.props.children

    const msg = this.state.erro?.message || String(this.state.erro)
    // primeira linha da pilha de componentes: é o nome do que quebrou
    const componente = (this.state.onde || '').trim().split('\n')[0]?.trim() || ''

    return (
      <div className="queda">
        <div className="queda-caixa">
          <span className="queda-etiqueta">algo quebrou</span>
          <h1>A tela caiu</h1>
          <p className="queda-msg">{msg}</p>
          {componente && <p className="queda-onde">em {componente}</p>}
          <p className="queda-nota">
            Seus arquivos e as separações já feitas não foram afetados — isto é
            só a tela. Recarregar costuma resolver.
          </p>
          <div className="queda-acoes">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <button className="btn-secondary" onClick={() => this.setState({ erro: null, onde: null })}>
              Tentar continuar
            </button>
          </div>
        </div>
      </div>
    )
  }
}
