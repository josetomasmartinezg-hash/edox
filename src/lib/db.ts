import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Machine, MachinaryRecord } from '../types'

interface EdoxDB extends DBSchema {
  records: {
    key: string
    value: MachinaryRecord
    indexes: { 'by-sync': string; 'by-created': string }
  }
  machines: {
    key: string
    value: Machine
  }
}

let dbPromise: Promise<IDBPDatabase<EdoxDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<EdoxDB>('edox-maquinaria', 3, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('records')) {
          const store = db.createObjectStore('records', { keyPath: 'id' })
          store.createIndex('by-sync', 'syncStatus')
          store.createIndex('by-created', 'createdAt')
        } else {
          const store = transaction.objectStore('records')
          if (!store.indexNames.contains('by-sync')) {
            store.createIndex('by-sync', 'syncStatus')
          }
          if (!store.indexNames.contains('by-created')) {
            store.createIndex('by-created', 'createdAt')
          }
        }
        if (!db.objectStoreNames.contains('machines')) {
          db.createObjectStore('machines', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function saveRecord(record: MachinaryRecord) {
  const db = await getDb()
  await db.put('records', {
    ...record,
    updatedAt: new Date().toISOString(),
  })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('edox-records-changed'))
  }
}

export async function getRecord(id: string) {
  const db = await getDb()
  return db.get('records', id)
}

export async function getAllRecords() {
  const db = await getDb()
  const all = await db.getAll('records')
  return all.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function getPendingRecords() {
  const all = await getAllRecords()
  return all.filter((record) => record.syncStatus !== 'synced')
}

export async function deleteRecord(id: string) {
  const db = await getDb()
  await db.delete('records', id)
}

export async function saveMachines(machines: Machine[]) {
  const db = await getDb()
  const tx = db.transaction('machines', 'readwrite')
  await tx.store.clear()
  for (const machine of machines) {
    await tx.store.put(machine)
  }
  await tx.done
}

export async function getCachedMachines(): Promise<Machine[]> {
  const db = await getDb()
  return db.getAll('machines')
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
