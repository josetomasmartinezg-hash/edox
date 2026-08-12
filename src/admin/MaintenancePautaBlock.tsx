export type MachinePautaItem = {
  id: string
  label: string
}

export type MachinePautaTipo = {
  id: string
  nombre: string
  items: MachinePautaItem[]
}

export type PautaRunDraft = {
  tipoId: string
  horometro: string
  doneTasks: Record<string, boolean>
  observaciones: string
}

function newId() {
  return crypto.randomUUID()
}

export function emptyPautaTipo(): MachinePautaTipo {
  return {
    id: newId(),
    nombre: '',
    items: [{ id: newId(), label: '' }],
  }
}

export function emptyPautaList(): MachinePautaTipo[] {
  return [emptyPautaTipo()]
}

export function emptyPautaRun(pauta: MachinePautaTipo[] = []): PautaRunDraft {
  return {
    tipoId: pauta[0]?.id || '',
    horometro: '',
    doneTasks: {},
    observaciones: '',
  }
}

type EditorProps = {
  value: MachinePautaTipo[]
  onChange: (value: MachinePautaTipo[]) => void
  disabled?: boolean
  fileName?: string
  existingFileName?: string
  parsing?: boolean
  parseMessage?: string
  parseError?: string
  onSelectFile?: (file: File | null) => void
}

export function MachinePautaEditor({
  value,
  onChange,
  disabled,
  fileName,
  existingFileName,
  parsing,
  parseMessage,
  parseError,
  onSelectFile,
}: EditorProps) {
  const tipos = value.length ? value : emptyPautaList()

  function updateTipo(id: string, patch: Partial<MachinePautaTipo>) {
    onChange(tipos.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  function updateItem(tipoId: string, itemId: string, label: string) {
    onChange(
      tipos.map((t) =>
        t.id === tipoId
          ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, label } : i)) }
          : t,
      ),
    )
  }

  return (
    <div className="machine-pauta">
      <div className="machine-pauta-head">
        <h4>Pauta de mantenimiento</h4>
        <p className="section-help">
          Sube el PDF o Excel de la pauta (por ejemplo el programa de una motoniveladora 770D).
          El sistema lee los intervalos e ítems; después puedes corregirlos a mano.
        </p>
      </div>

      {onSelectFile ? (
        <div className="pauta-upload">
          <label className="field">
            <span>Archivo de pauta (PDF o Excel)</span>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={disabled || parsing}
              onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
            />
          </label>
          {parsing ? <p className="section-help">Leyendo pauta…</p> : null}
          {fileName ? (
            <p className="pauta-upload-ok">Archivo listo para guardar: {fileName}</p>
          ) : existingFileName ? (
            <p className="section-help">Archivo actual: {existingFileName}</p>
          ) : null}
          {parseMessage ? <p className="pauta-upload-ok">{parseMessage}</p> : null}
          {parseError ? <p className="pauta-upload-err">{parseError}</p> : null}
        </div>
      ) : null}

      {tipos.map((tipo, index) => (
        <div key={tipo.id} className="pauta-tipo-card">
          <div className="pauta-tipo-head">
            <label className="field">
              <span>Tipo {index + 1}</span>
              <input
                value={tipo.nombre}
                onChange={(e) => updateTipo(tipo.id, { nombre: e.target.value })}
                placeholder="Ej: 10.000 km, 500 horas, servicio A…"
                disabled={disabled}
              />
            </label>
            {tipos.length > 1 ? (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={disabled}
                onClick={() => onChange(tipos.filter((t) => t.id !== tipo.id))}
              >
                Quitar tipo
              </button>
            ) : null}
          </div>

          <div className="pauta-items">
            {tipo.items.map((item, itemIndex) => (
              <div key={item.id} className="pauta-item-row">
                <input
                  value={item.label}
                  onChange={(e) => updateItem(tipo.id, item.id, e.target.value)}
                  placeholder={`Ítem ${itemIndex + 1}`}
                  disabled={disabled}
                />
                {tipo.items.length > 1 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={disabled}
                    onClick={() =>
                      updateTipo(tipo.id, {
                        items: tipo.items.filter((i) => i.id !== item.id),
                      })
                    }
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={disabled}
              onClick={() =>
                updateTipo(tipo.id, {
                  items: [...tipo.items, { id: newId(), label: '' }],
                })
              }
            >
              + Ítem
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled}
        onClick={() => onChange([...tipos, emptyPautaTipo()])}
      >
        + Tipo de pauta
      </button>
    </div>
  )
}

type RunProps = {
  pauta: MachinePautaTipo[]
  draft: PautaRunDraft
  onChange: (draft: PautaRunDraft) => void
  disabled?: boolean
}

export function MachinePautaRun({ pauta, draft, onChange, disabled }: RunProps) {
  const tipos = (pauta || []).filter((t) => t.nombre.trim() && t.items.some((i) => i.label.trim()))
  const current = tipos.find((t) => t.id === draft.tipoId) || tipos[0] || null
  const items = (current?.items || []).filter((i) => i.label.trim())
  const doneCount = items.filter((i) => draft.doneTasks[i.id]).length

  if (!tipos.length) {
    return (
      <div className="machine-pauta">
        <h4>Registrar mantenimiento</h4>
        <p className="section-help">
          Esta máquina aún no tiene pauta. Edita el equipo y súbela en PDF o Excel, o agrégala a
          mano.
        </p>
      </div>
    )
  }

  return (
    <div className="machine-pauta">
      <div className="machine-pauta-head">
        <h4>Registrar mantenimiento</h4>
        <p className="section-help">Marca cada ítem de la pauta de este equipo con OK.</p>
      </div>

      <div className="field">
        <span>Tipo de pauta</span>
        <div className="type-pill-row">
          {tipos.map((tipo) => (
            <button
              key={tipo.id}
              type="button"
              className={`type-pill ${current?.id === tipo.id ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => onChange({ ...draft, tipoId: tipo.id, doneTasks: {} })}
            >
              {tipo.nombre}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Kilometraje / Horómetro</span>
        <input
          inputMode="numeric"
          value={draft.horometro}
          onChange={(e) =>
            onChange({ ...draft, horometro: e.target.value.replace(/[^\d.]/g, '') })
          }
          placeholder="Ej: 45280"
          disabled={disabled}
        />
      </label>

      <p className="section-help">
        {doneCount} de {items.length} con OK
      </p>

      <div className="task-list">
        {items.map((item) => {
          const checked = !!draft.doneTasks[item.id]
          return (
            <button
              key={item.id}
              type="button"
              className={`task-ok-item ${checked ? 'done' : ''}`}
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...draft,
                  tipoId: current?.id || draft.tipoId,
                  doneTasks: { ...draft.doneTasks, [item.id]: !checked },
                })
              }
            >
              <span className="task-ok-badge">{checked ? 'OK' : ''}</span>
              <span className="task-ok-label">{item.label}</span>
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

export function cleanPauta(pauta: MachinePautaTipo[]): MachinePautaTipo[] {
  return pauta
    .map((tipo) => ({
      ...tipo,
      nombre: tipo.nombre.trim(),
      items: tipo.items
        .map((item) => ({ ...item, label: item.label.trim() }))
        .filter((item) => item.label),
    }))
    .filter((tipo) => tipo.nombre && tipo.items.length)
}
