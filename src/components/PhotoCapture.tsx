import { useRef } from 'react'

type Props = {
  value?: string | null
  onChange: (dataUrl: string | null) => void
}

export function PhotoCapture({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      onChange(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="section">
      <h3 className="section-title">Foto de respaldo</h3>
      <p className="section-help">
        Toma una foto de la boleta, guía o del medidor de combustible.
      </p>
      {value ? (
        <div className="photo-preview">
          <img src={value} alt="Respaldo de combustible" />
        </div>
      ) : null}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => inputRef.current?.click()}
        >
          {value ? 'Cambiar foto' : 'Tomar / subir foto'}
        </button>
        {value ? (
          <button type="button" className="btn btn-danger" onClick={() => onChange(null)}>
            Quitar foto
          </button>
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
  )
}
