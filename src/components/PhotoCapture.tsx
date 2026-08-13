import { useRef } from 'react'

type Props = {
  value?: string | null
  onChange: (dataUrl: string | null) => void
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const max = 1600
      let { width, height } = img
      if (width > max || height > max) {
        const scale = Math.min(max / width, max / height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('No se pudo comprimir la foto'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      const reader = new FileReader()
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }
    img.src = url
  })
}

export function PhotoCapture({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    try {
      onChange(await compressImage(file))
    } catch {
      const reader = new FileReader()
      reader.onload = () => {
        onChange(typeof reader.result === 'string' ? reader.result : null)
      }
      reader.readAsDataURL(file)
    }
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
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
