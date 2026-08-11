import { useEffect, useState } from 'react'
import { checkServer, isOnline, syncPending } from '../lib/sync'

export function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline())
  const [serverOk, setServerOk] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncMessage, setLastSyncMessage] = useState('')

  useEffect(() => {
    const update = () => setOnline(isOnline())
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      const ok = await checkServer()
      if (!cancelled) setServerOk(ok)
      if (ok) {
        setSyncing(true)
        const result = await syncPending()
        if (!cancelled) {
          if (result.synced > 0) {
            setLastSyncMessage(`${result.synced} registro(s) subidos`)
          } else if (result.failed > 0) {
            setLastSyncMessage(`${result.failed} con error al subir`)
          }
          setSyncing(false)
        }
      }
    }

    void run()
    const id = window.setInterval(() => void run(), 15000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [online])

  return { online, serverOk, syncing, lastSyncMessage, setLastSyncMessage }
}
