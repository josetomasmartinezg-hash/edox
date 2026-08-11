import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

type Props = {
  onScan: (value: string) => void
  onClose: () => void
}

export function QrScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState('')
  const started = useRef(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          onScan(decoded.trim())
          void scanner.stop().catch(() => undefined)
        },
        () => undefined,
      )
      .catch(() => {
        setError('No se pudo abrir la cámara. Puedes ingresar el código de la máquina a mano.')
      })

    return () => {
      void scanner.stop().catch(() => undefined)
      scanner.clear()
    }
  }, [onScan])

  return (
    <div className="section">
      <h3 className="section-title">Escanear QR de máquina</h3>
      <p className="section-help">Apunta al código QR pegado en la máquina o camión.</p>
      <div id="qr-reader" className="qr-wrap" />
      {error ? <p className="section-help">{error}</p> : null}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
