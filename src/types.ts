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
  /** Ítem marcado OK en pauta 10.000 / 20.000 km */
  realizado?: boolean
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
  manage_documents: boolean
  view_documents: boolean
  field_form: boolean
  view_all_records: boolean
}

export type DocumentAlert = 'expired' | 'soon' | 'ok' | 'none'

export type MachinePautaItem = {
  id: string
  label: string
}

export type MachinePautaTipo = {
  id: string
  nombre: string
  items: MachinePautaItem[]
}

export type MachineCategory = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

export type Machine = {
  id: string
  marca: string
  modelo: string
  anio: string
  sigla: string
  capacidadEstanque: string
  numeroChasis: string
  numeroMotor: string
  categoriaId?: string
  categoria?: string
  pauta?: MachinePautaTipo[]
  active?: boolean
  qrPayload?: string | null
  qrDataUrl?: string | null
  documentAlert?: DocumentAlert
  documentsCount?: number
  expiredCount?: number
  soonCount?: number
  createdAt?: string
  updatedAt?: string
}

export type MachineDocument = {
  id: string
  name: string
  machineId: string
  sigla: string
  expiresAt?: string | null
  fileUrl: string
  fileName: string
  mimeType: string
  uploadedById?: string
  uploadedByName?: string
  status?: DocumentAlert
  createdAt: string
  updatedAt: string
}

export type MaintenanceTaskDone = {
  id: string
  label: string
  realizado: boolean
}

export type MaintenanceRecord = {
  id: string
  machineId?: string | null
  sigla: string
  tipoMantenimiento: string
  intervaloId?: string
  horometro: string
  tareas?: MaintenanceTaskDone[]
  /** @deprecated campos antiguos */
  acciones?: string[]
  detalles?: Array<{
    tipo: string
    nivel: string
    seAdiciona: string
    seAplica: string
    realizado: boolean
  }>
  observaciones: string
  mecanicoId: string
  mecanicoNombre: string
  createdAt: string
  updatedAt: string
}

export type FieldRecordType = 'combustible' | 'revision_diaria' | 'mantenimiento'

export const FIELD_TYPE_LABELS: Record<FieldRecordType, string> = {
  combustible: 'Combustible',
  revision_diaria: 'Revisión diaria',
  mantenimiento: 'Mantenimiento',
}

export type MachinaryRecord = {
  id: string
  tipoRegistro: FieldRecordType
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
  /** Intervalo de pauta: km_10000 | km_20000 | … */
  intervaloMantenimiento?: string
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

export function createEmptyRecord(
  operador = '',
  tipoRegistro: FieldRecordType = 'combustible',
): MachinaryRecord {
  const now = new Date()
  const fecha = now.toISOString().slice(0, 10)
  return {
    id: crypto.randomUUID(),
    tipoRegistro,
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
    intervaloMantenimiento: tipoRegistro === 'mantenimiento' ? '' : undefined,
    mantenimiento:
      tipoRegistro === 'mantenimiento'
        ? []
        : DEFAULT_MAINTENANCE.map((row) => ({ ...row })),
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
