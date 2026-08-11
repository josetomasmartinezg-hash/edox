import { useEffect, useMemo, useState } from 'react'
import { HistoryList } from './HistoryList'
import { RecordForm } from './RecordForm'
import { useOnlineStatus } from '../hooks/useOnline'
import { getAllRecords, getRecord, saveRecord } from '../lib/db'
import { syncPending, syncRecord } from '../lib/sync'
import {
  FIELD_TYPE_LABELS,
  createEmptyRecord,
  type FieldRecordType,
  type MachinaryRecord,
  type User,
} from '../types'

type View = 'home' | 'form' | 'detail'

type Props = {
  user: User
  canOpenAdmin?: boolean
  onOpenAdmin?: () => void
  onLogout: () => void
}

const TABS: { id: FieldRecordType; title: string; help: string; cta: string }[] = [
  {
    id: 'combustible',
    title: 'Combustible',
    help: 'Litros en estanque, litros cargados y foto de respaldo.',
    cta: 'Nueva carga',
  },
  {
    id: 'revision_diaria',
    title: 'Revisión diaria',
    help: 'Chequeo antes de operar, horómetro y viajes.',
    cta: 'Nueva revisión',
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento',
    help: 'Aceites, diferencial, grasa y lo aplicado en terreno.',
    cta: 'Nuevo mantenimiento',
  },
]

export function FieldApp({ user, canOpenAdmin, onOpenAdmin, onLogout }: Props) {
  const { online, serverOk, syncing, lastSyncMessage, setLastSyncMessage } = useOnlineStatus()
  const [tab, setTab] = useState<FieldRecordType>('combustible')
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

  const filtered = useMemo(
    () =>
      records.filter((r) => (r.tipoRegistro || 'combustible') === tab),
    [records, tab],
  )

  const pendingCount = records.filter((r) => r.syncStatus !== 'synced').length
  const currentTab = TABS.find((t) => t.id === tab)!

  async function startNew() {
    setDraft(createEmptyRecord(user.name, tab))
    setView('form')
  }

  async function openRecord(id: string) {
    const record = await getRecord(id)
    if (!record) return
    // Normaliza registros antiguos sin tipo
    setDraft({
      ...record,
      tipoRegistro: record.tipoRegistro || 'combustible',
    })
    setView('detail')
  }

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    const local: MachinaryRecord = {
      ...draft,
      tipoRegistro: draft.tipoRegistro || tab,
      operador: draft.operador || user.name,
      firmaOperador: draft.firmaOperador || draft.operador || user.name,
      userId: user.id,
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
    if (!result.online) setToast('Sin conexión todavía')
    else if (result.synced === 0 && result.failed === 0) setToast('No hay pendientes')
    else if (result.failed > 0) setToast(`${result.synced} subidos, ${result.failed} con error`)
    else setToast(`${result.synced} registro(s) sincronizados`)
    await refresh()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo compact" src="/logo-soinver.png" alt="SOINVER Ingeniería" />
          <p>
            Hola {user.name.split(' ')[0]} · terreno
            {online ? '' : ' (sin señal)'}
          </p>
        </div>
        <div className="topbar-actions">
          <div className="status-pill" title={serverOk ? 'API OK' : 'API no disponible'}>
            <span className={`status-dot ${online ? 'online' : ''}`} />
            {syncing ? 'Sincronizando…' : online ? 'En línea' : 'Sin señal'}
          </div>
          {canOpenAdmin ? (
            <button type="button" className="btn btn-accent btn-small" onClick={onOpenAdmin}>
              Panel
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-small light" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      {toast ? <div className="toast">{toast}</div> : null}

      {view === 'home' ? (
        <div className="panel">
          <div className="hero-strip">
            <h2>Operación en terreno</h2>
            <p>Elige una pestaña según la faena: combustible, revisión o mantenimiento.</p>
          </div>
          <div className="panel-body">
            <div className="field-tabs">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`field-tab ${tab === item.id ? 'active' : ''}`}
                  onClick={() => setTab(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </div>

            <section className="section">
              <h3 className="section-title">{currentTab.title}</h3>
              <p className="section-help">{currentTab.help}</p>
            </section>

            <div className="nav-grid">
              <button type="button" className="nav-card" onClick={() => void startNew()}>
                <div>
                  <strong>{currentTab.cta}</strong>
                  <span>QR + formulario · funciona offline</span>
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
              <h3 className="section-title">Historial · {FIELD_TYPE_LABELS[tab]}</h3>
              <p className="section-help">
                Solo se muestran los registros de esta pestaña.
              </p>
              <HistoryList
                records={filtered}
                onOpen={(id) => void openRecord(id)}
                emptyText={`Sin registros de ${FIELD_TYPE_LABELS[tab].toLowerCase()} todavía.`}
              />
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
    </div>
  )
}
