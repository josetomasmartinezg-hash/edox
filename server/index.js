import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dataDir = path.join(root, 'data')
const uploadsDir = path.join(dataDir, 'uploads')
const recordsFile = path.join(dataDir, 'records.json')

fs.mkdirSync(uploadsDir, { recursive: true })
if (!fs.existsSync(recordsFile)) {
  fs.writeFileSync(recordsFile, '[]', 'utf8')
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${Date.now()}-${randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
})

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '15mb' }))
app.use('/uploads', express.static(uploadsDir))

function readRecords() {
  try {
    return JSON.parse(fs.readFileSync(recordsFile, 'utf8'))
  } catch {
    return []
  }
}

function writeRecords(records) {
  fs.writeFileSync(recordsFile, JSON.stringify(records, null, 2), 'utf8')
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

app.get('/api/records', (_req, res) => {
  const records = readRecords().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  res.json(records)
})

app.get('/api/records/:id', (req, res) => {
  const record = readRecords().find((r) => r.id === req.params.id)
  if (!record) return res.status(404).json({ error: 'No encontrado' })
  res.json(record)
})

app.post('/api/records', upload.single('photo'), (req, res) => {
  let payload
  try {
    payload = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body
  } catch {
    return res.status(400).json({ error: 'JSON inválido' })
  }

  const records = readRecords()
  const id = payload.id || randomUUID()
  const existing = records.findIndex((r) => r.id === id)

  const record = {
    ...payload,
    id,
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

  writeRecords(records)
  res.status(201).json(record)
})

app.delete('/api/records/:id', (req, res) => {
  const records = readRecords()
  const next = records.filter((r) => r.id !== req.params.id)
  if (next.length === records.length) {
    return res.status(404).json({ error: 'No encontrado' })
  }
  writeRecords(next)
  res.json({ ok: true })
})

const dist = path.join(root, 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Edox API en http://0.0.0.0:${PORT}`)
})
