import { useEffect, useState } from 'react'
import { HistoryList } from './components/HistoryList'
import { RecordForm } from './components/RecordForm'
import { useOnlineStatus } from './hooks/useOnline'
import { getAllRecords, getRecord, saveRecord } from './lib/db'
import { syncPending, syncRecord } from './lib/sync'
import { createEmptyRecord, type MachinaryRecord } from './types'

type View = 'home' | 'form' | 'detail'

export default function App() {
  const { online, serverOk, syncing, lastSyncMessage, setLastSyncMessage } = useOnlineStatus()
  const [view, setView] = useState<View>('home')
  const [records, setRecords] = useState<MachinaryRecord[]>([])
  const [draft, setDraft] = useState<MachinaryRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  async function refresh() {
    setRecords(await getAllRecords())
  }

  useEffect(() => {
    void refresh()
  }, [lastSyncMessage, syncing])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (lastSyncMessage) {
      setToast(lastSyncMessage)
      setLastSyncMessage('')
      void refresh()
    }
  }, [lastSyncMessage, setLastSyncMessage])

  const pendingCount = records.filter((r) => r.syncStatus !== 'synced').length

  async function startNew() {
    const next = createEmptyRecord()
    setDraft(next)
    setView('form')
  }

  async function openRecord(id: string) {
    const record = await getRecord(id)
    if (!record) return
    setDraft(record)
    setView('detail')
  }

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    const local: MachinaryRecord = {
      ...draft,
      firmaOperador: draft.firmaOperador || draft.operador,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }
    await saveRecord(local)

    if (online && serverOk) {
      try {
        await syncRecord(local)
        setToast('Registro guardado y subido al servidor')
      } catch {
        setToast('Guardado en el celular. Se subirá cuando haya señal')
      }
    } else {
      setToast('Sin señal: guardado local. Se sincroniza automáticamente')
    }

    setSaving(false)
    setDraft(null)
    setView('home')
    await refresh()
  }

  async function forceSync() {
    setToast('Sincronizando…')
    const result = await syncPending()
    if (!result.online) {
      setToast('Sin conexión todavía')
    } else if (result.synced === 0 && result.failed === 0) {
      setToast('No hay pendientes')
    } else if (result.failed > 0) {
      setToast(`${result.synced} subidos, ${result.failed} con error`)
    } else {
      setToast(`${result.synced} registro(s) sincronizados`)
    }
    await refresh()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-kicker">Transporte · Campo</div>
          <h1>Edox</h1>
          <p>Control de maquinaria y combustible, incluso sin señal.</p>
        </div>
        <div className={`status-pill`} title={serverOk ? 'API OK' : 'API no disponible'}>
          <span className={`status-dot ${online ? 'online' : ''}`} />
          {syncing ? 'Sincronizando…' : online ? 'En línea' : 'Sin señal'}
        </div>
      </header>

      {toast ? <div className="toast">{toast}</div> : null}

      {view === 'home' ? (
        <div className="panel">
          <div className="hero-strip">
            <h2>Parte diario</h2>
            <p>Escanea la máquina, registra bencina y deja foto de respaldo.</p>
          </div>
          <div className="panel-body">
            <div className="nav-grid">
              <button type="button" className="nav-card" onClick={() => void startNew()}>
                <div>
                  <strong>Nuevo registro</strong>
                  <span>QR + litros + foto · funciona offline</span>
                </div>
                <em>Empezar</em>
              </button>
              <button type="button" className="nav-card" onClick={() => void forceSync()}>
                <div>
                  <strong>Sincronizar ahora</strong>
                  <span>Sube lo pendiente cuando vuelva la señal</span>
                </div>
                <em>{pendingCount} pend.</em>
              </button>
            </div>

            <section className="section">
              <h3 className="section-title">Historial local</h3>
              <p className="section-help">
                Los pendientes quedan en este dispositivo hasta que haya internet.
              </p>
              <HistoryList records={records} onOpen={(id) => void openRecord(id)} />
            </section>
          </div>
        </div>
      ) : null}

      {(view === 'form' || view === 'detail') && draft ? (
        <RecordForm
          record={draft}
          onChange={setDraft}
          onSave={() => void handleSave()}
          onCancel={() => {
            setDraft(null)
            setView('home')
          }}
          saving={saving}
        />
      ) : null}

      <p className="footer-note">
        Basado en el formulario papel MAQUINARIA · sync automático al recuperar señal
      </p>
    </div>
  )
}
