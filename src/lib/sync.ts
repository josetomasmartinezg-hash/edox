import { apiFetch, clearSession, getToken, SESSION_EXPIRED_EVENT } from './auth'
import { dataUrlToBlob, getPendingRecords, saveRecord } from './db'
import type { MachinaryRecord } from '../types'

export type SyncResult = {
  synced: number
  failed: number
  online: boolean
}

export const RECORDS_SYNCED_EVENT = 'edox-records-synced'

let inflight: Promise<SyncResult> | null = null

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function notifySynced(result: SyncResult) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(RECORDS_SYNCED_EVENT, { detail: result }))
}

function errorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message
  return String(err || 'Error de sync')
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function requestBackgroundSync() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const syncManager = (
      reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> }
      }
    ).sync
    if (syncManager?.register) await syncManager.register('edox-records')
  } catch {
    /* iOS / navegadores sin Background Sync */
  }
}

export async function persistLocalData() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    /* ignore */
  }
}

export async function syncRecord(record: MachinaryRecord): Promise<MachinaryRecord> {
  const form = new FormData()
  const { photoDataUrl, lastSyncError: _err, syncStatus: _status, ...payload } = record
  form.append('data', JSON.stringify(payload))

  if (photoDataUrl) {
    const blob = await dataUrlToBlob(photoDataUrl)
    form.append('photo', blob, `combustible-${record.id}.jpg`)
  }

  const res = await apiFetch('/api/records', {
    method: 'POST',
    body: form,
    clearOn401: false,
  })

  if (!res.ok) {
    const text = await res.text()
    let message = text || `Error HTTP ${res.status}`
    try {
      const data = JSON.parse(text) as { error?: string }
      if (data.error) message = data.error
    } catch {
      if (res.status === 401) message = 'Tu sesión expiró. Vuelve a iniciar sesión.'
    }
    throw new Error(message)
  }

  const saved = (await res.json()) as MachinaryRecord
  const next: MachinaryRecord = {
    ...record,
    ...saved,
    photoDataUrl: photoDataUrl || null,
    syncStatus: 'synced',
    lastSyncError: null,
    updatedAt: new Date().toISOString(),
  }
  await saveRecord(next)
  return next
}

async function syncRecordWithRetry(record: MachinaryRecord) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await syncRecord(record)
    } catch (err) {
      lastError = err
      const message = errorMessage(err)
      if (/401|sesión|permiso/i.test(message)) throw err
      await wait(700 * (attempt + 1))
    }
  }
  throw lastError
}

async function flushPending(): Promise<SyncResult> {
  if (!getToken()) {
    await requestBackgroundSync()
    return { synced: 0, failed: 0, online: false }
  }

  const reachable = await checkServer()
  if (!reachable) {
    await requestBackgroundSync()
    return { synced: 0, failed: 0, online: false }
  }

  const pending = await getPendingRecords()
  let synced = 0
  let failed = 0

  for (const record of pending) {
    try {
      await syncRecordWithRetry(record)
      synced += 1
    } catch (err) {
      failed += 1
      const message = errorMessage(err)
      await saveRecord({
        ...record,
        syncStatus: 'pending',
        lastSyncError: message,
        updatedAt: new Date().toISOString(),
      })
      if (/401|sesión/i.test(message)) {
        clearSession()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
        }
        break
      }
    }
  }

  const result = { synced, failed, online: true }
  if (synced > 0 || failed > 0) notifySynced(result)
  if (failed > 0) await requestBackgroundSync()
  return result
}

export async function syncPending(): Promise<SyncResult> {
  if (inflight) return inflight
  inflight = flushPending().finally(() => {
    inflight = null
  })
  return inflight
}

export async function checkServer(): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}
