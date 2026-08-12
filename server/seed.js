import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
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
  writeJson('users.json', users)

  readJson('machines.json', [])
  readJson('maintenance.json', [])
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
