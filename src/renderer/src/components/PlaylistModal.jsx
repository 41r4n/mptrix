import { useEffect, useRef, useState } from 'react'

const STATES = {
  IDLE: 'idle',
  PROBING: 'probing',
  CHOOSE: 'choose',
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error'
}

const AUDIO_OPTIONS = [
  { id: 'music',      label: '🎵 MP3 — qualidade máxima',           presetId: 'music',     qualityHeight: null },
  { id: 'fast',       label: '⚡ MP3 — rápido (qualidade média)',   presetId: 'fast',      qualityHeight: null },
  { id: 'audio_m4a',  label: '🎼 M4A — qualidade original (sem reconverter)', presetId: 'audio_m4a', qualityHeight: null },
  { id: 'audio_wav',  label: '💿 WAV — sem compressão (arquivo grande)',     presetId: 'audio_wav', qualityHeight: null }
]

const VIDEO_OPTIONS = [
  { id: 'auto_max', label: '✨ Cada vídeo na máxima possível', auto: 'max' },
  { id: 'auto_med', label: '⚖️ Cada vídeo na média (~720p)', auto: 'med' },
  { id: 'auto_min', label: '📉 Cada vídeo na mínima (rápido)', auto: 'min' },
  { id: 'video_480',  label: '📺 MP4 até 480p',              presetId: 'video', qualityHeight: 480 },
  { id: 'video_720',  label: '📺 MP4 até 720p (HD)',         presetId: 'video', qualityHeight: 720 },
  { id: 'video_1080', label: '📺 MP4 até 1080p (Full HD)',   presetId: 'video', qualityHeight: 1080 },
  { id: 'video_1440', label: '📺 MP4 até 2K (1440p)',        presetId: 'video', qualityHeight: 1440 },
  { id: 'video_2160', label: '📺 MP4 até 4K',                presetId: 'video', qualityHeight: 2160 },
  { id: 'video_max',  label: '🎬 Vídeo máxima qualidade (até 8K)', presetId: 'video', qualityHeight: 4320 }
]

const ALL_OPTIONS = [...AUDIO_OPTIONS, ...VIDEO_OPTIONS]
const DEFAULT_OPTION_ID = 'music'

const QUALITY_FILTERS = [
  { id: 'all', label: 'Todas as qualidades', match: () => true },
  { id: 'lte_480', label: '≤ 480p (baixa)', match: (h) => typeof h === 'number' && h <= 480 },
  { id: 'lte_720', label: '≤ 720p (HD)', match: (h) => typeof h === 'number' && h <= 720 },
  { id: 'lte_1080', label: '≤ 1080p (Full HD)', match: (h) => typeof h === 'number' && h <= 1080 },
  { id: 'lte_1440', label: '≤ 2K (1440p)', match: (h) => typeof h === 'number' && h <= 1440 },
  { id: 'lte_2160', label: '≤ 4K', match: (h) => typeof h === 'number' && h <= 2160 },
  { id: 'gte_2160', label: '4K+ (só os de alta qualidade)', match: (h) => typeof h === 'number' && h >= 2160 },
  { id: 'eq_4320', label: 'Só 8K', match: (h) => typeof h === 'number' && h >= 4320 }
]

function formatDuration(sec) {
  if (!sec) return ''
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

function optionLabelShort(id) {
  const o = ALL_OPTIONS.find((x) => x.id === id)
  return o ? o.label : id
}

function countVideosAtOrAbove(videoMaxHeights, minHeight, total) {
  let count = 0
  for (let i = 0; i < total; i++) {
    const h = videoMaxHeights[i]
    if (typeof h === 'number' && h >= minHeight) count += 1
  }
  return count
}

function effectiveQualityHeight(option, maxHeight) {
  if (!option) return 1080
  if (option.auto === 'max') return typeof maxHeight === 'number' ? maxHeight : 1080
  if (option.auto === 'med') {
    if (typeof maxHeight === 'number') return Math.min(maxHeight, 720)
    return 720
  }
  if (option.auto === 'min') {
    if (typeof maxHeight === 'number') return Math.min(maxHeight, 360)
    return 360
  }
  return option.qualityHeight
}

function qualityHeightLabel(h) {
  if (h >= 4320) return '8K'
  if (h >= 2160) return '4K'
  if (h >= 1440) return '2K (1440p)'
  if (h >= 1080) return '1080p (Full HD)'
  if (h >= 720) return '720p (HD)'
  if (h >= 480) return '480p'
  if (h >= 360) return '360p'
  if (h >= 240) return '240p'
  return h + 'p'
}

function estimateBytesPerSec(option, effectiveHeight) {
  if (!option) return 0
  if (option.id === 'music') return 320 * 1000 / 8      // 320kbps MP3
  if (option.id === 'fast') return 128 * 1000 / 8       // 128kbps MP3
  if (option.id === 'audio_m4a') return 130 * 1000 / 8  // ~130kbps AAC
  if (option.id === 'audio_wav') return 176 * 1024      // ~176 KB/s WAV 16-bit
  const h = effectiveHeight || 1080
  if (h <= 240) return 350 * 1024
  if (h <= 360) return 700 * 1024
  if (h <= 480) return 1.2 * 1024 * 1024
  if (h <= 720) return 2.5 * 1024 * 1024
  if (h <= 1080) return 4 * 1024 * 1024
  if (h <= 1440) return 8 * 1024 * 1024
  if (h <= 2160) return 16 * 1024 * 1024
  return 40 * 1024 * 1024
}

function estimateItemBytes(durationSec, option, maxHeight) {
  if (!durationSec || !option) return 0
  let effective = null
  if (option.presetId === 'video') {
    effective = option.auto ? effectiveQualityHeight(option, maxHeight) : option.qualityHeight
  }
  return Math.round(durationSec * estimateBytesPerSec(option, effective))
}

function formatBytesSmart(bytes) {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes, i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return v.toFixed(v >= 10 || i < 2 ? 0 : 1) + ' ' + units[i]
}

export default function PlaylistModal({ outputDir, onClose, onPickFolder, urlInicial }) {
  // link vindo da roda: colar de novo seria pedir duas vezes a mesma coisa
  const [url, setUrl] = useState(urlInicial || '')
  const [state, setState] = useState(STATES.IDLE)
  const [errorMsg, setErrorMsg] = useState('')
  const [playlist, setPlaylist] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [perItemOption, setPerItemOption] = useState({})
  const [globalKind, setGlobalKind] = useState('audio')
  const [globalAudioId, setGlobalAudioId] = useState('music')
  const [globalVideoId, setGlobalVideoId] = useState('auto_max')
  const globalOption = globalKind === 'audio' ? globalAudioId : globalVideoId
  const [batchId, setBatchId] = useState(null)
  const [itemStatus, setItemStatus] = useState({})
  const [currentItemIndex, setCurrentItemIndex] = useState(-1)
  const [doneSummary, setDoneSummary] = useState(null)
  const [videoMaxHeights, setVideoMaxHeights] = useState({})
  const [qualityProbeId, setQualityProbeId] = useState(null)
  const [qualityProbeProgress, setQualityProbeProgress] = useState({ done: 0, total: 0 })
  const [qualityProbeRateLimited, setQualityProbeRateLimited] = useState(false)
  const [qualityFilter, setQualityFilter] = useState('all')
  const [lastBatchItems, setLastBatchItems] = useState([])
  const [itemErrors, setItemErrors] = useState({}) // batchIndex -> errorMsg
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const offItemStart = window.mptrix.playlist.onItemStart((e) => {
      if (e.batchId !== batchId) return
      setCurrentItemIndex(e.index)
      setItemStatus((prev) => ({ ...prev, [e.index]: 'running' }))
    })
    const offItemEnd = window.mptrix.playlist.onItemEnd((e) => {
      if (e.batchId !== batchId) return
      setItemStatus((prev) => ({ ...prev, [e.index]: e.success ? 'done' : 'error' }))
      if (!e.success && e.error) {
        setItemErrors((prev) => ({ ...prev, [e.index]: e.error }))
      }
    })
    const offEnd = window.mptrix.playlist.onEnd((e) => {
      if (e.batchId !== batchId) return
      setDoneSummary(e)
      setState(STATES.DONE)
    })
    return () => { offItemStart(); offItemEnd(); offEnd() }
  }, [batchId])

  useEffect(() => {
    const offItemQ = window.mptrix.playlist.onItemQuality((e) => {
      if (e.probeId !== qualityProbeId) return
      setVideoMaxHeights((prev) => ({ ...prev, [e.index]: e.maxHeight }))
      setQualityProbeProgress({ done: e.done, total: e.total })
    })
    const offDone = window.mptrix.playlist.onQualitiesDone((e) => {
      if (e.probeId !== qualityProbeId) return
      setQualityProbeProgress({ done: e.total, total: e.total })
      if (e.rateLimited) setQualityProbeRateLimited(true)
    })
    return () => { offItemQ(); offDone() }
  }, [qualityProbeId])

  useEffect(() => {
    setPerItemOption({})
  }, [globalKind])

  // LINK VINDO DA RODA JÁ ENTRA BUSCANDO. Quem escolheu a playlist na roda já
  // disse o que queria — parar numa caixa de texto com o endereço preenchido
  // e um botão "buscar" seria pedir pra confirmar a mesma coisa duas vezes.
  const jaBuscou = useRef(false)
  useEffect(() => {
    if (jaBuscou.current || !urlInicial?.trim()) return
    jaBuscou.current = true
    probe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInicial])

  const probe = async () => {
    if (!url.trim()) return
    setState(STATES.PROBING)
    setErrorMsg('')
    const result = await window.mptrix.playlist.probe(url.trim())
    if (result?.error) {
      setErrorMsg(result.error)
      setState(STATES.ERROR)
      return
    }
    setPlaylist(result.info)
    const allIndexes = new Set(result.info.entries.map((_, i) => i))
    setSelected(allIndexes)
    setPerItemOption({})
    setGlobalKind('audio')
    setGlobalAudioId(DEFAULT_OPTION_ID)
    setGlobalVideoId('auto_max')
    setState(STATES.CHOOSE)

    // disparar probe profundo em background
    setVideoMaxHeights({})
    setQualityProbeRateLimited(false)
    setQualityProbeProgress({ done: 0, total: result.info.entries.length })
    const qResult = await window.mptrix.playlist.probeQualities({
      entries: result.info.entries.map((e) => ({ url: e.url })),
      concurrency: 4
    })
    if (qResult?.probeId) setQualityProbeId(qResult.probeId)
  }

  const retryQualityProbe = async () => {
    if (!playlist?.entries?.length) return
    setVideoMaxHeights({})
    setQualityProbeRateLimited(false)
    setQualityProbeProgress({ done: 0, total: playlist.entries.length })
    setQualityProbeId(null)
    const qResult = await window.mptrix.playlist.probeQualities({
      entries: playlist.entries.map((e) => ({ url: e.url })),
      concurrency: 2
    })
    if (qResult?.probeId) setQualityProbeId(qResult.probeId)
  }

  const toggleItem = (index) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(playlist.entries.map((_, i) => i)))
  const selectNone = () => setSelected(new Set())

  const selectFiltered = () => setSelected(new Set([...selected, ...filteredIndices]))
  const deselectFiltered = () => {
    const next = new Set(selected)
    filteredIndices.forEach((i) => next.delete(i))
    setSelected(next)
  }

  const optionFor = (index) => perItemOption[index] || globalOption

  const startBatch = async () => {
    if (selected.size === 0) return
    const items = []
    for (const index of selected) {
      const entry = playlist.entries[index]
      if (!entry?.url) continue
      const opt = ALL_OPTIONS.find((o) => o.id === optionFor(index))
      if (!opt) continue
      // Pro audio, qualityHeight é null
      // Pro video, calcular effective baseado em auto/fixo
      let qualityHeight = opt.qualityHeight
      let presetId = opt.presetId
      if (opt.auto) {
        qualityHeight = effectiveQualityHeight(opt, videoMaxHeights[index])
        presetId = 'video'
      }
      items.push({
        url: entry.url,
        title: entry.title,
        presetId,
        qualityHeight,
        originalIndex: index
      })
    }
    if (items.length === 0) return
    setItemStatus({})
    setCurrentItemIndex(-1)
    setDoneSummary(null)
    setState(STATES.RUNNING)
    setLastBatchItems(items)
    setItemErrors({})
    const result = await window.mptrix.playlist.startBatch({ items, outputDir })
    if (result?.error) {
      setErrorMsg(result.error)
      setState(STATES.ERROR)
      return
    }
    setBatchId(result.batchId)
  }

  const cancelBatch = async () => {
    if (batchId) await window.mptrix.playlist.cancelBatch(batchId)
  }

  const retryFailed = async () => {
    const failedItems = lastBatchItems.filter((_, idx) => itemStatus[idx] === 'error')
    if (failedItems.length === 0) return
    setLastBatchItems(failedItems)
    setItemErrors({})
    setItemStatus({})
    setCurrentItemIndex(-1)
    setDoneSummary(null)
    setState(STATES.RUNNING)
    const result = await window.mptrix.playlist.startBatch({ items: failedItems, outputDir })
    if (result?.error) {
      setErrorMsg(result.error)
      setState(STATES.ERROR)
      return
    }
    setBatchId(result.batchId)
  }

  const handleKey = (e) => {
    if (e.key === 'Escape' && state !== STATES.RUNNING && state !== STATES.PROBING) onClose()
    if (e.key === 'Enter' && state === STATES.IDLE && url.trim()) probe()
  }

  const itemsToRun = state === STATES.RUNNING || state === STATES.DONE
    ? playlist.entries.filter((_, i) => selected.has(i))
    : []

  const totalEntries = playlist?.entries?.length || 0
  const visibleVideoOptions = VIDEO_OPTIONS
    .map((o) => {
      const count = countVideosAtOrAbove(videoMaxHeights, o.qualityHeight, totalEntries)
      return { ...o, _count: count, _label: count > 0 ? `${o.label} (${count})` : o.label }
    })
    .filter((o) => o._count > 0)
  const visibleVideoOptionsFinal = VIDEO_OPTIONS.map((o) => ({ ...o, _label: o.label }))
  const probeDone = qualityProbeProgress.total > 0 && qualityProbeProgress.done >= qualityProbeProgress.total
  const probeFailed = probeDone && visibleVideoOptionsFinal.length === 0
  const useFallback = qualityProbeRateLimited || probeFailed

  const activeFilter = QUALITY_FILTERS.find((f) => f.id === qualityFilter) || QUALITY_FILTERS[0]
  const filteredIndices = playlist ? playlist.entries
    .map((_, i) => i)
    .filter((i) => activeFilter.match(videoMaxHeights[i]))
    : []
  const visibleEntries = playlist ? filteredIndices.map((i) => ({ entry: playlist.entries[i], index: i })) : []

  const entriesWithSize = playlist ? playlist.entries.map((entry, index) => {
    const opt = ALL_OPTIONS.find((o) => o.id === optionFor(index))
    const bytes = estimateItemBytes(entry.duration, opt, videoMaxHeights[index])
    return { entry, index, bytes }
  }) : []

  const totalAllBytes = entriesWithSize.reduce((sum, x) => sum + x.bytes, 0)
  const totalVisibleBytes = entriesWithSize
    .filter((x) => activeFilter.match(videoMaxHeights[x.index]))
    .reduce((sum, x) => sum + x.bytes, 0)
  const totalSelectedBytes = entriesWithSize
    .filter((x) => selected.has(x.index))
    .reduce((sum, x) => sum + x.bytes, 0)

  return (
    <div className="modal-overlay" onClick={() => { if (state !== STATES.RUNNING && state !== STATES.PROBING) onClose() }}>
      <div className="modal modal-playlist chanfro" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        {/* O cabeçalho e a ficha da lista eram dois blocos empilhados dizendo
            quase a mesma coisa. Viraram um: o nome DA LISTA é o título, e
            "playlist" vira etiqueta pequena — a pessoa não abriu isto sem
            saber que é uma playlist. */}
        <header className="pl-cab">
          <div className="pl-cab-txt">
            <span className="pl-etiqueta">playlist</span>
            <h3>{playlist?.title || 'Playlist'}</h3>
            {playlist && (
              <p className="pl-cab-meta">
                {playlist.uploader ? `${playlist.uploader}  ·  ` : ''}
                {playlist.entries.length} música{playlist.entries.length !== 1 ? 's' : ''}
              </p>
            )}
            {!playlist && (
              <p className="pl-cab-meta">cole o link e escolha quais quer</p>
            )}
          </div>
          {state !== STATES.RUNNING && state !== STATES.PROBING && (
            <button className="pl-x" onClick={onClose} aria-label="Fechar" type="button">×</button>
          )}
        </header>

        {state === STATES.IDLE && (
          <div className="modal-body">
            <label className="field">
              <span>Link da playlist do YouTube</span>
              <input
                ref={inputRef}
                type="url"
                placeholder="https://www.youtube.com/playlist?list=…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKey}
                spellCheck={false}
                autoFocus
              />
            </label>
            <div className="folder-mini">
              <span className="muted">Salvar em:</span>{' '}
              <code title={outputDir}>{outputDir}</code>{' '}
              <button className="link-btn" onClick={onPickFolder}>mudar…</button>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" disabled={!url.trim()} onClick={probe}>
                Detectar playlist →
              </button>
            </div>
          </div>
        )}

        {state === STATES.PROBING && (
          <div className="modal-body">
            <div className="probe-loading">
              <div className="spinner" />
              <div>
                <div className="result-title">Carregando playlist…</div>
                <div className="muted small">Pode demorar uns segundos se a playlist for grande.</div>
              </div>
            </div>
          </div>
        )}

        {state === STATES.CHOOSE && playlist && (
          <div className="modal-body pl-corpo">
            {/* ▸ COMANDO — o que baixar, e o que aparece na lista.
                Eram cinco blocos empilhados antes da primeira música: dois
                cartões de formato, a barra de progresso, o aviso, o filtro,
                três caixas de total e a linha de marcar/desmarcar. Cada um
                deles é uma decisão pequena ocupando espaço de tela grande, e
                juntos empurravam a lista — que é o assunto — pra fora da
                vista. Agora são duas fileiras. */}
            <div className="pl-comando">
              <div className="pl-linha">
                <span className="pl-rot">levar como</span>
                <div className="pl-segmento">
                  <button
                    type="button"
                    className={`pl-seg ${globalKind === 'audio' ? 'on' : ''}`}
                    onClick={() => setGlobalKind('audio')}
                  >som</button>
                  <button
                    type="button"
                    className={`pl-seg ${globalKind === 'video' ? 'on' : ''}`}
                    onClick={() => setGlobalKind('video')}
                  >vídeo</button>
                </div>
                {globalKind === 'audio' ? (
                  <select
                    className="pl-sel"
                    value={globalAudioId}
                    onChange={(e) => { setGlobalAudioId(e.target.value); setGlobalKind('audio') }}
                  >
                    {AUDIO_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                ) : (
                  <select
                    className="pl-sel"
                    value={globalVideoId}
                    onChange={(e) => { setGlobalVideoId(e.target.value); setGlobalKind('video') }}
                  >
                    {visibleVideoOptionsFinal.map((o) => (
                      <option key={o.id} value={o.id}>{o._label}</option>
                    ))}
                  </select>
                )}
                <span className="pl-espaco" />
                <span className="pl-peso">
                  <b>~{formatBytesSmart(totalSelectedBytes)}</b>
                  <i>no total</i>
                </span>
              </div>

              <div className="pl-linha">
                <span className="pl-rot">mostrar</span>
                <select
                  className="pl-sel"
                  value={qualityFilter}
                  onChange={(e) => setQualityFilter(e.target.value)}
                  disabled={Object.keys(videoMaxHeights).length === 0}
                >
                  {QUALITY_FILTERS.map((f) => {
                    const count = f.id === 'all'
                      ? (playlist?.entries?.length || 0)
                      : (playlist?.entries || []).filter((_, i) => f.match(videoMaxHeights[i])).length
                    return (
                      <option key={f.id} value={f.id}>
                        {f.label}{count > 0 ? ` (${count})` : ''}
                      </option>
                    )
                  })}
                </select>
                <span className="pl-espaco" />
                {/* a contagem é o número que a pessoa mais olha nesta tela:
                    ela responde "quanto eu já escolhi?" */}
                <span className="pl-conta">
                  <b>{selected.size}</b>
                  <span>de {playlist.entries.length}</span>
                </span>
                {qualityFilter !== 'all' && filteredIndices.length > 0 ? (
                  <>
                    <button className="pl-btn" onClick={selectFiltered}>marcar visíveis</button>
                    <button className="pl-btn" onClick={deselectFiltered}>desmarcar</button>
                  </>
                ) : (
                  <>
                    <button className="pl-btn" onClick={selectAll}>marcar todas</button>
                    <button className="pl-btn" onClick={selectNone}>desmarcar</button>
                  </>
                )}
              </div>

              {/* progresso da análise: fio fino, não caixa. Ele informa sem
                  virar mais um bloco na pilha. */}
              {qualityProbeProgress.total > 0 && !probeDone && !qualityProbeRateLimited && (
                <div className="pl-varrendo">
                  <span
                    className="pl-varrendo-fio"
                    style={{ width: `${Math.round((qualityProbeProgress.done / qualityProbeProgress.total) * 100)}%` }}
                  />
                  <span className="pl-varrendo-txt">
                    lendo qualidades · {qualityProbeProgress.done}/{qualityProbeProgress.total}
                  </span>
                </div>
              )}
            </div>

            {/* AVISO DE VERDADE ganha o painel do kit — aqui ele tem vizinho,
                então a moldura serve pra separar, não pra enfeitar. */}
            {qualityProbeRateLimited && (
              <div className="pl-aviso">
                <span className="pl-aviso-canto tl" aria-hidden="true" />
                <span className="pl-aviso-canto bl" aria-hidden="true" />
                <b>O YouTube barrou a leitura automática</b>
                <p>
                  É temporário — ele limita quando muitos pedidos saem da mesma conexão.
                  <strong> Dá pra baixar do mesmo jeito:</strong> escolha a qualidade na mão e mande baixar.
                  Se o vídeo não tiver aquela qualidade, ele cai pra maior que tiver.
                </p>
                <p className="pl-aviso-pe">
                  Pra voltar ao automático: esperar 30–60 min ou usar outra rede.
                  <button className="pl-btn" onClick={retryQualityProbe}>tentar de novo</button>
                </p>
              </div>
            )}
            {probeFailed && !qualityProbeRateLimited && (
              <div className="pl-aviso">
                <span className="pl-aviso-canto tl" aria-hidden="true" />
                <span className="pl-aviso-canto bl" aria-hidden="true" />
                <b>Não deu pra ler as qualidades</b>
                <p>Mostrando todas as opções — o download funciona igual.
                  <button className="pl-btn" onClick={retryQualityProbe}>tentar de novo</button>
                </p>
              </div>
            )}

            <ul className="pl-lista">
              {visibleEntries.map(({ entry, index }) => {
                const isSelected = selected.has(index)
                const currentOpt = optionFor(index)
                const isOverride = perItemOption[index] && perItemOption[index] !== globalOption
                const opt = ALL_OPTIONS.find((o) => o.id === currentOpt)
                const bytes = estimateItemBytes(entry.duration, opt, videoMaxHeights[index])
                return (
                  <li key={`${entry.id || index}`} className={`pl-item ${isSelected ? 'on' : ''}`}>
                    {/* a linha inteira liga e desliga. Alvo de 13px de
                        caixinha é mira de precisão pra uma coisa que se faz
                        noventa vezes seguidas. */}
                    <button
                      type="button"
                      className="pl-item-toque"
                      onClick={() => toggleItem(index)}
                      aria-pressed={isSelected}
                    >
                      <span className="pl-marca" aria-hidden="true" />
                      <span className="pl-num">{String(index + 1).padStart(2, '0')}</span>
                      <span className="pl-item-txt">
                        <span className="pl-item-nome" title={entry.title}>{entry.title}</span>
                        <span className="pl-item-ficha">
                          {entry.duration ? formatDuration(entry.duration) : '—'}
                          {bytes > 0 ? `  ·  ~${formatBytesSmart(bytes)}` : ''}
                          {isOverride ? '  ·  formato próprio' : ''}
                        </span>
                      </span>
                    </button>
                    <select
                      className="pl-sel pl-item-sel"
                      value={currentOpt}
                      onChange={(e) => {
                        const v = e.target.value
                        setPerItemOption((prev) => {
                          const next = { ...prev }
                          if (v === globalOption) delete next[index]
                          else next[index] = v
                          return next
                        })
                      }}
                      disabled={!isSelected}
                      title={isOverride ? 'Formato próprio desta música' : 'Usa o formato escolhido em cima'}
                    >
                      {globalKind === 'audio' ? (
                        AUDIO_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)
                      ) : (() => {
                        const myMax = videoMaxHeights[index]
                        return VIDEO_OPTIONS.map((o) => {
                          let label = o.label
                          if (o.auto) {
                            const eff = effectiveQualityHeight(o, myMax)
                            label = `${o.label.split('—')[0].trim() || o.label} → MP4 até ${qualityHeightLabel(eff)}`
                          } else if (typeof myMax === 'number' && o.qualityHeight > myMax) {
                            label = `${o.label} (cai pra ${qualityHeightLabel(myMax)})`
                          }
                          return <option key={o.id} value={o.id}>{label}</option>
                        })
                      })()}
                    </select>
                  </li>
                )
              })}
              {visibleEntries.length === 0 && qualityFilter !== 'all' && (
                <li className="pl-vazio">
                  Nenhum vídeo nesse filtro.{' '}
                  <button className="pl-btn" onClick={() => setQualityFilter('all')}>limpar filtro</button>
                </li>
              )}
            </ul>

            <div className="pl-pe">
              <span className="pl-nota">
                Sem a qualidade escolhida, baixa a maior que o vídeo tiver — nunca inventa qualidade.
                Vídeo privado ou removido é pulado.
              </span>
              <span className="pl-espaco" />
              <button className="pl-btn" onClick={() => setState(STATES.IDLE)}>voltar</button>
              <button className="pl-btn forte" disabled={selected.size === 0} onClick={startBatch}>
                baixar {selected.size}
              </button>
            </div>
          </div>
        )}

        {state === STATES.RUNNING && (
          <div className="modal-body">
            <div className="batch-status">
              <strong>Baixando {itemsToRun.length} item{itemsToRun.length !== 1 ? 's' : ''}…</strong>
              <span className="muted">
                {' '}{Math.max(0, currentItemIndex + 1)} de {itemsToRun.length}
              </span>
            </div>

            <ul className="playlist-list batch-list">
              {itemsToRun.map((entry, runIdx) => {
                const status = itemStatus[runIdx] || (runIdx < currentItemIndex ? 'done' : 'pending')
                return (
                  <li key={`run-${runIdx}`} className={`playlist-item batch-item batch-${status}`}>
                    <span className={`batch-marker batch-marker-${status}`}>
                      {status === 'done' ? '✓' : status === 'error' ? '✕' : status === 'running' ? '●' : ''}
                    </span>
                    <span className="playlist-item-num">{runIdx + 1}</span>
                    <div className="playlist-item-main">
                      <div className="playlist-item-title">{entry.title}</div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="modal-actions">
              <button className="btn-danger" onClick={cancelBatch}>Cancelar tudo</button>
            </div>
          </div>
        )}

        {state === STATES.DONE && doneSummary && (
          <div className="modal-body">
            <div className={`result ${doneSummary.failed > 0 ? 'result-warn' : 'result-ok'}`}>
              <div className="result-icon">{doneSummary.failed > 0 ? '!' : '✓'}</div>
              <div>
                <div className="result-title">
                  {doneSummary.cancelled ? 'Cancelado pelo usuário' : 'Playlist concluída!'}
                </div>
                <div className="result-sub">
                  ✓ {doneSummary.completed} concluído{doneSummary.completed !== 1 ? 's' : ''}
                  {doneSummary.failed > 0 && ` · ✕ ${doneSummary.failed} com erro`}
                </div>
              </div>
            </div>

            {doneSummary.failed > 0 && (
              <div className="failed-report">
                <div className="failed-report-head">
                  <strong>Vídeos que falharam:</strong>
                  <span className="muted small">{doneSummary.failed} de {lastBatchItems.length}</span>
                </div>
                <ul className="failed-list">
                  {lastBatchItems.map((it, idx) => {
                    if (itemStatus[idx] !== 'error') return null
                    const err = itemErrors[idx] || 'Erro desconhecido'
                    return (
                      <li key={idx} className="failed-item">
                        <span className="failed-marker">✕</span>
                        <div className="failed-item-text">
                          <div className="failed-item-title" title={it.title}>{it.title}</div>
                          <div className="failed-item-error muted small" title={err}>{err}</div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => window.mptrix.shell.openPath(outputDir)}>Abrir pasta</button>
              {doneSummary.failed > 0 && (
                <button className="btn-primary" onClick={retryFailed}>↻ Tentar baixar os falhos ({doneSummary.failed})</button>
              )}
              <button className="btn-secondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}

        {state === STATES.ERROR && (
          <div className="modal-body">
            <div className="result result-err">
              <div className="result-icon">!</div>
              <div>
                <div className="result-title">Não foi possível</div>
                <div className="result-sub">{errorMsg}</div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setState(STATES.IDLE); setErrorMsg('') }}>Tentar de novo</button>
              <button className="btn-secondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
