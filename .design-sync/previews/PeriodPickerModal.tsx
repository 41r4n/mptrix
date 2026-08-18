// A escolha de período do acervo.
//
// Esta peça não desenha um calendário genérico: ela só oferece os períodos que
// EXISTEM no acervo. Por isso o histórico abaixo é inventado mas tem forma de
// verdade — datas espalhadas por meses diferentes de dois anos, que é o que faz
// os degraus (ano → mês → semana → dia) aparecerem povoados no cartão.
//
// O campo é `timestamp`, e isso custou uma rodada: escrevi `createdAt` (o nome
// usado no resto do acervo) e o cartão saiu com "Nada registrado", parecendo
// peça quebrada quando era só a chave errada.
import { PeriodPickerModal } from 'mptrix'

const Superficie = ({ children }: { children: any }) => (
  <div className="mptrix-superficie" style={{
    padding: 20, borderRadius: 12, minHeight: 340, display: 'grid', placeItems: 'center'
  }}>{children}</div>
)

const dia = (aaaa: number, mm: number, dd: number) => new Date(aaaa, mm - 1, dd).getTime()

const ACERVO = [
  { id: 'a1', timestamp: dia(2026, 8, 14) },
  { id: 'a2', timestamp: dia(2026, 8, 9) },
  { id: 'a3', timestamp: dia(2026, 8, 2) },
  { id: 'a4', timestamp: dia(2026, 7, 27) },
  { id: 'a5', timestamp: dia(2026, 7, 12) },
  { id: 'a6', timestamp: dia(2026, 6, 30) },
  { id: 'a7', timestamp: dia(2026, 5, 18) },
  { id: 'a8', timestamp: dia(2025, 12, 24) },
  { id: 'a9', timestamp: dia(2025, 11, 3) }
]

export const Padrao = () => (
  <Superficie>
    <PeriodPickerModal history={ACERVO} onApply={() => {}} onClose={() => {}} />
  </Superficie>
)
