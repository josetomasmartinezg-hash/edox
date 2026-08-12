import { useEffect, useMemo, useState } from 'react'
import type { ChecklistStatus, FieldRecordType, MachinaryRecord, RoleId } from '../types'
import { FIELD_TYPE_LABELS, ROLE_LABELS, parseMachineQr } from '../types'
import {
  LIGHT_TRUCK_MAINTENANCE_PROGRAM,
  getInterval,
} from '../data/maintenanceProgram'
import { apiFetch } from '../lib/auth'
import { PhotoCapture } from './PhotoCapture'
import { QrScanner } from './QrScanner'

type OperatorOption = {
  id: string
  name: string
  role: RoleId
}

type Props = {
  record: MachinaryRecord
  onChange: (record: MachinaryRecord) => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
}

function canSaveRecord(record: MachinaryRecord) {
  const base = record.maquina.trim() && record.operador.trim()
  if (!base) return false

  const tipo = record.tipoRegistro || 'combustible'
  if (tipo === 'combustible') {
    return Boolean(record.litrosEnEstanque.trim() && record.litrosCargados.trim())
  }
  if (tipo === 'revision_diaria') {
    return record.checklist.some((item) => item.status)
  }
  // mantenimiento: tipo de pauta + al menos un OK
  return Boolean(
    record.intervaloMantenimiento &&
      record.mantenimiento.some((row) => row.realizado),
  )
}

export function RecordForm({ record, onChange, onSave, onCancel, saving }: Props) {
  const [showQr, setShowQr] = useState(false)
  const [operators, setOperators] = useState<OperatorOption[]>([])
  const tipo: FieldRecordType = record.tipoRegistro || 'combustible'

  useEffect(() => {
    void (async () => {
      const res = await apiFetch('/api/operators')
      if (res.ok) setOperators(await res.json())
    })()
  }, [])

  function patch(partial: Partial<MachinaryRecord>) {
    onChange({ ...record, ...partial })
  }

  function setChecklist(id: string, status: ChecklistStatus) {
    patch({
      checklist: record.checklist.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    })
  }

  function applyMaintInterval(intervaloId: string) {
    const interval = getInterval(intervaloId) || LIGHT_TRUCK_MAINTENANCE_PROGRAM[0]
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
    patch({
      mantenimiento: record.mantenimiento.map((row) =>
        row.id === id ? { ...row, realizado: !row.realizado } : row,
      ),
    })
  }

  const canSave = canSaveRecord(record)
  const doneCount = useMemo(
    () => record.mantenimiento.filter((r) => r.realizado).length,
    [record.mantenimiento],
  )

  if (showQr) {
    return (
      <div className="panel">
        <div className="panel-body">
          <QrScanner
            onScan={(value) => {
              patch({ maquina: parseMachineQr(value) })
              setShowQr(false)
            }}
            onClose={() => setShowQr(false)}
          />
          <div className="demo-hint">
            Tip demo: si no tienes QR o cámara, usa el botón de máquina demo o escribe el código.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowQr(false)
              window.setTimeout(() => {
                onChange({ ...record, maquina: '75 D 35' })
              }, 50)
            }}
          >
            Usar máquina demo (75 D 35)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="hero-strip">
        <h2>{FIELD_TYPE_LABELS[tipo]}</h2>
        <p>
          Nº {record.formNumber} · Guarda sin señal y se sube solo cuando hay conexión.
        </p>
      </div>
      <div className="panel-body">
        <section className="section">
          <h3 className="section-title">Datos generales</h3>
          <div className="field-grid two">
            <label className="field">
              <span>Fecha</span>
              <input
                type="date"
                value={record.fecha}
                onChange={(e) => patch({ fecha: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Lugar de trabajo</span>
              <input
                value={record.lugarTrabajo}
                placeholder="Ej: C 319"
                onChange={(e) => patch({ lugarTrabajo: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Máquina</span>
              <div className="btn-row">
                <input
                  value={record.maquina}
                  placeholder="Escanea QR o escribe ID"
                  onChange={(e) => patch({ maquina: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-accent" onClick={() => setShowQr(true)}>
                  QR
                </button>
              </div>
            </label>
            <label className="field">
              <span>Operador</span>
              <select
                value={record.operador}
                onChange={(e) =>
                  patch({
                    operador: e.target.value,
                    firmaOperador: e.target.value || record.firmaOperador,
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
                {record.operador && !operators.some((op) => op.name === record.operador) ? (
                  <option value={record.operador}>{record.operador}</option>
                ) : null}
              </select>
            </label>
          </div>
        </section>

        {tipo === 'revision_diaria' ? (
          <>
            <section className="section">
              <h3 className="section-title">Chequeo diario antes de operar</h3>
              <div className="checklist">
                {record.checklist.map((item) => (
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
            </section>

            <section className="section">
              <h3 className="section-title">Horas / viajes</h3>
              <div className="field-grid two">
                <label className="field">
                  <span>Horómetro inicial</span>
                  <input
                    inputMode="decimal"
                    value={record.horasInicial}
                    onChange={(e) => patch({ horasInicial: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Horómetro final</span>
                  <input
                    inputMode="decimal"
                    value={record.horasFinal}
                    onChange={(e) => patch({ horasFinal: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Total horas</span>
                  <input
                    inputMode="decimal"
                    value={record.viajesTotalHoras}
                    onChange={(e) => patch({ viajesTotalHoras: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Cantidad viajes</span>
                  <input
                    inputMode="numeric"
                    value={record.viajesCantidad}
                    onChange={(e) => patch({ viajesCantidad: e.target.value })}
                  />
                </label>
              </div>
            </section>
          </>
        ) : null}

        {tipo === 'combustible' ? (
          <section className="fuel-box">
            <h3>Carga de combustible</h3>
            <p className="section-help">
              Registra litros en estanque vs litros cargados, con foto de respaldo.
            </p>
            <div className="field-grid two">
              <label className="field">
                <span>Litros en estanque</span>
                <input
                  inputMode="decimal"
                  value={record.litrosEnEstanque}
                  placeholder="Ej: 120"
                  onChange={(e) => patch({ litrosEnEstanque: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Litros cargados</span>
                <input
                  inputMode="decimal"
                  value={record.litrosCargados}
                  placeholder="Ej: 444,42"
                  onChange={(e) => patch({ litrosCargados: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Nº guía / boleta</span>
                <input
                  value={record.guiaNumero}
                  placeholder="Ej: 662166847"
                  onChange={(e) => patch({ guiaNumero: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Horómetro</span>
                <input
                  inputMode="decimal"
                  value={record.horasInicial}
                  placeholder="Horómetro actual"
                  onChange={(e) => patch({ horasInicial: e.target.value })}
                />
              </label>
            </div>
            <PhotoCapture
              value={record.photoDataUrl || record.photoUrl}
              onChange={(photoDataUrl) => patch({ photoDataUrl })}
            />
          </section>
        ) : null}

        {tipo === 'mantenimiento' ? (
          <section className="section">
            <h3 className="section-title">Tipo de mantenimiento</h3>
            <div className="type-pill-row">
              {LIGHT_TRUCK_MAINTENANCE_PROGRAM.map((interval) => (
                <button
                  key={interval.id}
                  type="button"
                  className={`type-pill ${
                    record.intervaloMantenimiento === interval.id ? 'active' : ''
                  }`}
                  onClick={() => applyMaintInterval(interval.id)}
                >
                  {interval.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Kilometraje</span>
              <input
                inputMode="numeric"
                value={record.horasInicial}
                placeholder="Ej: 45280"
                onChange={(e) =>
                  patch({ horasInicial: e.target.value.replace(/[^\d.]/g, '') })
                }
              />
            </label>
            <h3 className="section-title">
              Pauta {getInterval(record.intervaloMantenimiento || '')?.label || ''}
            </h3>
            <p className="section-help">
              {doneCount} de {record.mantenimiento.length || 0} con OK — toca cada ítem
            </p>
            <div className="task-list">
              {record.mantenimiento.map((row) => (
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
              {!record.mantenimiento.length ? (
                <p className="empty">Elige 10.000 o 20.000 km para cargar la pauta.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="section">
          <h3 className="section-title">
            {tipo === 'mantenimiento' ? 'Comentario / Observaciones' : 'Observaciones y firmas'}
          </h3>
          <label className="field">
            <span>Observaciones</span>
            <textarea
              value={record.observaciones}
              placeholder={
                tipo === 'mantenimiento'
                  ? 'Detalle del trabajo, repuestos, hallazgos…'
                  : 'Detalle del trabajo...'
              }
              onChange={(e) => patch({ observaciones: e.target.value })}
            />
          </label>
          {tipo !== 'mantenimiento' ? (
            <div className="field-grid two">
              <label className="field">
                <span>Firma operador</span>
                <input
                  value={record.firmaOperador}
                  onChange={(e) => patch({ firmaOperador: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Firma supervisor</span>
                <input
                  value={record.firmaSupervisor}
                  onChange={(e) => patch({ firmaSupervisor: e.target.value })}
                />
              </label>
            </div>
          ) : (
            <label className="field">
              <span>Mecánico / responsable</span>
              <input
                value={record.firmaOperador}
                onChange={(e) => patch({ firmaOperador: e.target.value })}
              />
            </label>
          )}
        </section>

        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Volver
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSave || saving}
            onClick={onSave}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {!canSave ? (
          <p className="section-help">
            {tipo === 'combustible'
              ? 'Completa máquina, operador, litros en estanque y litros cargados.'
              : tipo === 'revision_diaria'
                ? 'Completa máquina, operador y al menos un ítem del chequeo.'
                : 'Completa máquina, operador y al menos un dato de mantenimiento.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
