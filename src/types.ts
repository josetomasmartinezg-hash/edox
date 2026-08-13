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

export type ModuleId =
  | 'panel'
  | 'maquinaria'
  | 'mantenimiento'
  | 'reparaciones'
  | 'usuarios'
  | 'documentacion'
  | 'combustible'
  | 'revision_diaria'

export type ModuleAccess = {
  view: boolean
  edit: boolean
  delete: boolean
  scope?: 'all' | 'assigned'
}

export type UserType = {
  id: string
  name: string
  description?: string
  system?: boolean
  modules: Record<ModuleId, ModuleAccess>
  createdAt?: string
  updatedAt?: string
}

export type User = {
  id: string
  name: string
  email: string
  role: RoleId
  userTypeId?: string
  isPrincipal?: boolean
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export type Permissions = {
  modules: Record<ModuleId, ModuleAccess>
  maintenance_scope?: 'all' | 'assigned' | 'none'
  repairs_scope?: 'all' | 'assigned' | 'none'
  admin_panel: boolean
  manage_users: boolean
  manage_machines: boolean
  view_machines: boolean
  manage_maintenance: boolean
  assign_maintenance: boolean
  view_maintenance: boolean
  manage_repairs: boolean
  assign_repairs: boolean
  view_repairs: boolean
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
  capacidadEstanque2?: string
  numeroChasis: string
  numeroMotor: string
  categoriaId?: string
  categoria?: string
  pauta?: MachinePautaTipo[]
  pautaFileUrl?: string | null
  pautaFileName?: string
  pautaMimeType?: string
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
  kind?: string
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

export type MaintenancePhotoKind = 'dano' | 'prueba'

export type MaintenancePhoto = {
  id: string
  url: string
  fileName: string
  kind: MaintenancePhotoKind
  caption?: string
  uploadedById: string
  uploadedByName: string
  createdAt: string
}

export type MaintenanceStatus = 'assigned' | 'pending' | 'in_progress' | 'completed'

export type MaintenanceComment = {
  id: string
  texto: string
  autorId: string
  autorNombre: string
  createdAt: string
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
  pauta?: MachinePautaTipo[]
  pautaFileUrl?: string | null
  pautaFileName?: string
  pautaMimeType?: string
  observaciones: string
  instrucciones?: string
  status?: MaintenanceStatus
  asignadoId?: string | null
  asignadoNombre?: string
  asignadoRole?: string
  asignadoPorId?: string
  asignadoPorNombre?: string
  comentarios?: MaintenanceComment[]
  fotos?: MaintenancePhoto[]
  /** @deprecated campos antiguos */
  acciones?: string[]
  detalles?: Array<{
    tipo: string
    nivel: string
    seAdiciona: string
    seAplica: string
    realizado: boolean
  }>
  mecanicoId: string
  mecanicoNombre: string
  createdAt: string
  updatedAt: string
}

export type RepairRecord = {
  id: string
  machineId?: string | null
  sigla: string
  titulo: string
  descripcion: string
  horometro?: string
  observaciones?: string
  status?: MaintenanceStatus
  asignadoId?: string | null
  asignadoNombre?: string
  asignadoRole?: string
  asignadoPorId?: string
  asignadoPorNombre?: string
  comentarios?: MaintenanceComment[]
  fotos?: MaintenancePhoto[]
  createdAt: string
  updatedAt: string
}

export type FieldRecordType = 'combustible' | 'revision_diaria' | 'mantenimiento'

export const MAINTENANCE_PHOTO_LABELS: Record<MaintenancePhotoKind, string> = {
  dano: 'Daño',
  prueba: 'Prueba de mantenimiento',
}

export const FIELD_TYPE_LABELS: Record<FieldRecordType, string> = {
  combustible: 'Combustible',
  revision_diaria: 'Revisión diaria',
  mantenimiento: 'Mantenimiento',
}

export type RecordPhoto = {
  id: string
  url: string
  fileName?: string
  createdAt?: string
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
  /** Id del tipo de pauta de esa máquina */
  intervaloMantenimiento?: string
  /** Nombre del tipo (ej. Cada 250 horas de trabajo) */
  tipoMantenimiento?: string
  mantenimiento: MaintenanceRow[]
  observaciones: string
  observacionFotos?: RecordPhoto[]
  observacionFotosPending?: Array<{ id: string; dataUrl: string; fileName: string }>
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

export const MODULE_LABELS: Record<ModuleId, string> = {
  panel: 'Panel de control',
  maquinaria: 'Maquinaria',
  mantenimiento: 'Mantenimiento',
  reparaciones: 'Reparaciones',
  usuarios: 'Usuarios',
  documentacion: 'Documentación',
  combustible: 'Combustible',
  revision_diaria: 'Revisión diaria',
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
    tipoMantenimiento: tipoRegistro === 'mantenimiento' ? '' : undefined,
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

/** Extrae sigla e id desde QR EDOX|MACHINE|SIGLA|ID o texto libre */
export function parseMachineQrMeta(raw: string): { sigla: string; id: string } {
  const value = String(raw || '').trim()
  if (value.startsWith('EDOX|MACHINE|')) {
    const parts = value.split('|')
    return { sigla: parts[2] || value, id: parts[3] || '' }
  }
  return { sigla: value, id: '' }
}

export function parseMachineQr(raw: string): string {
  return parseMachineQrMeta(raw).sigla
}

export function findMachineByCode<T extends { id: string; sigla: string }>(
  machines: T[],
  raw: string,
): T | null {
  const { sigla, id } = parseMachineQrMeta(raw)
  const norm = sigla.trim().toUpperCase()
  return (
    machines.find((m) => id && m.id === id) ||
    machines.find((m) => String(m.sigla).trim().toUpperCase() === norm) ||
    null
  )
}
