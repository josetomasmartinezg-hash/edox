import { useRef, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  MAINTENANCE_PHOTO_LABELS,
  type MaintenancePhoto,
  type MaintenancePhotoKind,
  type MaintenanceRecord,
} from '../types'

type Props = {
  maintenance: { id: string; fotos?: MaintenancePhoto[]; status?: string }
  canEdit: boolean
  onUpdated: (item: MaintenanceRecord) => void
  resource?: 'maintenance' | 'repairs'
  uploadHelp?: string
  emptyHelp?: string
}

export function MaintenancePhotosBlock({
  maintenance,
  canEdit,
  onUpdated,
  resource = 'maintenance',
  uploadHelp = 'Sube fotos de daños detectados o como prueba del mantenimiento realizado.',
  emptyHelp = 'Aún no hay fotografías en este mantenimiento.',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<MaintenancePhotoKind>('prueba')
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fotos = maintenance.fotos || []

  function handleFile(file: File | undefined) {
    if (!file) return
    setPendingFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPreview(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.readAsDataURL(file)
  }

  function resetDraft() {
    setPreview(null)
    setPendingFile(null)
    setCaption('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function uploadPhoto() {
    if (!pendingFile) {
      setError('Selecciona una fotografía')
      return
    }
    setLoading(true)
    setError('')
    const form = new FormData()
    form.append('photo', pendingFile)
    form.append('kind', kind)
    form.append('caption', caption.trim())

    const res = await apiFetch(`/api/${resource}/${maintenance.id}/photos`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo subir la foto')
      return
    }
    resetDraft()
    onUpdated(data as MaintenanceRecord)
  }

  async function removePhoto(photo: MaintenancePhoto) {
    if (!confirm('¿Eliminar esta fotografía?')) return
    setLoading(true)
    setError('')
    const res = await apiFetch(`/api/${resource}/${maintenance.id}/photos/${photo.id}`, {
      method: 'DELETE',
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo eliminar la foto')
      return
    }
    onUpdated(data as MaintenanceRecord)
  }

  return (
    <div className="maintenance-photos">
      <div className="machine-pauta-head">
        <h4>Fotografías</h4>
        <p className="section-help">{uploadHelp}</p>
      </div>

      {fotos.length ? (
        <div className="photo-grid">
          {fotos.map((photo) => (
            <figure key={photo.id} className="photo-card">
              <a href={photo.url} target="_blank" rel="noreferrer">
                <img src={photo.url} alt={photo.caption || MAINTENANCE_PHOTO_LABELS[photo.kind]} />
              </a>
              <figcaption>
                <span className={`badge ${photo.kind === 'dano' ? 'error' : 'assigned'}`}>
                  {MAINTENANCE_PHOTO_LABELS[photo.kind]}
                </span>
                {photo.caption ? <p>{photo.caption}</p> : null}
                <p className="section-help">
                  {photo.uploadedByName} ·{' '}
                  {new Date(photo.createdAt).toLocaleString('es-CL', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    disabled={loading}
                    onClick={() => void removePhoto(photo)}
                  >
                    Eliminar
                  </button>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="section-help">{emptyHelp}</p>
      )}

      {canEdit ? (
        <div className="photo-upload-box">
          <div className="field-grid two">
            <label className="field">
              <span>Tipo de foto</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as MaintenancePhotoKind)}>
                <option value="prueba">Prueba de mantenimiento</option>
                <option value="dano">Daño</option>
              </select>
            </label>
            <label className="field">
              <span>Comentario (opcional)</span>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Ej: Filtro aceite, fisura en manguera…"
              />
            </label>
          </div>

          {preview ? (
            <div className="photo-preview">
              <img src={preview} alt="Vista previa" />
            </div>
          ) : null}

          <div className="btn-row">
            <button
              type="button"
              className="btn btn-accent"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            >
              {preview ? 'Cambiar foto' : 'Tomar / subir foto'}
            </button>
            {preview ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={() => void uploadPhoto()}
                >
                  {loading ? 'Subiendo…' : 'Agregar foto'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={loading}
                  onClick={resetDraft}
                >
                  Cancelar
                </button>
              </>
            ) : null}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}
