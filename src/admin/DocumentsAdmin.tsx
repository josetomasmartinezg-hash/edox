import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/auth'
import type { Machine, MachineDocument } from '../types'

type Props = {
  canManage: boolean
}

function statusLabel(status?: string) {
  if (status === 'expired') return 'Vencido'
  if (status === 'soon') return 'Por vencer'
  if (status === 'ok') return 'Vigente'
  return 'Sin fecha'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-CL')
  } catch {
    return value
  }
}

export function DocumentsAdmin({ canManage }: Props) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [docs, setDocs] = useState<MachineDocument[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [machineId, setMachineId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const [mRes, dRes] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/documents'),
    ])
    if (mRes.ok) setMachines(await mRes.json())
    if (dRes.ok) setDocs(await dRes.json())
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (!file) {
      setError('Debes subir un PDF o una foto')
      return
    }
    setLoading(true)
    setError('')
    const form = new FormData()
    form.append('name', name.trim())
    form.append('machineId', machineId)
    if (expiresAt) form.append('expiresAt', expiresAt)
    form.append('file', file)

    const res = await apiFetch('/api/documents', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar el documento')
      return
    }
    setName('')
    setMachineId('')
    setExpiresAt('')
    setFile(null)
    setShowForm(false)
    await load()
  }

  async function remove(doc: MachineDocument) {
    if (!confirm(`¿Eliminar documento “${doc.name}”?`)) return
    await apiFetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Documentación</h3>
          <p className="section-help">
            Sube PDF o fotos por equipo. Si hay fecha de vencimiento: amarillo = próximo a vencer
            (30 días), rojo = vencido.
          </p>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            Agregar documento
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form className="admin-card" onSubmit={(e) => void handleSubmit(e)}>
          <h4>Nuevo documento</h4>
          <div className="field-grid two">
            <label className="field">
              <span>Nombre</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ej: Permiso de circulación"
              />
            </label>
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
              <span>Fecha de vencimiento (opcional)</span>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Subir PDF o foto</span>
              <input
                type="file"
                accept="application/pdf,image/*"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Subiendo…' : 'Guardar documento'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false)
                setError('')
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="legend-row">
        <span className="legend-item soon">Por vencer (≤ 30 días)</span>
        <span className="legend-item expired">Vencido</span>
      </div>

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Nombre</th>
              <th>Equipo</th>
              <th>Vencimiento</th>
              <th>Archivo</th>
              <th>Subido por</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr
                key={doc.id}
                className={
                  doc.status === 'expired'
                    ? 'row-alert-expired'
                    : doc.status === 'soon'
                      ? 'row-alert-soon'
                      : ''
                }
              >
                <td>
                  <span
                    className={`badge ${
                      doc.status === 'expired'
                        ? 'error'
                        : doc.status === 'soon'
                          ? 'pending'
                          : 'synced'
                    }`}
                  >
                    {statusLabel(doc.status)}
                  </span>
                </td>
                <td>
                  <strong>{doc.name}</strong>
                </td>
                <td>{doc.sigla}</td>
                <td>{formatDate(doc.expiresAt)}</td>
                <td>
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="link-quiet">
                    {doc.fileName || 'Ver archivo'}
                  </a>
                </td>
                <td>{doc.uploadedByName || '—'}</td>
                <td>
                  {canManage ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={() => void remove(doc)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!docs.length ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  No hay documentos cargados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
