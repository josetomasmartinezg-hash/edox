import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import type { Machine, RepairRecord, User } from '../types'
import { MaintenancePhotosBlock } from './MaintenancePhotosBlock'

type Assignee = {
  id: string
  name: string
  role: User['role']
}

type Props = {
  user: User
  canAssign: boolean
  canManage: boolean
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

export function RepairsAdmin({ user, canAssign, canManage }: Props) {
  const [view, setView] = useState<View>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [items, setItems] = useState<RepairRecord[]>([])
  const [machineId, setMachineId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [asignadoId, setAsignadoId] = useState('')
  const [selected, setSelected] = useState<RepairRecord | null>(null)
  const [horometro, setHorometro] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('open')
  const [filterMachineId, setFilterMachineId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) || null,
    [machines, machineId],
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
    const [mRes, iRes, oRes] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/repairs'),
      apiFetch('/api/operators'),
    ])
    if (mRes.ok) setMachines(await mRes.json())
    if (iRes.ok) setItems(await iRes.json())
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
  }, [])

  function openAssign() {
    setError('')
    setMachineId('')
    setTitulo('')
    setDescripcion('')
    setAsignadoId('')
    setView('assign')
  }

  function openExecute(item: RepairRecord) {
    setSelected(item)
    setHorometro(item.horometro || '')
    setObservaciones(item.observaciones || '')
    setError('')
    setView('execute')
  }

  async function submitAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!canAssign) return
    if (!selectedMachine) {
      setError('Selecciona un equipo')
      return
    }
    if (!titulo.trim()) {
      setError('Ingresa un título para la reparación')
      return
    }
    if (!descripcion.trim()) {
      setError('Describe la falla o trabajo a realizar')
      return
    }
    if (!asignadoId) {
      setError('Asigna la reparación a un mecánico o supervisor')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch('/api/repairs', {
      method: 'POST',
      body: JSON.stringify({
        machineId: selectedMachine.id,
        sigla: selectedMachine.sigla,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        asignadoId,
        status: 'assigned',
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo crear la reparación')
      return
    }
    await load()
    setView('list')
  }

  async function saveProgress(complete: boolean) {
    if (!selected) return
    setLoading(true)
    setError('')
    const res = await apiFetch(`/api/repairs/${selected.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        horometro: horometro.trim(),
        observaciones: observaciones.trim(),
        status: complete ? 'completed' : selected.status === 'assigned' ? 'in_progress' : selected.status,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar')
      return
    }
    setSelected(data as RepairRecord)
    setItems((prev) => prev.map((row) => (row.id === data.id ? (data as RepairRecord) : row)))
    if (complete) setView('list')
  }

  async function remove(item: RepairRecord) {
    if (!confirm('¿Eliminar esta reparación?')) return
    const res = await apiFetch(`/api/repairs/${item.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'No se pudo eliminar')
      return
    }
    await load()
  }

  if (view === 'assign') {
    return (
      <div className="admin-section">
        <form className="admin-card" onSubmit={(e) => void submitAssign(e)}>
          <div className="toolbar">
            <div>
              <h3 className="section-title">Agregar reparación</h3>
              <p className="section-help">
                Registra una falla o trabajo correctivo y asígnalo a un mecánico.
              </p>
            </div>
          </div>
          <div className="field-grid two">
            <label className="field">
              <span>Equipo</span>
              <select value={machineId} onChange={(e) => setMachineId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sigla} — {m.marca} {m.modelo}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Asignado a</span>
              <select value={asignadoId} onChange={(e) => setAsignadoId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {assignees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Título</span>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                placeholder="Ej: Fuga hidráulica en manguera"
              />
            </label>
            <label className="field span-2">
              <span>Descripción del trabajo</span>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
                rows={4}
                placeholder="Detalla la falla, síntomas y lo que debe revisarse o repararse."
              />
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
              Volver
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : 'Agregar'}
            </button>
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
              {selected.sigla} · {selected.titulo}
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
        </div>

        <div className="admin-card">
          <div className="field-grid two">
            <div>
              <div className="detail-label">Equipo</div>
              <div className="detail-value">{selected.sigla}</div>
            </div>
            <div>
              <div className="detail-label">Estado</div>
              <div className="detail-value">{statusLabel(selected.status)}</div>
            </div>
            <div className="span-2">
              <div className="detail-label">Descripción</div>
              <div className="detail-value">{selected.descripcion || '—'}</div>
            </div>
            <label className="field">
              <span>Horómetro / Km</span>
              <input
                value={horometro}
                onChange={(e) => setHorometro(e.target.value)}
                disabled={!canEdit}
                placeholder="Al completar la reparación"
              />
            </label>
            <label className="field span-2">
              <span>Observaciones</span>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                disabled={!canEdit}
                rows={3}
                placeholder="Repuestos usados, pendientes, hallazgos…"
              />
            </label>
          </div>

          <MaintenancePhotosBlock
            maintenance={selected}
            canEdit={canEdit}
            resource="repairs"
            uploadHelp="Sube fotos del daño o de la reparación realizada."
            emptyHelp="Aún no hay fotografías en esta reparación."
            onUpdated={(item) => {
              const repair = item as unknown as RepairRecord
              setSelected(repair)
              setItems((prev) => prev.map((row) => (row.id === repair.id ? repair : row)))
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
                Completar reparación
              </button>
            </div>
          ) : (
            <p className="section-help">
              {selected.status === 'completed'
                ? 'Esta reparación ya está completada.'
                : 'Solo el asignado puede actualizar el trabajo.'}
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
          <h3 className="section-title">Reparaciones</h3>
          <p className="section-help">
            {canAssign
              ? 'Registra fallas o trabajos correctivos y asígnalos a un mecánico.'
              : 'Aquí aparecen las reparaciones que te asignaron.'}
          </p>
        </div>
        {canAssign ? (
          <button type="button" className="btn btn-primary" onClick={openAssign}>
            Agregar reparación
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
              <th>Título</th>
              <th>Asignado a</th>
              <th>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const mine = item.asignadoId === user.id
              return (
                <tr
                  key={item.id}
                  className={mine && item.status !== 'completed' ? 'row-alert-soon' : ''}
                >
                  <td>
                    <span className={`badge ${statusClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td>
                    <strong>{item.sigla}</strong>
                  </td>
                  <td>{item.titulo}</td>
                  <td>{item.asignadoNombre || '—'}</td>
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
                      {canAssign ? (
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
                <td colSpan={6} className="empty-cell">
                  {canAssign
                    ? 'No hay reparaciones en este filtro. Presiona Agregar para crear una.'
                    : 'No tienes reparaciones asignadas por ahora.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
