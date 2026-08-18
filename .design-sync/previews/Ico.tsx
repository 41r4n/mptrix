// Os 26 desenhos da casa, de uma vez.
//
// Um ícone sozinho não diz nada sobre um jogo de ícones — o que importa é se
// eles parecem da mesma família: mesma espessura de traço, mesma caixa, mesmo
// jeito de arredondar. Isso só aparece com todos lado a lado.
//
// Regra da casa: ícone é desenhado, nunca emoji.
import { Ico } from 'mptrix'

const Superficie = ({ children }: { children: any }) => (
  <div className="mptrix-superficie" style={{ padding: 20, borderRadius: 12 }}>{children}</div>
)

const TODOS = [
  'ampulheta', 'apagar', 'audio_m4a', 'audio_wav', 'aviso', 'baixar',
  'buscar', 'caixa', 'calendario', 'certo', 'copiar', 'estrela',
  'estrelaCheia', 'fast', 'livroReg', 'lixeira', 'music', 'pasta',
  'playlist', 'rapido', 'renomear', 'sair', 'studio', 'tempo', 'tocar', 'video'
] as const

export const Familia = () => (
  <Superficie>
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
      gap: 16,
      color: 'var(--text-2)'
    }}>
      {TODOS.map((nome) => (
        <div key={nome} style={{ display: 'grid', justifyItems: 'center', gap: 7 }}>
          <Ico nome={nome} tamanho={22} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--muted-2)', letterSpacing: '0.04em'
          }}>{nome}</span>
        </div>
      ))}
    </div>
  </Superficie>
)

export const Tamanhos = () => (
  <Superficie>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, color: 'var(--text)' }}>
      {[14, 18, 22, 28, 40].map((t) => (
        <div key={t} style={{ display: 'grid', justifyItems: 'center', gap: 7 }}>
          <Ico nome="ampulheta" tamanho={t} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted-2)' }}>{t}px</span>
        </div>
      ))}
    </div>
  </Superficie>
)

// O traço herda a cor de quem está em volta (`currentColor`), então o mesmo
// desenho serve de rótulo apagado e de destaque lima sem virar outro arquivo.
export const HerdaACor = () => (
  <Superficie>
    <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
      <span style={{ color: 'var(--accent)' }}><Ico nome="tocar" tamanho={26} /></span>
      <span style={{ color: 'var(--text)' }}><Ico nome="studio" tamanho={26} /></span>
      <span style={{ color: 'var(--muted-2)' }}><Ico nome="calendario" tamanho={26} /></span>
      <span style={{ color: 'var(--warn)' }}><Ico nome="aviso" tamanho={26} /></span>
      <span style={{ color: 'var(--bad)' }}><Ico nome="lixeira" tamanho={26} /></span>
    </div>
  </Superficie>
)
