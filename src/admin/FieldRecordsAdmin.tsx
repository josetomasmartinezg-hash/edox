import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  DEFAULT_CHECKLIST,
  DEFAULT_MAINTENANCE,
  FIELD_TYPE_LABELS,
  createEmptyRecord,
  type ChecklistStatus,
  type FieldRecordType,
  type Machine,
  type MachinaryRecord,
  type User,
} from '../types'
import { PhotoCapture } from '../components/PhotoCapture'

type Props = {
  tipo: FieldRecordType
  user: User
  canManage: boolean
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

export function FieldRecordsAdmin({ tipo, user, canManage }: Props) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [records, setRecords] = useState<MachinaryRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<MachinaryRecord | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const title = FIELD_TYPE_LABELS[tipo]
  const filtered = useMemo(
    () => records.filter((r) => (r.tipoRegistro || 'combustible') === tipo),
    [records, tipo],
  )

  async function load() {
    const [mRes, rRes] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/records'),
    ])
    if (mRes.ok) setMachines(await mRes.json())
    if (rRes.ok) {
      const data = (await rRes.json()) as MachinaryRecord[]
      setRecords(
        data.map((r) => ({
          ...r,
          tipoRegistro: r.tipoRegistro || 'combustible',
        })),
      )
    }
  }

  useEffect(() => {
    void load()
  }, [tipo])

  function openCreate() {
    setDraft(createEmptyRecord(user.name, tipo))
    setError('')
    setShowForm(true)
  }

  function patch(partial: Partial<MachinaryRecord>) {
    if (!draft) return
    setDraft({ ...draft, ...partial })
  }

  function setChecklist(id: string, status: ChecklistStatus) {
    if (!draft) return
    patch({
      checklist: (draft.checklist?.length ? draft.checklist : DEFAULT_CHECKLIST).map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    })
  }

  function setMaintenance(
    id: string,
    field: 'nivel' | 'seAdiciona' | 'seAplica',
    value: string,
  ) {
    if (!draft) return
    patch({
      mantenimiento: (draft.mantenimiento?.length
        ? draft.mantenimiento
        : DEFAULT_MAINTENANCE
      ).map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!draft || !canManage) return
    if (!draft.maquina.trim() || !draft.operador.trim()) {
      setError('Máquina y operador son obligatorios')
      return
    }
    if (
      tipo === 'combustible' &&
      (!draft.litrosEnEstanque.trim() || !draft.litrosCargados.trim())
    ) {
      setError('Completa litros en estanque y litros cargados')
      return
    }

    setLoading(true)
    setError('')
    const form = new FormData()
    const payload = {
      ...draft,
      tipoRegistro: tipo,
      firmaOperador: draft.firmaOperador || draft.operador,
      userId: user.id,
    }
    const { photoDataUrl, ...rest } = payload
    form.append('data', JSON.stringify(rest))
    if (photoDataUrl) {
      const blob = await (await fetch(photoDataUrl)).blob()
      form.append('photo', blob, `registro-${draft.id}.jpg`)
    }

    const res = await apiFetch('/api/records', { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar')
      return
    }
    setShowForm(false)
    setDraft(null)
    await load()
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="section-help">
            {tipo === 'combustible'
              ? 'Registro de cargas: estanque, litros cargados, guía y foto.'
              : tipo === 'revision_diaria'
                ? 'Chequeo diario antes de operar, horómetro y viajes.'
                : 'Control de aceites, diferencial y grasa en terreno.'}
          </p>
        </div>
        {canManage ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Nuevo registro
          </button>
        ) : null}
      </div>

      {showForm && draft ? (
        <form className="admin-card" onSubmit={(e) => void handleSave(e)}>
          <h4>Nuevo · {title}</h4>
          <div className="field-grid two">
            <label className="field">
              <span>Fecha</span>
              <input
                type="date"
                value={draft.fecha}
                onChange={(e) => patch({ fecha: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Equipo (sigla)</span>
              <select
                value={
                  machines.find((m) => m.sigla === draft.maquina)?.id ||
                  (draft.maquina ? '__manual__' : '')
                }
                onChange={(e) => {
                  const machine = machines.find((m) => m.id === e.target.value)
                  patch({ maquina: machine?.sigla || '' })
                }}
                required
              >
                <option value="">Seleccionar…</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sigla} — {m.marca} {m.modelo}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Lugar de trabajo</span>
              <input
                value={draft.lugarTrabajo}
                onChange={(e) => patch({ lugarTrabajo: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Operador</span>
              <input
                value={draft.operador}
                onChange={(e) => patch({ operador: e.target.value })}
                required
              />
            </label>
          </div>

          {tipo === 'combustible' ? (
            <div className="field-grid two">
              <label className="field">
                <span>Litros en estanque</span>
                <input
                  inputMode="decimal"
                  value={draft.litrosEnEstanque}
                  onChange={(e) => patch({ litrosEnEstanque: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Litros cargados</span>
                <input
                  inputMode="decimal"
                  value={draft.litrosCargados}
                  onChange={(e) => patch({ litrosCargados: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Nº guía / boleta</span>
                <input
                  value={draft.guiaNumero}
                  onChange={(e) => patch({ guiaNumero: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Horómetro</span>
                <input
                  inputMode="decimal"
                  value={draft.horasInicial}
                  onChange={(e) => patch({ horasInicial: e.target.value })}
                />
              </label>
              <div style={{ gridColumn: '1 / -1' }}>
                <PhotoCapture
                  value={draft.photoDataUrl || draft.photoUrl}
                  onChange={(photoDataUrl) => patch({ photoDataUrl })}
                />
              </div>
            </div>
          ) : null}

          {tipo === 'revision_diaria' ? (
            <>
              <div className="checklist">
                {(draft.checklist?.length ? draft.checklist : DEFAULT_CHECKLIST).map((item) => (
                  <div key={item.id} className="check-row">
                    <p>{item.label}</p>
                    <div className="status-options">
                      {(['bueno', 'malo', 'na'] as ChecklistStatus[]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`${status} ${item.status === status ? `active ${status}` : ''}`}
                          onClick={() => setChecklist(item.id, status)}
                        >
                          {status === 'bueno' ? 'Bueno' : status === 'malo' ? 'Malo' : 'N.A.'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="field-grid two">
                <label className="field">
                  <span>Horómetro inicial</span>
                  <input
                    value={draft.horasInicial}
                    onChange={(e) => patch({ horasInicial: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Horómetro final</span>
                  <input
                    value={draft.horasFinal}
                    onChange={(e) => patch({ horasFinal: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Total horas</span>
                  <input
                    value={draft.viajesTotalHoras}
                    onChange={(e) => patch({ viajesTotalHoras: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Cantidad viajes</span>
                  <input
                    value={draft.viajesCantidad}
                    onChange={(e) => patch({ viajesCantidad: e.target.value })}
                  />
                </label>
              </div>
            </>
          ) : null}

          {tipo === 'mantenimiento' ? (
            <>
              <label className="field">
                <span>Horómetro</span>
                <input
                  value={draft.horasInicial}
                  onChange={(e) => patch({ horasInicial: e.target.value })}
                />
              </label>
              <div className="table-scroll">
                <table className="maint-table">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Nivel</th>
                      <th>Se adiciona</th>
                      <th>Se aplica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.mantenimiento?.length
                      ? draft.mantenimiento
                      : DEFAULT_MAINTENANCE
                    ).map((row) => (
                      <tr key={row.id}>
                        <td>{row.tipo}</td>
                        <td>
                          <input
                            value={row.nivel}
                            onChange={(e) => setMaintenance(row.id, 'nivel', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            value={row.seAdiciona}
                            onChange={(e) =>
                              setMaintenance(row.id, 'seAdiciona', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            value={row.seAplica}
                            onChange={(e) => setMaintenance(row.id, 'seAplica', e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <label className="field">
            <span>Observaciones</span>
            <textarea
              value={draft.observaciones}
              onChange={(e) => patch({ observaciones: e.target.value })}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar registro'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false)
                setDraft(null)
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Equipo</th>
              <th>Operador</th>
              <th>Detalle</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.createdAt || record.fecha)}</td>
                <td>
                  <strong>{record.maquina}</strong>
                </td>
                <td>{record.operador}</td>
                <td>
                  {tipo === 'combustible' ? (
                    <div className="table-sub">
                      Estanque {record.litrosEnEstanque || '—'} L · Cargados{' '}
                      {record.litrosCargados || '—'} L
                      {record.guiaNumero ? ` · Guía ${record.guiaNumero}` : ''}
                      {record.photoUrl ? (
                        <>
                          {' · '}
                          <a href={record.photoUrl} target="_blank" rel="noreferrer">
                            Foto
                          </a>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {tipo === 'revision_diaria' ? (
                    <div className="table-sub">
                      Chequeo:{' '}
                      {(record.checklist || [])
                        .filter((c) => c.status)
                        .map((c) => `${c.label}: ${c.status}`)
                        .join(' · ') || '—'}
                      <br />
                      Horas {record.horasInicial || '—'} → {record.horasFinal || '—'}
                    </div>
                  ) : null}
                  {tipo === 'mantenimiento' ? (
                    <div className="table-sub">
                      {(record.mantenimiento || [])
                        .filter((m) => m.nivel || m.seAdiciona || m.seAplica)
                        .map((m) => m.tipo)
                        .join(' · ') || 'Sin detalle'}
                    </div>
                  ) : null}
                </td>
                <td>{record.observaciones || '—'}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No hay registros de {title.toLowerCase()}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
