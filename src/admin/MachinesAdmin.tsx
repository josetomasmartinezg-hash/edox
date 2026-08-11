import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/auth'
import type { Machine } from '../types'

const emptyForm = {
  marca: '',
  modelo: '',
  anio: '',
  sigla: '',
  capacidadEstanque: '',
  generateQr: true,
}

type TimelineItem = {
  id: string
  kind: 'combustible' | 'mantenimiento'
  title: string
  fecha: string
  createdAt: string
  operador?: string
  litrosEnEstanque?: string
  litrosCargados?: string
  guiaNumero?: string
  horasInicial?: string
  horasFinal?: string
  horometro?: string
  mecanicoNombre?: string
  tareas?: Array<{ id: string; label: string }>
  observaciones?: string
  photoUrl?: string | null
}

type HistorialResponse = {
  machine: Machine
  resumen: {
    totalRegistros: number
    totalMantenimientos: number
    ultimoRegistro: string | null
  }
  timeline: TimelineItem[]
}

type View = 'list' | 'create' | 'detail' | 'edit'

type Props = {
  canManage: boolean
}

function formatDate(value?: string | null) {
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

export function MachinesAdmin({ canManage }: Props) {
  const [view, setView] = useState<View>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [form, setForm] = useState(emptyForm)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [historial, setHistorial] = useState<HistorialResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadList() {
    const res = await apiFetch('/api/machines')
    if (!res.ok) {
      setError('No se pudieron cargar las máquinas')
      return
    }
    setMachines(await res.json())
  }

  async function loadDetail(id: string) {
    setLoading(true)
    setError('')
    const res = await apiFetch(`/api/machines/${id}/historial`)
    setLoading(false)
    if (!res.ok) {
      setError('No se pudo abrir la máquina')
      return
    }
    const data = (await res.json()) as HistorialResponse
    setHistorial(data)
    setSelectedId(id)
    setView('detail')
  }

  useEffect(() => {
    void loadList()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    setLoading(true)
    setError('')
    const res = await apiFetch('/api/machines', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Error al guardar')
      return
    }
    setForm(emptyForm)
    await loadList()
    await loadDetail(data.id)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage || !selectedId) return
    setLoading(true)
    setError('')
    const res = await apiFetch(`/api/machines/${selectedId}`, {
      method: 'PUT',
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Error al actualizar')
      return
    }
    await loadList()
    await loadDetail(data.id)
  }

  async function generateQr(machine: Machine) {
    const res = await apiFetch(`/api/machines/${machine.id}/qr`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo generar QR')
      return
    }
    await loadDetail(machine.id)
    await loadList()
  }

  async function remove(machine: Machine) {
    if (!confirm(`¿Eliminar máquina ${machine.sigla}?`)) return
    await apiFetch(`/api/machines/${machine.id}`, { method: 'DELETE' })
    setHistorial(null)
    setSelectedId(null)
    setView('list')
    await loadList()
  }

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setView('create')
  }

  function openEdit(machine: Machine) {
    setForm({
      marca: machine.marca,
      modelo: machine.modelo,
      anio: machine.anio,
      sigla: machine.sigla,
      capacidadEstanque: machine.capacidadEstanque,
      generateQr: true,
    })
    setError('')
    setView('edit')
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div className="admin-section">
        <div className="section">
          <div className="meta-row" style={{ justifyContent: 'space-between' }}>
            <h3 className="section-title">
              {view === 'create' ? 'Agregar maquinaria' : 'Editar maquinaria'}
            </h3>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setView(view === 'edit' && selectedId ? 'detail' : 'list')}
            >
              Volver
            </button>
          </div>
          <p className="section-help">
            Completa los datos de la máquina. Puedes generar su QR al guardar.
          </p>
        </div>

        <form
          className="admin-card"
          onSubmit={(e) => void (view === 'create' ? handleCreate(e) : handleUpdate(e))}
        >
          <div className="field-grid two">
            <label className="field">
              <span>Marca</span>
              <input
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Modelo</span>
              <input
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Año</span>
              <input
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Sigla</span>
              <input
                value={form.sigla}
                onChange={(e) => setForm({ ...form, sigla: e.target.value })}
                required
                placeholder="Ej: 75 D 35"
              />
            </label>
            <label className="field">
              <span>Capacidad estanque (L)</span>
              <input
                inputMode="decimal"
                value={form.capacidadEstanque}
                onChange={(e) => setForm({ ...form, capacidadEstanque: e.target.value })}
              />
            </label>
          </div>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={form.generateQr}
              onChange={(e) => setForm({ ...form, generateQr: e.target.checked })}
            />
            Generar / actualizar QR al guardar
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : view === 'create' ? 'Guardar máquina' : 'Actualizar'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (view === 'detail' && historial) {
    const machine = historial.machine
    return (
      <div className="admin-section">
        <div className="section">
          <div className="meta-row" style={{ justifyContent: 'space-between' }}>
            <h3 className="section-title">{machine.sigla}</h3>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => {
                setView('list')
                setHistorial(null)
              }}
            >
              Volver a lista
            </button>
          </div>
          <p className="section-help">
            Ficha de la máquina y todo lo que se ha ingresado (combustible y mantenimiento).
          </p>
        </div>

        <div className="admin-card">
          <div className="field-grid two">
            <div>
              <div className="detail-label">Marca</div>
              <div className="detail-value">{machine.marca}</div>
            </div>
            <div>
              <div className="detail-label">Modelo</div>
              <div className="detail-value">{machine.modelo}</div>
            </div>
            <div>
              <div className="detail-label">Año</div>
              <div className="detail-value">{machine.anio || '—'}</div>
            </div>
            <div>
              <div className="detail-label">Capacidad estanque</div>
              <div className="detail-value">
                {machine.capacidadEstanque ? `${machine.capacidadEstanque} L` : '—'}
              </div>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-box">
              <strong>{historial.resumen.totalRegistros}</strong>
              <span>Partes / combustible</span>
            </div>
            <div className="stat-box">
              <strong>{historial.resumen.totalMantenimientos}</strong>
              <span>Mantenimientos</span>
            </div>
            <div className="stat-box">
              <strong>{formatDate(historial.resumen.ultimoRegistro)}</strong>
              <span>Último ingreso</span>
            </div>
          </div>

          <div className="btn-row">
            {machine.qrDataUrl ? (
              <a className="btn btn-primary btn-small" href={machine.qrDataUrl} download={`qr-${machine.sigla}.png`}>
                Descargar QR
              </a>
            ) : canManage ? (
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={() => void generateQr(machine)}
              >
                Generar QR
              </button>
            ) : null}
            {canManage ? (
              <>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => openEdit(machine)}>
                  Editar datos
                </button>
                <button type="button" className="btn btn-danger btn-small" onClick={() => void remove(machine)}>
                  Eliminar
                </button>
              </>
            ) : null}
          </div>

          {machine.qrDataUrl ? (
            <div className="qr-inline">
              <img src={machine.qrDataUrl} alt={`QR ${machine.sigla}`} className="qr-image" />
            </div>
          ) : null}
        </div>

        <div className="section">
          <h3 className="section-title">Historial de ingresos</h3>
          <p className="section-help">
            Registros de terreno y mantenimientos asociados a esta sigla.
          </p>
        </div>

        <div className="history-list">
          {historial.timeline.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="history-item static">
              <div className="meta-row">
                <strong>{item.title}</strong>
                <span className={`badge ${item.kind === 'combustible' ? 'pending' : 'synced'}`}>
                  {item.kind === 'combustible' ? 'Combustible' : 'Mantenimiento'}
                </span>
              </div>
              <div className="meta-row">
                <span>{formatDate(item.createdAt)}</span>
                {item.kind === 'combustible' ? (
                  <>
                    <span>·</span>
                    <span>{item.operador}</span>
                  </>
                ) : (
                  <>
                    <span>·</span>
                    <span>{item.mecanicoNombre}</span>
                    <span>·</span>
                    <span>Horómetro {item.horometro || '—'}</span>
                  </>
                )}
              </div>

              {item.kind === 'combustible' ? (
                <div className="meta-row">
                  <span>Estanque: {item.litrosEnEstanque || '—'} L</span>
                  <span>Cargados: {item.litrosCargados || '—'} L</span>
                  {item.guiaNumero ? <span>Guía: {item.guiaNumero}</span> : null}
                  {item.horasInicial || item.horasFinal ? (
                    <span>
                      Horas: {item.horasInicial || '—'} → {item.horasFinal || '—'}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {item.tareas?.length ? (
                <ul className="task-summary">
                  {item.tareas.map((t) => (
                    <li key={t.id}>{t.label}</li>
                  ))}
                </ul>
              ) : null}

              {item.observaciones ? <p className="section-help">{item.observaciones}</p> : null}

              {item.photoUrl ? (
                <a href={item.photoUrl} target="_blank" rel="noreferrer" className="link-quiet">
                  Ver foto de respaldo
                </a>
              ) : null}
            </div>
          ))}
          {!historial.timeline.length ? (
            <div className="empty">Aún no hay ingresos para esta máquina.</div>
          ) : null}
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="admin-section">
      <div className="section">
        <div className="meta-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 className="section-title">Lista de maquinaria</h3>
            <p className="section-help">
              Selecciona una máquina para ver su ficha e historial de ingresos.
            </p>
          </div>
          {canManage ? (
            <button type="button" className="btn btn-primary btn-small" onClick={openCreate}>
              Agregar maquinaria
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="history-list">
        {machines.map((machine) => (
          <button
            key={machine.id}
            type="button"
            className="history-item machine-row"
            onClick={() => void loadDetail(machine.id)}
          >
            <div className="meta-row">
              <strong>{machine.sigla}</strong>
              <span className="badge synced">{machine.marca}</span>
            </div>
            <div className="meta-row">
              <span>
                {machine.modelo} · {machine.anio || 's/año'}
              </span>
              <span>Estanque: {machine.capacidadEstanque || '—'} L</span>
              <em className="row-cta">Abrir →</em>
            </div>
          </button>
        ))}
        {!machines.length ? (
          <div className="empty">
            No hay maquinaria. {canManage ? 'Usa “Agregar maquinaria” para crear la primera.' : ''}
          </div>
        ) : null}
      </div>
      {loading ? <p className="section-help">Cargando…</p> : null}
    </div>
  )
}
