import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import { ROLE_LABELS, type Machine, type MaintenanceRecord, type User } from '../types'
import {
  MachinePautaRun,
  cleanPauta,
  emptyPautaRun,
  pautaSummaryText,
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

type View = 'list' | 'assign' | 'execute'
type StatusFilter = 'open' | 'all' | 'completed'

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
  return {
    tipoId: item.intervaloId || 'tipo',
    horometro: item.horometro || '',
    doneTasks,
    observaciones: item.observaciones || '',
  }
}

function pautaFromItem(item: MaintenanceRecord) {
  return [
    {
      id: item.intervaloId || 'tipo',
      nombre: item.tipoMantenimiento,
      items: (item.tareas || []).map((task) => ({ id: task.id, label: task.label })),
    },
  ]
}

export function MaintenanceAdmin({ user, canAssign, canManage }: Props) {
  const [view, setView] = useState<View>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [machineId, setMachineId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [asignadoId, setAsignadoId] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [runDraft, setRunDraft] = useState<PautaRunDraft>(emptyPautaRun())
  const [selected, setSelected] = useState<MaintenanceRecord | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('open')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) || null,
    [machines, machineId],
  )
  const pauta = useMemo(() => cleanPauta(selectedMachine?.pauta || []), [selectedMachine])
  const currentTipo = pauta.find((t) => t.id === tipoId) || pauta[0] || null

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const status = item.status || 'pending'
      if (filter === 'open') return status === 'pending' || status === 'in_progress'
      if (filter === 'completed') return status === 'completed'
      return true
    })
  }, [items, filter])

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
        people.filter((p) => p.role === 'mecanico' || p.role === 'supervisor' || p.role === 'administrador'),
      )
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setTipoId(pauta[0]?.id || '')
    setError('')
  }, [machineId])

  function openAssign() {
    setError('')
    setMachineId('')
    setTipoId('')
    setAsignadoId('')
    setInstrucciones('')
    setView('assign')
  }

  function openExecute(item: MaintenanceRecord) {
    setSelected(item)
    setRunDraft(draftFromItem(item))
    setError('')
    setView('execute')
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!canAssign) return
    if (!selectedMachine || !currentTipo) {
      setError('Selecciona el equipo y el tipo de pauta')
      return
    }
    if (!asignadoId) {
      setError('Asigna el mantenimiento a un mecánico o supervisor')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        machineId: selectedMachine.id,
        sigla: selectedMachine.sigla,
        tipoMantenimiento: currentTipo.nombre,
        intervaloId: currentTipo.id,
        instrucciones: instrucciones.trim(),
        asignadoId,
        status: 'pending',
        tareas: currentTipo.items.map((item) => ({
          id: item.id,
          label: item.label,
          realizado: false,
        })),
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo asignar')
      return
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
    const tareas = (selected.tareas || []).map((task) => ({
      ...task,
      realizado: !!runDraft.doneTasks[task.id],
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
            <h3 className="section-title">Asignar mantenimiento</h3>
            <p className="section-help">
              Elige el equipo, el tipo de pauta y a quién se lo asignas. Le aparecerá en su panel.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
            Cancelar
          </button>
        </div>

        <form className="maint-create" onSubmit={(e) => void handleAssign(e)}>
          <div className="admin-card">
            <h4>Equipo y responsable</h4>
            <div className="field-grid two">
              <label className="field">
                <span>Maquinaria</span>
                <select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.sigla} — {m.categoria || 'Sin categoría'} · {m.marca} {m.modelo}
                      {cleanPauta(m.pauta || []).length ? '' : ' (sin pauta)'}
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
            ) : null}
            {pauta.length ? (
              <div className="field">
                <span>Tipo de pauta</span>
                <div className="type-pill-row">
                  {pauta.map((tipo) => (
                    <button
                      key={tipo.id}
                      type="button"
                      className={`type-pill ${currentTipo?.id === tipo.id ? 'active' : ''}`}
                      onClick={() => setTipoId(tipo.id)}
                    >
                      {tipo.nombre}
                    </button>
                  ))}
                </div>
                {currentTipo ? (
                  <p className="section-help">
                    {currentTipo.items.length} ítems se enviarán al responsable para que los vaya
                    marcando.
                  </p>
                ) : null}
              </div>
            ) : selectedMachine ? (
              <p className="empty">Este equipo no tiene pauta. Súbela en Maquinaria.</p>
            ) : null}
            <label className="field">
              <span>Instrucción (opcional)</span>
              <textarea
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                placeholder="Ej: hacer el servicio de 250 h, revisar ruido en el círculo…"
                rows={3}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="btn-row">
              <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
                Volver
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !selectedMachine || !currentTipo || !asignadoId}
              >
                {loading ? 'Asignando…' : 'Asignar mantenimiento'}
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
        </div>

        <div className="admin-card">
          {selected.instrucciones ? (
            <p className="section-help">
              <strong>Instrucción:</strong> {selected.instrucciones}
            </p>
          ) : null}
          <MachinePautaRun
            pauta={pautaFromItem(selected)}
            draft={runDraft}
            onChange={setRunDraft}
            disabled={loading || !canEdit}
            lockTipo
            title="Pauta a realizar"
            help="Ve marcando con OK lo que vas haciendo. Si hay algo extra, déjalo en el comentario."
            commentLabel="Comentario extra"
            commentPlaceholder="Hallazgos, repuestos, algo que no estaba en la pauta…"
          />
          {selected.comentarios?.length ? (
            <div className="comment-log">
              <h4>Comentarios anteriores</h4>
              {selected.comentarios.map((comment) => (
                <p key={comment.id} className="section-help">
                  <strong>{comment.autorNombre}</strong> · {formatDate(comment.createdAt)}
                  <br />
                  {comment.texto}
                </p>
              ))}
            </div>
          ) : null}
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
              ? 'Asigna la pauta de un equipo a un mecánico o supervisor. Ellos la ven en su panel y van marcando lo realizado.'
              : 'Aquí aparecen los mantenimientos que te asignaron. Ábrelos, marca lo que vas haciendo y deja un comentario si hay algo extra.'}
          </p>
        </div>
        {canAssign ? (
          <button type="button" className="btn btn-primary" onClick={openAssign}>
            Asignar
          </button>
        ) : null}
      </div>

      <div className="legend-row">
        <button
          type="button"
          className={`btn btn-small ${filter === 'open' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilter('open')}
        >
          Pendientes
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

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Equipo</th>
              <th>Tipo</th>
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
                <tr key={item.id} className={mine && item.status !== 'completed' ? 'row-alert-soon' : ''}>
                  <td>
                    <span className={`badge ${statusClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
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
                      {canAssign && item.status !== 'completed' ? (
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
                    ? 'No hay mantenimientos en este filtro. Presiona Asignar para crear uno.'
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
