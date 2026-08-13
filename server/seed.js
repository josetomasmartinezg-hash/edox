import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { DEFAULT_USER_TYPES, normalizeUserType } from './permissions.js'
import { readJson, writeJson } from './store.js'

const PRINCIPAL = {
  email: 'josetomasmartinezg@gmail.com',
  name: 'Jose Tomas Martinez',
  password: 'Edox2026!',
  role: 'administrador',
}

const ADMIN = {
  email: 'admin@soinver.cl',
  name: 'Administrador SOINVER',
  password: 'admin1234',
  role: 'administrador',
}

const DEMO_USERS = [
  {
    email: 'supervisor@soinver.cl',
    name: 'Supervisor Demo',
    password: 'demo1234',
    role: 'supervisor',
  },
  {
    email: 'mecanico@soinver.cl',
    name: 'Mecánico Demo',
    password: 'demo1234',
    role: 'mecanico',
  },
  {
    email: 'operador@soinver.cl',
    name: 'Operador Demo',
    password: 'demo1234',
    role: 'operador',
  },
  {
    email: 'surtidor@soinver.cl',
    name: 'Operador Surtidor Demo',
    password: 'demo1234',
    role: 'operador_surtidor',
  },
]

function upsertUser(users, spec, extra = {}) {
  const email = spec.email.toLowerCase()
  let user = users.find((u) => String(u.email || '').toLowerCase() === email)
  if (!user) {
    user = {
      id: randomUUID(),
      name: spec.name,
      email: spec.email,
      passwordHash: bcrypt.hashSync(spec.password, 10),
      role: spec.role,
      isPrincipal: false,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...extra,
    }
    users.push(user)
    return users
  }
  user.name = user.name || spec.name
  user.email = user.email || spec.email
  user.role = spec.role
  user.active = true
  if (!user.passwordHash) {
    user.passwordHash = bcrypt.hashSync(spec.password, 10)
  }
  Object.assign(user, extra)
  const idx = users.findIndex((u) => u.id === user.id)
  users[idx] = user
  return users
}

export function ensureSeedData() {
  let userTypes = readJson('userTypes.json', [])
  if (!userTypes.length) {
    userTypes = DEFAULT_USER_TYPES.map((type) => ({
      ...normalizeUserType(type),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    writeJson('userTypes.json', userTypes)
  } else {
    let changed = false
    for (const def of DEFAULT_USER_TYPES) {
      const idx = userTypes.findIndex((t) => t.id === def.id)
      if (idx < 0) {
        userTypes.push({
          ...normalizeUserType(def),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        changed = true
        continue
      }
      const normalized = normalizeUserType(userTypes[idx])
      const defNormalized = normalizeUserType(def)
      let typeChanged = false
      for (const moduleId of Object.keys(defNormalized.modules)) {
        const current = normalized.modules[moduleId]
        const fallback = defNormalized.modules[moduleId]
        if (!current?.view && !current?.edit && (fallback?.view || fallback?.edit)) {
          normalized.modules[moduleId] = fallback
          typeChanged = true
        }
      }
      if (typeChanged) {
        userTypes[idx] = { ...normalized, updatedAt: new Date().toISOString() }
        changed = true
      }
    }
    const normalizedAll = userTypes.map((type) => ({
      ...normalizeUserType(type),
      createdAt: type.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    if (JSON.stringify(normalizedAll) !== JSON.stringify(userTypes)) {
      writeJson('userTypes.json', normalizedAll)
    }
  }

  const typeByRole = Object.fromEntries(
    DEFAULT_USER_TYPES.filter((t) => t.roleLegacy).map((t) => [t.roleLegacy, t.id]),
  )

  let users = readJson('users.json', [])
  let principal = users.find((u) => u.email === PRINCIPAL.email || u.isPrincipal)

  if (!principal) {
    principal = {
      id: randomUUID(),
      name: PRINCIPAL.name,
      email: PRINCIPAL.email,
      passwordHash: bcrypt.hashSync(PRINCIPAL.password, 10),
      role: 'administrador',
      isPrincipal: true,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    users.push(principal)
    console.log(`Usuario principal creado: ${PRINCIPAL.email} / ${PRINCIPAL.password}`)
  } else {
    principal.isPrincipal = true
    principal.role = 'administrador'
    principal.active = true
    principal.name = principal.name || PRINCIPAL.name
    principal.email = principal.email || PRINCIPAL.email
    if (!principal.passwordHash) {
      principal.passwordHash = bcrypt.hashSync(PRINCIPAL.password, 10)
    }
    const idx = users.findIndex((u) => u.id === principal.id)
    users[idx] = principal
  }

  users = upsertUser(users, ADMIN)
  for (const demo of DEMO_USERS) {
    users = upsertUser(users, demo)
  }

  users = users.map((user) => {
    if (user.userTypeId) return user
    const typeId = typeByRole[user.role]
    if (!typeId) return user
    return { ...user, userTypeId: typeId }
  })

  writeJson('users.json', users)

  readJson('machines.json', [])
  readJson('repairs.json', [])
  readJson('records.json', [])
  readJson('documents.json', [])

  const defaultCategories = [
    'Motoniveladora',
    'Cargador frontal',
    'Camioneta',
    'Camión Liviano',
  ]
  const categories = readJson('categories.json', [])
  if (!categories.length) {
    writeJson(
      'categories.json',
      defaultCategories.map((name) => ({
        id: randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    )
  } else {
    // Asegura que existan las categorías base si faltan
    const names = new Set(categories.map((c) => String(c.name).toLowerCase()))
    let changed = false
    for (const name of defaultCategories) {
      if (!names.has(name.toLowerCase())) {
        categories.push({
          id: randomUUID(),
          name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        changed = true
      }
    }
    if (changed) writeJson('categories.json', categories)
  }

  return { principalEmail: PRINCIPAL.email, defaultPassword: PRINCIPAL.password }
}
