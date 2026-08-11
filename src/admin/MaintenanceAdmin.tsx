import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  MAINTENANCE_ACTIONS,
  MAINTENANCE_TYPES,
  type Machine,
  type MaintenanceActionId,
  type MaintenanceDetail,
  type MaintenanceRecord,
} from '../types'

type Props = {
  canManage: boolean
}

function emptyDetails(): MaintenanceDetail[] {
  return MAINTENANCE_TYPES.map((tipo) => ({
    tipo,
    nivel: '',
    seAdiciona: '',
    seAplica: '',
    realizado: false,
  }))
}

export function MaintenanceAdmin({ canManage }: Props) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [machineId, setMachineId] = useState('')
  const [tipoMantenimiento, setTipoMantenimiento] = useState(MAINTENANCE_TYPES[0])
  const [horometro, setHorometro] = useState('')
  const [acciones, setAcciones] = useState<MaintenanceActionId[]>([])
  const [detalles, setDetalles] = useState<MaintenanceDetail[]>(emptyDetails())
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) || null,
    [machines, machineId],
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

  function toggleAction(id: MaintenanceActionId) {
    setAcciones((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))
  }

  function updateDetail(tipo: string, patch: Partial<MaintenanceDetail>) {
    setDetalles((prev) => prev.map((d) => (d.tipo === tipo ? { ...d, ...patch } : d)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    setLoading(true)
    setError('')
    const res = await apiFetch('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        machineId,
        sigla: selectedMachine?.sigla,
        tipoMantenimiento,
        horometro,
        acciones,
        detalles: detalles.filter((d) => d.realizado),
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
    setAcciones([])
    setDetalles(emptyDetails())
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
          El mecánico elige el equipo (sigla), el tipo del formulario papel, el horómetro y marca lo
          realizado.
        </p>
      </div>

      {canManage ? (
        <form className="admin-card" onSubmit={(e) => void handleSubmit(e)}>
          <h4>Nuevo mantenimiento</h4>
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
              <span>Tipo de mantenimiento</span>
              <select
                value={tipoMantenimiento}
                onChange={(e) => setTipoMantenimiento(e.target.value)}
              >
                {MAINTENANCE_TYPES.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
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
          </div>

          <div className="section">
            <h4 className="mini-title">Qué se realizó</h4>
            <div className="chip-grid">
              {MAINTENANCE_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={`chip ${acciones.includes(action.id) ? 'active' : ''}`}
                  onClick={() => toggleAction(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <h4 className="mini-title">Detalle control (como el PDF)</h4>
            <div className="table-scroll">
              <table className="maint-table">
                <thead>
                  <tr>
                    <th>Realizado</th>
                    <th>Tipo</th>
                    <th>Nivel</th>
                    <th>Se adiciona</th>
                    <th>Se aplica</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.map((row) => (
                    <tr key={row.tipo}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.realizado}
                          onChange={(e) =>
                            updateDetail(row.tipo, { realizado: e.target.checked })
                          }
                        />
                      </td>
                      <td>{row.tipo}</td>
                      <td>
                        <input
                          value={row.nivel}
                          onChange={(e) => updateDetail(row.tipo, { nivel: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={row.seAdiciona}
                          onChange={(e) =>
                            updateDetail(row.tipo, { seAdiciona: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.seAplica}
                          onChange={(e) => updateDetail(row.tipo, { seAplica: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <label className="field">
            <span>Observaciones</span>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalle del trabajo realizado…"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={loading || !machineId}>
            {loading ? 'Guardando…' : 'Registrar mantenimiento'}
          </button>
        </form>
      ) : null}

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
            </div>
            {item.acciones?.length ? (
              <div className="meta-row">
                {item.acciones
                  .map((id) => MAINTENANCE_ACTIONS.find((a) => a.id === id)?.label || id)
                  .join(' · ')}
              </div>
            ) : null}
            {canManage ? (
              <div className="btn-row">
                <button type="button" className="btn btn-danger btn-small" onClick={() => void remove(item)}>
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
