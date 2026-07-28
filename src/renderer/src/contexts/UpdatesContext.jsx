import { createContext, useContext, useEffect, useState } from 'react'

function formatBytes(b) {
  if (!b) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let v = b, i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${u[i]}`
}

const UpdatesContext = createContext(null)
export const useUpdates = () => useContext(UpdatesContext)

export function UpdatesProvider({ children }) {
  const [versions, setVersions] = useState({ ytDlp: null, ffmpeg: null })
  const [checkInfo, setCheckInfo] = useState(null)
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [progress, setProgress] = useState(null)
  const [doneStatus, setDoneStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [lastCheckedAt, setLastCheckedAt] = useState(null)
  const [toast, setToast] = useState(null)
  const [toastKind, setToastKind] = useState(null)

  const loadVersions = async () => {
    const v = await window.mptrix.updates.getVersions()
    setVersions({ ytDlp: v.ytDlp, ffmpeg: v.ffmpeg })
  }

  const check = async (force = false) => {
    setChecking(true)
    setErrorMsg('')
    const result = await window.mptrix.updates.check({ force })
    setChecking(false)
    if (result?.error) { setErrorMsg(result.error); return }
    setCheckInfo(result)
    setLastCheckedAt(Date["now"]())
    if (force) {
      if (result.hasUpdate) {
        setToastKind('update')
        setToast(`Nova versão ${result.latest} disponível`)
      } else {
        setToastKind('ok')
        setToast(`Em dia. Você tem a versão ${result.latest}`)
      }
    }
  }

  useEffect(() => {
    loadVersions()
    check(false)
    const offProgress = window.mptrix.updates.onProgress((p) => setProgress(p))
    const offStatus = window.mptrix.updates.onStatus((s) => {
      if (s.state === 'done') {
        setUpdating(false); setProgress(null); setDoneStatus(s); loadVersions()
        setCheckInfo((prev) => prev ? { ...prev, hasUpdate: false, current: s.version } : prev)
      } else if (s.state === 'error') {
        setUpdating(false); setProgress(null); setErrorMsg(s.message || 'Erro ao atualizar.')
      }
    })
    return () => { offProgress(); offStatus() }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => { setToast(null); setToastKind(null) }, 4500)
    return () => clearTimeout(t)
  }, [toast])

  const runUpdate = async () => {
    setUpdating(true); setProgress(null); setErrorMsg(''); setDoneStatus(null)
    const result = await window.mptrix.updates.run()
    if (result?.error) { setUpdating(false); setErrorMsg(result.error) }
  }

  const dismiss = async () => {
    if (!checkInfo?.latest) return
    await window.mptrix.updates.dismiss(checkInfo.latest)
    setCheckInfo({ ...checkInfo, dismissed: true })
  }

  const value = {
    versions, checkInfo, checking, updating, progress, errorMsg, lastCheckedAt,
    showBanner: checkInfo && checkInfo.hasUpdate && !checkInfo.dismissed && !updating,
    runUpdate, dismiss, check
  }

  return (
    <UpdatesContext.Provider value={value}>
      {children}

      {updating && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <div className="confirm-body">
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
              <h3 className="confirm-title" style={{ marginTop: 6 }}>Atualizando yt-dlp…</h3>
              {progress && progress.total > 0 ? (
                <>
                  <div className="progress-bar" style={{ width: '100%', marginTop: 4 }}>
                    <div className="progress-fill" style={{ width: `${progress.percent || 0}%` }} />
                  </div>
                  <p className="confirm-note">
                    {formatBytes(progress.received)} de {formatBytes(progress.total)}
                    {progress.percent ? ` (${Math.round(progress.percent)}%)` : ''}
                  </p>
                </>
              ) : (
                <p className="confirm-message">Conectando ao GitHub e baixando a nova versão…</p>
              )}
              <p className="confirm-note muted">Por favor não feche o app até terminar.</p>
            </div>
          </div>
        </div>
      )}

      {doneStatus && doneStatus.state === 'done' && (
        <div className="modal-overlay" onClick={() => setDoneStatus(null)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-body">
              <div
                className="confirm-icon"
                style={{ background: 'rgba(78, 203, 140, 0.18)', color: 'var(--ok)' }}
              >✓</div>
              <h3 className="confirm-title">Atualizado!</h3>
              <p className="confirm-message">
                yt-dlp agora é a versão <code>{doneStatus.version}</code>.
              </p>
              <p className="confirm-note">Seus próximos downloads vão usar a versão nova.</p>
              <div className="confirm-actions">
                <button className="btn-primary" onClick={() => setDoneStatus(null)}>Entendi</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`update-toast toast-${toastKind}`}>{toast}</div>
      )}
    </UpdatesContext.Provider>
  )
}
