import type { Machine } from '../types'
import { apiFetch } from './auth'
import { getCachedMachines, saveMachines } from './db'

export async function loadMachines(): Promise<Machine[]> {
  const cached = await getCachedMachines()
  try {
    const res = await apiFetch('/api/machines')
    if (!res.ok) return cached
    const list = (await res.json()) as Machine[]
    await saveMachines(list)
    return list
  } catch {
    return cached
  }
}
