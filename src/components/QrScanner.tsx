import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

type Props = {
  onScan: (value: string) => void
  onClose: () => void
}

async function stopScanner(scanner: Html5Qrcode | null) {
  if (!scanner) return
  try {
    const state = scanner.getState()
    // 2 = SCANNING, 3 = PAUSED in html5-qrcode
    if (state === 2 || state === 3) {
      await scanner.stop()
    }
  } catch {
    // ignore stop errors
  }
  try {
    scanner.clear()
  } catch {
    // ignore clear errors
  }
}

export function QrScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState('')
  const onScanRef = useRef(onScan)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (cancelled) return
          const value = decoded.trim()
          void stopScanner(scanner).then(() => onScanRef.current(value))
        },
        () => undefined,
      )
      .catch(() => {
        if (!cancelled) {
          setError(
            'No se pudo abrir la cámara. Usa la máquina demo o escribe el código a mano.',
          )
        }
      })

    return () => {
      cancelled = true
      void stopScanner(scanner)
      scannerRef.current = null
    }
  }, [])

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
