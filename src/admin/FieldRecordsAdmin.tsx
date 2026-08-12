import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  LIGHT_TRUCK_MAINTENANCE_PROGRAM,
  getInterval,
  getProgramForCategory,
  isLightTruckCategory,
  meterLabelForCategory,
} from '../data/maintenanceProgram'
import {
  DEFAULT_CHECKLIST,
  FIELD_TYPE_LABELS,
  ROLE_LABELS,
  createEmptyRecord,
  type ChecklistStatus,
  type FieldRecordType,
  type Machine,
  type MachinaryRecord,
  type User,
} from '../types'
import { PhotoCapture } from '../components/PhotoCapture'

type OperatorOption = {
  id: string
  name: string
  role: User['role']
}

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
  const [operators, setOperators] = useState<OperatorOption[]>([])
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
    const [mRes, rRes, oRes] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/records'),
      apiFetch('/api/operators'),
    ])
    if (mRes.ok) setMachines(await mRes.json())
    if (oRes.ok) setOperators(await oRes.json())
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
    setDraft(createEmptyRecord('', tipo))
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

  function applyInterval(intervaloId: string, machine?: Machine | null) {
    if (!draft) return
    const program = machine
      ? getProgramForCategory(machine.categoria)
      : LIGHT_TRUCK_MAINTENANCE_PROGRAM
    const interval = getInterval(intervaloId) || program.find((i) => i.id === intervaloId) || program[0]
    if (!interval) return
    patch({
      intervaloMantenimiento: interval.id,
      mantenimiento: interval.tasks.map((t) => ({
        id: t.id,
        tipo: t.label,
        nivel: '',
        seAdiciona: '',
        seAplica: '',
        realizado: false,
      })),
    })
  }

  function toggleTaskOk(id: string) {
    if (!draft) return
    patch({
      mantenimiento: draft.mantenimiento.map((row) =>
        row.id === id ? { ...row, realizado: !row.realizado } : row,
      ),
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
    if (tipo === 'mantenimiento') {
      if (!draft.intervaloMantenimiento) {
        setError('Selecciona el tipo de mantenimiento (10.000 o 20.000 km)')
        return
      }
      if (!draft.mantenimiento.some((row) => row.realizado)) {
        setError('Marca al menos un ítem con OK')
        return
      }
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

  const selectedMachine = useMemo(
    () => machines.find((m) => m.sigla === draft?.maquina) || null,
    [machines, draft?.maquina],
  )
  const maintProgram = useMemo(() => {
    if (tipo !== 'mantenimiento') return LIGHT_TRUCK_MAINTENANCE_PROGRAM
    return getProgramForCategory(selectedMachine?.categoria)
  }, [tipo, selectedMachine?.categoria])
  const meterLabel = meterLabelForCategory(selectedMachine?.categoria)

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
                : 'Pauta de camiones livianos: elige 10.000 o 20.000 km y marca cada ítem OK.'}
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            className={`btn btn-primary ${tipo === 'mantenimiento' ? 'btn-add' : ''}`}
            onClick={openCreate}
          >
            {tipo === 'mantenimiento' ? '+' : 'Nuevo registro'}
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
                  if (!machine) {
                    patch({ maquina: '' })
                    return
                  }
                  if (tipo === 'mantenimiento') {
                    const program = getProgramForCategory(machine.categoria)
                    const id =
                      draft.intervaloMantenimiento &&
                      program.some((i) => i.id === draft.intervaloMantenimiento)
                        ? draft.intervaloMantenimiento
                        : program[0]?.id
                    const interval = id ? getInterval(id) : null
                    patch({
                      maquina: machine.sigla,
                      intervaloMantenimiento: id || '',
                      mantenimiento: (interval?.tasks || []).map((t) => ({
                        id: t.id,
                        tipo: t.label,
                        nivel: '',
                        seAdiciona: '',
                        seAplica: '',
                        realizado: false,
                      })),
                    })
                    return
                  }
                  patch({ maquina: machine.sigla })
                }}
                required
              >
                <option value="">Seleccionar…</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sigla} — {m.categoria || 'Sin cat.'} · {m.marca} {m.modelo}
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
              <select
                value={draft.operador}
                onChange={(e) =>
                  patch({
                    operador: e.target.value,
                    firmaOperador: e.target.value || draft.firmaOperador,
                  })
                }
                required
              >
                <option value="">Seleccionar…</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.name}>
                    {op.name} · {ROLE_LABELS[op.role] || op.role}
                  </option>
                ))}
                {draft.operador && !operators.some((op) => op.name === draft.operador) ? (
                  <option value={draft.operador}>{draft.operador}</option>
                ) : null}
              </select>
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
              <div className="field">
                <span>Tipo de mantenimiento</span>
                <div className="type-pill-row">
                  {maintProgram.map((interval) => (
                    <button
                      key={interval.id}
                      type="button"
                      className={`type-pill ${
                        draft.intervaloMantenimiento === interval.id ? 'active' : ''
                      }`}
                      onClick={() => applyInterval(interval.id, selectedMachine)}
                    >
                      {interval.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>{meterLabel}</span>
                <input
                  inputMode="numeric"
                  value={draft.horasInicial}
                  onChange={(e) =>
                    patch({ horasInicial: e.target.value.replace(/[^\d.]/g, '') })
                  }
                  placeholder={
                    isLightTruckCategory(selectedMachine?.categoria) ? 'Ej: 45280' : 'Ej: 127582'
                  }
                />
              </label>
              <div className="task-list">
                {draft.mantenimiento.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`task-ok-item ${row.realizado ? 'done' : ''}`}
                    onClick={() => toggleTaskOk(row.id)}
                  >
                    <span className="task-ok-badge">{row.realizado ? 'OK' : ''}</span>
                    <span className="task-ok-label">{row.tipo}</span>
                  </button>
                ))}
                {!draft.mantenimiento.length ? (
                  <p className="empty">Selecciona el tipo (10.000 o 20.000 km) para ver la pauta.</p>
                ) : null}
              </div>
              <label className="field">
                <span>Comentario / Observaciones</span>
                <textarea
                  value={draft.observaciones}
                  onChange={(e) => patch({ observaciones: e.target.value })}
                  placeholder="Detalle del trabajo, repuestos, hallazgos…"
                  rows={4}
                />
              </label>
            </>
          ) : null}

          {tipo !== 'mantenimiento' ? (
            <label className="field">
              <span>Observaciones</span>
              <textarea
                value={draft.observaciones}
                onChange={(e) => patch({ observaciones: e.target.value })}
              />
            </label>
          ) : null}

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
                      {getInterval(record.intervaloMantenimiento || '')?.label ||
                        record.intervaloMantenimiento ||
                        'Pauta'}
                      {' · '}
                      {(record.mantenimiento || []).filter((m) => m.realizado).length || 0}/
                      {(record.mantenimiento || []).length || 0} OK
                      {record.horasInicial ? ` · ${record.horasInicial}` : ''}
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
