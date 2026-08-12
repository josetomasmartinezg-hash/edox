import { useMemo } from 'react'
import {
  defaultIntervalForCategory,
  getInterval,
  getProgramForCategory,
  isLightTruckCategory,
  meterLabelForCategory,
  type MaintenanceIntervalId,
} from '../data/maintenanceProgram'

export type PautaDraft = {
  intervaloId: MaintenanceIntervalId
  horometro: string
  doneTasks: Record<string, boolean>
  observaciones: string
}

export const emptyPautaDraft = (categoria?: string | null): PautaDraft => ({
  intervaloId: defaultIntervalForCategory(categoria),
  horometro: '',
  doneTasks: {},
  observaciones: '',
})

type Props = {
  categoria?: string | null
  draft: PautaDraft
  onChange: (draft: PautaDraft) => void
  disabled?: boolean
}

export function MaintenancePautaBlock({ categoria, draft, onChange, disabled }: Props) {
  const program = useMemo(() => getProgramForCategory(categoria), [categoria])
  const currentInterval = useMemo(
    () => getInterval(draft.intervaloId) || program[0] || null,
    [draft.intervaloId, program],
  )
  const meterLabel = meterLabelForCategory(categoria)
  const isKm = isLightTruckCategory(categoria)
  const doneCount = Object.values(draft.doneTasks).filter(Boolean).length

  function setIntervalo(id: MaintenanceIntervalId) {
    onChange({ ...draft, intervaloId: id, doneTasks: {} })
  }

  return (
    <div className="machine-pauta">
      <div className="machine-pauta-head">
        <h4>Mantenimiento</h4>
        <p className="section-help">
          {isKm
            ? 'Elige 10.000 o 20.000 km y marca cada ítem con OK.'
            : 'Elige el intervalo de la pauta y marca cada ítem con OK.'}
        </p>
      </div>

      <div className="field">
        <span>Tipo de mantenimiento</span>
        <div className="type-pill-row">
          {program.map((interval) => (
            <button
              key={interval.id}
              type="button"
              className={`type-pill ${draft.intervaloId === interval.id ? 'active' : ''}`}
              onClick={() => setIntervalo(interval.id)}
              disabled={disabled}
            >
              {interval.label}
            </button>
          ))}
        </div>
        {currentInterval?.subtitle ? (
          <p className="section-help">{currentInterval.subtitle}</p>
        ) : null}
      </div>

      <label className="field">
        <span>{meterLabel}</span>
        <input
          inputMode="numeric"
          value={draft.horometro}
          onChange={(e) =>
            onChange({ ...draft, horometro: e.target.value.replace(/[^\d.]/g, '') })
          }
          placeholder={isKm ? 'Ej: 45280' : 'Ej: 127582'}
          disabled={disabled}
        />
      </label>

      <div className="toolbar compact">
        <p className="section-help">
          {doneCount} de {currentInterval?.tasks.length || 0} con OK
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={disabled || !currentInterval}
            onClick={() => {
              const all: Record<string, boolean> = {}
              for (const t of currentInterval?.tasks || []) all[t.id] = true
              onChange({ ...draft, doneTasks: all })
            }}
          >
            Todos OK
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            disabled={disabled}
            onClick={() => onChange({ ...draft, doneTasks: {} })}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="task-list">
        {(currentInterval?.tasks || []).map((task) => {
          const checked = !!draft.doneTasks[task.id]
          return (
            <button
              key={task.id}
              type="button"
              className={`task-ok-item ${checked ? 'done' : ''}`}
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...draft,
                  doneTasks: { ...draft.doneTasks, [task.id]: !checked },
                })
              }
            >
              <span className="task-ok-badge">{checked ? 'OK' : ''}</span>
              <span className="task-ok-label">{task.label}</span>
            </button>
          )
        })}
      </div>

      <label className="field">
        <span>Comentario / Observaciones</span>
        <textarea
          value={draft.observaciones}
          onChange={(e) => onChange({ ...draft, observaciones: e.target.value })}
          placeholder="Detalle del trabajo, repuestos, hallazgos…"
          rows={3}
          disabled={disabled}
        />
      </label>
    </div>
  )
}

export function pautaHasWork(draft: PautaDraft) {
  return Boolean(draft.horometro.trim() || Object.values(draft.doneTasks).some(Boolean))
}

export function pautaPayload(draft: PautaDraft) {
  const interval = getInterval(draft.intervaloId)
  return {
    tipoMantenimiento: interval?.label || draft.intervaloId,
    intervaloId: draft.intervaloId,
    horometro: draft.horometro.trim(),
    observaciones: draft.observaciones.trim(),
    tareas: (interval?.tasks || []).map((t) => ({
      id: t.id,
      label: t.label,
      realizado: !!draft.doneTasks[t.id],
    })),
  }
}
