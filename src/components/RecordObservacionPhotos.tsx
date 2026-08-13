import { useRef } from 'react'
import type { RecordPhoto } from '../types'

type PendingPhoto = {
  id: string
  dataUrl: string
  fileName: string
}

type Props = {
  pending: PendingPhoto[]
  saved?: RecordPhoto[]
  onPendingChange: (pending: PendingPhoto[]) => void
  disabled?: boolean
}

export function RecordObservacionPhotos({
  pending,
  saved = [],
  onPendingChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files?.length || disabled) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') return
        onPendingChange([
          ...pending,
          {
            id: crypto.randomUUID(),
            dataUrl: reader.result,
            fileName: file.name || `foto-${Date.now()}.jpg`,
          },
        ])
      }
      reader.readAsDataURL(file)
    })
    if (inputRef.current) inputRef.current.value = ''
  }

  function removePending(id: string) {
    onPendingChange(pending.filter((foto) => foto.id !== id))
  }

  const hasPhotos = saved.length > 0 || pending.length > 0

  return (
    <div className="maintenance-photos">
      <div className="machine-pauta-head">
        <h4>Fotos de observaciones</h4>
        <p className="section-help">
          Sube una o más fotos para respaldar hallazgos, daños o comentarios del chequeo.
        </p>
      </div>

      {hasPhotos ? (
        <div className="photo-grid">
          {saved.map((photo) => (
            <figure key={photo.id} className="photo-card">
              <a href={photo.url} target="_blank" rel="noreferrer">
                <img src={photo.url} alt={photo.fileName || 'Foto de observación'} />
              </a>
              <figcaption>
                <p className="section-help">{photo.fileName || 'Foto guardada'}</p>
              </figcaption>
            </figure>
          ))}
          {pending.map((photo) => (
            <figure key={photo.id} className="photo-card">
              <img src={photo.dataUrl} alt={photo.fileName || 'Foto pendiente'} />
              <figcaption>
                <p className="section-help">{photo.fileName}</p>
                {!disabled ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => removePending(photo.id)}
                  >
                    Quitar
                  </button>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="section-help">Aún no hay fotos en las observaciones.</p>
      )}

      {!disabled ? (
        <div className="photo-upload-box">
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => inputRef.current?.click()}
            >
              Tomar / subir fotos
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      ) : null}
    </div>
  )
}
