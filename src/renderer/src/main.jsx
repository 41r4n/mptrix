import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Guarda from './components/Guarda.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* a guarda por fora de tudo: erro na tela vira mensagem, não janela preta */}
    <Guarda>
      <App />
    </Guarda>
  </React.StrictMode>
)
