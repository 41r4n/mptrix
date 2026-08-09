import { useMemo, useState } from 'react'
import Ico from './Icones.jsx'

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const PRESETS = [
  { value: 'all', label: 'Sempre' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'thisMonth', label: 'Este mês' },
  { value: 'thisYear', label: 'Este ano' }
]

function buildAvailability(history) {
  const years = new Map()
  for (const e of history) {
    if (!e.timestamp) continue
    const d = new Date(e.timestamp)
    if (isNaN(d)) continue
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    const week = Math.min(Math.ceil(day / 7), 5)

    if (!years.has(year)) years.set(year, new Map())
    const months = years.get(year)
    if (!months.has(month)) months.set(month, new Map())
    const weeks = months.get(month)
    if (!weeks.has(week)) weeks.set(week, new Set())
    weeks.get(week).add(day)
  }
  return years
}

function setToArr(s) { return Array.from(s) }

export default function PeriodPickerModal({ history, initial, onApply, onClose }) {
  const [mode, setMode] = useState(initial?.mode ?? 'all')
  const [preset, setPreset] = useState(initial?.preset ?? 'all')
  const [years, setYears] = useState(() => new Set(initial?.years ?? []))
  const [months, setMonths] = useState(() => new Set(initial?.months ?? []))
  const [weeks, setWeeks] = useState(() => new Set(initial?.weeks ?? []))
  const [days, setDays] = useState(() => new Set(initial?.days ?? []))

  const availability = useMemo(() => buildAvailability(history), [history])

  const availableYears = useMemo(() => [...availability.keys()].sort((a, b) => b - a), [availability])

  const availableMonths = useMemo(() => {
    const out = []
    for (const y of years) {
      const monthsMap = availability.get(y)
      if (!monthsMap) continue
      for (const m of [...monthsMap.keys()].sort((a, b) => a - b)) {
        out.push({ key: `${y}-${m}`, year: y, month: m })
      }
    }
    return out
  }, [years, availability])

  const availableWeeks = useMemo(() => {
    const out = []
    for (const monthKey of months) {
      const [y, m] = monthKey.split('-').map(Number)
      const weeksMap = availability.get(y)?.get(m)
      if (!weeksMap) continue
      for (const w of [...weeksMap.keys()].sort((a, b) => a - b)) {
        out.push({ key: `${y}-${m}-${w}`, year: y, month: m, week: w })
      }
    }
    return out
  }, [months, availability])

  const availableDays = useMemo(() => {
    const out = []
    for (const weekKey of weeks) {
      const [y, m, w] = weekKey.split('-').map(Number)
      const daysSet = availability.get(y)?.get(m)?.get(w)
      if (!daysSet) continue
      for (const d of [...daysSet].sort((a, b) => a - b)) {
        out.push({ key: `${y}-${m}-${d}`, year: y, month: m, day: d })
      }
    }
    return out
  }, [weeks, availability])

  const switchMode = (next) => {
    setMode(next)
    if (next === 'all' || next === 'preset') {
      setYears(new Set()); setMonths(new Set()); setWeeks(new Set()); setDays(new Set())
    }
  }

  const toggle = (collection, setter, key, options = {}) => {
    setMode('hierarchical')
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      if (options.onChange) options.onChange(next)
      return next
    })
  }

  const toggleYear = (y) => {
    toggle(years, setYears, y, {
      onChange: (next) => {
        setMonths((prevM) => {
          const filtered = new Set([...prevM].filter((k) => next.has(Number(k.split('-')[0]))))
          setWeeks((prevW) => new Set([...prevW].filter((k) => filtered.has(k.split('-').slice(0, 2).join('-')))))
          setDays((prevD) => new Set([...prevD].filter((k) => {
            const [yy, mm] = k.split('-').map(Number)
            return next.has(yy) && filtered.has(`${yy}-${mm}`)
          })))
          return filtered
        })
      }
    })
  }

  const toggleMonth = (key) => {
    toggle(months, setMonths, key, {
      onChange: (next) => {
        setWeeks((prev) => new Set([...prev].filter((k) => next.has(k.split('-').slice(0, 2).join('-')))))
        setDays((prev) => new Set([...prev].filter((k) => {
          const [yy, mm] = k.split('-').map(Number)
          return next.has(`${yy}-${mm}`)
        })))
      }
    })
  }

  const toggleWeek = (key) => {
    toggle(weeks, setWeeks, key, {
      onChange: (next) => {
        setDays((prev) => new Set([...prev].filter((k) => {
          const [yy, mm, dd] = k.split('-').map(Number)
          const w = Math.min(Math.ceil(dd / 7), 5)
          return next.has(`${yy}-${mm}-${w}`)
        })))
      }
    })
  }

  const toggleDay = (key) => toggle(days, setDays, key)

  const clearAll = () => {
    setMode('all'); setPreset('all')
    setYears(new Set()); setMonths(new Set()); setWeeks(new Set()); setDays(new Set())
  }

  const apply = () => {
    if (mode === 'all') return onApply({ mode: 'all' })
    if (mode === 'preset') return onApply({ mode: 'preset', preset })
    return onApply({
      mode: 'hierarchical',
      years: setToArr(years),
      months: setToArr(months),
      weeks: setToArr(weeks),
      days: setToArr(days)
    })
  }

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter') apply()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* Mesma lingua do acervo: chassi cavado com chanfro de contorno
          fechado, marca lima na quina, rotulo mono em caixa-alta. O
          funcionamento nao mudou uma linha — so o vestuario. */}
      <div className="period-caixa" onClick={(e) => e.stopPropagation()}>
      <div className="modal modal-period chanfro" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <header className="period-head">
          <div>
            <span className="period-etiqueta">Filtro</span>
            <h3>Período</h3>
          </div>
          <button className="period-x chanfro" onClick={onClose} aria-label="Fechar" type="button">
            <Ico nome="apagar" tamanho={15} />
          </button>
        </header>

        <div className="modal-body period-body">
          <div className="period-presets">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                className={`preset-chip chanfro ${mode === 'all' && p.value === 'all' ? 'active' : ''} ${mode === 'preset' && preset === p.value ? 'active' : ''}`}
                onClick={() => {
                  if (p.value === 'all') switchMode('all')
                  else { switchMode('preset'); setPreset(p.value) }
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="period-divider">
            <span>ou explore em detalhe</span>
          </div>

          <div className="period-columns">
            <PeriodColumn
              tom="t1"
              title="Ano"
              items={availableYears.map((y) => ({ key: y, label: String(y) }))}
              selected={years}
              empty="Nada registrado."
              onToggle={(k) => toggleYear(Number(k))}
            />
            <PeriodColumn
              tom="t2"
              title="Mês"
              items={availableMonths.map(({ key, year, month }) => ({
                key,
                label: `${MONTH_SHORT[month - 1]} ${availableYears.length > 1 ? year : ''}`.trim(),
                sublabel: MONTH_NAMES[month - 1]
              }))}
              selected={months}
              empty={years.size === 0 ? 'Selecione um ano →' : 'Nada nesses anos.'}
              onToggle={toggleMonth}
              disabled={years.size === 0}
            />
            <PeriodColumn
              tom="t3"
              title="Semana"
              items={availableWeeks.map(({ key, week, month, year }) => {
                const start = (week - 1) * 7 + 1
                const end = Math.min(week * 7, new Date(year, month, 0).getDate())
                return {
                  key,
                  label: `${start}–${end}`,
                  sublabel: `Semana ${week} · ${MONTH_SHORT[month - 1]}`
                }
              })}
              selected={weeks}
              empty={months.size === 0 ? 'Selecione um mês →' : 'Nada nesses meses.'}
              onToggle={toggleWeek}
              disabled={months.size === 0}
            />
            <PeriodColumn
              tom="t4"
              title="Dia"
              items={availableDays.map(({ key, year, month, day }) => {
                const date = new Date(year, month - 1, day)
                return {
                  key,
                  label: String(day).padStart(2, '0'),
                  sublabel: `${WEEKDAY_SHORT[date.getDay()]} · ${MONTH_SHORT[month - 1]}`
                }
              })}
              selected={days}
              empty={weeks.size === 0 ? 'Selecione uma semana →' : 'Nada nessas semanas.'}
              onToggle={toggleDay}
              disabled={weeks.size === 0}
            />
          </div>
        </div>

        <div className="period-footer">
          <button className="period-limpar" onClick={clearAll} type="button">limpar tudo</button>
          <div className="period-footer-actions">
            <button className="period-btn chanfro" onClick={onClose} type="button">Cancelar</button>
            <button className="period-btn chanfro forte" onClick={apply} type="button">Aplicar</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

function PeriodColumn({ title, items, selected, onToggle, disabled, empty, tom }) {
  return (
    <div className={`period-col chanfro ${tom} ${disabled ? 'disabled' : ''}`}>
      <div className="period-col-head">
        <span>{title}</span>
        {selected.size > 0 && <span className="period-col-count">{selected.size}</span>}
      </div>
      <div className="period-col-list">
        {items.length === 0 ? (
          <div className="period-col-empty">{empty}</div>
        ) : (
          items.map((it) => {
            const isSelected = selected.has(it.key)
            return (
              <label key={it.key} className={`period-item ${isSelected ? 'selected' : ''}`}>
                {/* a caixinha nativa do Windows chega com a paleta dela e nao
                    obedece nem a espessura do traco — o input continua ai pro
                    teclado e pro leitor de tela, invisivel, e quem aparece e
                    a marca desenhada */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(it.key)}
                />
                <span className="period-marca" aria-hidden="true" />
                <div className="period-item-text">
                  <div className="period-item-label">{it.label}</div>
                  {it.sublabel && <div className="period-item-sub">{it.sublabel}</div>}
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}
