import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { readJson, writeJson } from './store.js'

const PRINCIPAL = {
  email: 'josetomasmartinezg@gmail.com',
  name: 'Jose Tomas Martinez',
  password: 'Edox2026!',
  role: 'administrador',
}

export function ensureSeedData() {
  const users = readJson('users.json', [])
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
    writeJson('users.json', users)
    console.log(`Usuario principal creado: ${PRINCIPAL.email} / ${PRINCIPAL.password}`)
  } else {
    // Asegura privilegios totales del principal
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
    writeJson('users.json', users)
  }

  readJson('machines.json', [])
  readJson('maintenance.json', [])
  readJson('records.json', [])

  return { principalEmail: PRINCIPAL.email, defaultPassword: PRINCIPAL.password }
}
