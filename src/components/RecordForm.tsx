import { useState } from 'react'
import type { ChecklistStatus, MachinaryRecord } from '../types'
import { parseMachineQr } from '../types'
import { PhotoCapture } from './PhotoCapture'
import { QrScanner } from './QrScanner'

type Props = {
  record: MachinaryRecord
  onChange: (record: MachinaryRecord) => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
}

export function RecordForm({ record, onChange, onSave, onCancel, saving }: Props) {
  const [showQr, setShowQr] = useState(false)

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

  function setMaintenance(
    id: string,
    field: 'nivel' | 'seAdiciona' | 'seAplica',
    value: string,
  ) {
    patch({
      mantenimiento: record.mantenimiento.map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    })
  }

  const canSave =
    record.maquina.trim() &&
    record.operador.trim() &&
    record.litrosEnEstanque.trim() &&
    record.litrosCargados.trim()

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
              // Deja que el scanner se desmonte limpio antes de actualizar el form
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
        <h2>Formulario maquinaria</h2>
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
              <input
                value={record.operador}
                placeholder="Nombre del operador"
                onChange={(e) => patch({ operador: e.target.value })}
              />
            </label>
          </div>
        </section>

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

        <section className="fuel-box">
          <h3>Control de combustible</h3>
          <p className="section-help">
            Registra lo que tiene el estanque vs lo que se cargó (el papel solo tenía un campo).
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
          </div>
          <PhotoCapture
            value={record.photoDataUrl || record.photoUrl}
            onChange={(photoDataUrl) => patch({ photoDataUrl })}
          />
        </section>

        <section className="section">
          <h3 className="section-title">Control de mantenimiento</h3>
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
                {record.mantenimiento.map((row) => (
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
                        onChange={(e) => setMaintenance(row.id, 'seAdiciona', e.target.value)}
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
        </section>

        <section className="section">
          <h3 className="section-title">Observaciones y firmas</h3>
          <label className="field">
            <span>Observaciones</span>
            <textarea
              value={record.observaciones}
              placeholder="Ej: Traslado de moto y excavadora..."
              onChange={(e) => patch({ observaciones: e.target.value })}
            />
          </label>
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
            <label className="field">
              <span>Firma jefe faena</span>
              <input
                value={record.firmaJefeFaena}
                onChange={(e) => patch({ firmaJefeFaena: e.target.value })}
              />
            </label>
          </div>
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
            {saving ? 'Guardando…' : 'Guardar registro'}
          </button>
        </div>
        {!canSave ? (
          <p className="section-help">
            Completa máquina, operador, litros en estanque y litros cargados.
          </p>
        ) : null}
      </div>
    </div>
  )
}
