import type { Permissions, RoleId, User } from '../types'

const ROLE_PERMISSIONS: Record<keyof Permissions, RoleId[]> = {
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

export function permissionsForUser(user: User): Permissions {
  const result = {} as Permissions
  for (const key of Object.keys(ROLE_PERMISSIONS) as (keyof Permissions)[]) {
    result[key] = !!user.isPrincipal || ROLE_PERMISSIONS[key].includes(user.role)
  }
  return result
}

export function screenForUser(user: User, permissions: Permissions): 'admin' | 'field' {
  if (user.isPrincipal || user.role === 'administrador' || user.role === 'mecanico') {
    return permissions.admin_panel ? 'admin' : 'field'
  }
  if (permissions.field_form) return 'field'
  if (permissions.admin_panel) return 'admin'
  return 'field'
}

export function isNetworkError(err: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const message = err instanceof Error ? err.message : String(err || '')
  return /failed to fetch|network|abort|timeout|sin conexión|load failed/i.test(message)
}
