import { getToken } from './auth'

export async function downloadMaintenancePdf(maintenanceId: string, filename?: string) {
  const token = getToken()
  const res = await fetch(`/api/maintenance/${maintenanceId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  })

  if (!res.ok) {
    const raw = await res.text()
    let message = 'No se pudo descargar el PDF'
    try {
      const data = JSON.parse(raw)
      if (data.error) message = data.error
    } catch {
      if (res.status === 404) {
        message = 'PDF no disponible. Reinicia el servidor (npm run dev) e intenta de nuevo.'
      }
    }
    throw new Error(message)
  }

  const contentType = res.headers.get('Content-Type') || ''
  if (!contentType.includes('application/pdf')) {
    throw new Error('La respuesta del servidor no es un PDF válido')
  }

  const blob = await res.blob()
  if (!blob.size) throw new Error('El PDF está vacío')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download =
    filename ||
    res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ||
    `mantenimiento-${maintenanceId}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
