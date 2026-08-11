import type { MachinaryRecord } from '../types'

type Props = {
  records: MachinaryRecord[]
  onOpen: (id: string) => void
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

export function HistoryList({ records, onOpen }: Props) {
  if (!records.length) {
    return <div className="empty">Aún no hay registros. Crea el primero con el escáner QR.</div>
  }

  return (
    <div className="history-list">
      {records.map((record) => (
        <button
          key={record.id}
          type="button"
          className="history-item"
          onClick={() => onOpen(record.id)}
        >
          <div className="meta-row">
            <strong>{record.maquina || 'Sin máquina'}</strong>
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
            <span>Estanque: {record.litrosEnEstanque || '—'} L</span>
            <span>Cargados: {record.litrosCargados || '—'} L</span>
          </div>
        </button>
      ))}
    </div>
  )
}
