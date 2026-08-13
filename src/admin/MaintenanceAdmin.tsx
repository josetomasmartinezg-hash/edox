import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import { getPendingRecords } from '../lib/db'
import { RECORDS_SYNCED_EVENT } from '../lib/sync'
import {
  ROLE_LABELS,
  type Machine,
  type MachinaryRecord,
  type MaintenanceRecord,
  type User,
} from '../types'
import {
  MachinePautaRun,
  cleanPauta,
  emptyPautaRun,
  pautaSummaryText,
  type PautaRunDraft,
} from './MaintenancePautaBlock'
import { MaintenancePhotosBlock } from './MaintenancePhotosBlock'
import { downloadMaintenancePdf } from '../lib/maintenancePdf'

type Assignee = {
  id: string
  name: string
  role: User['role']
}

type Props = {
  user: User
  canAssign: boolean
  canManage: boolean
  openMaintenanceId?: string | null
  onOpenMaintenanceHandled?: () => void
}

type View = 'list' | 'assign' | 'execute'
type StatusFilter = 'open' | 'all' | 'completed'

function statusLabel(status?: string) {
  if (status === 'assigned' || status === 'pending') return 'Asignado'
  if (status === 'in_progress') return 'En curso'
  if (status === 'completed') return 'Completado'
  return 'Asignado'
}

function statusClass(status?: string) {
  if (status === 'completed') return 'synced'
  if (status === 'in_progress') return 'pending'
  if (status === 'assigned' || status === 'pending') return 'assigned'
  return 'assigned'
}

function formatDate(value?: string) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

function draftFromItem(item: MaintenanceRecord): PautaRunDraft {
  const doneTasks: Record<string, boolean> = {}
  for (const task of item.tareas || []) doneTasks[task.id] = !!task.realizado
  const pauta = cleanPauta(item.pauta || [])
  return {
    tipoId: item.intervaloId || pauta[0]?.id || 'tipo',
    horometro: item.horometro || '',
    doneTasks,
    observaciones: item.observaciones || '',
  }
}

function pautaFromItem(item: MaintenanceRecord) {
  const stored = cleanPauta(item.pauta || [])
  if (item.intervaloId) {
    const match = stored.find((t) => t.id === item.intervaloId)
    if (match) return [match]
  }
  if (stored.length) return stored
  return [
    {
      id: item.intervaloId || 'tipo',
      nombre: item.tipoMantenimiento,
      items: (item.tareas || []).map((task) => ({ id: task.id, label: task.label })),
    },
  ]
}

function fromFieldRecord(record: MachinaryRecord): MaintenanceRecord {
  const tareas = (record.mantenimiento || [])
    .filter((row) => row.id || row.tipo)
    .map((row) => ({
      id: row.id,
      label: row.tipo,
      realizado: !!row.realizado,
    }))
  return {
    id: record.id,
    fieldRecordId: record.id,
    machineId: null,
    sigla: record.maquina,
    tipoMantenimiento: record.tipoMantenimiento || record.intervaloMantenimiento || 'Pauta',
    intervaloId: record.intervaloMantenimiento,
    horometro: record.horasInicial || '—',
    tareas,
    observaciones: record.observaciones || '',
    instrucciones: '',
    status: 'completed',
    asignadoNombre: record.operador,
    mecanicoId: record.userId || '',
    mecanicoNombre: record.operador,
    pendingSync: record.syncStatus !== 'synced',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export function MaintenanceAdmin({
  user,
  canAssign,
  canManage,
  openMaintenanceId,
  onOpenMaintenanceHandled,
}: Props) {
  const [view, setView] = useState<View>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [machineId, setMachineId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [asignadoId, setAsignadoId] = useState('')
  const [runDraft, setRunDraft] = useState<PautaRunDraft>(emptyPautaRun())
  const [selected, setSelected] = useState<MaintenanceRecord | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('open')
  const [filterMachineId, setFilterMachineId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) || null,
    [machines, machineId],
  )
  const pauta = useMemo(() => cleanPauta(selectedMachine?.pauta || []), [selectedMachine])
  const machinesWithPauta = useMemo(
    () => machines.filter((m) => cleanPauta(m.pauta || []).length),
    [machines],
  )

  const machineFilterOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const item of items) {
      const machine = machines.find(
        (m) => m.id === item.machineId || m.sigla === item.sigla,
      )
      const id = machine?.id || item.machineId || item.sigla
      options.set(String(id), item.sigla)
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [items, machines])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.pendingSync) return filter !== 'completed'
      const status = item.status || 'assigned'
      if (filter === 'open') {
        if (status !== 'assigned' && status !== 'pending' && status !== 'in_progress') {
          return false
        }
      } else if (filter === 'completed') {
        if (status !== 'completed') return false
      }

      if (!filterMachineId) return true
      const machine = machines.find((m) => m.id === filterMachineId)
      const filterSigla = machine?.sigla?.toUpperCase()
      if (item.machineId === filterMachineId) return true
      if (filterSigla && item.sigla?.toUpperCase() === filterSigla) return true
      return filterMachineId === item.sigla
    })
  }, [items, filter, filterMachineId, machines])

  async function load() {
    const [mRes, iRes, oRes, localPending] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/maintenance'),
      apiFetch('/api/operators'),
      getPendingRecords(),
    ])
    if (mRes.ok) setMachines(await mRes.json())
    const server: MaintenanceRecord[] = iRes.ok ? await iRes.json() : []
    const localMaint = localPending
      .filter((r) => (r.tipoRegistro || '') === 'mantenimiento')
      .map(fromFieldRecord)
    const merged = new Map<string, MaintenanceRecord>()
    for (const item of server) {
      merged.set(item.fieldRecordId || item.id, item)
    }
    for (const item of localMaint) {
      const key = item.fieldRecordId || item.id
      if (!merged.has(key)) merged.set(key, item)
    }
    setItems(
      [...merged.values()].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime(),
      ),
    )
    if (oRes.ok) {
      const people = (await oRes.json()) as Assignee[]
      setAssignees(
        people.filter(
          (p) => p.role === 'mecanico' || p.role === 'supervisor' || p.role === 'administrador',
        ),
      )
    }
  }

  useEffect(() => {
    void load()
    const onSynced = () => void load()
    window.addEventListener(RECORDS_SYNCED_EVENT, onSynced)
    window.addEventListener('edox-records-changed', onSynced)
    const id = window.setInterval(() => void load(), 5000)
    return () => {
      window.removeEventListener(RECORDS_SYNCED_EVENT, onSynced)
      window.removeEventListener('edox-records-changed', onSynced)
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (!openMaintenanceId || !items.length) return
    const item = items.find((row) => row.id === openMaintenanceId)
    if (!item) return
    openExecute(item)
    onOpenMaintenanceHandled?.()
  }, [openMaintenanceId, items, onOpenMaintenanceHandled])

  useEffect(() => {
    setTipoId(pauta[0]?.id || '')
  }, [machineId, pauta])

  function openAssign() {
    setError('')
    setMachineId('')
    setTipoId('')
    setAsignadoId('')
    setView('assign')
  }

  function openExecute(item: MaintenanceRecord) {
    setSelected(item)
    setRunDraft(draftFromItem(item))
    setError('')
    setView('execute')
  }

  async function handleDownloadPdf(item: MaintenanceRecord) {
    setError('')
    try {
      await downloadMaintenancePdf(item.id, `mantenimiento-${item.sigla}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el PDF')
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!canAssign) return
    if (!selectedMachine || !pauta.length) {
      setError('Selecciona un equipo que ya tenga pauta (PDF o Excel).')
      return
    }
    if (!asignadoId) {
      setError('Asigna el mantenimiento a un mecánico o supervisor')
      return
    }
    const selectedTipo = pauta.find((t) => t.id === tipoId) || pauta[0]
    if (!selectedTipo) {
      setError('Selecciona el tipo de mantenimiento de la pauta del equipo')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        machineId: selectedMachine.id,
        sigla: selectedMachine.sigla,
        intervaloId: selectedTipo.id,
        tipoMantenimiento: selectedTipo.nombre,
        tareas: selectedTipo.items.map((item) => ({
          id: item.id,
          label: item.label,
          realizado: false,
        })),
        asignadoId,
        status: 'assigned',
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo asignar')
      return
    }
    try {
      await downloadMaintenancePdf(data.id, `mantenimiento-${selectedMachine.sigla}.pdf`)
    } catch {
      // La asignación ya se guardó; el PDF se puede descargar después desde la lista.
    }
    setView('list')
    await load()
  }

  async function saveProgress(complete: boolean) {
    if (!selected || !canManage) return
    if (complete && !runDraft.horometro.trim()) {
      setError('Ingresa el kilometraje u horómetro para completar')
      return
    }
    const pautaItems = pautaFromItem(selected)
    const currentTipo = pautaItems.find((t) => t.id === runDraft.tipoId) || pautaItems[0]
    const tareas = (currentTipo?.items || []).map((item) => ({
      id: item.id,
      label: item.label,
      realizado: !!runDraft.doneTasks[item.id],
    }))
    if (complete && !tareas.some((t) => t.realizado) && !runDraft.observaciones.trim()) {
      setError('Marca al menos un ítem o deja un comentario')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch(`/api/maintenance/${selected.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        horometro: runDraft.horometro.trim(),
        observaciones: runDraft.observaciones.trim(),
        intervaloId: runDraft.tipoId,
        tipoMantenimiento:
          pautaItems.find((t) => t.id === runDraft.tipoId)?.nombre || selected.tipoMantenimiento,
        pauta: pautaItems,
        tareas,
        status: complete
          ? 'completed'
          : tareas.some((t) => t.realizado)
            ? 'in_progress'
            : 'assigned',
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar')
      return
    }
    setView('list')
    setSelected(null)
    await load()
  }

  async function remove(item: MaintenanceRecord) {
    if (!confirm('¿Eliminar este mantenimiento?')) return
    await apiFetch(`/api/maintenance/${item.id}`, { method: 'DELETE' })
    await load()
  }

  if (view === 'assign') {
    return (
      <div className="admin-section">
        <div className="toolbar">
          <div>
            <h3 className="section-title">Agregar mantenimiento</h3>
            <p className="section-help">
              Elige el equipo, el tipo de mantenimiento de su pauta y a quién se lo asignas.
              Al guardar se descargará un PDF con la orden de trabajo.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
            Cancelar
          </button>
        </div>

        <form className="maint-create" onSubmit={(e) => void handleAssign(e)}>
          <div className="admin-card">
            <div className="field-grid two">
              <label className="field">
                <span>Equipo</span>
                <select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {machinesWithPauta.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.sigla} — {m.categoria || 'Sin categoría'} · {m.marca} {m.modelo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tipo de mantenimiento</span>
                <select
                  value={tipoId}
                  onChange={(e) => setTipoId(e.target.value)}
                  required
                  disabled={!selectedMachine || !pauta.length}
                >
                  <option value="">
                    {selectedMachine ? 'Seleccionar tipo…' : 'Primero elige un equipo'}
                  </option>
                  {pauta.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nombre} ({tipo.items.length} ítems)
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Asignar a</span>
                <select
                  value={asignadoId}
                  onChange={(e) => setAsignadoId(e.target.value)}
                  required
                >
                  <option value="">Mecánico o supervisor…</option>
                  {assignees.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} · {ROLE_LABELS[person.role] || person.role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selectedMachine ? (
              <p className="pauta-upload-ok">{pautaSummaryText(selectedMachine)}</p>
            ) : (
              <p className="section-help">
                Solo aparecen equipos con pauta cargada en Maquinaria.
              </p>
            )}
            {error ? <p className="form-error">{error}</p> : null}
            <div className="btn-row">
              <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
                Volver
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !selectedMachine || !pauta.length || !tipoId || !asignadoId}
              >
                {loading ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  if (view === 'execute' && selected) {
    const mine = selected.asignadoId === user.id
    const canEdit = canManage && (mine || canAssign) && selected.status !== 'completed'
    return (
      <div className="admin-section">
        <div className="toolbar">
          <div>
            <h3 className="section-title">
              {selected.sigla} · {selected.tipoMantenimiento}
            </h3>
            <p className="section-help">
              Asignado a {selected.asignadoNombre || '—'} · {statusLabel(selected.status)}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setView('list')
              setSelected(null)
            }}
          >
            Volver
          </button>
          {canAssign || selected.asignadoId === user.id ? (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => void handleDownloadPdf(selected)}
            >
              Descargar PDF
            </button>
          ) : null}
        </div>

        <div className="admin-card">
          <MachinePautaRun
            pauta={pautaFromItem(selected)}
            draft={runDraft}
            onChange={setRunDraft}
            disabled={loading || !canEdit}
            lockTipo={!!selected.intervaloId}
            title="Pauta del equipo"
            help={
              selected.intervaloId
                ? 'Marca OK lo que vas haciendo según la pauta asignada.'
                : 'Es la pauta del PDF. Elige el intervalo, marca OK lo que vas haciendo y deja un comentario si hay algo extra.'
            }
            commentLabel="Comentario extra"
            commentPlaceholder="Hallazgos, repuestos, algo que no estaba en la pauta…"
          />
          <MaintenancePhotosBlock
            maintenance={selected}
            canEdit={canEdit}
            onUpdated={(item) => {
              setSelected(item)
              setItems((prev) => prev.map((row) => (row.id === item.id ? item : row)))
            }}
          />
          {error ? <p className="form-error">{error}</p> : null}
          {canEdit ? (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading}
                onClick={() => void saveProgress(false)}
              >
                {loading ? 'Guardando…' : 'Guardar avance'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={() => void saveProgress(true)}
              >
                Completar mantenimiento
              </button>
            </div>
          ) : (
            <p className="section-help">
              {selected.status === 'completed'
                ? 'Este mantenimiento ya está completado.'
                : 'Solo el asignado puede ir marcando la pauta.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Mantenimiento</h3>
          <p className="section-help">
            {canAssign
              ? 'Agrega un mantenimiento, elige el equipo y asígnalo. Lo hecho en terreno sin señal también aparece aquí y se sube solo.'
              : 'Aquí aparecen los mantenimientos que te asignaron. Ábrelos y marca la pauta.'}
          </p>
        </div>
        {canAssign ? (
          <button type="button" className="btn btn-primary" onClick={openAssign}>
            Agregar mantenimiento
          </button>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="meta-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div className="legend-row" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`btn btn-small ${filter === 'open' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('open')}
          >
            Abiertos
          </button>
          <button
            type="button"
            className={`btn btn-small ${filter === 'completed' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('completed')}
          >
            Completados
          </button>
          <button
            type="button"
            className={`btn btn-small ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
        </div>

        <label className="field inline-filter">
          <span>Equipo</span>
          <select
            value={filterMachineId}
            onChange={(e) => setFilterMachineId(e.target.value)}
          >
            <option value="">Todos los equipos</option>
            {machineFilterOptions.map(([id, sigla]) => (
              <option key={id} value={id}>
                {sigla}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Equipo</th>
              <th>Pauta</th>
              <th>Asignado a</th>
              <th>Avance</th>
              <th>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const done = item.tareas?.filter((t) => t.realizado).length || 0
              const total = item.tareas?.length || 0
              const mine = item.asignadoId === user.id
              return (
                <tr
                  key={item.id}
                  className={
                    item.pendingSync
                      ? 'row-pending-sync'
                      : mine && item.status !== 'completed'
                        ? 'row-alert-soon'
                        : ''
                  }
                >
                  <td>
                    {item.pendingSync ? (
                      <span className="badge pending">En el celular</span>
                    ) : (
                      <span className={`badge ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    )}
                  </td>
                  <td>
                    <strong>{item.sigla}</strong>
                  </td>
                  <td>{item.tipoMantenimiento}</td>
                  <td>{item.asignadoNombre || item.mecanicoNombre || '—'}</td>
                  <td>
                    {done} / {total} OK
                  </td>
                  <td>{formatDate(item.updatedAt || item.createdAt)}</td>
                  <td>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() => openExecute(item)}
                      >
                        {mine && item.status !== 'completed' ? 'Realizar' : 'Ver'}
                      </button>
                      {canAssign || mine ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => void handleDownloadPdf(item)}
                        >
                          PDF
                        </button>
                      ) : null}
                      {canAssign && item.status !== 'completed' && !item.pendingSync ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => void remove(item)}
                        >
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!filteredItems.length ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  {canAssign
                    ? 'No hay mantenimientos en este filtro. Presiona Agregar para crear uno.'
                    : 'No tienes mantenimientos asignados por ahora.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
