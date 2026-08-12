import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import type { Machine, MaintenanceRecord } from '../types'
import {
  MachinePautaRun,
  cleanPauta,
  emptyPautaRun,
  pautaSummaryText,
  type PautaRunDraft,
} from './MaintenancePautaBlock'

type Props = {
  canManage: boolean
}

type View = 'list' | 'create'

export function MaintenanceAdmin({ canManage }: Props) {
  const [view, setView] = useState<View>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [machineId, setMachineId] = useState('')
  const [runDraft, setRunDraft] = useState<PautaRunDraft>(emptyPautaRun())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) || null,
    [machines, machineId],
  )

  const pauta = useMemo(
    () => cleanPauta(selectedMachine?.pauta || []),
    [selectedMachine],
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
    setRunDraft(emptyPautaRun(pauta))
    setError('')
  }, [machineId])

  function openCreate() {
    setError('')
    setMachineId('')
    setRunDraft(emptyPautaRun())
    setView('create')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (!selectedMachine) {
      setError('Selecciona el equipo')
      return
    }
    const tipos = cleanPauta(selectedMachine.pauta || [])
    const current = tipos.find((t) => t.id === runDraft.tipoId) || tipos[0]
    if (!current) {
      setError('Este equipo no tiene pauta. Súbela en Maquinaria (PDF o Excel).')
      return
    }
    if (!runDraft.horometro.trim()) {
      setError('Ingresa el kilometraje u horómetro')
      return
    }
    if (!Object.values(runDraft.doneTasks).some(Boolean)) {
      setError('Marca al menos un ítem con OK')
      return
    }

    setLoading(true)
    setError('')
    const res = await apiFetch('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        machineId: selectedMachine.id,
        sigla: selectedMachine.sigla,
        tipoMantenimiento: current.nombre,
        intervaloId: current.id,
        horometro: runDraft.horometro.trim(),
        observaciones: runDraft.observaciones.trim(),
        tareas: current.items.map((item) => ({
          id: item.id,
          label: item.label,
          realizado: !!runDraft.doneTasks[item.id],
        })),
      }),
    })
    const data = await res.json().catch(() => ({}))
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
              Elige el equipo: la pauta del PDF o Excel se carga sola. Marca los ítems con OK.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
            Cancelar
          </button>
        </div>

        <form className="maint-create" onSubmit={(e) => void handleSubmit(e)}>
          <div className="admin-card">
            <h4>Equipo</h4>
            <label className="field">
              <span>Seleccionar maquinaria</span>
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
            {selectedMachine ? (
              <p className="pauta-upload-ok">{pautaSummaryText(selectedMachine)}</p>
            ) : (
              <p className="section-help">
                Al seleccionar, aparecen los intervalos e ítems que se leyeron del archivo de pauta.
              </p>
            )}
          </div>

          <div className="admin-card">
            <MachinePautaRun
              pauta={pauta}
              draft={runDraft}
              onChange={setRunDraft}
              disabled={loading || !selectedMachine}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <div className="btn-row">
              <button type="button" className="btn btn-ghost" onClick={() => setView('list')}>
                Volver
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !selectedMachine || !pauta.length}
              >
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
            Cada equipo usa la pauta que se subió al crearlo. Presiona + para registrar un servicio.
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
                  {item.tareas?.filter((t) => t.realizado).length || 0}
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
