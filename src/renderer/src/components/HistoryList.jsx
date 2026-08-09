import { useEffect, useMemo, useRef, useState } from 'react'
import Ico from './Icones.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import EditEntryModal from './EditEntryModal.jsx'
import BatchActionsDialog from './BatchActionsDialog.jsx'
import PeriodPickerModal from './PeriodPickerModal.jsx'

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const PRESET_LABELS = {
  all: 'Sempre',
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  thisMonth: 'Este mês',
  thisYear: 'Este ano',
  lastMonth: 'Mês passado',
  lastYear: 'Ano passado'
}


const TYPE_FILTERS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'music', label: 'Música única' },
  { value: 'playlist', label: 'Playlist' },
  { value: 'fast', label: 'Rápido' },
  { value: 'video', label: 'Vídeo' }
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'largest', label: 'Maior arquivo' },
  { value: 'smallest', label: 'Menor arquivo' }
]

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.round((now - d) / 60000)
  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `há ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `há ${diffD} d`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function displayTitle(entry) {
  return entry.customName || entry.displayName || entry.title || '(sem nome)'
}

// Capa colorida: hash simples do título -> uma das 6 cores de stem do design

// Iniciais da capa: 1ª letra das 2 primeiras palavras

// Badge de origem da capa: derivado do que o item já mostra (ext/qualidade/preset)
function originBadge(entry) {
  if (entry.ext) return entry.ext.toUpperCase()
  if (entry.qualityLabel) return entry.qualityLabel
  return (entry.presetName || '').slice(0, 8) || '—'
}

function matchesQuery(entry, q) {
  if (!q) return true
  const haystack = [
    entry.customName, entry.displayName, entry.title, entry.url,
    entry.presetName, entry.qualityLabel, entry.ext
  ].filter(Boolean).join(' ').toLowerCase()
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  return terms.every((t) => haystack.includes(t))
}

function inPresetPeriod(timestamp, period) {
  if (period === 'all' || !timestamp) return true
  const t = new Date(timestamp).getTime()
  if (isNaN(t)) return true
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  if (period === 'today') return t >= todayStart
  if (period === '7d') return t >= todayStart - 7 * 86400000
  if (period === '30d') return t >= todayStart - 30 * 86400000
  if (period === 'thisMonth') return t >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  if (period === 'thisYear') return t >= new Date(now.getFullYear(), 0, 1).getTime()
  if (period === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
    const end = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    return t >= start && t < end
  }
  if (period === 'lastYear') {
    const start = new Date(now.getFullYear() - 1, 0, 1).getTime()
    const end = new Date(now.getFullYear(), 0, 1).getTime()
    return t >= start && t < end
  }
  return true
}

function inHierarchicalPeriod(timestamp, sel) {
  if (!timestamp) return false
  const d = new Date(timestamp)
  if (isNaN(d)) return false
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const week = Math.min(Math.ceil(day / 7), 5)

  const years = new Set(sel.years || [])
  const months = new Set(sel.months || [])
  const weeks = new Set(sel.weeks || [])
  const days = new Set(sel.days || [])

  if (years.size === 0) return false
  if (!years.has(year)) return false
  if (months.size === 0) return true
  if (!months.has(`${year}-${month}`)) return false
  if (weeks.size === 0) return true
  if (!weeks.has(`${year}-${month}-${week}`)) return false
  if (days.size === 0) return true
  return days.has(`${year}-${month}-${day}`)
}

function matchesPeriod(timestamp, periodSel) {
  if (!periodSel || periodSel.mode === 'all') return true
  if (periodSel.mode === 'preset') return inPresetPeriod(timestamp, periodSel.preset)
  if (periodSel.mode === 'hierarchical') return inHierarchicalPeriod(timestamp, periodSel)
  return true
}

function summarizePeriod(sel) {
  if (!sel || sel.mode === 'all') return 'Sempre'
  if (sel.mode === 'preset') return PRESET_LABELS[sel.preset] || 'Sempre'

  const days = sel.days || []
  const weeks = sel.weeks || []
  const months = sel.months || []
  const years = sel.years || []

  if (days.length > 0) return `${days.length} dia${days.length !== 1 ? 's' : ''}`
  if (weeks.length > 0) return `${weeks.length} semana${weeks.length !== 1 ? 's' : ''}`
  if (months.length > 0) {
    if (months.length <= 2) {
      return months.map((k) => {
        const [y, m] = k.split('-').map(Number)
        return `${MONTH_SHORT[m - 1]}/${String(y).slice(2)}`
      }).join(', ')
    }
    return `${months.length} meses`
  }
  if (years.length > 0) {
    if (years.length <= 3) return years.sort().join(', ')
    return `${years.length} anos`
  }
  return 'Sempre'
}

function sortEntries(entries, sortBy) {
  const arr = [...entries]
  if (sortBy === 'newest') return arr.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  if (sortBy === 'oldest') return arr.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
  if (sortBy === 'largest') return arr.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0))
  if (sortBy === 'smallest') return arr.sort((a, b) => (a.fileSize || 0) - (b.fileSize || 0))
  return arr
}

export default function HistoryList({ history, onChange, onOpenStudio, onQuickEdit }) {
  const [unlockedIds, setUnlockedIds] = useState(() => new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [confirmState, setConfirmState] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  // CAPA DE VERDADE. O MP3 baixado com capa traz a miniatura do video embutida
  // — o motor extrai uma vez e guarda em cache. Sem isso a alternativa era a
  // capa falsa de cor sorteada, que era justamente o que estava feio.
  const [capas, setCapas] = useState({})
  const capasPedidas = useRef(new Set())
  const [batchActionsOpen, setBatchActionsOpen] = useState(false)
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [periodSelection, setPeriodSelection] = useState({ mode: 'all' })
  const [sortBy, setSortBy] = useState('newest')
  const [soFavoritos, setSoFavoritos] = useState(false)

  const filtered = useMemo(() => {
    const out = history.filter((e) => {
      if (!matchesQuery(e, query.trim())) return false
      if (filterType !== 'all' && e.presetId !== filterType) return false
      if (!matchesPeriod(e.timestamp, periodSelection)) return false
      if (soFavoritos && !e.favorito) return false
      return true
    })
    return sortEntries(out, sortBy)
  }, [history, query, filterType, periodSelection, sortBy, soFavoritos])
  const totalFavoritos = useMemo(() => history.filter((e) => e.favorito).length, [history])

  const periodActive = periodSelection.mode !== 'all'
  const hasActiveFilters = query.trim() || filterType !== 'all' || periodActive || sortBy !== 'newest' || soFavoritos

  if (!history || history.length === 0) {
    return (
      <div className="history-empty">
        Nenhum download ainda. Quando você baixar algo, vai aparecer aqui.
      </div>
    )
  }

  const openFile = (entry) => entry.primaryFile && window.mptrix.shell.openPath(entry.primaryFile)
  const showInExplorer = (entry) => entry.primaryFile && window.mptrix.shell.showInFolder(entry.primaryFile)

  const toggleLock = (id) => {
    setUnlockedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const closeConfirm = () => setConfirmState(null)

  const askRemoveOne = (entry) => {
    setConfirmState({
      title: 'Apagar de verdade?',
      message: `"${displayTitle(entry)}"`,
      note: 'Sai da lista, o arquivo vai pra Lixeira do Windows e as faixas separadas são apagadas. Dá pra recuperar o arquivo na Lixeira se mudar de ideia.',
      confirmLabel: 'Apagar tudo',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        closeConfirm()
        const updated = await window.mptrix.history.remove(entry.id, { deleteFile: true })
        setUnlockedIds((prev) => {
          const next = new Set(prev)
          next.delete(entry.id)
          return next
        })
        onChange?.(updated)
      }
    })
  }

  const enterSelectionMode = () => {
    setSelectionMode(true)
    setSelectedIds(new Set())
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  // FAVORITO — marca do dono, guardada no registro. Nao mexe em arquivo:
  // o acervo ja tem 99 itens e sem marcacao a unica forma de reachar uma
  // musica e lembrar do nome dela.
  const toggleFavorito = async (entry) => {
    // A ponte pro motor so e reconstruida quando o app reinicia — a tela
    // recarrega sozinha, o preload nao. Sem esta guarda o clique morria
    // calado, que e o pior jeito de falhar: parece botao quebrado.
    if (!window.mptrix?.history?.favorite) {
      setConfirmState({
        title: 'Precisa reiniciar o MPTRIX',
        message: 'O favorito acabou de ser instalado no motor. A tela já atualizou sozinha, mas a ponte com o motor só é refeita quando o app abre de novo — feche e abra o MPTRIX que a estrela passa a funcionar.',
        confirmLabel: 'Entendi',
        onConfirm: () => setConfirmState(null)
      })
      return
    }
    const r = await window.mptrix.history.favorite(entry.id, !entry.favorito)
    if (r?.updated) onChange?.(r.updated)
  }

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const VISIBLE_LIMIT = 100
  const visible = filtered.slice(0, VISIBLE_LIMIT)

  // Busca a capa dos itens à vista, um pedido por arquivo (o motor guarda em
  // cache no disco; aqui só evito repetir o pedido na mesma sessão).
  useEffect(() => {
    let vivo = true
    ;(async () => {
      for (const e of visible) {
        const f = e.primaryFile
        if (!f || capasPedidas.current.has(f)) continue
        capasPedidas.current.add(f)
        try {
          const url = await window.mptrix.history.capa(f)
          if (!vivo) return
          if (url) setCapas((c) => ({ ...c, [f]: url }))
        } catch { /* sem capa: o cartão cai no desenho de reserva */ }
      }
    })()
    return () => { vivo = false }
  }, [visible])
  const hiddenCount = filtered.length - visible.length

  const selectAllVisible = () => setSelectedIds(new Set(visible.map((e) => e.id)))
  const deselectAll = () => setSelectedIds(new Set())

  const performBatchDelete = async () => {
    let updated = history
    for (const id of selectedIds) {
      updated = await window.mptrix.history.remove(id, { deleteFile: true })
    }
    onChange?.(updated)
    exitSelectionMode()
  }

  const askBatchDeleteSecond = (items) => {
    setConfirmState({
      title: 'Última confirmação',
      message: `Apagar de verdade ${items.length} item${items.length !== 1 ? 's' : ''}?`,
      note: 'Os arquivos vão pra Lixeira do Windows e as faixas separadas são apagadas. Dá pra recuperar os arquivos na Lixeira se mudar de ideia.',
      confirmLabel: 'Sim, apagar tudo',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        closeConfirm()
        await performBatchDelete()
      }
    })
  }

  const askBatchDelete = () => {
    if (selectedIds.size === 0) return
    const items = history.filter((e) => selectedIds.has(e.id))
    const titles = items.map(displayTitle)
    const visible = titles.slice(0, 6)
    const extra = titles.length > 6 ? titles.length - 6 : 0
    setConfirmState({
      title: `Apagar ${items.length} item${items.length !== 1 ? 's' : ''} do histórico?`,
      list: visible,
      note: extra > 0 ? `…e mais ${extra} item${extra !== 1 ? 's' : ''}.` : null,
      confirmLabel: 'Continuar →',
      cancelLabel: 'Cancelar',
      danger: false,
      onConfirm: () => askBatchDeleteSecond(items)
    })
  }

  const askClearAll = () => {
    setConfirmState({
      title: 'Limpar TODO o histórico?',
      message: `${history.length} item${history.length !== 1 ? 's' : ''} serão removidos da lista.`,
      note: 'Os arquivos baixados continuam onde estão. Essa ação não pode ser desfeita.',
      confirmLabel: 'Limpar tudo',
      cancelLabel: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        closeConfirm()
        const updated = await window.mptrix.history.clear()
        onChange?.(updated)
        setUnlockedIds(new Set())
      }
    })
  }

  const performShare = async () => {
    const items = history.filter((e) => selectedIds.has(e.id))
    const paths = items.map((e) => e.primaryFile).filter(Boolean)
    if (paths.length === 0) {
      setConfirmState({
        title: 'Nenhum arquivo disponível',
        message: 'Os arquivos selecionados não foram encontrados no disco.',
        confirmLabel: 'OK',
        cancelLabel: null,
        danger: false,
        onConfirm: closeConfirm
      })
      return
    }
    const result = await window.mptrix.shell.copyFilesToClipboard(paths)
    if (result?.error) {
      setConfirmState({
        title: 'Não consegui copiar',
        message: result.error,
        confirmLabel: 'OK',
        danger: true,
        onConfirm: closeConfirm
      })
      return
    }
    setConfirmState({
      title: '📋 Arquivos copiados!',
      message: `${result.count} arquivo${result.count !== 1 ? 's foram copiados' : ' foi copiado'} pra área de transferência.`,
      note: 'Vai em qualquer app (WhatsApp Web, Discord, email, pasta do Windows…) e aperta Ctrl+V pra colar os arquivos como anexo.',
      confirmLabel: 'Entendi',
      danger: false,
      onConfirm: () => {
        closeConfirm()
        exitSelectionMode()
      }
    })
  }

  const visibleSelectedCount = filtered.filter((e) => selectedIds.has(e.id)).length
  const allVisibleSelected = filtered.length > 0 && visibleSelectedCount === filtered.length

  const resetFilters = () => {
    setQuery('')
    setFilterType('all')
    setPeriodSelection({ mode: 'all' })
    setSortBy('newest')
    setSoFavoritos(false)
  }

  return (
    <div>
      {/* BARRA DE COMANDO: uma fileira só.
          Eram três empilhadas (busca, filtros, seleção) antes de aparecer uma
          única música — e a contagem saía duas vezes, porque o título do
          destino já diz quantos são. Comando é meio, não fim: ele encolhe pra
          o acervo aparecer. */}
      {/* a caixa nao recorta nada: ela existe so pra projetar a sombra da
          barra, que e recortada e por isso nao consegue projetar a propria */}
      <div className="barra-caixa">
        <div className="barra">
        <div className="barra-busca">
          <span className="search-icon"><Ico nome="buscar" tamanho={14} /></span>
          <input
            type="search"
            className="barra-campo"
            placeholder="buscar por nome, arquivo, link…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
          />
          {query && (
            <button className="barra-x" onClick={() => setQuery('')} title="Limpar busca">×</button>
          )}
        </div>

        {/* PERÍODO colado na busca, e não largado entre tipo e ordem: os dois
            respondem "de tudo que existe, o que eu quero ver?" — data é busca
            no tempo. Solto no meio ele obrigava a ler os vizinhos pra
            entender do que era.
            Sem filtro ele é só o ícone: "Sempre" ocupava largura pra dizer
            que nada estava filtrado. Com filtro ele acende e escreve o
            recorte, porque aí a informação existe. */}
        <button
          className={`barra-btn so-icone ${periodActive ? 'on' : ''}`}
          onClick={() => setPeriodPickerOpen(true)}
          type="button"
          title={periodActive ? `Período: ${summarizePeriod(periodSelection)}` : 'Filtrar por período'}
        >
          <Ico nome="calendario" tamanho={14} />
          {periodActive && <span>{summarizePeriod(periodSelection)}</span>}
        </button>

        <span className="barra-div" aria-hidden="true" />

        <select className="barra-sel" value={filterType} onChange={(e) => setFilterType(e.target.value)} title="Tipo">
          {TYPE_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select className="barra-sel" value={sortBy} onChange={(e) => setSortBy(e.target.value)} title="Ordem">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* só aparece quando há o que limpar. Mostra quanto sobrou APENAS se o
            filtro cortou algo — trocar a ordem não corta nada, e "99 de 99"
            seria um número inútil ocupando a barra. */}
        {/* FAVORITOS no fim dos dois seletores: eles dizem "que tipo" e "em
            que ordem", e este diz "so os meus" — os tres estreitam a mesma
            lista. Some quando nao ha nenhum favorito, porque filtro que so
            pode dar zero e armadilha. */}
        {totalFavoritos > 0 && (
          <button
            className={`barra-btn so-icone ${soFavoritos ? 'on estrelado' : ''}`}
            onClick={() => setSoFavoritos((v) => !v)}
            type="button"
            aria-pressed={soFavoritos}
            title={soFavoritos ? 'Mostrando só favoritos' : `Ver só favoritos (${totalFavoritos})`}
          >
            <Ico nome={soFavoritos ? 'estrelaCheia' : 'estrela'} tamanho={14} />
            {soFavoritos && <span>{totalFavoritos}</span>}
          </button>
        )}

        {hasActiveFilters && (
          <button className="barra-btn aviso" onClick={resetFilters} title="Limpar filtros">
            {filtered.length < history.length ? `${filtered.length} de ${history.length} ✕` : 'limpar ✕'}
          </button>
        )}

        <span className="barra-esticar" />

        {selectionMode ? (
          <>
            <span className="barra-conta"><b>{selectedIds.size}</b> marcados</span>
            <button className="barra-btn" onClick={allVisibleSelected ? deselectAll : selectAllVisible}>
              {allVisibleSelected ? 'desmarcar tudo' : 'marcar tudo'}
            </button>
            <button className="barra-btn forte" disabled={selectedIds.size === 0} onClick={() => setBatchActionsOpen(true)}>
              confirmar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
            <button className="barra-btn" onClick={exitSelectionMode}>cancelar</button>
          </>
        ) : (
          <>
            <button className="barra-btn" onClick={enterSelectionMode} title="Apagar ou compartilhar vários de uma vez">
              selecionar vários
            </button>
            <button className="barra-btn perigo" onClick={askClearAll} title="Apagar todo o histórico">
              limpar tudo
            </button>
          </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="history-empty">
          {hasActiveFilters ? (
            <>
              Nenhum download corresponde aos filtros.
              <br />
              <button className="link-btn" onClick={resetFilters}>limpar filtros</button>
            </>
          ) : (
            'Nenhum download ainda.'
          )}
        </div>
      ) : (
        <ul className={`hlib-grid ${selectionMode ? 'selection-mode' : ''}`}>
          {visible.map((entry, i) => {
            const unlocked = unlockedIds.has(entry.id)
            const selected = selectedIds.has(entry.id)
            const onItemClick = selectionMode ? () => toggleSelected(entry.id) : undefined
            const shown = displayTitle(entry)

            return (
              <li
                key={entry.id}
                className={`hcard ${selected ? 'selected' : ''} ${selectionMode ? 'clickable' : ''}`}
                onClick={onItemClick}
              >
                {/* CAPA DE VERDADE. Os cartoes antigos nao eram feios por serem
                    cartoes — eram feios pela CAPA FALSA: bloco de cor sorteada
                    pelo nome do arquivo, com iniciais. Com a miniatura do video
                    (que ja vem embutida no MP3) o cartao se sustenta sozinho.
                    Sem capa embutida, cai no desenho de reserva: o icone do
                    formato numa superficie escura — nunca cor sorteada. */}
                <div className="hcard-capa">
                  {capas[entry.primaryFile]
                    ? <img src={capas[entry.primaryFile]} alt="" loading="lazy" />
                    : <span className="hcard-semcapa"><Ico nome={entry.presetId} tamanho={30} /></span>}
                  {/* a marca fica VISIVEL sempre, nao so no hover: favorito
                      existe pra achar de longe, e um selo que so aparece
                      quando o mouse chega nao serve pra achar nada */}
                  {entry.favorito && !selectionMode && (
                    <span className="hcard-estrela" title="Favorito"><Ico nome="estrelaCheia" tamanho={13} /></span>
                  )}
                  <span className="hcard-selo">{originBadge(entry)}</span>
                  {selectionMode && (
                    <span className={`hcard-check ${selected ? 'on' : ''}`}>{selected ? '✓' : ''}</span>
                  )}
                  {!selectionMode && (
                    <div className="hcard-acoes">
                      <button className={`ac ${entry.favorito ? 'favorito' : ''}`} onClick={(e) => { e.stopPropagation(); toggleFavorito(entry) }}
                        title={entry.favorito ? 'Tirar dos favoritos' : 'Marcar como favorito'}
                        aria-pressed={!!entry.favorito}><Ico nome={entry.favorito ? 'estrelaCheia' : 'estrela'} tamanho={16} /></button>
                      <button className="ac destaque" onClick={(e) => { e.stopPropagation(); onOpenStudio?.(entry) }} disabled={!entry.primaryFile}
                        title="Abrir no Estúdio (separar instrumentos)"><Ico nome="studio" tamanho={16} /></button>
                      <button className="ac" onClick={(e) => { e.stopPropagation(); onQuickEdit?.(entry) }} disabled={!entry.primaryFile}
                        title="Edição rápida (tom, BPM e velocidade — sem separar, ~1 min)"><Ico nome="rapido" tamanho={16} /></button>
                      <button className="ac" onClick={(e) => { e.stopPropagation(); openFile(entry) }} disabled={!entry.primaryFile}
                        title="Abrir arquivo"><Ico nome="tocar" tamanho={16} /></button>
                      <button className="ac" onClick={(e) => { e.stopPropagation(); showInExplorer(entry) }} disabled={!entry.primaryFile}
                        title="Mostrar no Explorer"><Ico nome="pasta" tamanho={16} /></button>
                      <button className="ac" onClick={(e) => { e.stopPropagation(); setEditingEntry(entry) }}
                        title="Renomear"><Ico nome="renomear" tamanho={16} /></button>
                      <button className={`ac ${unlocked ? 'aberto' : ''}`} onClick={(e) => { e.stopPropagation(); toggleLock(entry.id) }}
                        title={unlocked ? 'Trancar de novo' : 'Destrancar pra poder apagar'}>
                        <Ico nome={unlocked ? 'destrancado' : 'trancado'} tamanho={16} /></button>
                      {unlocked && (
                        <button className="ac perigo" onClick={(e) => { e.stopPropagation(); askRemoveOne(entry) }}
                          title="Apagar do histórico"><Ico nome="apagar" tamanho={16} /></button>
                      )}
                    </div>
                  )}
                </div>
                <div className="hcard-pe">
                  <div
                    className={`hcard-titulo ${!selectionMode ? 'history-title-clickable' : ''}`}
                    title={selectionMode ? shown : `${shown}

Clique pra renomear`}
                    onClick={(e) => {
                      if (selectionMode) return
                      e.stopPropagation()
                      setEditingEntry(entry)
                    }}
                  >
                    {shown}
                    {entry.customName && <span className="custom-mark" title="Renomeado por você">·</span>}
                  </div>
                  <div className="hcard-meta">
                    {entry.qualityLabel && <span>{entry.qualityLabel}</span>}
                    {entry.fileSizeLabel && <span>{entry.fileSizeLabel}</span>}
                    {entry.files && entry.files.length > 1 && <span>{entry.files.length} arq.</span>}
                    <span>{formatTime(entry.timestamp)}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {hiddenCount > 0 && (
        <div className="history-more muted">
          Mostrando os {VISIBLE_LIMIT} mais recentes — tem mais {hiddenCount} guardado{hiddenCount !== 1 ? 's' : ''}.
          Use a busca ou os filtros pra encontrar qualquer um.
        </div>
      )}

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        list={confirmState?.list}
        note={confirmState?.note}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        danger={confirmState?.danger}
        onConfirm={confirmState?.onConfirm}
        onCancel={closeConfirm}
      />

      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => setEditingEntry(null)}
        />
      )}

      <BatchActionsDialog
        open={batchActionsOpen}
        count={selectedIds.size}
        onClose={() => setBatchActionsOpen(false)}
        onDelete={() => { setBatchActionsOpen(false); askBatchDelete() }}
        onShare={() => { setBatchActionsOpen(false); performShare() }}
      />

      {periodPickerOpen && (
        <PeriodPickerModal
          history={history}
          initial={periodSelection}
          onClose={() => setPeriodPickerOpen(false)}
          onApply={(sel) => { setPeriodSelection(sel); setPeriodPickerOpen(false) }}
        />
      )}
    </div>
  )
}
