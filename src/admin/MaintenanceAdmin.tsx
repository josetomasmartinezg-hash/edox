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
      <div className="section">
        <h3 className="section-title">Mantenimiento</h3>
        <p className="section-help">
          Programa de mantenimiento de tiempos operativos. Selecciona el equipo, el intervalo del
          manual y marca las tareas realizadas.
        </p>
      </div>

      {canManage ? (
        <form className="admin-card" onSubmit={(e) => void handleSubmit(e)}>
          <h4>Registrar mantenimiento</h4>
          <div className="field-grid two">
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
            <label className="field" style={{ gridColumn: '1 / -1' }}>
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
          </div>

          {currentInterval?.subtitle ? (
            <p className="section-help">{currentInterval.subtitle}</p>
          ) : null}

          <div className="section">
            <div className="meta-row" style={{ justifyContent: 'space-between' }}>
              <h4 className="mini-title">Tareas del intervalo</h4>
              <div className="btn-row">
                <button type="button" className="btn btn-ghost btn-small" onClick={selectAll}>
                  Marcar todas
                </button>
                <button type="button" className="btn btn-ghost btn-small" onClick={clearAll}>
                  Limpiar
                </button>
              </div>
            </div>
            <p className="section-help">
              {selectedTasks.length} de {currentInterval?.tasks.length || 0} realizadas
            </p>
            <div className="task-list">
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

          <label className="field">
            <span>Observaciones</span>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalle adicional del trabajo, repuestos usados, hallazgos…"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={loading || !machineId}>
            {loading ? 'Guardando…' : 'Registrar mantenimiento'}
          </button>
        </form>
      ) : null}

      <div className="section">
        <h3 className="section-title">Historial</h3>
      </div>
      <div className="history-list">
        {items.map((item) => (
          <div key={item.id} className="history-item static">
            <div className="meta-row">
              <strong>{item.sigla}</strong>
              <span className="badge synced">{item.tipoMantenimiento}</span>
            </div>
            <div className="meta-row">
              <span>Horómetro: {item.horometro}</span>
              <span>·</span>
              <span>{item.mecanicoNombre}</span>
              <span>·</span>
              <span>{new Date(item.createdAt).toLocaleString('es-CL')}</span>
            </div>
            {item.tareas?.length ? (
              <ul className="task-summary">
                {item.tareas.map((t) => (
                  <li key={t.id}>{t.label}</li>
                ))}
              </ul>
            ) : null}
            {item.observaciones ? (
              <p className="section-help">{item.observaciones}</p>
            ) : null}
            {canManage ? (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() => void remove(item)}
                >
                  Eliminar
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {!items.length ? <div className="empty">Sin mantenimientos registrados.</div> : null}
      </div>
    </div>
  )
}
