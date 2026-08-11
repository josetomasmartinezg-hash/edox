export type ChecklistStatus = 'bueno' | 'malo' | 'na' | ''

export type ChecklistItem = {
  id: string
  label: string
  status: ChecklistStatus
}

export type MaintenanceRow = {
  id: string
  tipo: string
  nivel: string
  seAdiciona: string
  seAplica: string
}

export type MachinaryRecord = {
  id: string
  formNumber: string
  fecha: string
  lugarTrabajo: string
  maquina: string
  operador: string
  checklist: ChecklistItem[]
  horasInicial: string
  horasFinal: string
  viajesTotalHoras: string
  viajesCantidad: string
  litrosEnEstanque: string
  litrosCargados: string
  guiaNumero: string
  mantenimiento: MaintenanceRow[]
  observaciones: string
  firmaOperador: string
  firmaSupervisor: string
  firmaJefeFaena: string
  photoDataUrl?: string | null
  photoUrl?: string | null
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'error'
  lastSyncError?: string | null
}

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'aceite-motor', label: 'Comprobar el nivel de aceite del motor', status: '' },
  { id: 'sistema-electrico', label: 'Sistema eléctrico', status: '' },
  { id: 'refrigerante', label: 'Comprobar el nivel del refrigerante', status: '' },
  { id: 'aceite-hidraulico', label: 'Comprobar el nivel del aceite hidráulico', status: '' },
]

export const DEFAULT_MAINTENANCE: MaintenanceRow[] = [
  { id: 'hidraulico', tipo: 'Aceite Hidráulico', nivel: '', seAdiciona: '', seAplica: '' },
  { id: 'motor', tipo: 'Aceite Motor', nivel: '', seAdiciona: '', seAplica: '' },
  { id: 'transmision', tipo: 'Aceite Transmisión', nivel: '', seAdiciona: '', seAplica: '' },
  { id: 'diferencial', tipo: 'Diferencial', nivel: '', seAdiciona: '', seAplica: '' },
  { id: 'grasa', tipo: 'Grasa', nivel: '', seAdiciona: '', seAplica: '' },
]

export function createEmptyRecord(): MachinaryRecord {
  const now = new Date()
  const fecha = now.toISOString().slice(0, 10)
  return {
    id: crypto.randomUUID(),
    formNumber: String(Math.floor(10000 + Math.random() * 90000)),
    fecha,
    lugarTrabajo: '',
    maquina: '',
    operador: '',
    checklist: DEFAULT_CHECKLIST.map((item) => ({ ...item })),
    horasInicial: '',
    horasFinal: '',
    viajesTotalHoras: '',
    viajesCantidad: '',
    litrosEnEstanque: '',
    litrosCargados: '',
    guiaNumero: '',
    mantenimiento: DEFAULT_MAINTENANCE.map((row) => ({ ...row })),
    observaciones: '',
    firmaOperador: '',
    firmaSupervisor: '',
    firmaJefeFaena: '',
    photoDataUrl: null,
    photoUrl: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    syncStatus: 'pending',
    lastSyncError: null,
  }
}
