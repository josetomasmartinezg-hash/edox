import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getPendingRecords } from '../lib/db'
import {
  checkServer,
  isOnline,
  persistLocalData,
  RECORDS_SYNCED_EVENT,
  requestBackgroundSync,
  syncPending,
} from '../lib/sync'

export type OnlineStatus = {
  online: boolean
  serverOk: boolean
  syncing: boolean
  pendingCount: number
  lastSyncMessage: string
  setLastSyncMessage: (message: string) => void
  forceSync: () => Promise<void>
}

const SyncContext = createContext<OnlineStatus | null>(null)

export function useOnlineStatus() {
  const ctx = useContext(SyncContext)
  if (!ctx) {
    throw new Error('useOnlineStatus debe usarse dentro de SyncProvider')
  }
  return ctx
}

type ProviderProps = {
  children: ReactNode
  active: boolean
}

export function SyncProvider({ children, active }: ProviderProps) {
  const [online, setOnline] = useState(isOnline())
  const [serverOk, setServerOk] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncMessage, setLastSyncMessage] = useState('')
  const [tick, setTick] = useState(0)

  const refreshPending = useCallback(async () => {
    const pending = await getPendingRecords()
    setPendingCount(pending.length)
    return pending.length
  }, [])

  const runSync = useCallback(
    async (manual = false) => {
      if (!active) {
        await refreshPending()
        return
      }

      setOnline(isOnline())
      const ok = await checkServer()
      setServerOk(ok)
      const count = await refreshPending()
      if (!ok) {
        await requestBackgroundSync()
        if (manual) setLastSyncMessage('Sin conexión todavía')
        return
      }
      if (count === 0) {
        if (manual) setLastSyncMessage('No hay pendientes')
        return
      }

      setSyncing(true)
      try {
        const result = await syncPending()
        if (result.synced > 0) {
          setLastSyncMessage(`${result.synced} registro(s) subidos al panel`)
        } else if (result.failed > 0) {
          setLastSyncMessage(`${result.failed} con error al subir. Se reintenta solo`)
        } else if (manual) {
          setLastSyncMessage('No hay pendientes')
        }
      } finally {
        setSyncing(false)
        await refreshPending()
      }
    },
    [active, refreshPending],
  )

  const forceSync = useCallback(async () => {
    setLastSyncMessage('')
    await runSync(true)
  }, [runSync])

  useEffect(() => {
    void persistLocalData()
  }, [])

  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    const onOnline = () => {
      setOnline(true)
      bump()
    }
    const onOffline = () => {
      setOnline(false)
      setServerOk(false)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump()
    }
    const onChanged = () => {
      void refreshPending()
      void requestBackgroundSync()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('focus', bump)
    window.addEventListener('pageshow', bump)
    window.addEventListener('edox-records-changed', onChanged)
    window.addEventListener(RECORDS_SYNCED_EVENT, onChanged)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', bump)
      window.removeEventListener('pageshow', bump)
      window.removeEventListener('edox-records-changed', onChanged)
      window.removeEventListener(RECORDS_SYNCED_EVENT, onChanged)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshPending])

  useEffect(() => {
    if (!active) return
    void runSync()
    const delay = pendingCount > 0 ? 4000 : 12000
    const id = window.setInterval(() => void runSync(), delay)
    return () => window.clearInterval(id)
  }, [active, tick, runSync, pendingCount])

  const value = useMemo<OnlineStatus>(
    () => ({
      online,
      serverOk,
      syncing,
      pendingCount,
      lastSyncMessage,
      setLastSyncMessage,
      forceSync,
    }),
    [online, serverOk, syncing, pendingCount, lastSyncMessage, forceSync],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
