import express from 'express'
import cors from 'cors'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  MAINTENANCE_INTERVALS,
  ROLES,
  documentStatus,
  permissionsFor,
  publicUser,
  worstDocumentStatus,
} from './constants.js'
import {
  MODULES,
  canAssignMaintenance,
  canAssignRepairs,
  canSeeAllMaintenance,
  canSeeAllRepairs,
  repairsScope,
  getUserTypeById,
  legacyPermissions,
  normalizeUserType,
  publicUserType,
  readUserTypes,
  userCan,
  userHasLegacyPermission,
  maintenanceScope,
} from './permissions.js'
import {
  authOptional,
  authRequired,
  requireAnyPermission,
  requirePermission,
  signToken,
} from './auth.js'
import { ensureSeedData } from './seed.js'
import { dataDir, readJson, uploadsDir, writeJson } from './store.js'
import { isPautaFile, parsePautaFile, pautaSummary } from './parsePauta.js'
import {
  buildMaintenanceAssignmentPdf,
  maintenancePdfFilename,
} from './maintenancePdf.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const seedInfo = ensureSeedData()

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${Date.now()}-${randomUUID()}${ext}`)
  },
})

function isImageOrPdf(file) {
  const name = String(file?.originalname || '')
  const mime = String(file?.mimetype || '')
  return (
    mime.startsWith('image/') ||
    mime === 'application/pdf' ||
    /\.(pdf|png|jpe?g|webp|gif)$/i.test(name)
  )
}

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isImageOrPdf(file)) return cb(new Error('Solo se permiten PDF o imágenes'))
    cb(null, true)
  },
})

const documentUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isImageOrPdf(file) || isPautaFile(file)) return cb(null, true)
    return cb(new Error('Solo se permiten PDF, Excel o imágenes'))
  },
})

const pautaUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isPautaFile(file)) return cb(new Error('Solo se permiten PDF o Excel'))
    cb(null, true)
  },
})

const pautaParseUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!isPautaFile(file)) return cb(new Error('Solo se permiten PDF o Excel'))
    cb(null, true)
  },
})

function unlinkUpload(fileUrl) {
  if (!fileUrl) return
  const filePath = path.join(uploadsDir, path.basename(fileUrl))
  if (!fs.existsSync(filePath)) return
  try {
    fs.unlinkSync(filePath)
  } catch {
    // ignore delete errors
  }
}

function upsertPautaDocument(machine, file, user) {
  const docs = readJson('documents.json', [])
  const existing = docs.find((d) => d.machineId === machine.id && d.kind === 'pauta')
  if (existing?.fileUrl) unlinkUpload(existing.fileUrl)
  if (machine.pautaFileUrl && machine.pautaFileUrl !== existing?.fileUrl) {
    unlinkUpload(machine.pautaFileUrl)
  }

  const doc = {
    id: existing?.id || randomUUID(),
    name: 'Pauta de mantenimiento',
    kind: 'pauta',
    machineId: machine.id,
    sigla: machine.sigla,
    expiresAt: null,
    fileUrl: `/uploads/${file.filename}`,
    fileName: file.originalname,
    mimeType: file.mimetype,
    uploadedById: user?.id,
    uploadedByName: user?.name,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (existing) {
    docs[docs.findIndex((d) => d.id === existing.id)] = doc
  } else {
    docs.push(doc)
  }
  writeJson('documents.json', docs)
  return doc
}

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '15mb' }))
app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders(res, filePath) {
      if (/\.pdf$/i.test(filePath)) {
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', 'inline')
      }
    },
  }),
)
app.use(authOptional)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    principal: seedInfo.principalEmail,
  })
})

app.get('/api/meta', (_req, res) => {
  res.json({
    roles: ROLES,
    maintenanceIntervals: MAINTENANCE_INTERVALS,
  })
})

/* ─── Auth ─── */
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase()
  const password = String(req.body.password || '')
  const users = readJson('users.json', [])
  const user = users.find((u) => u.email.toLowerCase() === email && u.active !== false)
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' })
  }
  const token = signToken(user)
  const publicProfile = publicUser(user)
  res.json({ token, user: publicProfile, permissions: legacyPermissions(publicProfile) })
})

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({
    user: req.user,
    permissions: legacyPermissions(req.user),
  })
})

function devToolsEnabled() {
  return process.env.NODE_ENV !== 'production'
}

/** Perfiles disponibles para cambiar de usuario en desarrollo */
app.get('/api/auth/switch-users', authRequired, (req, res) => {
  if (!devToolsEnabled()) return res.status(404).json({ error: 'No disponible' })
  const users = readJson('users.json', [])
    .filter((u) => u.active !== false)
    .map(publicUser)
    .sort((a, b) => {
      const roleOrder = ['administrador', 'supervisor', 'mecanico', 'operador', 'operador_surtidor']
      const ra = roleOrder.indexOf(a.role)
      const rb = roleOrder.indexOf(b.role)
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name, 'es')
    })
  res.json(users)
})

/** Cambia la sesión a otro usuario (solo desarrollo) */
app.post('/api/auth/switch', authRequired, (req, res) => {
  if (!devToolsEnabled()) return res.status(404).json({ error: 'No disponible' })
  const userId = String(req.body.userId || '')
  const users = readJson('users.json', [])
  const user = users.find((u) => u.id === userId && u.active !== false)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  res.json({ token: signToken(user), user: publicUser(user) })
})

/* ─── User types ─── */
app.get('/api/user-types', authRequired, requirePermission('manage_users'), (_req, res) => {
  res.json(readUserTypes().map(publicUserType))
})

app.get('/api/user-types/meta', authRequired, requirePermission('manage_users'), (_req, res) => {
  res.json({ modules: MODULES })
})

app.post('/api/user-types', authRequired, requirePermission('manage_users'), (req, res) => {
  const { name, description, modules } = req.body || {}
  if (!name?.trim()) {
    return res.status(400).json({ error: 'El nombre del tipo es obligatorio' })
  }
  const types = readUserTypes()
  const normalized = normalizeUserType({
    id: randomUUID(),
    name: String(name).trim(),
    description: String(description || '').trim(),
    system: false,
    modules,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  types.push(normalized)
  writeJson('userTypes.json', types)
  res.status(201).json(publicUserType(normalized))
})

app.put('/api/user-types/:id', authRequired, requirePermission('manage_users'), (req, res) => {
  const types = readJson('userTypes.json', [])
  const idx = types.findIndex((t) => t.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Tipo no encontrado' })

  const current = normalizeUserType(types[idx])
  const updated = normalizeUserType({
    ...current,
    name: req.body.name?.trim() || current.name,
    description:
      req.body.description != null ? String(req.body.description).trim() : current.description,
    modules: req.body.modules != null ? req.body.modules : current.modules,
    updatedAt: new Date().toISOString(),
  })
  types[idx] = updated
  writeJson('userTypes.json', types)
  res.json(publicUserType(updated))
})

app.delete('/api/user-types/:id', authRequired, requirePermission('manage_users'), (req, res) => {
  const types = readJson('userTypes.json', [])
  const type = types.find((t) => t.id === req.params.id)
  if (!type) return res.status(404).json({ error: 'Tipo no encontrado' })
  if (type.system) {
    return res.status(400).json({ error: 'No se pueden eliminar tipos del sistema' })
  }
  const users = readJson('users.json', [])
  if (users.some((u) => u.userTypeId === type.id)) {
    return res.status(400).json({ error: 'Hay usuarios con este tipo. Reasígnalos antes de eliminar.' })
  }
  writeJson(
    'userTypes.json',
    types.filter((t) => t.id !== req.params.id),
  )
  res.json({ ok: true })
})

/* ─── Users ─── */
app.get('/api/users', authRequired, requirePermission('manage_users'), (_req, res) => {
  const users = readJson('users.json', []).map(publicUser)
  res.json(users)
})

/** Lista liviana para selects de operador (sin datos sensibles) */
app.get('/api/operators', authRequired, (req, res) => {
  if (
    !req.user.isPrincipal &&
    !userHasLegacyPermission(req.user, 'field_form') &&
    !userHasLegacyPermission(req.user, 'view_all_records') &&
    !userHasLegacyPermission(req.user, 'admin_panel')
  ) {
    return res.status(403).json({ error: 'Sin permiso' })
  }
  const operators = readJson('users.json', [])
    .filter((u) => u.active !== false)
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' }))
  res.json(operators)
})

app.post('/api/users', authRequired, requirePermission('manage_users'), (req, res) => {
  const { name, email, password, userTypeId, role } = req.body || {}
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' })
  }

  const types = readUserTypes()
  let resolvedTypeId = userTypeId
  if (!resolvedTypeId && role) {
    resolvedTypeId = types.find((t) => t.roleLegacy === role)?.id
  }
  const userType = getUserTypeById(resolvedTypeId)
  if (!userType) {
    return res.status(400).json({ error: 'Selecciona un tipo de usuario válido' })
  }

  const users = readJson('users.json', [])
  const normalized = String(email).trim().toLowerCase()
  if (users.some((u) => u.email.toLowerCase() === normalized)) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' })
  }

  const user = {
    id: randomUUID(),
    name: String(name).trim(),
    email: normalized,
    passwordHash: bcrypt.hashSync(String(password), 10),
    role: userType.roleLegacy || 'operador',
    userTypeId: userType.id,
    isPrincipal: false,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  users.push(user)
  writeJson('users.json', users)
  res.status(201).json(publicUser(user))
})

app.put('/api/users/:id', authRequired, requirePermission('manage_users'), (req, res) => {
  const users = readJson('users.json', [])
  const idx = users.findIndex((u) => u.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Usuario no encontrado' })

  const current = users[idx]
  if (current.isPrincipal && req.body.role && req.body.role !== 'administrador') {
    return res.status(400).json({ error: 'El usuario principal debe ser Administrador' })
  }
  if (current.isPrincipal && req.body.active === false) {
    return res.status(400).json({ error: 'No se puede desactivar al usuario principal' })
  }

  const nextEmail = req.body.email
    ? String(req.body.email).trim().toLowerCase()
    : current.email
  if (
    users.some((u) => u.id !== current.id && u.email.toLowerCase() === nextEmail)
  ) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' })
  }

  const types = readUserTypes()
  let nextTypeId = req.body.userTypeId || current.userTypeId
  if (!nextTypeId && req.body.role) {
    nextTypeId = types.find((t) => t.roleLegacy === req.body.role)?.id
  }
  const userType = getUserTypeById(nextTypeId)

  const updated = {
    ...current,
    name: req.body.name?.trim() || current.name,
    email: nextEmail,
    userTypeId: userType?.id || current.userTypeId,
    role: userType?.roleLegacy || req.body.role || current.role,
    active: typeof req.body.active === 'boolean' ? req.body.active : current.active,
    updatedAt: new Date().toISOString(),
  }
  if (req.body.password) {
    updated.passwordHash = bcrypt.hashSync(String(req.body.password), 10)
  }
  if (updated.isPrincipal) {
    updated.role = 'administrador'
    updated.active = true
  }

  users[idx] = updated
  writeJson('users.json', users)
  res.json(publicUser(updated))
})

app.delete('/api/users/:id', authRequired, requirePermission('manage_users'), (req, res) => {
  const users = readJson('users.json', [])
  const user = users.find((u) => u.id === req.params.id)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (user.isPrincipal) {
    return res.status(400).json({ error: 'No se puede eliminar al usuario principal' })
  }
  writeJson(
    'users.json',
    users.filter((u) => u.id !== req.params.id),
  )
  res.json({ ok: true })
})

/* ─── Machines ─── */
function machineQrPayload(machine) {
  return `EDOX|MACHINE|${machine.sigla}|${machine.id}`
}

async function withQr(machine) {
  if (!machine) return machine
  if (machine.qrDataUrl) return machine
  const qrDataUrl = await QRCode.toDataURL(machineQrPayload(machine), {
    margin: 1,
    width: 320,
    color: { dark: '#1f2937', light: '#ffffff' },
  })
  return { ...machine, qrPayload: machineQrPayload(machine), qrDataUrl }
}

function normalizeSigla(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

function normalizePauta(pauta) {
  if (!Array.isArray(pauta)) return []
  return pauta
    .map((tipo) => ({
      id: String(tipo?.id || randomUUID()),
      nombre: String(tipo?.nombre || '').trim(),
      items: Array.isArray(tipo?.items)
        ? tipo.items
            .map((item) => ({
              id: String(item?.id || randomUUID()),
              label: String(item?.label || '').trim(),
            }))
            .filter((item) => item.label)
        : [],
    }))
    .filter((tipo) => tipo.nombre && tipo.items.length)
}

async function parsePautaFromDisk(machine) {
  const fileUrl = machine?.pautaFileUrl
  if (!fileUrl) return []
  const filePath = path.join(uploadsDir, path.basename(fileUrl))
  if (!fs.existsSync(filePath)) return []
  try {
    const buffer = fs.readFileSync(filePath)
    return normalizePauta(
      await parsePautaFile({
        buffer,
        originalname: machine.pautaFileName || path.basename(fileUrl),
        mimetype: machine.pautaMimeType || '',
      }),
    )
  } catch {
    return []
  }
}

async function ensureMachinePauta(machine) {
  const existing = normalizePauta(machine.pauta)
  if (existing.length) {
    return { machine: { ...machine, pauta: existing }, saved: false }
  }
  const parsed = await parsePautaFromDisk(machine)
  if (!parsed.length) {
    return { machine: { ...machine, pauta: existing }, saved: false }
  }
  return {
    machine: { ...machine, pauta: parsed, updatedAt: new Date().toISOString() },
    saved: true,
  }
}

async function persistEnsuredPauta(list) {
  let changed = false
  const next = []
  for (const machine of list) {
    const result = await ensureMachinePauta(machine)
    next.push(result.machine)
    if (result.saved) changed = true
  }
  if (changed) writeJson('machines.json', next)
  return next
}

function withMachinePautaMeta(item, machines) {
  const machine =
    machines.find((m) => m.id === item.machineId) ||
    machines.find((m) => normalizeSigla(m.sigla) === normalizeSigla(item.sigla))
  const stored = normalizePauta(item.pauta)
  return {
    ...item,
    pauta: stored.length ? stored : normalizePauta(machine?.pauta),
    pautaFileUrl: item.pautaFileUrl || machine?.pautaFileUrl || null,
    pautaFileName: item.pautaFileName || machine?.pautaFileName || '',
    pautaMimeType: item.pautaMimeType || machine?.pautaMimeType || '',
  }
}

function normalizeMachine(machine) {
  const categories = readJson('categories.json', [])
  const category =
    categories.find((c) => c.id === machine.categoriaId) ||
    categories.find(
      (c) =>
        String(c.name).toLowerCase() === String(machine.categoria || '').toLowerCase(),
    )
  return {
    ...machine,
    numeroChasis: machine.numeroChasis || '',
    numeroMotor: machine.numeroMotor || '',
    capacidadEstanque: machine.capacidadEstanque || '',
    capacidadEstanque2: machine.capacidadEstanque2 || '',
    categoriaId: category?.id || machine.categoriaId || '',
    categoria: category?.name || machine.categoria || '',
    pauta: normalizePauta(machine.pauta),
    pautaFileUrl: machine.pautaFileUrl || null,
    pautaFileName: machine.pautaFileName || '',
    pautaMimeType: machine.pautaMimeType || '',
  }
}

function resolveCategory(categoriaId, categoriaName) {
  const categories = readJson('categories.json', [])
  if (categoriaId) {
    const byId = categories.find((c) => c.id === categoriaId)
    if (byId) return byId
  }
  if (categoriaName?.trim()) {
    return (
      categories.find(
        (c) => String(c.name).toLowerCase() === String(categoriaName).trim().toLowerCase(),
      ) || null
    )
  }
  return null
}

function machineDocumentAlert(machineId, sigla) {
  const docs = readJson('documents.json', []).filter(
    (d) =>
      d.kind !== 'pauta' &&
      (d.machineId === machineId ||
      normalizeSigla(d.sigla) === normalizeSigla(sigla)),
  )
  const statuses = docs.map((d) => documentStatus(d.expiresAt))
  return {
    documentAlert: worstDocumentStatus(statuses),
    documentsCount: docs.length,
    expiredCount: statuses.filter((s) => s === 'expired').length,
    soonCount: statuses.filter((s) => s === 'soon').length,
  }
}

app.get('/api/machines', authRequired, requirePermission('view_machines'), async (_req, res) => {
  const machines = (await persistEnsuredPauta(readJson('machines.json', []))).map(normalizeMachine)
  const withCodes = await Promise.all(
    machines.map(async (machine) => {
      const withCode = await withQr(machine)
      return { ...withCode, ...machineDocumentAlert(machine.id, machine.sigla) }
    }),
  )
  res.json(
    withCodes.sort((a, b) => a.sigla.localeCompare(b.sigla, 'es', { sensitivity: 'base' })),
  )
})

app.get('/api/machines/:id', authRequired, requirePermission('view_machines'), async (req, res) => {
  const all = await persistEnsuredPauta(readJson('machines.json', []))
  const machine = all.find((m) => m.id === req.params.id)
  if (!machine) return res.status(404).json({ error: 'Máquina no encontrada' })
  res.json(await withQr(normalizeMachine(machine)))
})

app.get(
  '/api/machines/:id/historial',
  authRequired,
  requirePermission('view_machines'),
  async (req, res) => {
    const all = await persistEnsuredPauta(readJson('machines.json', []))
    const machine = all.find((m) => m.id === req.params.id)
    if (!machine) return res.status(404).json({ error: 'Máquina no encontrada' })

    const sigla = normalizeSigla(machine.sigla)
    const records = readJson('records.json', [])
      .filter((r) => normalizeSigla(r.maquina) === sigla)
      .map((r) => ({
        id: r.id,
        kind: 'combustible',
        title: 'Parte / combustible',
        fecha: r.fecha || r.createdAt,
        createdAt: r.createdAt,
        operador: r.operador || r.firmaOperador || '—',
        litrosEnEstanque: r.litrosEnEstanque || '',
        litrosCargados: r.litrosCargados || '',
        guiaNumero: r.guiaNumero || '',
        horasInicial: r.horasInicial || '',
        horasFinal: r.horasFinal || '',
        observaciones: r.observaciones || '',
        photoUrl: r.photoUrl || null,
      }))

    const maintenances = readJson('maintenance.json', [])
      .filter(
        (m) =>
          m.machineId === machine.id || normalizeSigla(m.sigla) === sigla,
      )
      .map((m) => ({
        id: m.id,
        kind: 'mantenimiento',
        title: m.tipoMantenimiento || 'Mantenimiento',
        fecha: m.createdAt,
        createdAt: m.createdAt,
        horometro: m.horometro || '',
        mecanicoNombre: m.mecanicoNombre || '—',
        tareas: m.tareas || [],
        observaciones: m.observaciones || '',
      }))

    const documents = readJson('documents.json', [])
      .filter(
        (d) =>
          d.machineId === machine.id || normalizeSigla(d.sigla) === sigla,
      )
      .map((d) => ({
        ...d,
        status: documentStatus(d.expiresAt),
      }))

    const timeline = [...records, ...maintenances].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

    res.json({
      machine: {
        ...(await withQr(normalizeMachine(machine))),
        ...machineDocumentAlert(machine.id, machine.sigla),
      },
      resumen: {
        totalRegistros: records.length,
        totalMantenimientos: maintenances.length,
        totalDocumentos: documents.length,
        ultimoRegistro: timeline[0]?.createdAt || null,
      },
      documents,
      timeline,
    })
  },
)

/* ─── Categories ─── */
app.get('/api/categories', authRequired, requirePermission('view_machines'), (_req, res) => {
  const categories = readJson('categories.json', []).sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' }),
  )
  res.json(categories)
})

app.post('/api/categories', authRequired, requirePermission('manage_machines'), (req, res) => {
  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' })

  const categories = readJson('categories.json', [])
  if (categories.some((c) => String(c.name).toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: 'Ya existe esa categoría' })
  }

  const category = {
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  categories.push(category)
  writeJson('categories.json', categories)
  res.status(201).json(category)
})

app.put('/api/categories/:id', authRequired, requirePermission('manage_machines'), (req, res) => {
  const categories = readJson('categories.json', [])
  const idx = categories.findIndex((c) => c.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Categoría no encontrada' })

  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' })
  if (
    categories.some(
      (c) => c.id !== req.params.id && String(c.name).toLowerCase() === name.toLowerCase(),
    )
  ) {
    return res.status(409).json({ error: 'Ya existe esa categoría' })
  }

  const previousName = categories[idx].name
  categories[idx] = {
    ...categories[idx],
    name,
    updatedAt: new Date().toISOString(),
  }
  writeJson('categories.json', categories)

  // Actualiza nombre en máquinas que usen esta categoría
  const machines = readJson('machines.json', [])
  let changed = false
  for (const machine of machines) {
    if (machine.categoriaId === categories[idx].id || machine.categoria === previousName) {
      machine.categoriaId = categories[idx].id
      machine.categoria = name
      machine.updatedAt = new Date().toISOString()
      changed = true
    }
  }
  if (changed) writeJson('machines.json', machines)

  res.json(categories[idx])
})

app.delete('/api/categories/:id', authRequired, requirePermission('manage_machines'), (req, res) => {
  const categories = readJson('categories.json', [])
  const category = categories.find((c) => c.id === req.params.id)
  if (!category) return res.status(404).json({ error: 'Categoría no encontrada' })

  const machines = readJson('machines.json', [])
  const inUse = machines.some(
    (m) => m.categoriaId === category.id || m.categoria === category.name,
  )
  if (inUse) {
    return res.status(400).json({
      error: 'No se puede eliminar: hay maquinaria usando esta categoría',
    })
  }

  writeJson(
    'categories.json',
    categories.filter((c) => c.id !== req.params.id),
  )
  res.json({ ok: true })
})

app.post(
  '/api/pauta/parse',
  authRequired,
  requirePermission('manage_machines'),
  (req, res) => {
    pautaParseUpload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Error al leer el archivo' })
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Debes subir un PDF o un Excel de la pauta' })
      }
      try {
        const pauta = await parsePautaFile(req.file)
        const summary = pautaSummary(pauta)
        if (!summary.items) {
          return res.status(422).json({
            error:
              'No se detectaron ítems en el archivo. Revisa que sea una pauta (PDF o Excel) e inténtalo de nuevo, o cárgala a mano.',
            pauta: [],
            ...summary,
          })
        }
        res.json({
          pauta,
          fileName: req.file.originalname,
          ...summary,
        })
      } catch (error) {
        res.status(400).json({ error: error.message || 'No se pudo leer la pauta' })
      }
    })
  },
)

app.post(
  '/api/machines/:id/pauta-file',
  authRequired,
  requirePermission('manage_machines'),
  (req, res) => {
    pautaUpload.single('file')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Error al subir la pauta' })
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Debes subir un PDF o un Excel de la pauta' })
      }

      const machines = readJson('machines.json', [])
      const idx = machines.findIndex((m) => m.id === req.params.id)
      if (idx < 0) {
        unlinkUpload(`/uploads/${req.file.filename}`)
        return res.status(404).json({ error: 'Máquina no encontrada' })
      }

      const machine = machines[idx]
      const doc = upsertPautaDocument(machine, req.file, req.user)
      machine.pautaFileUrl = doc.fileUrl
      machine.pautaFileName = doc.fileName
      machine.pautaMimeType = doc.mimeType
      try {
        const parsed = await parsePautaFromDisk(machine)
        if (parsed.length) machine.pauta = parsed
      } catch {
        // keep existing pauta if the file cannot be parsed
      }
      machine.updatedAt = new Date().toISOString()
      machines[idx] = machine
      writeJson('machines.json', machines)
      res.json({
        machine: normalizeMachine(machine),
        document: { ...doc, status: documentStatus(doc.expiresAt) },
      })
    })
  },
)

app.post('/api/machines', authRequired, requirePermission('manage_machines'), async (req, res) => {
  const {
    marca,
    modelo,
    anio,
    sigla,
    capacidadEstanque,
    capacidadEstanque2,
    numeroChasis,
    numeroMotor,
    categoriaId,
    categoria,
    pauta,
    generateQr = true,
  } = req.body || {}
  if (!marca?.trim() || !modelo?.trim() || !sigla?.trim()) {
    return res.status(400).json({ error: 'Marca, modelo y sigla son obligatorios' })
  }

  const category = resolveCategory(categoriaId, categoria)
  if (!category) {
    return res.status(400).json({ error: 'Debes seleccionar una categoría' })
  }

  const machines = readJson('machines.json', [])
  const normalizedSigla = String(sigla).trim().toUpperCase()
  if (machines.some((m) => m.sigla.toUpperCase() === normalizedSigla)) {
    return res.status(409).json({ error: 'Ya existe una máquina con esa sigla' })
  }

  const machine = {
    id: randomUUID(),
    marca: String(marca).trim(),
    modelo: String(modelo).trim(),
    anio: String(anio || '').trim(),
    sigla: normalizedSigla,
    capacidadEstanque: String(capacidadEstanque || '')
      .replace(/[^\d]/g, '')
      .trim(),
    capacidadEstanque2: String(capacidadEstanque2 || '')
      .replace(/[^\d]/g, '')
      .trim(),
    numeroChasis: String(numeroChasis || '').trim(),
    numeroMotor: String(numeroMotor || '').trim(),
    categoriaId: category.id,
    categoria: category.name,
    pauta: normalizePauta(pauta),
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    qrPayload: null,
    qrDataUrl: null,
  }

  if (generateQr) {
    machine.qrPayload = machineQrPayload(machine)
    machine.qrDataUrl = await QRCode.toDataURL(machine.qrPayload, {
      margin: 1,
      width: 320,
      color: { dark: '#1f2937', light: '#ffffff' },
    })
  }

  machines.push(machine)
  writeJson('machines.json', machines)
  res.status(201).json(machine)
})

app.put('/api/machines/:id', authRequired, requirePermission('manage_machines'), async (req, res) => {
  const machines = readJson('machines.json', [])
  const idx = machines.findIndex((m) => m.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Máquina no encontrada' })

  const current = machines[idx]
  const nextSigla = req.body.sigla
    ? String(req.body.sigla).trim().toUpperCase()
    : current.sigla

  if (
    machines.some((m) => m.id !== current.id && m.sigla.toUpperCase() === nextSigla)
  ) {
    return res.status(409).json({ error: 'Ya existe una máquina con esa sigla' })
  }

  const nextCategory =
    req.body.categoriaId || req.body.categoria
      ? resolveCategory(req.body.categoriaId, req.body.categoria)
      : resolveCategory(current.categoriaId, current.categoria)

  if ((req.body.categoriaId || req.body.categoria) && !nextCategory) {
    return res.status(400).json({ error: 'Categoría inválida' })
  }

  const updated = {
    ...current,
    marca: req.body.marca?.trim() || current.marca,
    modelo: req.body.modelo?.trim() || current.modelo,
    anio: req.body.anio != null ? String(req.body.anio).trim() : current.anio,
    sigla: nextSigla,
    capacidadEstanque:
      req.body.capacidadEstanque != null
        ? String(req.body.capacidadEstanque).replace(/[^\d]/g, '').trim()
        : current.capacidadEstanque,
    capacidadEstanque2:
      req.body.capacidadEstanque2 != null
        ? String(req.body.capacidadEstanque2).replace(/[^\d]/g, '').trim()
        : current.capacidadEstanque2 || '',
    numeroChasis:
      req.body.numeroChasis != null
        ? String(req.body.numeroChasis).trim()
        : current.numeroChasis || '',
    numeroMotor:
      req.body.numeroMotor != null
        ? String(req.body.numeroMotor).trim()
        : current.numeroMotor || '',
    categoriaId: nextCategory?.id || current.categoriaId || '',
    categoria: nextCategory?.name || current.categoria || '',
    pauta: req.body.pauta != null ? normalizePauta(req.body.pauta) : normalizePauta(current.pauta),
    active: typeof req.body.active === 'boolean' ? req.body.active : current.active,
    updatedAt: new Date().toISOString(),
  }

  if (req.body.generateQr || nextSigla !== current.sigla || !current.qrDataUrl) {
    updated.qrPayload = machineQrPayload(updated)
    updated.qrDataUrl = await QRCode.toDataURL(updated.qrPayload, {
      margin: 1,
      width: 320,
      color: { dark: '#1f2937', light: '#ffffff' },
    })
  }

  machines[idx] = updated
  writeJson('machines.json', machines)
  res.json(updated)
})

app.post(
  '/api/machines/:id/qr',
  authRequired,
  requirePermission('manage_machines'),
  async (req, res) => {
    const machines = readJson('machines.json', [])
    const idx = machines.findIndex((m) => m.id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'Máquina no encontrada' })

    const machine = machines[idx]
    machine.qrPayload = machineQrPayload(machine)
    machine.qrDataUrl = await QRCode.toDataURL(machine.qrPayload, {
      margin: 1,
      width: 320,
      color: { dark: '#1f2937', light: '#ffffff' },
    })
    machine.updatedAt = new Date().toISOString()
    machines[idx] = machine
    writeJson('machines.json', machines)
    res.json(machine)
  },
)

app.delete('/api/machines/:id', authRequired, requirePermission('manage_machines'), (req, res) => {
  const machines = readJson('machines.json', [])
  if (!machines.some((m) => m.id === req.params.id)) {
    return res.status(404).json({ error: 'Máquina no encontrada' })
  }
  writeJson(
    'machines.json',
    machines.filter((m) => m.id !== req.params.id),
  )
  res.json({ ok: true })
})

/* ─── Documents ─── */
app.get(
  '/api/documents',
  authRequired,
  requirePermission('view_documents'),
  (_req, res) => {
    const docs = readJson('documents.json', [])
      .map((d) => ({ ...d, status: documentStatus(d.expiresAt) }))
      .sort((a, b) => {
        const rank = { expired: 0, soon: 1, ok: 2 }
        const ra = rank[a.status] ?? 3
        const rb = rank[b.status] ?? 3
        if (ra !== rb) return ra - rb
        return String(a.expiresAt || '9999').localeCompare(String(b.expiresAt || '9999'))
      })
    res.json(docs)
  },
)

app.post(
  '/api/documents',
  authRequired,
  requireAnyPermission('manage_documents', 'manage_machines'),
  (req, res) => {
    documentUpload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Error al subir archivo' })
      }

      const { name, machineId, sigla, expiresAt } = req.body || {}
      if (!name?.trim()) {
        return res.status(400).json({ error: 'El nombre del documento es obligatorio' })
      }
      if (!machineId && !sigla?.trim()) {
        return res.status(400).json({ error: 'Debes seleccionar un equipo' })
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Debes subir un PDF, Excel o una foto' })
      }

      const machines = readJson('machines.json', [])
      const machine =
        machines.find((m) => m.id === machineId) ||
        machines.find((m) => normalizeSigla(m.sigla) === normalizeSigla(sigla))

      if (!machine) {
        return res.status(404).json({ error: 'Equipo no encontrado' })
      }

      const doc = {
        id: randomUUID(),
        name: String(name).trim(),
        machineId: machine.id,
        sigla: machine.sigla,
        expiresAt: expiresAt ? String(expiresAt).trim() : null,
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        uploadedById: req.user.id,
        uploadedByName: req.user.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const all = readJson('documents.json', [])
      all.push(doc)
      writeJson('documents.json', all)
      res.status(201).json({ ...doc, status: documentStatus(doc.expiresAt) })
    })
  },
)

app.delete(
  '/api/documents/:id',
  authRequired,
  requireAnyPermission('manage_documents', 'manage_machines'),
  (req, res) => {
    const all = readJson('documents.json', [])
    const doc = all.find((d) => d.id === req.params.id)
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' })

    if (doc.fileUrl) unlinkUpload(doc.fileUrl)

    if (doc.kind === 'pauta' && doc.machineId) {
      const machines = readJson('machines.json', [])
      const idx = machines.findIndex((m) => m.id === doc.machineId)
      if (idx >= 0 && machines[idx].pautaFileUrl === doc.fileUrl) {
        machines[idx].pautaFileUrl = null
        machines[idx].pautaFileName = ''
        machines[idx].pautaMimeType = ''
        machines[idx].updatedAt = new Date().toISOString()
        writeJson('machines.json', machines)
      }
    }

    writeJson(
      'documents.json',
      all.filter((d) => d.id !== req.params.id),
    )
    res.json({ ok: true })
  },
)

function maintenanceStatusFromTasks(tareas, requested, hasAssignee = false) {
  if (
    requested === 'completed' ||
    requested === 'assigned' ||
    requested === 'pending' ||
    requested === 'in_progress'
  ) {
    return requested === 'pending' && hasAssignee ? 'assigned' : requested
  }
  const list = Array.isArray(tareas) ? tareas : []
  if (!list.length) return hasAssignee ? 'assigned' : 'pending'
  if (list.every((t) => t.realizado)) return 'completed'
  if (list.some((t) => t.realizado)) return 'in_progress'
  return hasAssignee ? 'assigned' : 'pending'
}

function normalizeMaintenance(item) {
  const tareas = Array.isArray(item?.tareas) ? item.tareas : []
  const hasAssignee = !!(item?.asignadoId || item?.mecanicoId)
  let status = item?.status
  if (!status) {
    status = tareas.some((t) => t.realizado)
      ? tareas.every((t) => t.realizado)
        ? 'completed'
        : 'in_progress'
      : hasAssignee
        ? 'assigned'
        : 'pending'
  } else if (status === 'pending' && hasAssignee && !tareas.some((t) => t.realizado)) {
    status = 'assigned'
  }
  return {
    ...item,
    status,
    horometro: item?.horometro || '',
    instrucciones: item?.instrucciones || '',
    observaciones: item?.observaciones || '',
    asignadoId: item?.asignadoId || item?.mecanicoId || null,
    asignadoNombre: item?.asignadoNombre || item?.mecanicoNombre || '',
    asignadoRole: item?.asignadoRole || '',
    asignadoPorId: item?.asignadoPorId || '',
    asignadoPorNombre: item?.asignadoPorNombre || '',
    comentarios: Array.isArray(item?.comentarios) ? item.comentarios : [],
    fotos: Array.isArray(item?.fotos)
      ? item.fotos.map((f) => ({
          id: String(f?.id || randomUUID()),
          url: String(f?.url || ''),
          fileName: String(f?.fileName || ''),
          kind: f?.kind === 'dano' ? 'dano' : 'prueba',
          caption: String(f?.caption || '').trim(),
          uploadedById: String(f?.uploadedById || ''),
          uploadedByName: String(f?.uploadedByName || ''),
          createdAt: f?.createdAt || new Date().toISOString(),
        }))
      : [],
    pauta: Array.isArray(item?.pauta) ? item.pauta : [],
    pautaFileUrl: item?.pautaFileUrl || null,
    pautaFileName: item?.pautaFileName || '',
    pautaMimeType: item?.pautaMimeType || '',
  }
}

function mapTareas(tareas) {
  if (!Array.isArray(tareas)) return []
  return tareas
    .filter((t) => t && (t.id || t.label))
    .map((t) => ({
      id: String(t.id || randomUUID()),
      label: String(t.label || '').trim(),
      realizado: t.realizado === true || t.realizado === 'true',
    }))
    .filter((t) => t.label)
}

function flattenPautaToTareas(pauta) {
  const tipos = Array.isArray(pauta) ? pauta : []
  const rows = []
  for (const tipo of tipos) {
    for (const item of tipo.items || []) {
      const label = String(item?.label || '').trim()
      if (!label) continue
      rows.push({
        id: String(item.id || randomUUID()),
        label,
        tipoId: String(tipo.id || ''),
        tipoNombre: String(tipo.nombre || '').trim(),
        realizado: false,
      })
    }
  }
  return rows
}

function pautaItemsForTipo(machine, intervaloId, tipoNombre) {
  const tipos = Array.isArray(machine?.pauta) ? machine.pauta : []
  const current =
    tipos.find((t) => t.id === intervaloId) ||
    tipos.find(
      (t) =>
        String(t.nombre || '').trim().toLowerCase() ===
        String(tipoNombre || '').trim().toLowerCase(),
    ) ||
    tipos[0]
  if (!current) return []
  return (current.items || [])
    .filter((item) => String(item?.label || '').trim())
    .map((item) => ({
      id: String(item.id || randomUUID()),
      label: String(item.label).trim(),
      realizado: false,
    }))
}

function resolveAssignee(asignadoId) {
  if (!asignadoId) return null
  const users = readJson('users.json', [])
  const user = users.find((u) => u.id === asignadoId && u.active !== false)
  if (!user) return null
  if (!userCan(user, 'mantenimiento', 'view') && !user.isPrincipal) return null
  return user
}

function isAssignedMaintenanceOnly(user) {
  return maintenanceScope(user) === 'assigned' && !canAssignMaintenance(user)
}

function canUpdateMaintenance(user, item) {
  if (!user) return false
  if (user.isPrincipal || canAssignMaintenance(user)) return true
  if (maintenanceScope(user) === 'assigned') return item.asignadoId === user.id
  return userCan(user, 'mantenimiento', 'edit')
}

function normalizeRepair(raw) {
  if (!raw) return raw
  return {
    ...raw,
    status: raw.status || 'assigned',
    fotos: Array.isArray(raw.fotos) ? raw.fotos : [],
    comentarios: Array.isArray(raw.comentarios) ? raw.comentarios : [],
  }
}

function repairStatusFromBody(requested, hasAssignee = false) {
  if (
    requested === 'completed' ||
    requested === 'assigned' ||
    requested === 'pending' ||
    requested === 'in_progress'
  ) {
    return requested === 'pending' && hasAssignee ? 'assigned' : requested
  }
  return hasAssignee ? 'assigned' : 'in_progress'
}

function resolveRepairAssignee(asignadoId) {
  if (!asignadoId) return null
  const users = readJson('users.json', [])
  const user = users.find((u) => u.id === asignadoId && u.active !== false)
  if (!user) return null
  if (!userCan(user, 'reparaciones', 'view') && !user.isPrincipal) return null
  return user
}

function isAssignedRepairOnly(user) {
  return repairsScope(user) === 'assigned' && !canAssignRepairs(user)
}

function canUpdateRepair(user, item) {
  if (!user) return false
  if (user.isPrincipal || canAssignRepairs(user)) return true
  if (repairsScope(user) === 'assigned') return item.asignadoId === user.id
  return userCan(user, 'reparaciones', 'edit')
}

/* ─── Maintenance ─── */
app.get(
  '/api/maintenance',
  authRequired,
  requirePermission('view_maintenance'),
  (req, res) => {
    let items = readJson('maintenance.json', []).map(normalizeMaintenance)
    const machines = readJson('machines.json', [])
    items = items.map((item) => withMachinePautaMeta(item, machines))
    if (!canSeeAllMaintenance(req.user)) {
      items = items.filter((m) => m.asignadoId === req.user.id)
    }
    const rank = { assigned: 0, pending: 0, in_progress: 1, completed: 2 }
    items.sort((a, b) => {
      const ra = rank[a.status] ?? 3
      const rb = rank[b.status] ?? 3
      if (ra !== rb) return ra - rb
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    })
    res.json(items)
  },
)

app.get(
  '/api/maintenance/:id/pdf',
  authRequired,
  requirePermission('view_maintenance'),
  async (req, res) => {
    const all = readJson('maintenance.json', [])
    const raw = all.find((m) => m.id === req.params.id)
    if (!raw) return res.status(404).json({ error: 'Registro no encontrado' })

    const item = normalizeMaintenance(raw)
    const canDownload =
      canSeeAllMaintenance(req.user) ||
      canAssignMaintenance(req.user) ||
      item.asignadoId === req.user.id

    if (!canDownload) {
      return res.status(403).json({ error: 'No tienes permiso para descargar este PDF' })
    }

    const machines = readJson('machines.json', [])
    const machine =
      machines.find((m) => m.id === item.machineId) ||
      machines.find((m) => m.sigla?.toUpperCase() === String(item.sigla).trim().toUpperCase()) ||
      null

    try {
      const pdf = await buildMaintenanceAssignmentPdf(item, machine)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${maintenancePdfFilename(item)}"`,
      )
      res.send(pdf)
    } catch {
      res.status(500).json({ error: 'No se pudo generar el PDF' })
    }
  },
)

app.post(
  '/api/maintenance',
  authRequired,
  requirePermission('manage_maintenance'),
  (req, res) => {
    const {
      machineId,
      sigla,
      tipoMantenimiento,
      intervaloId,
      horometro,
      tareas = [],
      observaciones,
      instrucciones,
      asignadoId,
      status,
    } = req.body || {}

    if (!sigla?.trim() && !machineId) {
      return res.status(400).json({ error: 'Debes seleccionar un equipo (sigla)' })
    }

    const isAssignment =
      !!asignadoId || req.user.isPrincipal || canAssignMaintenance(req.user)

    if (isAssignedMaintenanceOnly(req.user)) {
      return res.status(403).json({ error: 'Solo un supervisor puede crear mantenimientos. Revisa los que te asignaron.' })
    }

    if (isAssignment && !intervaloId) {
      return res.status(400).json({ error: 'Selecciona el tipo de mantenimiento de la pauta del equipo' })
    }

    const machines = readJson('machines.json', [])
    const machine =
      machines.find((m) => m.id === machineId) ||
      machines.find((m) => m.sigla.toUpperCase() === String(sigla).trim().toUpperCase())

    const pautaSnap = normalizePauta(req.body.pauta != null ? req.body.pauta : machine?.pauta)
    let taskRows = mapTareas(tareas)
    if (!taskRows.length && intervaloId) {
      taskRows = pautaItemsForTipo(machine, intervaloId, tipoMantenimiento)
    }
    if (!taskRows.length && !isAssignment) {
      taskRows = flattenPautaToTareas(pautaSnap)
    }
    if (!taskRows.length) {
      return res.status(400).json({ error: 'Este equipo no tiene pauta. Súbela en PDF o Excel al crear la máquina.' })
    }

    const assigningToOther = asignadoId && asignadoId !== req.user.id
    if (assigningToOther && !req.user.isPrincipal && !canAssignMaintenance(req.user)) {
      return res.status(403).json({ error: 'No puedes asignar mantenimientos a otros usuarios' })
    }

    const assignee = resolveAssignee(asignadoId) || req.user
    const nextStatus = maintenanceStatusFromTasks(
      taskRows,
      status || (asignadoId ? 'assigned' : undefined),
      !!(assignee?.id && asignadoId),
    )

    if (nextStatus === 'completed' && !String(horometro || '').trim()) {
      return res.status(400).json({ error: 'Ingresa el kilometraje u horómetro para completar' })
    }

    const selectedTipoPauta = intervaloId
      ? pautaSnap.filter((t) => t.id === intervaloId)
      : pautaSnap
    const selectedTipo = selectedTipoPauta[0] || null

    const item = {
      id: randomUUID(),
      machineId: machine?.id || machineId || null,
      sigla: machine?.sigla || String(sigla).trim().toUpperCase(),
      tipoMantenimiento: String(
        tipoMantenimiento || selectedTipo?.nombre || machine?.pautaFileName || 'Pauta',
      ).trim(),
      intervaloId: intervaloId || null,
      pauta: selectedTipoPauta.length ? selectedTipoPauta : pautaSnap,
      pautaFileUrl: machine?.pautaFileUrl || null,
      pautaFileName: machine?.pautaFileName || '',
      pautaMimeType: machine?.pautaMimeType || '',
      horometro: String(horometro || '').trim(),
      tareas: taskRows,
      observaciones: String(observaciones || '').trim(),
      instrucciones: String(instrucciones || '').trim(),
      status: nextStatus,
      asignadoId: assignee.id,
      asignadoNombre: assignee.name,
      asignadoRole: assignee.role,
      asignadoPorId: req.user.id,
      asignadoPorNombre: req.user.name,
      comentarios: [],
      mecanicoId: assignee.id,
      mecanicoNombre: assignee.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const all = readJson('maintenance.json', [])
    all.push(item)
    writeJson('maintenance.json', all)
    res.status(201).json(normalizeMaintenance(item))
  },
)

app.put(
  '/api/maintenance/:id',
  authRequired,
  requirePermission('view_maintenance'),
  (req, res) => {
    const all = readJson('maintenance.json', [])
    const idx = all.findIndex((m) => m.id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'Registro no encontrado' })

    const current = normalizeMaintenance(all[idx])
    if (!canUpdateMaintenance(req.user, current)) {
      return res.status(403).json({ error: 'Este mantenimiento no está asignado a ti' })
    }

    const taskRows =
      req.body.tareas != null ? mapTareas(req.body.tareas) : current.tareas || []
    const nextStatus = maintenanceStatusFromTasks(
      taskRows,
      req.body.status,
      !!(current.asignadoId || current.mecanicoId),
    )
    const horometro =
      req.body.horometro != null ? String(req.body.horometro).trim() : current.horometro

    if (nextStatus === 'completed' && !horometro) {
      return res.status(400).json({ error: 'Ingresa el kilometraje u horómetro para completar' })
    }

    let comentarios = current.comentarios || []
    const extra = String(req.body.comentario || '').trim()
    if (extra) {
      comentarios = [
        ...comentarios,
        {
          id: randomUUID(),
          texto: extra,
          autorId: req.user.id,
          autorNombre: req.user.name,
          createdAt: new Date().toISOString(),
        },
      ]
    }

    let assignee = {
      asignadoId: current.asignadoId,
      asignadoNombre: current.asignadoNombre,
      asignadoRole: current.asignadoRole,
      mecanicoId: current.mecanicoId,
      mecanicoNombre: current.mecanicoNombre,
    }
    if (req.body.asignadoId && (req.user.isPrincipal || canAssignMaintenance(req.user))) {
      const nextAssignee = resolveAssignee(req.body.asignadoId)
      if (!nextAssignee) {
        return res.status(400).json({ error: 'El asignado debe ser mecánico o supervisor' })
      }
      assignee = {
        asignadoId: nextAssignee.id,
        asignadoNombre: nextAssignee.name,
        asignadoRole: nextAssignee.role,
        mecanicoId: nextAssignee.id,
        mecanicoNombre: nextAssignee.name,
      }
    }

    const updated = {
      ...current,
      ...assignee,
      horometro,
      tareas: taskRows,
      observaciones:
        req.body.observaciones != null
          ? String(req.body.observaciones).trim()
          : current.observaciones,
      instrucciones:
        req.body.instrucciones != null
          ? String(req.body.instrucciones).trim()
          : current.instrucciones,
      pauta:
        req.body.pauta != null ? normalizePauta(req.body.pauta) : current.pauta,
      pautaFileUrl: current.pautaFileUrl,
      pautaFileName: current.pautaFileName,
      pautaMimeType: current.pautaMimeType,
      status: nextStatus,
      comentarios,
      updatedAt: new Date().toISOString(),
    }

    all[idx] = updated
    writeJson('maintenance.json', all)
    res.json(normalizeMaintenance(updated))
  },
)

app.post(
  '/api/maintenance/:id/photos',
  authRequired,
  requirePermission('view_maintenance'),
  upload.single('photo'),
  (req, res) => {
    const all = readJson('maintenance.json', [])
    const idx = all.findIndex((m) => m.id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'Registro no encontrado' })

    const current = normalizeMaintenance(all[idx])
    if (!canUpdateMaintenance(req.user, current)) {
      return res.status(403).json({ error: 'Este mantenimiento no está asignado a ti' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Debes subir una fotografía' })
    }

    const kind = req.body?.kind === 'dano' ? 'dano' : 'prueba'
    const photo = {
      id: randomUUID(),
      url: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname || req.file.filename,
      kind,
      caption: String(req.body?.caption || '').trim(),
      uploadedById: req.user.id,
      uploadedByName: req.user.name,
      createdAt: new Date().toISOString(),
    }

    let status = current.status
    if (status === 'assigned' || status === 'pending') status = 'in_progress'

    const updated = {
      ...current,
      fotos: [...(current.fotos || []), photo],
      status,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    writeJson('maintenance.json', all)
    res.status(201).json(normalizeMaintenance(updated))
  },
)

app.delete(
  '/api/maintenance/:id/photos/:photoId',
  authRequired,
  requirePermission('view_maintenance'),
  (req, res) => {
    const all = readJson('maintenance.json', [])
    const idx = all.findIndex((m) => m.id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'Registro no encontrado' })

    const current = normalizeMaintenance(all[idx])
    if (!canUpdateMaintenance(req.user, current)) {
      return res.status(403).json({ error: 'Este mantenimiento no está asignado a ti' })
    }

    const photo = (current.fotos || []).find((f) => f.id === req.params.photoId)
    if (!photo) return res.status(404).json({ error: 'Foto no encontrada' })

    unlinkUpload(photo.url)

    const updated = {
      ...current,
      fotos: (current.fotos || []).filter((f) => f.id !== req.params.photoId),
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    writeJson('maintenance.json', all)
    res.json(normalizeMaintenance(updated))
  },
)

app.delete(
  '/api/maintenance/:id',
  authRequired,
  requirePermission('view_maintenance'),
  (req, res) => {
    if (!userCan(req.user, 'mantenimiento', 'delete')) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar mantenimientos' })
    }
    const all = readJson('maintenance.json', [])
    if (!all.some((m) => m.id === req.params.id)) {
      return res.status(404).json({ error: 'Registro no encontrado' })
    }
    writeJson(
      'maintenance.json',
      all.filter((m) => m.id !== req.params.id),
    )
    res.json({ ok: true })
  },
)

/* ─── Repairs ─── */
app.get('/api/repairs', authRequired, requirePermission('view_repairs'), (req, res) => {
  let items = readJson('repairs.json', []).map(normalizeRepair)
  if (!canSeeAllRepairs(req.user)) {
    items = items.filter((r) => r.asignadoId === req.user.id)
  }
  const rank = { assigned: 0, pending: 0, in_progress: 1, completed: 2 }
  items.sort((a, b) => {
    const ra = rank[a.status] ?? 3
    const rb = rank[b.status] ?? 3
    if (ra !== rb) return ra - rb
    return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  })
  res.json(items)
})

app.post('/api/repairs', authRequired, requirePermission('manage_repairs'), (req, res) => {
  const { machineId, sigla, titulo, descripcion, horometro, observaciones, asignadoId, status } =
    req.body || {}

  if (!sigla?.trim() && !machineId) {
    return res.status(400).json({ error: 'Debes seleccionar un equipo' })
  }
  if (!String(titulo || '').trim()) {
    return res.status(400).json({ error: 'El título de la reparación es obligatorio' })
  }
  if (!String(descripcion || '').trim()) {
    return res.status(400).json({ error: 'Describe la falla o trabajo a realizar' })
  }
  if (isAssignedRepairOnly(req.user)) {
    return res.status(403).json({ error: 'Solo un supervisor puede crear reparaciones. Revisa las que te asignaron.' })
  }
  if (!asignadoId) {
    return res.status(400).json({ error: 'Asigna la reparación a un mecánico o supervisor' })
  }

  const machines = readJson('machines.json', [])
  const machine =
    machines.find((m) => m.id === machineId) ||
    machines.find((m) => m.sigla.toUpperCase() === String(sigla).trim().toUpperCase())

  const assigningToOther = asignadoId && asignadoId !== req.user.id
  if (assigningToOther && !req.user.isPrincipal && !canAssignRepairs(req.user)) {
    return res.status(403).json({ error: 'No puedes asignar reparaciones a otros usuarios' })
  }

  const assignee = resolveRepairAssignee(asignadoId)
  if (!assignee) {
    return res.status(400).json({ error: 'El asignado debe ser mecánico o supervisor' })
  }

  const nextStatus = repairStatusFromBody(status || 'assigned', true)
  if (nextStatus === 'completed' && !String(horometro || '').trim()) {
    return res.status(400).json({ error: 'Ingresa el horómetro para completar' })
  }

  const item = {
    id: randomUUID(),
    machineId: machine?.id || machineId || null,
    sigla: machine?.sigla || String(sigla).trim().toUpperCase(),
    titulo: String(titulo).trim(),
    descripcion: String(descripcion).trim(),
    horometro: String(horometro || '').trim(),
    observaciones: String(observaciones || '').trim(),
    status: nextStatus,
    asignadoId: assignee.id,
    asignadoNombre: assignee.name,
    asignadoRole: assignee.role,
    asignadoPorId: req.user.id,
    asignadoPorNombre: req.user.name,
    comentarios: [],
    fotos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const all = readJson('repairs.json', [])
  all.push(item)
  writeJson('repairs.json', all)
  res.status(201).json(normalizeRepair(item))
})

app.put('/api/repairs/:id', authRequired, requirePermission('view_repairs'), (req, res) => {
  const all = readJson('repairs.json', [])
  const idx = all.findIndex((r) => r.id === req.params.id)
  if (idx < 0) return res.status(404).json({ error: 'Registro no encontrado' })

  const current = normalizeRepair(all[idx])
  if (!canUpdateRepair(req.user, current)) {
    return res.status(403).json({ error: 'Esta reparación no está asignada a ti' })
  }

  const nextStatus = repairStatusFromBody(req.body.status, !!current.asignadoId)
  const horometro =
    req.body.horometro != null ? String(req.body.horometro).trim() : current.horometro || ''

  if (nextStatus === 'completed' && !horometro) {
    return res.status(400).json({ error: 'Ingresa el horómetro para completar' })
  }

  let comentarios = current.comentarios || []
  const extra = String(req.body.comentario || '').trim()
  if (extra) {
    comentarios = [
      ...comentarios,
      {
        id: randomUUID(),
        texto: extra,
        autorId: req.user.id,
        autorNombre: req.user.name,
        createdAt: new Date().toISOString(),
      },
    ]
  }

  let assignee = {
    asignadoId: current.asignadoId,
    asignadoNombre: current.asignadoNombre,
    asignadoRole: current.asignadoRole,
  }
  if (req.body.asignadoId && (req.user.isPrincipal || canAssignRepairs(req.user))) {
    const nextAssignee = resolveRepairAssignee(req.body.asignadoId)
    if (!nextAssignee) {
      return res.status(400).json({ error: 'El asignado debe ser mecánico o supervisor' })
    }
    assignee = {
      asignadoId: nextAssignee.id,
      asignadoNombre: nextAssignee.name,
      asignadoRole: nextAssignee.role,
    }
  }

  const updated = {
    ...current,
    ...assignee,
    titulo: req.body.titulo != null ? String(req.body.titulo).trim() : current.titulo,
    descripcion:
      req.body.descripcion != null ? String(req.body.descripcion).trim() : current.descripcion,
    horometro,
    observaciones:
      req.body.observaciones != null
        ? String(req.body.observaciones).trim()
        : current.observaciones,
    status: nextStatus,
    comentarios,
    updatedAt: new Date().toISOString(),
  }

  all[idx] = updated
  writeJson('repairs.json', all)
  res.json(normalizeRepair(updated))
})

app.post(
  '/api/repairs/:id/photos',
  authRequired,
  requirePermission('view_repairs'),
  upload.single('photo'),
  (req, res) => {
    const all = readJson('repairs.json', [])
    const idx = all.findIndex((r) => r.id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'Registro no encontrado' })

    const current = normalizeRepair(all[idx])
    if (!canUpdateRepair(req.user, current)) {
      return res.status(403).json({ error: 'Esta reparación no está asignada a ti' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Debes subir una fotografía' })
    }

    const kind = req.body?.kind === 'dano' ? 'dano' : 'prueba'
    const photo = {
      id: randomUUID(),
      url: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname || req.file.filename,
      kind,
      caption: String(req.body?.caption || '').trim(),
      uploadedById: req.user.id,
      uploadedByName: req.user.name,
      createdAt: new Date().toISOString(),
    }

    let status = current.status
    if (status === 'assigned' || status === 'pending') status = 'in_progress'

    const updated = {
      ...current,
      fotos: [...(current.fotos || []), photo],
      status,
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    writeJson('repairs.json', all)
    res.status(201).json(normalizeRepair(updated))
  },
)

app.delete(
  '/api/repairs/:id/photos/:photoId',
  authRequired,
  requirePermission('view_repairs'),
  (req, res) => {
    const all = readJson('repairs.json', [])
    const idx = all.findIndex((r) => r.id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'Registro no encontrado' })

    const current = normalizeRepair(all[idx])
    if (!canUpdateRepair(req.user, current)) {
      return res.status(403).json({ error: 'Esta reparación no está asignada a ti' })
    }

    const photo = (current.fotos || []).find((p) => p.id === req.params.photoId)
    if (photo?.url) unlinkUpload(photo.url)

    const updated = {
      ...current,
      fotos: (current.fotos || []).filter((p) => p.id !== req.params.photoId),
      updatedAt: new Date().toISOString(),
    }
    all[idx] = updated
    writeJson('repairs.json', all)
    res.json(normalizeRepair(updated))
  },
)

app.delete('/api/repairs/:id', authRequired, requirePermission('view_repairs'), (req, res) => {
  if (!userCan(req.user, 'reparaciones', 'delete')) {
    return res.status(403).json({ error: 'No tienes permiso para eliminar reparaciones' })
  }
  const all = readJson('repairs.json', [])
  if (!all.some((r) => r.id === req.params.id)) {
    return res.status(404).json({ error: 'Registro no encontrado' })
  }
  writeJson(
    'repairs.json',
    all.filter((r) => r.id !== req.params.id),
  )
  res.json({ ok: true })
})

/* ─── Field records (combustible / parte diario) ─── */
app.get('/api/records', authRequired, (req, res) => {
  let records = readJson('records.json', [])
  const canAll = req.user.isPrincipal || userHasLegacyPermission(req.user, 'view_all_records')
  if (!canAll) {
    records = records.filter(
      (r) => r.userId === req.user.id || r.operador === req.user.name,
    )
  }
  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  res.json(records)
})

app.get('/api/records/:id', authRequired, (req, res) => {
  const record = readJson('records.json', []).find((r) => r.id === req.params.id)
  if (!record) return res.status(404).json({ error: 'No encontrado' })
  res.json(record)
})

function syncMaintenanceFromFieldRecord(record, user) {
  if (record.tipoRegistro !== 'mantenimiento') return

  const tareas = Array.isArray(record.mantenimiento)
    ? record.mantenimiento
        .filter((t) => t && (t.id || t.tipo || t.label))
        .map((t) => ({
          id: String(t.id || randomUUID()),
          label: String(t.tipo || t.label || '').trim(),
          realizado: t.realizado === true || t.realizado === 'true',
        }))
        .filter((t) => t.label)
    : []
  if (!tareas.some((t) => t.realizado)) return

  const machines = readJson('machines.json', [])
  const machine = machines.find(
    (m) => normalizeSigla(m.sigla) === normalizeSigla(record.maquina),
  )
  const tipoNombre =
    String(record.tipoMantenimiento || '').trim() ||
    (machine?.pauta || []).find((t) => t.id === record.intervaloMantenimiento)?.nombre ||
    String(record.intervaloMantenimiento || 'Pauta')

  const all = readJson('maintenance.json', [])
  const idx = all.findIndex((m) => m.fieldRecordId === record.id)
  const item = {
    id: idx >= 0 ? all[idx].id : randomUUID(),
    fieldRecordId: record.id,
    machineId: machine?.id || null,
    sigla: machine?.sigla || String(record.maquina || '').trim().toUpperCase(),
    tipoMantenimiento: tipoNombre,
    intervaloId: record.intervaloMantenimiento || null,
    horometro: String(record.horasInicial || '').trim() || '—',
    tareas,
    observaciones: String(record.observaciones || '').trim(),
    instrucciones: '',
    status: 'completed',
    asignadoId: user.id,
    asignadoNombre: record.operador || user.name,
    asignadoRole: user.role,
    asignadoPorId: user.id,
    asignadoPorNombre: user.name,
    pauta: normalizePauta(machine?.pauta),
    pautaFileUrl: machine?.pautaFileUrl || null,
    pautaFileName: machine?.pautaFileName || '',
    pautaMimeType: machine?.pautaMimeType || '',
    comentarios: idx >= 0 ? all[idx].comentarios || [] : [],
    mecanicoId: user.id,
    mecanicoNombre: record.operador || user.name,
    createdAt: idx >= 0 ? all[idx].createdAt : record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) all[idx] = item
  else all.push(item)
  writeJson('maintenance.json', all)
}

app.post('/api/records', authRequired, (req, res) => {
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'observacionPhotos', maxCount: 8 },
  ])(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error al subir archivos' })
    }

  const canWrite =
    req.user.isPrincipal ||
    userHasLegacyPermission(req.user, 'field_form') ||
    userHasLegacyPermission(req.user, 'manage_maintenance') ||
    userHasLegacyPermission(req.user, 'view_all_records')
  if (!canWrite) {
    return res.status(403).json({ error: 'No tienes permiso para registrar partes' })
  }

  let payload
  try {
    payload = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body
  } catch {
    return res.status(400).json({ error: 'JSON inválido' })
  }

  const records = readJson('records.json', [])
  const id = payload.id || randomUUID()
  const existing = records.findIndex((r) => r.id === id)
  const tipoRegistro = ['combustible', 'revision_diaria', 'mantenimiento'].includes(
    payload.tipoRegistro,
  )
    ? payload.tipoRegistro
    : 'combustible'

  const record = {
    ...payload,
    id,
    tipoRegistro,
    userId: payload.userId || req.user.id,
    photoUrl: req.files?.photo?.[0]
      ? `/uploads/${req.files.photo[0].filename}`
      : payload.photoUrl || null,
    observacionFotos: [
      ...(Array.isArray(payload.observacionFotos) ? payload.observacionFotos : []),
      ...(req.files?.observacionPhotos || []).map((file) => ({
        id: randomUUID(),
        url: `/uploads/${file.filename}`,
        fileName: file.originalname || file.filename,
        createdAt: new Date().toISOString(),
      })),
    ],
    syncStatus: 'synced',
    syncedAt: new Date().toISOString(),
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  delete record.photoDataUrl
  delete record.lastSyncError

  if (existing >= 0) {
    records[existing] = { ...records[existing], ...record }
  } else {
    records.push(record)
  }

  writeJson('records.json', records)
  syncMaintenanceFromFieldRecord(record, req.user)
  res.status(201).json(record)
  })
})

app.delete(
  '/api/records/:id',
  authRequired,
  requirePermission('view_all_records'),
  (req, res) => {
    const records = readJson('records.json', [])
    const next = records.filter((r) => r.id !== req.params.id)
    if (next.length === records.length) {
      return res.status(404).json({ error: 'No encontrado' })
    }
    writeJson('records.json', next)
    res.json({ ok: true })
  },
)

/* ─── Static frontend ─── */
const dist = path.join(root, 'dist')
if (fs.existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders(res, filePath) {
        const base = path.basename(filePath)
        if (
          base === 'index.html' ||
          base === 'sw.js' ||
          base === 'registerSW.js' ||
          base === 'manifest.webmanifest'
        ) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
        }
      },
    }),
  )
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/uploads/') || req.path.startsWith('/api/')) return next()
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Edox API en http://0.0.0.0:${PORT}`)
  console.log(`Login principal: ${seedInfo.principalEmail} / ${seedInfo.defaultPassword}`)
  console.log(`Data dir: ${dataDir}`)
})
