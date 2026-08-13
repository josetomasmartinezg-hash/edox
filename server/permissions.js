import { readJson } from './store.js'

/** @typedef {'panel'|'maquinaria'|'mantenimiento'|'reparaciones'|'usuarios'|'documentacion'|'combustible'|'revision_diaria'} ModuleId */

export const MODULES = [
  { id: 'panel', label: 'Panel de control' },
  { id: 'maquinaria', label: 'Maquinaria' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
  { id: 'reparaciones', label: 'Reparaciones' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'combustible', label: 'Combustible' },
  { id: 'revision_diaria', label: 'Revisión diaria' },
]

export const MODULE_IDS = MODULES.map((m) => m.id)

/** @typedef {{ view: boolean, edit: boolean, delete: boolean, scope?: 'all'|'assigned' }} ModuleAccess */

export function emptyModuleAccess() {
  return { view: false, edit: false, delete: false }
}

export function fullModuleAccess(scope) {
  const access = { view: true, edit: true, delete: true }
  if (scope) access.scope = scope
  return access
}

export function emptyPermissionsMap() {
  return Object.fromEntries(MODULE_IDS.map((id) => [id, emptyModuleAccess()]))
}

export function fullPermissionsMap() {
  return Object.fromEntries(
    MODULE_IDS.map((id) => [
      id,
      id === 'mantenimiento' || id === 'reparaciones' ? fullModuleAccess('all') : fullModuleAccess(),
    ]),
  )
}

/** Tipos de usuario base (se guardan en userTypes.json) */
export const DEFAULT_USER_TYPES = [
  {
    id: 'tipo-administrador',
    name: 'Administrador',
    description: 'Acceso completo a todos los módulos',
    system: true,
    roleLegacy: 'administrador',
    modules: fullPermissionsMap(),
  },
  {
    id: 'tipo-supervisor',
    name: 'Supervisor',
    description: 'Supervisa operación, maquinaria y asigna mantenimientos',
    system: true,
    roleLegacy: 'supervisor',
    modules: {
      panel: fullModuleAccess(),
      maquinaria: { view: true, edit: false, delete: false },
      mantenimiento: fullModuleAccess('all'),
      reparaciones: fullModuleAccess('all'),
      usuarios: emptyModuleAccess(),
      documentacion: { view: true, edit: true, delete: true },
      combustible: fullModuleAccess(),
      revision_diaria: fullModuleAccess(),
    },
  },
  {
    id: 'tipo-mecanico',
    name: 'Mecánico',
    description: 'Ve maquinaria y solo los mantenimientos asignados a él',
    system: true,
    roleLegacy: 'mecanico',
    modules: {
      panel: { view: true, edit: false, delete: false },
      maquinaria: { view: true, edit: false, delete: false },
      mantenimiento: { view: true, edit: true, delete: false, scope: 'assigned' },
      reparaciones: { view: true, edit: true, delete: false, scope: 'assigned' },
      usuarios: emptyModuleAccess(),
      documentacion: { view: true, edit: false, delete: false },
      combustible: emptyModuleAccess(),
      revision_diaria: emptyModuleAccess(),
    },
  },
  {
    id: 'tipo-operador',
    name: 'Operador',
    description: 'Registros de combustible y revisión diaria en terreno',
    system: true,
    roleLegacy: 'operador',
    modules: {
      panel: emptyModuleAccess(),
      maquinaria: { view: true, edit: false, delete: false },
      mantenimiento: emptyModuleAccess(),
      reparaciones: emptyModuleAccess(),
      usuarios: emptyModuleAccess(),
      documentacion: emptyModuleAccess(),
      combustible: { view: true, edit: true, delete: false },
      revision_diaria: { view: true, edit: true, delete: false },
    },
  },
  {
    id: 'tipo-operador-surtidor',
    name: 'Operador surtidor',
    description: 'Solo cargas de combustible',
    system: true,
    roleLegacy: 'operador_surtidor',
    modules: {
      panel: emptyModuleAccess(),
      maquinaria: { view: true, edit: false, delete: false },
      mantenimiento: emptyModuleAccess(),
      reparaciones: emptyModuleAccess(),
      usuarios: emptyModuleAccess(),
      documentacion: emptyModuleAccess(),
      combustible: { view: true, edit: true, delete: false },
      revision_diaria: emptyModuleAccess(),
    },
  },
]

function normalizeModuleAccess(raw) {
  const access = emptyModuleAccess()
  if (!raw || typeof raw !== 'object') return access
  access.view = !!raw.view
  access.edit = !!raw.edit
  access.delete = !!raw.delete
  if (raw.scope === 'assigned') access.scope = 'assigned'
  else if (raw.scope === 'all') access.scope = 'all'
  return access
}

export function normalizeUserType(raw) {
  const modules = emptyPermissionsMap()
  for (const id of MODULE_IDS) {
    modules[id] = normalizeModuleAccess(raw?.modules?.[id])
  }
  if (modules.mantenimiento.view || modules.mantenimiento.edit) {
    if (!modules.mantenimiento.scope) modules.mantenimiento.scope = 'all'
  }
  if (modules.reparaciones.view || modules.reparaciones.edit) {
    if (!modules.reparaciones.scope) modules.reparaciones.scope = 'all'
  }
  if (
    (modules.mantenimiento.view || modules.mantenimiento.edit) &&
    !modules.reparaciones.view &&
    !modules.reparaciones.edit
  ) {
    modules.reparaciones = { ...modules.mantenimiento }
  }
  return {
    id: String(raw?.id || ''),
    name: String(raw?.name || '').trim(),
    description: String(raw?.description || '').trim(),
    system: !!raw?.system,
    roleLegacy: raw?.roleLegacy || null,
    modules,
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  }
}

export function readUserTypes() {
  return readJson('userTypes.json', []).map(normalizeUserType)
}

export function getUserTypeById(typeId) {
  if (!typeId) return null
  return readUserTypes().find((t) => t.id === typeId) || null
}

export function getUserTypeForUser(user) {
  if (!user) return null
  const types = readUserTypes()
  if (user.userTypeId) {
    const byId = types.find((t) => t.id === user.userTypeId)
    if (byId) return byId
  }
  return types.find((t) => t.roleLegacy === user.role) || null
}

export function resolveModuleMap(user) {
  if (user?.isPrincipal) return fullPermissionsMap()
  const type = getUserTypeForUser(user)
  if (type) return type.modules
  return emptyPermissionsMap()
}

/** @param {import('./constants.js').User} user @param {ModuleId} module @param {'view'|'edit'|'delete'} action */
export function userCan(user, module, action) {
  if (!user) return false
  if (user.isPrincipal) return true
  const mod = resolveModuleMap(user)[module] || emptyModuleAccess()
  if (action === 'view') return !!mod.view
  if (action === 'edit') return !!mod.edit
  if (action === 'delete') return !!mod.delete
  return false
}

export function maintenanceScope(user) {
  if (user?.isPrincipal) return 'all'
  const mod = resolveModuleMap(user).mantenimiento
  if (!mod?.view && !mod?.edit) return 'none'
  return mod.scope === 'assigned' ? 'assigned' : 'all'
}

export function canAssignMaintenance(user) {
  return userCan(user, 'mantenimiento', 'edit') && maintenanceScope(user) === 'all'
}

export function repairsScope(user) {
  if (user?.isPrincipal) return 'all'
  const mod = resolveModuleMap(user).reparaciones
  if (!mod?.view && !mod?.edit) return 'none'
  return mod.scope === 'assigned' ? 'assigned' : 'all'
}

export function canAssignRepairs(user) {
  return userCan(user, 'reparaciones', 'edit') && repairsScope(user) === 'all'
}

export function canSeeAllRepairs(user) {
  return repairsScope(user) === 'all'
}

export function canSeeAllMaintenance(user) {
  return maintenanceScope(user) === 'all'
}

export function legacyPermissions(user) {
  const modules = resolveModuleMap(user)
  const m = modules.mantenimiento || emptyModuleAccess()
  const fieldEdit =
    userCan(user, 'combustible', 'edit') || userCan(user, 'revision_diaria', 'edit')
  const fieldView =
    userCan(user, 'combustible', 'view') || userCan(user, 'revision_diaria', 'view')

  return {
    modules,
    admin_panel: userCan(user, 'panel', 'view'),
    manage_users: userCan(user, 'usuarios', 'edit'),
    manage_machines: userCan(user, 'maquinaria', 'edit'),
    view_machines: userCan(user, 'maquinaria', 'view'),
    manage_maintenance: userCan(user, 'mantenimiento', 'edit'),
    assign_maintenance: canAssignMaintenance(user),
    view_maintenance: userCan(user, 'mantenimiento', 'view'),
    manage_repairs:
      userCan(user, 'reparaciones', 'edit') || userCan(user, 'mantenimiento', 'edit'),
    assign_repairs: canAssignRepairs(user) || canAssignMaintenance(user),
    view_repairs:
      userCan(user, 'reparaciones', 'view') || userCan(user, 'mantenimiento', 'view'),
    manage_documents: userCan(user, 'documentacion', 'edit'),
    view_documents: userCan(user, 'documentacion', 'view'),
    field_form: fieldEdit,
    view_all_records: fieldView && maintenanceScope(user) === 'all',
    maintenance_scope: maintenanceScope(user),
    repairs_scope: repairsScope(user),
  }
}

/** Compatibilidad con requirePermission('manage_users') etc. */
const LEGACY_PERMISSION_MAP = {
  admin_panel: ['panel', 'view'],
  manage_users: ['usuarios', 'edit'],
  view_machines: ['maquinaria', 'view'],
  manage_machines: ['maquinaria', 'edit'],
  view_maintenance: ['mantenimiento', 'view'],
  manage_maintenance: ['mantenimiento', 'edit'],
  assign_maintenance: ['__assign_maintenance__'],
  view_repairs: ['reparaciones', 'view'],
  manage_repairs: ['reparaciones', 'edit'],
  assign_repairs: ['__assign_repairs__'],
  manage_documents: ['documentacion', 'edit'],
  view_documents: ['documentacion', 'view'],
  field_form: ['__field_form__'],
  view_all_records: ['__view_all_records__'],
}

export function userHasLegacyPermission(user, permission) {
  if (!user) return false
  if (user.isPrincipal) return true
  const map = LEGACY_PERMISSION_MAP[permission]
  if (!map) return false
  if (permission === 'assign_maintenance') return canAssignMaintenance(user)
  if (permission === 'assign_repairs') {
    return canAssignRepairs(user) || canAssignMaintenance(user)
  }
  if (permission === 'view_repairs') {
    return userCan(user, 'reparaciones', 'view') || userCan(user, 'mantenimiento', 'view')
  }
  if (permission === 'manage_repairs') {
    return userCan(user, 'reparaciones', 'edit') || userCan(user, 'mantenimiento', 'edit')
  }
  if (permission === 'field_form') {
    return userCan(user, 'combustible', 'edit') || userCan(user, 'revision_diaria', 'edit')
  }
  if (permission === 'view_all_records') {
    return (
      (userCan(user, 'combustible', 'view') || userCan(user, 'revision_diaria', 'view')) &&
      maintenanceScope(user) === 'all'
    )
  }
  const [module, action] = map
  return userCan(user, module, action)
}

export function publicUserType(type) {
  if (!type) return null
  const { roleLegacy, ...rest } = type
  return rest
}
