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

export type RoleId =
  | 'administrador'
  | 'supervisor'
  | 'operador'
  | 'mecanico'
  | 'operador_surtidor'

export type User = {
  id: string
  name: string
  email: string
  role: RoleId
  isPrincipal?: boolean
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export type Permissions = {
  admin_panel: boolean
  manage_users: boolean
  manage_machines: boolean
  view_machines: boolean
  manage_maintenance: boolean
  view_maintenance: boolean
  field_form: boolean
  view_all_records: boolean
}

export type Machine = {
  id: string
  marca: string
  modelo: string
  anio: string
  sigla: string
  capacidadEstanque: string
  active?: boolean
  qrPayload?: string | null
  qrDataUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export type MaintenanceActionId =
  | 'nivel_ok'
  | 'se_adiciona'
  | 'se_aplica'
  | 'cambio_completo'
  | 'filtro_cambiado'
  | 'inspeccion'
  | 'reparacion'

export type MaintenanceDetail = {
  tipo: string
  nivel: string
  seAdiciona: string
  seAplica: string
  realizado: boolean
}

export type MaintenanceRecord = {
  id: string
  machineId?: string | null
  sigla: string
  tipoMantenimiento: string
  horometro: string
  acciones: MaintenanceActionId[]
  detalles: MaintenanceDetail[]
  observaciones: string
  mecanicoId: string
  mecanicoNombre: string
  createdAt: string
  updatedAt: string
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
  userId?: string
}

export const ROLE_LABELS: Record<RoleId, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  mecanico: 'Mecánico',
  operador_surtidor: 'Operador surtidor',
}

export const MAINTENANCE_TYPES = [
  'Aceite Hidráulico',
  'Aceite Motor',
  'Aceite Transmisión',
  'Diferencial',
  'Grasa',
]

export const MAINTENANCE_ACTIONS: { id: MaintenanceActionId; label: string }[] = [
  { id: 'nivel_ok', label: 'Nivel OK / verificado' },
  { id: 'se_adiciona', label: 'Se adiciona' },
  { id: 'se_aplica', label: 'Se aplica' },
  { id: 'cambio_completo', label: 'Cambio completo' },
  { id: 'filtro_cambiado', label: 'Filtro cambiado' },
  { id: 'inspeccion', label: 'Inspección visual' },
  { id: 'reparacion', label: 'Reparación' },
]

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

export function createEmptyRecord(operador = ''): MachinaryRecord {
  const now = new Date()
  const fecha = now.toISOString().slice(0, 10)
  return {
    id: crypto.randomUUID(),
    formNumber: String(Math.floor(10000 + Math.random() * 90000)),
    fecha,
    lugarTrabajo: '',
    maquina: '',
    operador,
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
    firmaOperador: operador,
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

/** Extrae sigla desde QR EDOX|MACHINE|SIGLA|ID o texto libre */
export function parseMachineQr(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('EDOX|MACHINE|')) {
    const parts = value.split('|')
    return parts[2] || value
  }
  return value
}
