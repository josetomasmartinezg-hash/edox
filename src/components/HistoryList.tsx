import type { FieldRecordType, MachinaryRecord } from '../types'
import { FIELD_TYPE_LABELS } from '../types'

type Props = {
  records: MachinaryRecord[]
  onOpen: (id: string) => void
  emptyText?: string
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

function summaryFor(record: MachinaryRecord) {
  const tipo = record.tipoRegistro || 'combustible'
  if (tipo === 'combustible') {
    return `Estanque: ${record.litrosEnEstanque || '—'} L · Cargados: ${record.litrosCargados || '—'} L`
  }
  if (tipo === 'revision_diaria') {
    const done = record.checklist.filter((c) => c.status).length
    return `Chequeo: ${done}/${record.checklist.length} · Horas ${record.horasInicial || '—'} → ${record.horasFinal || '—'}`
  }
  const filled = record.mantenimiento.filter(
    (m) => m.nivel || m.seAdiciona || m.seAplica,
  ).length
  return `Mantenimiento: ${filled} ítems · Horómetro ${record.horasInicial || '—'}`
}

export function HistoryList({ records, onOpen, emptyText }: Props) {
  if (!records.length) {
    return (
      <div className="empty">
        {emptyText || 'Aún no hay registros. Crea el primero con el escáner QR.'}
      </div>
    )
  }

  return (
    <div className="history-list">
      {records.map((record) => {
        const tipo = (record.tipoRegistro || 'combustible') as FieldRecordType
        return (
          <button
            key={record.id}
            type="button"
            className="history-item"
            onClick={() => onOpen(record.id)}
          >
            <div className="meta-row">
              <strong>{record.maquina || 'Sin máquina'}</strong>
              <span className="badge synced">{FIELD_TYPE_LABELS[tipo]}</span>
              <span className={`badge ${record.syncStatus}`}>
                {record.syncStatus === 'synced'
                  ? 'Sincronizado'
                  : record.syncStatus === 'error'
                    ? 'Error'
                    : 'Pendiente'}
              </span>
            </div>
            <div className="meta-row">
              <span>{record.operador || 'Sin operador'}</span>
              <span>·</span>
              <span>{formatDate(record.createdAt)}</span>
            </div>
            <div className="meta-row">
              <span>{summaryFor(record)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
