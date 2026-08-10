import { useEffect, useRef, useState } from 'react'

const STATES = {
  IDLE: 'idle',
  PROBING: 'probing',
  CHOOSE_QUALITY: 'choose_quality',
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error',
  CANCELLED: 'cancelled'
}

function formatDuration(sec) {
  if (!sec) return ''
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}min`
  return `${m}:${String(r).padStart(2, '0')}`
}

function formatElapsed(sec) {
  const m = Math.floor(sec / 60)
  const r = sec % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

const DOWNLOAD_STAGE_IDS = new Set(['downloading', 'downloading_audio'])

function getStartingHint(elapsedSec) {
  if (elapsedSec < 8) return { label: 'Conectando ao YouTube…', icon: '⏳' }
  if (elapsedSec < 30) return { label: 'Procurando o vídeo no servidor…', icon: '🔌' }
  if (elapsedSec < 120) return { label: 'Pegando informações (vídeos longos demoram um pouco)', icon: '🔍' }
  return { label: 'Ainda processando — aguarde, não travou', icon: '🕒' }
}

function formatBytesShort(b) {
  if (!b) return ''
  const u = ['B', 'KB', 'MB', 'GB']
  let v = b, i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${u[i]}`
}

function formatEstimateRange(seconds) {
  if (!seconds || seconds < 1) return null
  const low = Math.max(1, Math.round(seconds * 0.7))
  const high = Math.round(seconds * 1.5)
  const fmt = (s) => {
    if (s < 60) return `${s}s`
    const m = Math.round(s / 60)
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    const r = m % 60
    return r > 0 ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`
  }
  if (Math.abs(high - low) < 5) return `~${fmt(Math.round(seconds))}`
  return `${fmt(low)} – ${fmt(high)}`
}

function RunProgress({ stages, progress, elapsedSec, filesCount, lastLog, estimate }) {
  const fallback = stages.length === 0 ? getStartingHint(elapsedSec) : null
  const current = stages[stages.length - 1] || {
    id: 'starting',
    label: fallback.label,
    icon: fallback.icon
  }
  const hasProgress = DOWNLOAD_STAGE_IDS.has(current.id) && progress
  const pct = progress?.percent ?? 0

  return (
    <div className="run-progress">
      <div className="run-current">
        <div className={`run-current-icon ${hasProgress ? '' : 'pulse'}`}>{current.icon}</div>
        <div className="run-current-text">
          <div className="run-current-label">{current.label}</div>
          <div className="run-current-sub muted">
            {hasProgress && progress?.percentStr
              ? `${progress.percentStr.trim()} concluído`
              : 'Processando…'}
            {' · '}{formatElapsed(elapsedSec)} decorrido
          </div>
        </div>
      </div>

      {estimate && (
        <div className="estimate-row">
          <span className="estimate-icon">🕒</span>
          <span className="estimate-text">
            Estimativa: <strong>{formatEstimateRange(estimate.seconds)}</strong>
            <span className="muted">
              {' · '}
              {formatBytesShort(estimate.sizeBytes)} a {formatBytesShort(estimate.bytesPerSec)}/s
            </span>
          </span>
        </div>
      )}

      <div className="progress-bar run-bar">
        <div
          className={`progress-fill ${hasProgress ? '' : 'indeterminate'}`}
          style={hasProgress ? { width: `${pct}%` } : undefined}
        />
      </div>

      {hasProgress && (
        <div className="progress-meta">
          <span>{progress?.speed ? `⚡ ${progress.speed}` : ''}</span>
          <span>{progress?.eta ? `⏱ ${progress.eta} restante` : ''}</span>
        </div>
      )}

      {lastLog && (
        <div className="run-log" title="Última mensagem do yt-dlp (apenas pra você ver que tá ativo)">
          <span className="run-log-label">log</span>
          <code className="run-log-line">{lastLog}</code>
        </div>
      )}

      {stages.length > 0 && (
        <ul className="stage-timeline">
          {stages.map((s, i) => {
            const isCurrent = i === stages.length - 1
            return (
              <li key={s.id} className={`stage-step ${isCurrent ? 'current' : 'done'}`}>
                <span className="stage-marker">
                  {isCurrent ? <span className="stage-marker-dot" /> : '✓'}
                </span>
                <span className="stage-step-icon">{s.icon}</span>
                <span className="stage-step-label">{s.label}</span>
              </li>
            )
          })}
        </ul>
      )}

      {filesCount > 1 && (
        <div className="muted small">{filesCount} arquivos baixados até agora</div>
      )}
    </div>
  )
}

export default function DownloadModal({ preset, outputDir, onClose, onPickFolder, history, urlInicial, aoConcluir }) {
  // link vindo da roda: a pessoa ja copiou la fora, colar de novo aqui seria
  // pedir duas vezes a mesma coisa
  const [url, setUrl] = useState(urlInicial || '')
  const [state, setState] = useState(STATES.IDLE)
  const [progress, setProgress] = useState(null)
  const [stages, setStages] = useState([])
  const [lastLog, setLastLog] = useState('')
  const [detectedIssue, setDetectedIssue] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [files, setFiles] = useState([])
  const [primaryFile, setPrimaryFile] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)
  const [selectedHeight, setSelectedHeight] = useState(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [estimate, setEstimate] = useState(null)
  const startedAtRef = useRef(null)
  const jobIdRef = useRef(null)
  const inputRef = useRef(null)
  const pendingIssueRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // QUEM PEDIU SEPARAÇÃO não pediu um arquivo na pasta: pediu a música aberta
  // no estúdio. Baixar é meio, não fim — então, terminado o download, este
  // modal sai da frente e entrega o arquivo pra quem mandou.
  useEffect(() => {
    if (state === STATES.DONE && aoConcluir && primaryFile) aoConcluir(primaryFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, primaryFile])

  useEffect(() => {
    const offProgress = window.mptrix.download.onProgress((p) => {
      if (p.id === jobIdRef.current) {
        pendingIssueRef.current = null
        setDetectedIssue(null)
        setProgress(p)
      }
    })
    const offStatus = window.mptrix.download.onStatus((s) => {
      if (s.id !== jobIdRef.current) return
      if (s.state === 'done') {
        setDetectedIssue(null)
        pendingIssueRef.current = null
        setFiles(s.files || [])
        setPrimaryFile(s.primaryFile || null)
        setState(STATES.DONE)
      } else if (s.state === 'error') {
        setErrorMsg(s.message || 'Erro desconhecido.')
        setState(STATES.ERROR)
      } else if (s.state === 'cancelled') {
        setState(STATES.CANCELLED)
      }
    })
    const offFile = window.mptrix.download.onFile((f) => {
      if (f.id === jobIdRef.current) setFiles((prev) => [...prev, f.filepath])
    })
    const offStage = window.mptrix.download.onStage((st) => {
      if (st.id !== jobIdRef.current) return
      setStages((prev) => {
        if (prev.some((s) => s.id === st.id)) return prev
        return [...prev, { id: st.id, label: st.label, icon: st.icon }]
      })
    })
    const offLog = window.mptrix.download.onLog((lg) => {
      if (lg.id === jobIdRef.current) setLastLog(lg.line)
    })
    const offIssue = window.mptrix.download.onIssue((iss) => {
      if (iss.id !== jobIdRef.current) return
      pendingIssueRef.current = iss
      setTimeout(() => {
        if (pendingIssueRef.current === iss) setDetectedIssue(iss)
      }, 8000)
    })
    return () => { offProgress(); offStatus(); offFile(); offStage(); offLog(); offIssue() }
  }, [])

  useEffect(() => {
    if (state !== STATES.RUNNING) return
    startedAtRef.current = Date.now()
    setElapsedSec(0)
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [state])

  useEffect(() => {
    if (state !== STATES.RUNNING || !history || !startedAtRef.current) return
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    const matched = history.find((entry) => {
      if (!entry.url || !entry.timestamp) return false
      if (entry.url !== trimmedUrl) return false
      const t = new Date(entry.timestamp).getTime()
      return t >= startedAtRef.current - 2000
    })
    if (matched) {
      setFiles(matched.files || [])
      setPrimaryFile(matched.primaryFile || null)
      setState(STATES.DONE)
    }
  }, [history, state, url])

  const probeAndChoose = async () => {
    if (!url.trim()) return
    setState(STATES.PROBING)
    setErrorMsg('')
    const result = await window.mptrix.video.probe(url.trim())
    if (result?.error) {
      setErrorMsg(result.error)
      setState(STATES.ERROR)
      return
    }
    if (!result.info?.qualities?.length) {
      setErrorMsg('Esse vídeo não tem qualidades baixáveis.')
      setState(STATES.ERROR)
      return
    }
    setVideoInfo(result.info)
    const preferred = result.info.qualities.find((q) => q.height === 1080) ?? result.info.qualities[0]
    setSelectedHeight(preferred.height)
    setState(STATES.CHOOSE_QUALITY)
  }

  const computeEstimate = async (qualityHeight) => {
    const chosen = videoInfo?.qualities?.find((q) => q.height === qualityHeight)
    const sizeBytes = chosen?.sizeBytes
    if (!sizeBytes) return null
    try {
      const bw = await window.mptrix.system.estimateBandwidth()
      const bps = bw?.bytesPerSec || (3 * 1024 * 1024)
      const seconds = sizeBytes / bps
      return { sizeBytes, bytesPerSec: bps, seconds }
    } catch {
      return null
    }
  }

  const startNow = async (qualityHeight = null) => {
    setState(STATES.RUNNING)
    setProgress(null)
    setStages([])
    setLastLog('')
    setDetectedIssue(null)
    setFiles([])
    setPrimaryFile(null)
    setErrorMsg('')
    setEstimate(null)
    if (qualityHeight) {
      computeEstimate(qualityHeight).then((est) => est && setEstimate(est))
    }
    const result = await window.mptrix.download.start({
      url: url.trim(),
      presetId: preset.id,
      outputDir,
      qualityHeight
    })
    if (result?.error) {
      setErrorMsg(result.error)
      setState(STATES.ERROR)
      return
    }
    jobIdRef.current = result.id
  }

  const onMainAction = () => {
    if (!url.trim()) return
    if (preset.needsQualityChoice) {
      probeAndChoose()
    } else {
      startNow()
    }
  }

  const cancel = async () => {
    if (jobIdRef.current) await window.mptrix.download.cancel(jobIdRef.current)
  }

  const cancelAndUpdateYtDlp = async () => {
    if (jobIdRef.current) {
      await window.mptrix.download.cancel(jobIdRef.current)
    }
    setUpdating(true)
    setDetectedIssue(null)
    const result = await window.mptrix.updates.run()
    setUpdating(false)
    if (result?.error) {
      setErrorMsg(`Falha ao atualizar: ${result.error}`)
      setState(STATES.ERROR)
      return
    }
    setState(STATES.IDLE)
  }

  const openFile = () => primaryFile && window.mptrix.shell.showInFolder(primaryFile)
  const openFolder = () => outputDir && window.mptrix.shell.openPath(outputDir)

  const resetAndClose = () => { if (state !== STATES.RUNNING && state !== STATES.PROBING) onClose() }
  const handleKey = (e) => {
    if (e.key === 'Escape' && state !== STATES.RUNNING && state !== STATES.PROBING) onClose()
    if (e.key === 'Enter' && state === STATES.IDLE && url.trim()) onMainAction()
  }

  const tryAgain = () => {
    setState(STATES.IDLE)
    setErrorMsg('')
    setVideoInfo(null)
    setSelectedHeight(null)
  }

  return (
    <div className="modal-overlay" onClick={resetAndClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <header className="modal-header">
          <div>
            <h3>{preset.name}</h3>
            <p className="modal-sub">{preset.description}</p>
          </div>
          {state !== STATES.RUNNING && state !== STATES.PROBING && (
            <button className="btn-close" onClick={onClose} aria-label="Fechar">×</button>
          )}
        </header>

        {state === STATES.IDLE && (
          <div className="modal-body">
            <label className="field">
              <span>Link do YouTube</span>
              <input
                ref={inputRef}
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
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
              <button className="btn-primary" disabled={!url.trim()} onClick={onMainAction}>
                {preset.needsQualityChoice ? 'Buscar opções →' : 'Baixar'}
              </button>
            </div>
          </div>
        )}

        {state === STATES.PROBING && (
          <div className="modal-body">
            <div className="probe-loading">
              <div className="spinner" />
              <div>
                <div className="result-title">Buscando informações do vídeo…</div>
                <div className="muted small">Isso leva alguns segundos.</div>
              </div>
            </div>
          </div>
        )}

        {state === STATES.CHOOSE_QUALITY && videoInfo && (
          <div className="modal-body">
            <div className="video-info">
              {videoInfo.thumbnail && (
                <img src={videoInfo.thumbnail} alt="" className="video-thumb" referrerPolicy="no-referrer" />
              )}
              <div className="video-meta">
                <div className="video-title" title={videoInfo.title}>{videoInfo.title}</div>
                <div className="video-sub">
                  {videoInfo.uploader && <span>{videoInfo.uploader}</span>}
                  {videoInfo.duration && <span> • {formatDuration(videoInfo.duration)}</span>}
                </div>
              </div>
            </div>

            <div className="quality-list">
              {videoInfo.qualities.map((q) => (
                <label
                  key={q.height}
                  className={`quality-row ${selectedHeight === q.height ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="quality"
                    checked={selectedHeight === q.height}
                    onChange={() => setSelectedHeight(q.height)}
                  />
                  <div className="quality-main">
                    <div className="quality-label">
                      {q.label}
                      {q.fps && q.fps > 30 && <span className="badge-fps">{Math.round(q.fps)}fps</span>}
                    </div>
                    <div className="quality-sub">
                      <span className={`container-pill ${q.isMp4Native ? 'pill-mp4' : 'pill-other'}`}>
                        {q.container}
                      </span>
                      {!q.isMp4Native && (
                        <span className="muted small">roda em players modernos</span>
                      )}
                    </div>
                  </div>
                  <div className="quality-size">
                    {q.sizeLabel || '—'}
                  </div>
                </label>
              ))}
            </div>

            <p className="muted small" style={{ padding: '8px 2px 4px', lineHeight: 1.4 }}>
              💡 yt-dlp baixa a melhor qualidade disponível até o limite escolhido — sem upscaling artificial.
            </p>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setState(STATES.IDLE)}>← Voltar</button>
              <button
                className="btn-primary"
                disabled={!selectedHeight}
                onClick={() => startNow(selectedHeight)}
              >
                Baixar em {videoInfo.qualities.find(q => q.height === selectedHeight)?.label || ''}
              </button>
            </div>
          </div>
        )}

        {state === STATES.RUNNING && (
          <div className="modal-body run-body">
            {detectedIssue && !updating && (
              <div className="issue-panel">
                <div className="issue-icon">⚠</div>
                <div className="issue-text">
                  <strong>{detectedIssue.title}</strong>
                  <p>{detectedIssue.message}</p>
                </div>
                <div className="issue-actions">
                  <button className="btn-primary btn-small" onClick={cancelAndUpdateYtDlp}>
                    Atualizar yt-dlp
                  </button>
                  <button className="btn-secondary btn-small" onClick={() => setDetectedIssue(null)}>
                    Ignorar
                  </button>
                </div>
              </div>
            )}

            {updating && (
              <div className="issue-panel issue-panel-updating">
                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
                <div className="issue-text">
                  <strong>Atualizando yt-dlp…</strong>
                  <p>Aguarde alguns segundos. Quando terminar, você pode tentar baixar de novo.</p>
                </div>
              </div>
            )}

            <RunProgress
              stages={stages}
              progress={progress}
              elapsedSec={elapsedSec}
              filesCount={files.length}
              lastLog={lastLog}
              estimate={estimate}
            />
            <div className="modal-actions">
              <button className="btn-danger" onClick={cancel} disabled={updating}>
                Cancelar download
              </button>
            </div>
          </div>
        )}

        {state === STATES.DONE && (
          <div className="modal-body">
            <div className="result result-ok">
              <div className="result-icon">✓</div>
              <div>
                <div className="result-title">Download concluído!</div>
                <div className="result-sub">
                  {files.length} arquivo{files.length !== 1 ? 's' : ''} salvo{files.length !== 1 ? 's' : ''} em <code>{outputDir}</code>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={openFolder}>Abrir pasta</button>
              {primaryFile && (
                <button className="btn-primary" onClick={openFile}>Mostrar arquivo no Explorer</button>
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
                <div className="result-title">Não foi possível baixar</div>
                <div className="result-sub">{errorMsg}</div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={tryAgain}>Tentar de novo</button>
              <button className="btn-secondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}

        {state === STATES.CANCELLED && (
          <div className="modal-body">
            <div className="result result-warn">
              <div className="result-icon">⏹</div>
              <div>
                <div className="result-title">Download cancelado</div>
                <div className="result-sub">Nenhum arquivo finalizado.</div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={tryAgain}>Tentar de novo</button>
              <button className="btn-secondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
