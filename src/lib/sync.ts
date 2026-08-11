import { dataUrlToBlob, getPendingRecords, saveRecord } from './db'
import type { MachinaryRecord } from '../types'

export type SyncResult = {
  synced: number
  failed: number
  online: boolean
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export async function syncRecord(record: MachinaryRecord): Promise<MachinaryRecord> {
  const form = new FormData()
  const { photoDataUrl, ...payload } = record
  form.append('data', JSON.stringify(payload))

  if (photoDataUrl) {
    const blob = await dataUrlToBlob(photoDataUrl)
    form.append('photo', blob, `combustible-${record.id}.jpg`)
  }

  const res = await fetch('/api/records', {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Error HTTP ${res.status}`)
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

export async function syncPending(): Promise<SyncResult> {
  if (!isOnline()) {
    return { synced: 0, failed: 0, online: false }
  }

  const pending = await getPendingRecords()
  let synced = 0
  let failed = 0

  for (const record of pending) {
    try {
      await syncRecord(record)
      synced += 1
    } catch (err) {
      failed += 1
      await saveRecord({
        ...record,
        syncStatus: 'pending',
        lastSyncError: err instanceof Error ? err.message : 'Error de sync',
        updatedAt: new Date().toISOString(),
      })
    }
  }

  return { synced, failed, online: true }
}

export async function checkServer(): Promise<boolean> {
  if (!isOnline()) return false
  try {
    const res = await fetch('/api/health', { cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}
