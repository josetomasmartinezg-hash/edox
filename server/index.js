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
  publicUser,
  roleCan,
  worstDocumentStatus,
} from './constants.js'
import { authOptional, authRequired, requirePermission, signToken } from './auth.js'
import { ensureSeedData } from './seed.js'
import { dataDir, readJson, uploadsDir, writeJson } from './store.js'
import { isPautaFile, parsePautaFile, pautaSummary } from './parsePauta.js'

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
app.use('/uploads', express.static(uploadsDir))
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
  res.json({ token, user: publicUser(user) })
})

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({
    user: req.user,
    permissions: {
      admin_panel: req.user.isPrincipal || roleCan(req.user.role, 'admin_panel'),
      manage_users: req.user.isPrincipal || roleCan(req.user.role, 'manage_users'),
      manage_machines: req.user.isPrincipal || roleCan(req.user.role, 'manage_machines'),
      view_machines: req.user.isPrincipal || roleCan(req.user.role, 'view_machines'),
      manage_maintenance: req.user.isPrincipal || roleCan(req.user.role, 'manage_maintenance'),
      view_maintenance: req.user.isPrincipal || roleCan(req.user.role, 'view_maintenance'),
      manage_documents: req.user.isPrincipal || roleCan(req.user.role, 'manage_documents'),
      view_documents: req.user.isPrincipal || roleCan(req.user.role, 'view_documents'),
      field_form: req.user.isPrincipal || roleCan(req.user.role, 'field_form'),
      view_all_records: req.user.isPrincipal || roleCan(req.user.role, 'view_all_records'),
    },
  })
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
    !roleCan(req.user.role, 'field_form') &&
    !roleCan(req.user.role, 'view_all_records') &&
    !roleCan(req.user.role, 'admin_panel')
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
  const { name, email, password, role } = req.body || {}
  if (!name?.trim() || !email?.trim() || !password || !role) {
    return res.status(400).json({ error: 'Nombre, correo, contraseña y perfil son obligatorios' })
  }
  if (!ROLES.some((r) => r.id === role)) {
    return res.status(400).json({ error: 'Perfil inválido' })
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
    role,
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

  const updated = {
    ...current,
    name: req.body.name?.trim() || current.name,
    email: nextEmail,
    role: req.body.role || current.role,
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
  const machines = readJson('machines.json', []).map(normalizeMachine)
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
  const machine = readJson('machines.json', []).find((m) => m.id === req.params.id)
  if (!machine) return res.status(404).json({ error: 'Máquina no encontrada' })
  res.json(await withQr(normalizeMachine(machine)))
})

app.get(
  '/api/machines/:id/historial',
  authRequired,
  requirePermission('view_machines'),
  async (req, res) => {
    const machine = readJson('machines.json', []).find((m) => m.id === req.params.id)
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
    pautaUpload.single('file')(req, res, (err) => {
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
  requirePermission('manage_documents'),
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
  requirePermission('manage_documents'),
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

/* ─── Maintenance ─── */
app.get(
  '/api/maintenance',
  authRequired,
  requirePermission('view_maintenance'),
  (_req, res) => {
    const items = readJson('maintenance.json', []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    res.json(items)
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
    } = req.body || {}

    if (!sigla?.trim() && !machineId) {
      return res.status(400).json({ error: 'Debes seleccionar un equipo (sigla)' })
    }
    if (!tipoMantenimiento?.trim() && !intervaloId) {
      return res.status(400).json({ error: 'Intervalo de mantenimiento obligatorio' })
    }
    if (!horometro && horometro !== 0) {
      return res.status(400).json({ error: 'Horómetro obligatorio' })
    }

    const machines = readJson('machines.json', [])
    const machine =
      machines.find((m) => m.id === machineId) ||
      machines.find((m) => m.sigla.toUpperCase() === String(sigla).trim().toUpperCase())

    const taskRows = Array.isArray(tareas)
      ? tareas
          .filter((t) => t && t.id && t.label)
          .map((t) => ({
            id: String(t.id),
            label: String(t.label),
            realizado: t.realizado === true || t.realizado === 'true',
          }))
      : []

    if (!taskRows.some((t) => t.realizado)) {
      return res.status(400).json({ error: 'Debes marcar al menos una tarea realizada' })
    }

    const item = {
      id: randomUUID(),
      machineId: machine?.id || machineId || null,
      sigla: machine?.sigla || String(sigla).trim().toUpperCase(),
      tipoMantenimiento: String(tipoMantenimiento || intervaloId).trim(),
      intervaloId: intervaloId || null,
      horometro: String(horometro).trim(),
      tareas: taskRows,
      observaciones: String(observaciones || '').trim(),
      mecanicoId: req.user.id,
      mecanicoNombre: req.user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const all = readJson('maintenance.json', [])
    all.push(item)
    writeJson('maintenance.json', all)
    res.status(201).json(item)
  },
)

app.delete(
  '/api/maintenance/:id',
  authRequired,
  requirePermission('manage_maintenance'),
  (req, res) => {
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

/* ─── Field records (combustible / parte diario) ─── */
app.get('/api/records', authRequired, (req, res) => {
  let records = readJson('records.json', [])
  const canAll = req.user.isPrincipal || roleCan(req.user.role, 'view_all_records')
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
    mecanicoId: user.id,
    mecanicoNombre: record.operador || user.name,
    createdAt: idx >= 0 ? all[idx].createdAt : record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) all[idx] = item
  else all.push(item)
  writeJson('maintenance.json', all)
}

app.post('/api/records', authRequired, upload.single('photo'), (req, res) => {
  const canWrite =
    req.user.isPrincipal ||
    roleCan(req.user.role, 'field_form') ||
    roleCan(req.user.role, 'manage_maintenance') ||
    roleCan(req.user.role, 'view_all_records')
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
    userId: req.user.id,
    photoUrl: req.file ? `/uploads/${req.file.filename}` : payload.photoUrl || null,
    syncedAt: new Date().toISOString(),
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (existing >= 0) {
    records[existing] = { ...records[existing], ...record }
  } else {
    records.push(record)
  }

  writeJson('records.json', records)
  syncMaintenanceFromFieldRecord(record, req.user)
  res.status(201).json(record)
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
  app.use(express.static(dist))
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Edox API en http://0.0.0.0:${PORT}`)
  console.log(`Login principal: ${seedInfo.principalEmail} / ${seedInfo.defaultPassword}`)
  console.log(`Data dir: ${dataDir}`)
})
