import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  defaultIntervalForCategory,
  getInterval,
  getProgramForCategory,
  isLightTruckCategory,
  meterLabelForCategory,
  type MaintenanceIntervalId,
} from '../data/maintenanceProgram'
import type { Machine, MaintenanceRecord } from '../types'

type Props = {
  canManage: boolean
}

type View = 'list' | 'create'

export function MaintenanceAdmin({ canManage }: Props) {
  const [view, setView] = useState<View>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [machineId, setMachineId] = useState('')
  const [intervaloId, setIntervaloId] = useState<MaintenanceIntervalId>('km_10000')
  const [horometro, setHorometro] = useState('')
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({})
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) || null,
    [machines, machineId],
  )

  const program = useMemo(
    () => getProgramForCategory(selectedMachine?.categoria),
    [selectedMachine?.categoria],
  )

  const currentInterval = useMemo(() => getInterval(intervaloId), [intervaloId])
  const isKm = isLightTruckCategory(selectedMachine?.categoria)
  const meterLabel = meterLabelForCategory(selectedMachine?.categoria)

  const doneCount = useMemo(
    () => Object.values(doneTasks).filter(Boolean).length,
    [doneTasks],
  )

  async function load() {
    const [mRes, iRes] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/maintenance'),
    ])
    if (mRes.ok) setMachines(await mRes.json())
    if (iRes.ok) setItems(await iRes.json())
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!selectedMachine) return
    const next = defaultIntervalForCategory(selectedMachine.categoria)
    setIntervaloId(next)
    setDoneTasks({})
  }, [selectedMachine?.id, selectedMachine?.categoria])

  useEffect(() => {
    setDoneTasks({})
  }, [intervaloId])

  function openCreate() {
    setError('')
    setMachineId('')
    setIntervaloId('km_10000')
    setHorometro('')
    setDoneTasks({})
    setObservaciones('')
    setView('create')
  }

  function toggleTask(id: string) {
    setDoneTasks((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (!machineId) {
      setError('Selecciona el equipo')
      return
    }
    if (!intervaloId) {
      setError('Selecciona el tipo de mantenimiento')
      return
    }
    if (!horometro.trim()) {
      setError(`Ingresa el ${meterLabel.toLowerCase()}`)
      return
    }
    if (!doneCount) {
      setError('Marca al menos un ítem realizado (OK)')
      return
    }

    setLoading(true)
    setError('')

    const tareas = (currentInterval?.tasks || []).map((t) => ({
      id: t.id,
      label: t.label,
      realizado: !!doneTasks[t.id],
    }))

    const res = await apiFetch('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        machineId,
        sigla: selectedMachine?.sigla,
        tipoMantenimiento: currentInterval?.label || intervaloId,
        intervaloId,
        horometro,
        tareas,
        observaciones,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar')
      return
    }
    setView('list')
    await load()
  }

  async function remove(item: MaintenanceRecord) {
    if (!confirm('¿Eliminar este mantenimiento?')) return
    await apiFetch(`/api/maintenance/${item.id}`, { method: 'DELETE' })
    await load()
  }

  if (view === 'create') {
    return (
      <div className="admin-section">
        <div className="toolbar">
          <div>
            <h3 className="section-title">Nuevo mantenimiento</h3>
            <p className="section-help">
              Elige el equipo, el tipo de pauta y marca cada ítem con OK.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
            Cancelar
          </button>
        </div>

        <form className="maint-create" onSubmit={(e) => void handleSubmit(e)}>
          <div className="admin-card">
            <h4>Datos</h4>
            <div className="field-grid">
              <label className="field">
                <span>Equipo</span>
                <select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.sigla} — {m.categoria || 'Sin categoría'} · {m.marca} {m.modelo}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field">
                <span>Tipo de mantenimiento</span>
                <div className="type-pill-row">
                  {program.map((interval) => (
                    <button
                      key={interval.id}
                      type="button"
                      className={`type-pill ${intervaloId === interval.id ? 'active' : ''}`}
                      onClick={() => setIntervaloId(interval.id)}
                      disabled={!machineId}
                    >
                      {interval.label}
                    </button>
                  ))}
                </div>
                {currentInterval?.subtitle ? (
                  <p className="section-help">{currentInterval.subtitle}</p>
                ) : null}
              </div>

              <label className="field">
                <span>{meterLabel}</span>
                <input
                  inputMode="numeric"
                  value={horometro}
                  onChange={(e) => setHorometro(e.target.value.replace(/[^\d.]/g, ''))}
                  required
                  placeholder={isKm ? 'Ej: 45280' : 'Ej: 127582'}
                />
              </label>
            </div>
          </div>

          <div className="admin-card">
            <div className="toolbar compact">
              <div>
                <h4 className="mini-title">Pauta · {currentInterval?.label || '—'}</h4>
                <p className="section-help">
                  {doneCount} de {currentInterval?.tasks.length || 0} con OK
                </p>
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => {
                    const all: Record<string, boolean> = {}
                    for (const t of currentInterval?.tasks || []) all[t.id] = true
                    setDoneTasks(all)
                  }}
                  disabled={!currentInterval}
                >
                  Todos OK
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => setDoneTasks({})}
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="task-list desktop-tasks">
              {(currentInterval?.tasks || []).map((task) => {
                const checked = !!doneTasks[task.id]
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={`task-ok-item ${checked ? 'done' : ''}`}
                    onClick={() => toggleTask(task.id)}
                  >
                    <span className="task-ok-badge">{checked ? 'OK' : ''}</span>
                    <span className="task-ok-label">{task.label}</span>
                  </button>
                )
              })}
              {!machineId ? (
                <p className="empty">Selecciona un equipo para ver la pauta.</p>
              ) : null}
            </div>
          </div>

          <div className="admin-card">
            <h4>Comentario / Observaciones</h4>
            <label className="field">
              <span>Observaciones</span>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Detalle del trabajo, repuestos, hallazgos…"
                rows={4}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="btn-row">
              <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
                Volver
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading || !machineId}>
                {loading ? 'Guardando…' : 'Guardar mantenimiento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Mantenimiento</h3>
          <p className="section-help">
            Pauta por equipo: camiones livianos 10.000 / 20.000 km. Presiona + para registrar.
          </p>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-primary btn-add" onClick={openCreate}>
            +
          </button>
        ) : null}
      </div>

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Equipo</th>
              <th>Tipo</th>
              <th>Medidor</th>
              <th>Mecánico</th>
              <th>Ítems OK</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString('es-CL')}</td>
                <td>
                  <strong>{item.sigla}</strong>
                </td>
                <td>{item.tipoMantenimiento}</td>
                <td>{item.horometro}</td>
                <td>{item.mecanicoNombre}</td>
                <td>
                  {item.tareas?.filter((t) => t.realizado).length || item.tareas?.length || 0}
                  {item.tareas?.length ? ` / ${item.tareas.length}` : ''}
                </td>
                <td>
                  {canManage ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={() => void remove(item)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  Sin mantenimientos. {canManage ? 'Presiona + para crear el primero.' : ''}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
