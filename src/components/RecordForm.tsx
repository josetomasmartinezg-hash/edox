import { useEffect, useMemo, useState } from 'react'
import type {
  ChecklistStatus,
  FieldRecordType,
  Machine,
  MachinaryRecord,
  RoleId,
} from '../types'
import {
  FIELD_TYPE_LABELS,
  ROLE_LABELS,
  findMachineByCode,
  parseMachineQrMeta,
} from '../types'
import { apiFetch } from '../lib/auth'
import { loadMachines } from '../lib/machines'
import {
  cleanPauta,
  pautaSummaryText,
  pautaTipoToRows,
} from '../admin/MaintenancePautaBlock'
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
      record.horasInicial.trim() &&
      record.mantenimiento.some((row) => row.realizado),
  )
}

export function RecordForm({ record, onChange, onSave, onCancel, saving }: Props) {
  const [showQr, setShowQr] = useState(false)
  const [operators, setOperators] = useState<OperatorOption[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const tipo: FieldRecordType = record.tipoRegistro || 'combustible'
  const selectedMachine = useMemo(
    () => findMachineByCode(machines, record.maquina),
    [machines, record.maquina],
  )
  const pauta = useMemo(
    () => cleanPauta(selectedMachine?.pauta || []),
    [selectedMachine],
  )

  useEffect(() => {
    void (async () => {
      const [opsRes, list] = await Promise.all([
        apiFetch('/api/operators'),
        loadMachines(),
      ])
      if (opsRes.ok) setOperators(await opsRes.json())
      setMachines(list)
    })()
  }, [])

  function patch(partial: Partial<MachinaryRecord>) {
    onChange({ ...record, ...partial })
  }

  function applyMachine(machine: Machine, keepTipoId?: string) {
    if (tipo !== 'mantenimiento') {
      patch({ maquina: machine.sigla })
      return
    }
    const tipos = cleanPauta(machine.pauta || [])
    const current =
      tipos.find((t) => t.id === keepTipoId) ||
      tipos.find((t) => t.id === record.intervaloMantenimiento) ||
      tipos[0]
    patch({
      maquina: machine.sigla,
      intervaloMantenimiento: current?.id || '',
      tipoMantenimiento: current?.nombre || '',
      mantenimiento: current ? pautaTipoToRows(current) : [],
    })
  }

  function applyPautaTipo(tipoId: string) {
    const current = pauta.find((t) => t.id === tipoId)
    if (!current) return
    patch({
      intervaloMantenimiento: current.id,
      tipoMantenimiento: current.nombre,
      mantenimiento: pautaTipoToRows(current),
    })
  }

  function setChecklist(id: string, status: ChecklistStatus) {
    patch({
      checklist: record.checklist.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    })
  }

  function toggleTaskOk(id: string) {
    patch({
      mantenimiento: record.mantenimiento.map((row) =>
        row.id === id ? { ...row, realizado: !row.realizado } : row,
      ),
    })
  }

  useEffect(() => {
    if (tipo !== 'mantenimiento' || !record.maquina || !machines.length) return
    const machine = findMachineByCode(machines, record.maquina)
    if (!machine) return
    const tipos = cleanPauta(machine.pauta || [])
    if (tipos.some((t) => t.id === record.intervaloMantenimiento) && record.mantenimiento.length) {
      return
    }
    if (!tipos.length && machine.sigla.trim().toUpperCase() === record.maquina.trim().toUpperCase()) {
      return
    }
    const current = tipos[0]
    onChange({
      ...record,
      maquina: machine.sigla,
      intervaloMantenimiento: current?.id || '',
      tipoMantenimiento: current?.nombre || '',
      mantenimiento: current ? pautaTipoToRows(current) : [],
    })
  }, [tipo, record.maquina, machines])

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
              const meta = parseMachineQrMeta(value)
              const machine =
                findMachineByCode(machines, value) ||
                findMachineByCode(machines, meta.sigla)
              if (machine) applyMachine(machine)
              else patch({ maquina: meta.sigla })
              setShowQr(false)
            }}
            onClose={() => setShowQr(false)}
          />
          <div className="demo-hint">
            Escanea el QR del equipo para cargar su pauta. Si no hay cámara, elige la máquina en la
            lista.
          </div>
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
                <select
                  value={selectedMachine?.id || ''}
                  onChange={(e) => {
                    const machine = machines.find((m) => m.id === e.target.value)
                    if (machine) applyMachine(machine)
                    else patch({ maquina: '' })
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="">Seleccionar o escanear QR…</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.sigla} — {m.marca} {m.modelo}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-accent" onClick={() => setShowQr(true)}>
                  QR
                </button>
              </div>
              {selectedMachine ? (
                <p className="section-help">{pautaSummaryText(selectedMachine)}</p>
              ) : record.maquina ? (
                <p className="section-help">Código: {record.maquina}</p>
              ) : null}
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
            <h3 className="section-title">Pauta del equipo</h3>
            {!selectedMachine ? (
              <p className="empty">Escanea el QR o selecciona la máquina para ver su pauta.</p>
            ) : !pauta.length ? (
              <p className="empty">
                Esta máquina aún no tiene pauta. Súbela en PDF o Excel al crear o editar el equipo.
              </p>
            ) : (
              <>
                <p className="section-help">
                  Se cargó sola la pauta de {selectedMachine.sigla}. Elige el intervalo y marca OK.
                </p>
                <div className="type-pill-row">
                  {pauta.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`type-pill ${
                        record.intervaloMantenimiento === item.id ? 'active' : ''
                      }`}
                      onClick={() => applyPautaTipo(item.id)}
                    >
                      {item.nombre}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Kilometraje / Horómetro</span>
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
                  {record.tipoMantenimiento ||
                    pauta.find((t) => t.id === record.intervaloMantenimiento)?.nombre ||
                    'Ítems'}
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
                </div>
              </>
            )}
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
                : 'Completa máquina, operador, horómetro y al menos un ítem OK.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
