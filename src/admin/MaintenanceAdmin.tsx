import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  ROLE_LABELS,
  type Machine,
  type MaintenanceRecord,
  type User,
} from '../types'
import {
  MachinePautaRun,
  cleanPauta,
  emptyPautaRun,
  type PautaRunDraft,
} from './MaintenancePautaBlock'

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

function statusLabel(status?: string) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'in_progress') return 'En curso'
  if (status === 'completed') return 'Completado'
  return 'Pendiente'
}

function statusClass(status?: string) {
  if (status === 'completed') return 'synced'
  if (status === 'in_progress') return 'pending'
  return 'error'
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
  if (stored.length) return stored
  return [
    {
      id: item.intervaloId || 'tipo',
      nombre: item.tipoMantenimiento,
      items: (item.tareas || []).map((task) => ({ id: task.id, label: task.label })),
    },
  ]
}

function openJobFor(items: MaintenanceRecord[], machineId: string) {
  return (
    items.find(
      (item) =>
        item.machineId === machineId &&
        (item.status === 'pending' || item.status === 'in_progress'),
    ) || null
  )
}

export function MaintenanceAdmin({ user, canAssign, canManage }: Props) {
  const [view, setView] = useState<'list' | 'execute'>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [runDraft, setRunDraft] = useState<PautaRunDraft>(emptyPautaRun())
  const [selected, setSelected] = useState<MaintenanceRecord | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState('')

  const machinesWithPauta = useMemo(
    () => machines.filter((m) => cleanPauta(m.pauta || []).length),
    [machines],
  )

  const myJobs = useMemo(
    () =>
      items.filter(
        (item) =>
          item.asignadoId === user.id &&
          (item.status === 'pending' || item.status === 'in_progress'),
      ),
    [items, user.id],
  )

  async function load() {
    const [mRes, iRes, oRes] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/maintenance'),
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

  function openExecute(item: MaintenanceRecord) {
    setSelected(item)
    setRunDraft(draftFromItem(item))
    setError('')
    setView('execute')
  }

  async function assignPerson(machine: Machine, personId: string) {
    if (!canAssign) return
    const pauta = cleanPauta(machine.pauta || [])
    if (!pauta.length) {
      setError('Este equipo no tiene pauta. Súbela en Maquinaria (PDF o Excel).')
      return
    }
    if (!personId) return
    const open = openJobFor(items, machine.id)
    setSavingId(machine.id)
    setError('')
    const res = open
      ? await apiFetch(`/api/maintenance/${open.id}`, {
          method: 'PUT',
          body: JSON.stringify({ asignadoId: personId }),
        })
      : await apiFetch('/api/maintenance', {
          method: 'POST',
          body: JSON.stringify({
            machineId: machine.id,
            sigla: machine.sigla,
            pauta,
            asignadoId: personId,
            status: 'pending',
            tipoMantenimiento: machine.pautaFileName || 'Pauta',
          }),
        })
    const data = await res.json().catch(() => ({}))
    setSavingId('')
    if (!res.ok) {
      setError(data.error || 'No se pudo asignar')
      return
    }
    await load()
  }

  async function saveProgress(complete: boolean) {
    if (!selected || !canManage) return
    if (complete && !runDraft.horometro.trim()) {
      setError('Ingresa el kilometraje u horómetro para completar')
      return
    }
    const pauta = pautaFromItem(selected)
    const tareas = pauta.flatMap((tipo) =>
      tipo.items.map((item) => ({
        id: item.id,
        label: item.label,
        realizado: !!runDraft.doneTasks[item.id],
      })),
    )
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
          pauta.find((t) => t.id === runDraft.tipoId)?.nombre || selected.tipoMantenimiento,
        tareas,
        status: complete
          ? 'completed'
          : tareas.some((t) => t.realizado)
            ? 'in_progress'
            : 'pending',
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
        </div>

        <div className="admin-card">
          <MachinePautaRun
            pauta={pautaFromItem(selected)}
            draft={runDraft}
            onChange={setRunDraft}
            disabled={loading || !canEdit}
            title="Pauta del equipo"
            help="Es la pauta del PDF. Elige el intervalo, marca OK lo que vas haciendo y deja un comentario si hay algo extra."
            commentLabel="Comentario extra"
            commentPlaceholder="Hallazgos, repuestos, algo que no estaba en la pauta…"
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

  if (!canAssign) {
    return (
      <div className="admin-section">
        <div className="toolbar">
          <div>
            <h3 className="section-title">Mantenimiento</h3>
            <p className="section-help">
              Estos son los equipos que te asignaron. Ábrelos, marca la pauta del PDF y deja un
              comentario si hay algo extra.
            </p>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Equipo</th>
                <th>Pauta</th>
                <th>Avance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {myJobs.map((item) => {
                const done = item.tareas?.filter((t) => t.realizado).length || 0
                const total = item.tareas?.length || 0
                return (
                  <tr key={item.id} className="row-alert-soon">
                    <td>
                      <span className={`badge ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      <strong>{item.sigla}</strong>
                    </td>
                    <td>{item.tipoMantenimiento}</td>
                    <td>
                      {done} / {total} OK
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => openExecute(item)}
                      >
                        Realizar
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!myJobs.length ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No tienes mantenimientos asignados por ahora.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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
            Equipos que ya tienen pauta (PDF o Excel). Aquí mismo asignas la persona: mecánico o
            supervisor. Le llega a su panel para ir marcando.
          </p>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Pauta</th>
              <th>Asignar a</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {machinesWithPauta.map((machine) => {
              const job = openJobFor(items, machine.id)
              const tipos = cleanPauta(machine.pauta || [])
              const itemsCount = tipos.reduce((sum, tipo) => sum + tipo.items.length, 0)
              return (
                <tr key={machine.id}>
                  <td>
                    <strong>{machine.sigla}</strong>
                    <div className="table-sub">
                      {machine.categoria || 'Sin categoría'} · {machine.marca} {machine.modelo}
                    </div>
                  </td>
                  <td>
                    {machine.pautaFileName || 'Pauta cargada'}
                    <div className="table-sub">
                      {tipos.length} tipos · {itemsCount} ítems
                    </div>
                  </td>
                  <td>
                    <select
                      value={job?.asignadoId || ''}
                      disabled={savingId === machine.id}
                      onChange={(e) => void assignPerson(machine, e.target.value)}
                    >
                      <option value="">Seleccionar persona…</option>
                      {assignees.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} · {ROLE_LABELS[person.role] || person.role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {job ? (
                      <span className={`badge ${statusClass(job.status)}`}>
                        {statusLabel(job.status)}
                      </span>
                    ) : (
                      <span className="badge">Sin asignar</span>
                    )}
                  </td>
                  <td>
                    {job ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-small"
                        onClick={() => openExecute(job)}
                      >
                        Ver
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {!machinesWithPauta.length ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No hay equipos con pauta. En Maquinaria, crea el equipo y sube el PDF o Excel.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {items.some((item) => item.status === 'completed') ? (
        <div className="admin-card" style={{ marginTop: 18 }}>
          <h4>Completados</h4>
          <div className="table-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Equipo</th>
                  <th>Responsable</th>
                  <th>Avance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((item) => item.status === 'completed')
                  .map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.updatedAt || item.createdAt)}</td>
                      <td>
                        <strong>{item.sigla}</strong>
                      </td>
                      <td>{item.asignadoNombre || item.mecanicoNombre}</td>
                      <td>
                        {item.tareas?.filter((t) => t.realizado).length || 0} /{' '}
                        {item.tareas?.length || 0} OK
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => openExecute(item)}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
