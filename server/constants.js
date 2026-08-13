export const ROLES = [
  { id: 'administrador', label: 'Administrador' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'operador', label: 'Operador' },
  { id: 'mecanico', label: 'Mecánico' },
  { id: 'operador_surtidor', label: 'Operador surtidor' },
]

/** Acciones del sistema → roles permitidos */
export const PERMISSIONS = {
  admin_panel: ['administrador', 'supervisor', 'mecanico'],
  manage_users: ['administrador'],
  manage_machines: ['administrador'],
  view_machines: ['administrador', 'supervisor', 'operador', 'mecanico', 'operador_surtidor'],
  manage_maintenance: ['administrador', 'supervisor', 'mecanico'],
  assign_maintenance: ['administrador', 'supervisor'],
  view_maintenance: ['administrador', 'supervisor', 'mecanico'],
  manage_documents: ['administrador', 'supervisor'],
  view_documents: ['administrador', 'supervisor', 'mecanico'],
  field_form: ['administrador', 'supervisor', 'operador', 'operador_surtidor'],
  view_all_records: ['administrador', 'supervisor'],
}

/** Días antes del vencimiento para alerta amarilla */
export const DOCUMENT_SOON_DAYS = 30

export function documentStatus(expiresAt, soonDays = DOCUMENT_SOON_DAYS) {
  if (!expiresAt) return 'ok'
  const end = new Date(`${expiresAt}T23:59:59`)
  if (Number.isNaN(end.getTime())) return 'ok'
  const now = new Date()
  if (end.getTime() < now.getTime()) return 'expired'
  const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= soonDays) return 'soon'
  return 'ok'
}

export function worstDocumentStatus(statuses) {
  if (statuses.includes('expired')) return 'expired'
  if (statuses.includes('soon')) return 'soon'
  if (statuses.includes('ok')) return 'ok'
  return 'none'
}

/** Intervalos del programa de mantenimiento */
export const MAINTENANCE_INTERVALS = [
  '10.000 km',
  '20.000 km',
  'Según se requiera',
  'Cada 10 horas o diariamente',
  'Cada 50 horas de trabajo',
  'Mantenimiento inicial — 100 horas',
  'Cada 250 horas de trabajo',
  'Cada 500 horas de trabajo',
  'Cada 1000 horas de trabajo',
  'Cada 2000 horas de trabajo',
  'Cada 4000 horas de trabajo',
  'Cada 5000 horas de trabajo',
  'Cada 6000 horas de trabajo',
]

export function roleCan(role, permission) {
  const allowed = PERMISSIONS[permission] || []
  return allowed.includes(role)
}

export function permissionsFor(user) {
  const can = (permission) => !!(user?.isPrincipal || roleCan(user?.role, permission))
  return {
    admin_panel: can('admin_panel'),
    manage_users: can('manage_users'),
    manage_machines: can('manage_machines'),
    view_machines: can('view_machines'),
    manage_maintenance: can('manage_maintenance'),
    assign_maintenance: can('assign_maintenance'),
    view_maintenance: can('view_maintenance'),
    manage_documents: can('manage_documents'),
    view_documents: can('view_documents'),
    field_form: can('field_form'),
    view_all_records: can('view_all_records'),
  }
}

export function publicUser(user) {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return rest
}
