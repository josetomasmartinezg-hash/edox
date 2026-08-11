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

type Props = {
  canManage: boolean
}

export function MachinesAdmin({ canManage }: Props) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<Machine | null>(null)
  const [qrMachine, setQrMachine] = useState<Machine | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const res = await apiFetch('/api/machines')
    if (!res.ok) {
      setError('No se pudieron cargar las máquinas')
      return
    }
    setMachines(await res.json())
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    setLoading(true)
    setError('')
    const res = await apiFetch(editing ? `/api/machines/${editing.id}` : '/api/machines', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Error al guardar')
      return
    }
    setForm(emptyForm)
    setEditing(null)
    if (data.qrDataUrl) setQrMachine(data)
    await load()
  }

  async function generateQr(machine: Machine) {
    const res = await apiFetch(`/api/machines/${machine.id}/qr`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo generar QR')
      return
    }
    setQrMachine(data)
    await load()
  }

  async function remove(machine: Machine) {
    if (!confirm(`¿Eliminar máquina ${machine.sigla}?`)) return
    await apiFetch(`/api/machines/${machine.id}`, { method: 'DELETE' })
    if (qrMachine?.id === machine.id) setQrMachine(null)
    await load()
  }

  function startEdit(machine: Machine) {
    setEditing(machine)
    setForm({
      marca: machine.marca,
      modelo: machine.modelo,
      anio: machine.anio,
      sigla: machine.sigla,
      capacidadEstanque: machine.capacidadEstanque,
      generateQr: true,
    })
  }

  return (
    <div className="admin-section">
      <div className="section">
        <h3 className="section-title">Maquinaria</h3>
        <p className="section-help">
          Marca, modelo, año, sigla, capacidad de estanque y QR para escanear en terreno.
        </p>
      </div>

      {canManage ? (
        <form className="admin-card" onSubmit={(e) => void handleSubmit(e)}>
          <h4>{editing ? `Editar ${editing.sigla}` : 'Agregar máquina'}</h4>
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
              {loading ? 'Guardando…' : editing ? 'Actualizar' : 'Guardar máquina'}
            </button>
            {editing ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(null)
                  setForm(emptyForm)
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="history-list">
        {machines.map((machine) => (
          <div key={machine.id} className="history-item static">
            <div className="meta-row">
              <strong>{machine.sigla}</strong>
              <span className="badge synced">{machine.marca}</span>
            </div>
            <div className="meta-row">
              <span>
                {machine.modelo} · {machine.anio || 's/año'}
              </span>
              <span>Estanque: {machine.capacidadEstanque || '—'} L</span>
            </div>
            <div className="btn-row">
              {machine.qrDataUrl ? (
                <button type="button" className="btn btn-accent btn-small" onClick={() => setQrMachine(machine)}>
                  Ver QR
                </button>
              ) : canManage ? (
                <button
                  type="button"
                  className="btn btn-accent btn-small"
                  onClick={() => void generateQr(machine)}
                >
                  Agregar QR
                </button>
              ) : null}
              {canManage ? (
                <>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => startEdit(machine)}>
                    Editar
                  </button>
                  <button type="button" className="btn btn-danger btn-small" onClick={() => void remove(machine)}>
                    Eliminar
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}
        {!machines.length ? <div className="empty">Aún no hay maquinaria registrada.</div> : null}
      </div>

      {qrMachine?.qrDataUrl ? (
        <div className="admin-card qr-card">
          <h4>QR · {qrMachine.sigla}</h4>
          <img src={qrMachine.qrDataUrl} alt={`QR ${qrMachine.sigla}`} className="qr-image" />
          <p className="section-help">Imprime este QR y pégalo en la máquina para escanearlo en terreno.</p>
          <div className="btn-row">
            <a className="btn btn-primary" href={qrMachine.qrDataUrl} download={`qr-${qrMachine.sigla}.png`}>
              Descargar QR
            </a>
            <button type="button" className="btn btn-ghost" onClick={() => setQrMachine(null)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
