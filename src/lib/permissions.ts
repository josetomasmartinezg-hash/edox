import type { ModuleAccess, ModuleId, Permissions, RoleId, User } from '../types'

const ROLE_PERMISSIONS: Record<
  Exclude<keyof Permissions, 'modules' | 'maintenance_scope' | 'repairs_scope'>,
  RoleId[]
> = {
  admin_panel: ['administrador', 'supervisor', 'mecanico'],
  manage_users: ['administrador'],
  manage_machines: ['administrador'],
  view_machines: ['administrador', 'supervisor', 'operador', 'mecanico', 'operador_surtidor'],
  manage_maintenance: ['administrador', 'supervisor', 'mecanico'],
  assign_maintenance: ['administrador', 'supervisor'],
  view_maintenance: ['administrador', 'supervisor', 'mecanico'],
  manage_repairs: ['administrador', 'supervisor', 'mecanico'],
  assign_repairs: ['administrador', 'supervisor'],
  view_repairs: ['administrador', 'supervisor', 'mecanico'],
  manage_documents: ['administrador', 'supervisor'],
  view_documents: ['administrador', 'supervisor', 'mecanico'],
  field_form: ['administrador', 'supervisor', 'operador', 'operador_surtidor'],
  view_all_records: ['administrador', 'supervisor'],
}


function moduleAccess(view: RoleId[], edit: RoleId[], user: User): ModuleAccess {
  const can = (roles: RoleId[]) => !!user.isPrincipal || roles.includes(user.role)
  return {
    view: can(view),
    edit: can(edit),
    delete: can(edit),
  }
}

export function permissionsForUser(user: User): Permissions {
  const can = (roles: RoleId[]) => !!user.isPrincipal || roles.includes(user.role)

  const modules = {
    panel: moduleAccess(['administrador', 'supervisor', 'mecanico'], ['administrador'], user),
    maquinaria: moduleAccess(
      ['administrador', 'supervisor', 'operador', 'mecanico', 'operador_surtidor'],
      ['administrador'],
      user,
    ),
    mantenimiento: moduleAccess(
      ['administrador', 'supervisor', 'mecanico'],
      ['administrador', 'supervisor', 'mecanico'],
      user,
    ),
    reparaciones: moduleAccess(
      ['administrador', 'supervisor', 'mecanico'],
      ['administrador', 'supervisor', 'mecanico'],
      user,
    ),
    usuarios: moduleAccess(['administrador'], ['administrador'], user),
    documentacion: moduleAccess(
      ['administrador', 'supervisor', 'mecanico'],
      ['administrador', 'supervisor'],
      user,
    ),
    combustible: moduleAccess(
      ['administrador', 'supervisor', 'operador', 'operador_surtidor'],
      ['administrador', 'supervisor', 'operador', 'operador_surtidor'],
      user,
    ),
    revision_diaria: moduleAccess(
      ['administrador', 'supervisor', 'operador', 'operador_surtidor'],
      ['administrador', 'supervisor', 'operador', 'operador_surtidor'],
      user,
    ),
  } satisfies Record<ModuleId, ModuleAccess>

  const result: Permissions = {
    modules,
    maintenance_scope: can(['administrador', 'supervisor'])
      ? 'all'
      : can(['mecanico'])
        ? 'assigned'
        : 'none',
    repairs_scope: can(['administrador', 'supervisor'])
      ? 'all'
      : can(['mecanico'])
        ? 'assigned'
        : 'none',
    admin_panel: false,
    manage_users: false,
    manage_machines: false,
    view_machines: false,
    manage_maintenance: false,
    assign_maintenance: false,
    view_maintenance: false,
    manage_repairs: false,
    assign_repairs: false,
    view_repairs: false,
    manage_documents: false,
    view_documents: false,
    field_form: false,
    view_all_records: false,
  }

  for (const key of Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]) {
    result[key] = can(ROLE_PERMISSIONS[key])
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
