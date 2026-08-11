import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { MachinaryRecord } from '../types'

interface EdoxDB extends DBSchema {
  records: {
    key: string
    value: MachinaryRecord
    indexes: { 'by-sync': string; 'by-created': string }
  }
}

let dbPromise: Promise<IDBPDatabase<EdoxDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<EdoxDB>('edox-maquinaria', 1, {
      upgrade(db) {
        const store = db.createObjectStore('records', { keyPath: 'id' })
        store.createIndex('by-sync', 'syncStatus')
        store.createIndex('by-created', 'createdAt')
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
  const db = await getDb()
  return db.getAllFromIndex('records', 'by-sync', 'pending')
}

export async function deleteRecord(id: string) {
  const db = await getDb()
  await db.delete('records', id)
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
