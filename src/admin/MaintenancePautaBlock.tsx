import { useEffect, useState } from 'react'
import type { Machine, MaintenanceRow } from '../types'

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
  previewFile?: File | null
  existingFileName?: string
  existingFileUrl?: string | null
  existingMimeType?: string
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
  previewFile,
  existingFileName,
  existingFileUrl,
  existingMimeType,
  parsing,
  parseMessage,
  parseError,
  onSelectFile,
}: EditorProps) {
  const tipos = value.length ? value : emptyPautaList()
  const extracted = cleanPauta(value)

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

      <PautaFilePreview
        file={previewFile}
        fileUrl={previewFile ? null : existingFileUrl}
        fileName={fileName || existingFileName}
        mimeType={previewFile?.type || existingMimeType}
      />

      {extracted.length ? (
        <PautaChecklist pauta={extracted} title="Pauta extraída del archivo" />
      ) : null}

      <details className="pauta-edit-details" open={!extracted.length}>
        <summary>Corregir ítems a mano</summary>
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
      </details>
    </div>
  )
}

type RunProps = {
  pauta: MachinePautaTipo[]
  draft: PautaRunDraft
  onChange: (draft: PautaRunDraft) => void
  disabled?: boolean
  lockTipo?: boolean
  title?: string
  help?: string
  commentLabel?: string
  commentPlaceholder?: string
  fileUrl?: string | null
  fileName?: string
  mimeType?: string
}

export function MachinePautaRun({
  pauta,
  draft,
  onChange,
  disabled,
  lockTipo,
  title,
  help,
  commentLabel,
  commentPlaceholder,
  fileUrl,
  fileName,
  mimeType,
}: RunProps) {
  const tipos = (pauta || []).filter((t) => t.nombre.trim() && t.items.some((i) => i.label.trim()))
  const allItems = tipos.flatMap((tipo) => tipo.items.filter((i) => i.label.trim()))
  const doneCount = allItems.filter((i) => draft.doneTasks[i.id]).length

  if (!tipos.length && !fileUrl) {
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
        <h4>{title || 'Registrar mantenimiento'}</h4>
        <p className="section-help">
          {help || 'Esta es la pauta del PDF. Marca OK en cada ítem que vayas realizando.'}
        </p>
      </div>

      <PautaFilePreview fileUrl={fileUrl} fileName={fileName} mimeType={mimeType} />

      {tipos.length ? (
        <>
          {!lockTipo && tipos.length > 1 ? (
            <div className="field">
              <span>Ir a un intervalo</span>
              <div className="type-pill-row">
                {tipos.map((tipo) => (
                  <button
                    key={tipo.id}
                    type="button"
                    className="type-pill"
                    onClick={() => {
                      onChange({ ...draft, tipoId: tipo.id })
                      document.getElementById(`pauta-tipo-${tipo.id}`)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }}
                  >
                    {tipo.nombre}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
            {doneCount} de {allItems.length} con OK
          </p>

          <PautaChecklist
            pauta={tipos}
            doneTasks={draft.doneTasks}
            disabled={disabled}
            onToggle={(id) =>
              onChange({
                ...draft,
                doneTasks: { ...draft.doneTasks, [id]: !draft.doneTasks[id] },
              })
            }
          />
        </>
      ) : (
        <p className="empty">
          El archivo está adjunto, pero aún no se pudieron leer los ítems. Ábrelo arriba o vuelve a
          subirlo en Maquinaria.
        </p>
      )}

      <label className="field">
        <span>{commentLabel || 'Comentario / Observaciones'}</span>
        <textarea
          value={draft.observaciones}
          onChange={(e) => onChange({ ...draft, observaciones: e.target.value })}
          placeholder={
            commentPlaceholder || 'Si hay algo extra, déjalo aquí: repuestos, hallazgos, pendientes…'
          }
          rows={3}
          disabled={disabled}
        />
      </label>
    </div>
  )
}

export function isPautaPdf(fileUrl?: string | null, fileName?: string, mimeType?: string) {
  return (
    /pdf/i.test(mimeType || '') ||
    /\.pdf(\?|$)/i.test(fileName || '') ||
    /\.pdf(\?|$)/i.test(fileUrl || '')
  )
}

export function PautaFilePreview({
  file,
  fileUrl,
  fileName,
  mimeType,
}: {
  file?: File | null
  fileUrl?: string | null
  fileName?: string
  mimeType?: string
}) {
  const [objectUrl, setObjectUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setObjectUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const src = objectUrl || fileUrl || ''
  if (!src) return null
  const pdf = isPautaPdf(src, file?.name || fileName, file?.type || mimeType)

  return (
    <div className="pauta-file-preview">
      <div className="pauta-file-preview-head">
        <strong>{file?.name || fileName || 'Archivo de pauta'}</strong>
        <a href={src} target="_blank" rel="noreferrer" className="link-quiet">
          Abrir en otra pestaña
        </a>
      </div>
      {pdf ? (
        <iframe className="pauta-pdf-frame" title={file?.name || fileName || 'Pauta PDF'} src={src} />
      ) : (
        <p className="section-help">
          Este archivo no se puede previsualizar aquí. Ábrelo en otra pestaña para verlo.
        </p>
      )}
    </div>
  )
}

export function PautaChecklist({
  pauta,
  doneTasks,
  onToggle,
  disabled,
  title,
}: {
  pauta: MachinePautaTipo[]
  doneTasks?: Record<string, boolean>
  onToggle?: (id: string) => void
  disabled?: boolean
  title?: string
}) {
  const tipos = cleanPauta(pauta)
  const interactive = typeof onToggle === 'function'

  if (!tipos.length) {
    return <p className="empty">No hay ítems extraídos de la pauta todavía.</p>
  }

  return (
    <div className="pauta-checklist">
      {title ? <h4>{title}</h4> : null}
      {tipos.map((tipo) => {
        const items = tipo.items.filter((item) => item.label.trim())
        const done = items.filter((item) => doneTasks?.[item.id]).length
        return (
          <section key={tipo.id} id={`pauta-tipo-${tipo.id}`} className="pauta-tipo-run">
            <div className="pauta-tipo-run-head">
              <h5>{tipo.nombre}</h5>
              <span className="table-sub">
                {interactive ? `${done} de ${items.length} OK` : `${items.length} ítems`}
              </span>
            </div>
            <div className={interactive ? 'task-list pauta-task-list' : 'pauta-preview-list'}>
              {items.map((item) => {
                const checked = !!doneTasks?.[item.id]
                if (!interactive) {
                  return (
                    <div key={item.id} className="pauta-preview-item">
                      <span className="pauta-preview-dot" />
                      <span>{item.label}</span>
                    </div>
                  )
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`task-ok-item ${checked ? 'done' : ''}`}
                    disabled={disabled}
                    onClick={() => onToggle?.(item.id)}
                  >
                    <span className="task-ok-badge">{checked ? 'OK' : ''}</span>
                    <span className="task-ok-label">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function cleanPauta(pauta: MachinePautaTipo[] = []): MachinePautaTipo[] {
  return (pauta || [])
    .map((tipo) => ({
      ...tipo,
      nombre: tipo.nombre.trim(),
      items: tipo.items
        .map((item) => ({ ...item, label: item.label.trim() }))
        .filter((item) => item.label),
    }))
    .filter((tipo) => tipo.nombre && tipo.items.length)
}

export function pautaTipoToRows(tipo: MachinePautaTipo): MaintenanceRow[] {
  return tipo.items
    .filter((item) => item.label.trim())
    .map((item) => ({
      id: item.id,
      tipo: item.label,
      nivel: '',
      seAdiciona: '',
      seAplica: '',
      realizado: false,
    }))
}

export function flattenPautaToRows(pauta: MachinePautaTipo[] = []): MaintenanceRow[] {
  return cleanPauta(pauta).flatMap(pautaTipoToRows)
}

export function machineHasPauta(machine?: Machine | null) {
  if (!machine) return false
  return cleanPauta(machine.pauta || []).length > 0 || Boolean(machine.pautaFileUrl)
}

export function pautaSummaryText(machine?: Machine | null) {
  if (!machine) return ''
  const tipos = cleanPauta(machine.pauta || [])
  const items = tipos.reduce((sum, tipo) => sum + tipo.items.length, 0)
  const file = machine.pautaFileName ? ` · ${machine.pautaFileName}` : ''
  if (!tipos.length) {
    return machine.pautaFileName
      ? `${machine.marca} ${machine.modelo}${file}`
      : `${machine.marca} ${machine.modelo} · sin pauta`
  }
  return `${machine.marca} ${machine.modelo} · ${tipos.length} tipos, ${items} ítems${file}`
}
