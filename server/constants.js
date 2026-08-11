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
  manage_maintenance: ['administrador', 'mecanico'],
  view_maintenance: ['administrador', 'supervisor', 'mecanico'],
  field_form: ['administrador', 'supervisor', 'operador', 'operador_surtidor'],
  view_all_records: ['administrador', 'supervisor'],
}

/** Intervalos del programa de mantenimiento (manual de tiempos operativos) */
export const MAINTENANCE_INTERVALS = [
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

export function publicUser(user) {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return rest
}
