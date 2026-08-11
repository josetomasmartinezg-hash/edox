import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  MAINTENANCE_PROGRAM,
  getInterval,
  type MaintenanceIntervalId,
} from '../data/maintenanceProgram'
import type { Machine, MaintenanceRecord } from '../types'

type Props = {
  canManage: boolean
}

export function MaintenanceAdmin({ canManage }: Props) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [machineId, setMachineId] = useState('')
  const [intervaloId, setIntervaloId] = useState<MaintenanceIntervalId>('10h_diario')
  const [horometro, setHorometro] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) || null,
    [machines, machineId],
  )

  const currentInterval = useMemo(() => getInterval(intervaloId), [intervaloId])

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
    setSelectedTasks([])
  }, [intervaloId])

  function toggleTask(id: string) {
    setSelectedTasks((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  function selectAll() {
    if (!currentInterval) return
    setSelectedTasks(currentInterval.tasks.map((t) => t.id))
  }

  function clearAll() {
    setSelectedTasks([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (!selectedTasks.length) {
      setError('Marca al menos una tarea realizada del programa')
      return
    }
    setLoading(true)
    setError('')

    const tareas = (currentInterval?.tasks || [])
      .filter((t) => selectedTasks.includes(t.id))
      .map((t) => ({ id: t.id, label: t.label, realizado: true }))

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
    setHorometro('')
    setSelectedTasks([])
    setObservaciones('')
    await load()
  }

  async function remove(item: MaintenanceRecord) {
    if (!confirm('¿Eliminar este mantenimiento?')) return
    await apiFetch(`/api/maintenance/${item.id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Mantenimiento</h3>
          <p className="section-help">
            Programa de tiempos operativos: selecciona equipo, intervalo y marca las tareas
            realizadas.
          </p>
        </div>
      </div>

      {canManage ? (
        <form className="desktop-grid-2" onSubmit={(e) => void handleSubmit(e)}>
          <div className="admin-card">
            <h4>Datos del registro</h4>
            <div className="field-grid">
              <label className="field">
                <span>Equipo (sigla)</span>
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
                <span>Horómetro al realizarlo</span>
                <input
                  inputMode="decimal"
                  value={horometro}
                  onChange={(e) => setHorometro(e.target.value)}
                  required
                  placeholder="Ej: 127582"
                />
              </label>
              <label className="field">
                <span>Intervalo / tipo de mantenimiento</span>
                <select
                  value={intervaloId}
                  onChange={(e) => setIntervaloId(e.target.value as MaintenanceIntervalId)}
                >
                  {MAINTENANCE_PROGRAM.map((interval) => (
                    <option key={interval.id} value={interval.id}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Observaciones</span>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Repuestos, hallazgos, detalle del trabajo…"
                />
              </label>
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={loading || !machineId}>
              {loading ? 'Guardando…' : 'Registrar mantenimiento'}
            </button>
          </div>

          <div className="admin-card">
            <div className="toolbar compact">
              <div>
                <h4 className="mini-title">Tareas del intervalo</h4>
                {currentInterval?.subtitle ? (
                  <p className="section-help">{currentInterval.subtitle}</p>
                ) : (
                  <p className="section-help">
                    {selectedTasks.length} de {currentInterval?.tasks.length || 0} realizadas
                  </p>
                )}
              </div>
              <div className="btn-row">
                <button type="button" className="btn btn-ghost btn-small" onClick={selectAll}>
                  Marcar todas
                </button>
                <button type="button" className="btn btn-ghost btn-small" onClick={clearAll}>
                  Limpiar
                </button>
              </div>
            </div>
            <div className="task-list desktop-tasks">
              {(currentInterval?.tasks || []).map((task) => {
                const checked = selectedTasks.includes(task.id)
                return (
                  <label key={task.id} className={`task-item ${checked ? 'done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span>{task.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </form>
      ) : null}

      <div className="section">
        <h3 className="section-title">Historial</h3>
      </div>
      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Equipo</th>
              <th>Intervalo</th>
              <th>Horómetro</th>
              <th>Mecánico</th>
              <th>Tareas</th>
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
                <td>{item.tareas?.length || 0}</td>
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
                  Sin mantenimientos registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
