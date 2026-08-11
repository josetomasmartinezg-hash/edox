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

/** Tipos del formulario papel MAQUINARIA / control de mantenimiento */
export const MAINTENANCE_TYPES = [
  'Aceite Hidráulico',
  'Aceite Motor',
  'Aceite Transmisión',
  'Diferencial',
  'Grasa',
]

export const MAINTENANCE_ACTIONS = [
  { id: 'nivel_ok', label: 'Nivel OK / verificado' },
  { id: 'se_adiciona', label: 'Se adiciona' },
  { id: 'se_aplica', label: 'Se aplica' },
  { id: 'cambio_completo', label: 'Cambio completo' },
  { id: 'filtro_cambiado', label: 'Filtro cambiado' },
  { id: 'inspeccion', label: 'Inspección visual' },
  { id: 'reparacion', label: 'Reparación' },
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
