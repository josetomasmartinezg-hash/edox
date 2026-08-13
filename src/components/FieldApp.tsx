import { useEffect, useMemo, useState } from 'react'
import { HistoryList } from './HistoryList'
import { RecordForm } from './RecordForm'
import { UserSwitcher } from './UserSwitcher'
import { useOnlineStatus } from '../hooks/useOnline'
import { getAllRecords, getRecord, saveRecord } from '../lib/db'
import { loadMachines } from '../lib/machines'
import { syncPending } from '../lib/sync'
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
  onLogout: () => void
  onSwitchUser: () => void
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
    help: 'Chequeo antes de operar, horómetro, viajes y fotos de observaciones.',
    cta: 'Nueva revisión',
  },
  {
    id: 'mantenimiento',
    title: 'Mantenimiento',
    help: 'Escanea el QR: se carga sola la pauta del PDF de ese equipo.',
    cta: 'Nuevo mantenimiento',
  },
]

export function FieldApp({ user, onLogout, onSwitchUser }: Props) {
  const {
    online,
    serverOk,
    syncing,
    pendingCount,
    lastSyncMessage,
    setLastSyncMessage,
    forceSync,
  } = useOnlineStatus()
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
    void loadMachines()
  }, [lastSyncMessage, syncing])

  useEffect(() => {
    const onChanged = () => void refresh()
    window.addEventListener('edox-records-changed', onChanged)
    return () => window.removeEventListener('edox-records-changed', onChanged)
  }, [])

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

    try {
      const result = await syncPending()
      if (result.synced > 0) setToast('Registro guardado y subido al servidor')
      else if (!result.online) {
        setToast('Sin señal: guardado local. Se sincroniza automáticamente')
      } else if (result.failed > 0) {
        setToast('Guardado en el celular. Se subirá cuando haya señal')
      } else {
        setToast('Registro guardado')
      }
    } catch {
      setToast('Sin señal: guardado local. Se sincroniza automáticamente')
    }

    setSaving(false)
    setDraft(null)
    setView('home')
    await refresh()
  }

  async function handleForceSync() {
    setToast('Sincronizando…')
    await forceSync()
    await refresh()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand topbar-brand-mark compact">
          <img className="brand-logo compact" src="/logo-soinver.svg" alt="SOINVER Ingeniería" />
          <p>
            Hola {user.name.split(' ')[0]} · terreno
            {online ? '' : ' (sin señal)'}
          </p>
        </div>
        <div className="topbar-actions">
          <UserSwitcher currentUser={user} onSwitched={onSwitchUser} compact />
          <div className="status-pill" title={serverOk ? 'API OK' : 'API no disponible'}>
            <span className={`status-dot ${online ? 'online' : ''}`} />
            {syncing ? 'Sincronizando…' : online ? 'En línea' : 'Sin señal'}
          </div>
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
            <p>Elige una pestaña: combustible, revisión diaria o mantenimiento (QR + pauta).</p>
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
              <button type="button" className="nav-card" onClick={() => void handleForceSync()}>
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
