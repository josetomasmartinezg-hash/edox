import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const PRODUCTS_PATH = path.join(root, 'data', 'products.json')
const ORDERS_PATH = path.join(root, 'data', 'orders.json')

const app = express()
const PORT = Number(process.env.PORT || 8787)
const ENV_PATH = path.join(root, '.env')

/**
 * Node --env-file a veces pierde valores negativos (chat ids de grupos).
 * Leemos .env a mano como fallback.
 */
function readEnvFileValue(key) {
  try {
    if (!fs.existsSync(ENV_PATH)) return ''
    const raw = fs.readFileSync(ENV_PATH, 'utf8')
    for (const line of raw.split(/\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx < 0) continue
      if (trimmed.slice(0, idx) !== key) continue
      let value = trimmed.slice(idx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      return value
    }
  } catch {
    /* ignore */
  }
  return ''
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || readEnvFileValue('TELEGRAM_BOT_TOKEN') || ''
/** Puede mutar si Telegram migra el grupo a supergrupo. */
let CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || readEnvFileValue('TELEGRAM_CHAT_ID') || '').trim()
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || readEnvFileValue('ADMIN_PASSWORD') || 'stackd-admin'
const BOT_USERNAME = (
  process.env.TELEGRAM_BOT_USERNAME ||
  process.env.VITE_TELEGRAM_BOT_USERNAME ||
  readEnvFileValue('TELEGRAM_BOT_USERNAME') ||
  'ADVAULTCL_BOT'
).replace(/^@/, '')

function persistChatId(nextId) {
  const value = String(nextId || '').trim()
  if (!value) return
  CHAT_ID = value
  try {
    if (!fs.existsSync(ENV_PATH)) return
    const raw = fs.readFileSync(ENV_PATH, 'utf8')
    const line = `TELEGRAM_CHAT_ID="${value}"`
    const next = raw.includes('TELEGRAM_CHAT_ID=')
      ? raw.replace(/^TELEGRAM_CHAT_ID=.*$/m, line)
      : `${raw.trimEnd()}\n${line}\n`
    fs.writeFileSync(ENV_PATH, next, 'utf8')
    console.log(`Telegram chat_id actualizado a ${value}`)
  } catch (error) {
    console.error('No se pudo persistir TELEGRAM_CHAT_ID', error)
  }
}

/** @type {Map<string, number>} */
const adminTokens = new Map()

app.use(cors())
app.use(express.json({ limit: '100kb' }))

function readProducts() {
  const raw = fs.readFileSync(PRODUCTS_PATH, 'utf8')
  return JSON.parse(raw)
}

function writeProducts(products) {
  fs.mkdirSync(path.dirname(PRODUCTS_PATH), { recursive: true })
  fs.writeFileSync(PRODUCTS_PATH, `${JSON.stringify(products, null, 2)}\n`, 'utf8')
}

function readOrders() {
  try {
    if (!fs.existsSync(ORDERS_PATH)) return []
    const raw = fs.readFileSync(ORDERS_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOrders(orders) {
  fs.mkdirSync(path.dirname(ORDERS_PATH), { recursive: true })
  fs.writeFileSync(ORDERS_PATH, `${JSON.stringify(orders, null, 2)}\n`, 'utf8')
}

function paymentCategory(method) {
  const value = String(method || '').toLowerCase()
  if (value.includes('paypal')) return 'paypal'
  if (value.includes('usdt') || value.includes('trc') || value.includes('bep')) return 'usdt'
  return 'other'
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'completed' || value === 'completado' || value === 'done') return 'completed'
  return 'pending'
}

function buildStats(orders) {
  const total = orders.length
  const usdt = orders.filter((o) => o.paymentCategory === 'usdt')
  const paypal = orders.filter((o) => o.paymentCategory === 'paypal')
  const completed = orders.filter((o) => normalizeStatus(o.status) === 'completed')
  const pending = orders.filter((o) => normalizeStatus(o.status) !== 'completed')
  const sum = (list) => list.reduce((acc, o) => acc + Number(o.amountDue || 0), 0)
  return {
    totalOrders: total,
    usdtOrders: usdt.length,
    paypalOrders: paypal.length,
    otherOrders: orders.filter((o) => o.paymentCategory === 'other').length,
    completedOrders: completed.length,
    pendingOrders: pending.length,
    totalRevenue: Number(sum(orders).toFixed(2)),
    usdtRevenue: Number(sum(usdt).toFixed(2)),
    paypalRevenue: Number(sum(paypal).toFixed(2)),
    completedRevenue: Number(sum(completed).toFixed(2)),
    pendingRevenue: Number(sum(pending).toFixed(2)),
  }
}

function saveIncomingOrder(body) {
  const orderId = String(body.orderId || '').trim()
  if (!orderId) throw new Error('Falta orderId')

  const paymentMethod = String(body.paymentMethod || 'Desconocido')
  const amountDue = Number(body.amountDue)
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {}
  const lines = Array.isArray(body.lines) ? body.lines : []

  const orders = readOrders()
  const existing = orders.findIndex((o) => o.id === orderId)
  const previous = existing >= 0 ? orders[existing] : null
  const record = {
    id: orderId,
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: previous ? normalizeStatus(previous.status) : 'pending',
    paymentMethod,
    paymentCategory: paymentCategory(paymentMethod),
    amountDue: Number.isFinite(amountDue) ? Number(amountDue.toFixed(2)) : 0,
    subtotal: Number.isFinite(Number(body.subtotal)) ? Number(Number(body.subtotal).toFixed(2)) : undefined,
    customer: {
      name: String(customer.name || ''),
      email: String(customer.email || ''),
      telegram: String(customer.telegram || '').replace(/^@/, ''),
      notes: String(customer.notes || ''),
    },
    lines: lines.map((line) => ({
      productId: String(line.productId || line.id || ''),
      name: String(line.name || line.productName || ''),
      qty: Number(line.qty || 0),
      price: Number(line.price || 0),
    })),
  }

  if (existing >= 0) orders[existing] = record
  else orders.unshift(record)

  writeOrders(orders.slice(0, 2000))
  return record
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  const expires = adminTokens.get(token)
  if (!token || !expires || expires < Date.now()) {
    if (token) adminTokens.delete(token)
    res.status(401).json({ ok: false, error: 'No autorizado' })
    return
  }
  next()
}

function sanitizeProducts(input) {
  if (!Array.isArray(input)) throw new Error('products debe ser un array')
  const current = readProducts()
  const byId = new Map(current.map((item) => [item.id, item]))

  return input.map((row) => {
    const base = byId.get(row.id)
    if (!base) throw new Error(`Producto desconocido: ${row.id}`)
    const price = Number(row.price)
    const stock = Number(row.stock)
    if (!Number.isFinite(price) || price < 0) throw new Error(`Precio inválido en ${row.id}`)
    if (!Number.isInteger(stock) || stock < 0) throw new Error(`Stock inválido en ${row.id}`)

    const oldPriceRaw = row.oldPrice
    const oldPrice =
      oldPriceRaw === '' || oldPriceRaw === null || oldPriceRaw === undefined
        ? undefined
        : Number(oldPriceRaw)
    if (oldPrice !== undefined && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
      throw new Error(`Precio anterior inválido en ${row.id}`)
    }

    const next = {
      ...base,
      price: Math.round(price * 100) / 100,
      stock,
      badge: typeof row.badge === 'string' && row.badge.trim() ? row.badge.trim() : base.badge,
      name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : base.name,
    }
    if (oldPrice !== undefined) next.oldPrice = Math.round(oldPrice * 100) / 100
    else delete next.oldPrice
    return next
  })
}

function configured() {
  return Boolean(BOT_TOKEN && CHAT_ID)
}

async function telegramApi(method, body) {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN no configurado')
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) {
    const err = new Error(data.description || `Telegram API error (${method})`)
    err.code = data.error_code
    err.parameters = data.parameters
    throw err
  }
  return data
}

async function notifyAdmin(text, parseMode = 'HTML') {
  if (!configured()) {
    const err = new Error('Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID')
    err.code = 'NOT_CONFIGURED'
    throw err
  }
  const payload = {
    chat_id: CHAT_ID,
    text,
    disable_web_page_preview: true,
  }
  if (parseMode) payload.parse_mode = parseMode

  try {
    return await telegramApi('sendMessage', payload)
  } catch (error) {
    const migrated = error?.parameters?.migrate_to_chat_id
    if (migrated) {
      persistChatId(migrated)
      payload.chat_id = CHAT_ID
      return telegramApi('sendMessage', payload)
    }
    throw error
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    telegramConfigured: configured(),
    botUsername: BOT_USERNAME,
    chatIdSet: Boolean(CHAT_ID),
  })
})

app.get('/api/products', (_req, res) => {
  try {
    res.json({ ok: true, products: readProducts() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error leyendo productos'
    res.status(500).json({ ok: false, error: message })
  }
})

app.post('/api/admin/login', (req, res) => {
  const password = String(req.body?.password || '')
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ ok: false, error: 'Contraseña incorrecta' })
    return
  }
  const token = crypto.randomBytes(24).toString('hex')
  adminTokens.set(token, Date.now() + 1000 * 60 * 60 * 12) // 12h
  res.json({ ok: true, token })
})

app.put('/api/products', requireAdmin, (req, res) => {
  try {
    const products = sanitizeProducts(req.body?.products)
    writeProducts(products)
    res.json({ ok: true, products })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error guardando productos'
    res.status(400).json({ ok: false, error: message })
  }
})

app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  try {
    const orders = readOrders().map((order) => ({
      ...order,
      status: normalizeStatus(order.status),
    }))
    res.json({
      ok: true,
      stats: buildStats(orders),
      orders: orders.slice(0, 200),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error leyendo estadísticas'
    res.status(500).json({ ok: false, error: message })
  }
})

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  try {
    const orderId = String(req.params.id || '').trim()
    const rawStatus = String(req.body?.status || '').toLowerCase().trim()
    if (!orderId) {
      res.status(400).json({ ok: false, error: 'Falta id de orden' })
      return
    }
    if (!rawStatus) {
      res.status(400).json({ ok: false, error: 'Falta status (pending | completed)' })
      return
    }

    const allowed = new Set(['pending', 'pendiente', 'completed', 'completado', 'done', 'confirmed'])
    if (!allowed.has(rawStatus)) {
      res.status(400).json({ ok: false, error: 'Status inválido. Usá pending o completed' })
      return
    }

    const nextStatus = normalizeStatus(rawStatus)
    const orders = readOrders()
    const index = orders.findIndex((order) => order.id === orderId)
    if (index < 0) {
      res.status(404).json({ ok: false, error: 'Orden no encontrada' })
      return
    }

    orders[index] = {
      ...orders[index],
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      completedAt: nextStatus === 'completed' ? new Date().toISOString() : null,
    }
    writeOrders(orders)

    const order = { ...orders[index], status: nextStatus }
    res.json({
      ok: true,
      order,
      stats: buildStats(orders.map((row) => ({ ...row, status: normalizeStatus(row.status) }))),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error actualizando orden'
    res.status(500).json({ ok: false, error: message })
  }
})

app.post('/api/telegram/order', async (req, res) => {
  try {
    const { text, orderId, startPayload, parseMode } = req.body || {}
    if (!text || !orderId) {
      res.status(400).json({ ok: false, error: 'Faltan text u orderId' })
      return
    }

    // Persistir compra para el panel admin (aunque Telegram falle)
    let saved = null
    try {
      saved = saveIncomingOrder(req.body)
    } catch (persistError) {
      console.error('order persist error', persistError)
    }

    try {
      await notifyAdmin(String(text), parseMode || 'HTML')
    } catch (error) {
      // Si ya guardamos la orden, no perdamos el pedido por un fallo de Telegram
      if (saved) {
        res.json({
          ok: true,
          saved: true,
          telegram: false,
          botUrl: `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(startPayload || `order_${orderId}`)}`,
          warning: error instanceof Error ? error.message : 'Telegram no disponible',
        })
        return
      }
      throw error
    }

    res.json({
      ok: true,
      saved: Boolean(saved),
      telegram: true,
      botUrl: `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(startPayload || `order_${orderId}`)}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    const status = error?.code === 'NOT_CONFIGURED' ? 503 : 500
    res.status(status).json({ ok: false, error: message })
  }
})

app.post('/api/telegram/comment', async (req, res) => {
  try {
    const { text, message, name } = req.body || {}
    if (!text && !(name && message)) {
      res.status(400).json({ ok: false, error: 'Falta el comentario' })
      return
    }

    await notifyAdmin(String(text || `💬 ${name}: ${message}`))
    res.json({
      ok: true,
      botUrl: `https://t.me/${BOT_USERNAME}?start=comment`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    const status = error?.code === 'NOT_CONFIGURED' ? 503 : 500
    res.status(status).json({ ok: false, error: message })
  }
})

/**
 * Webhook del bot: cuando el cliente abre el bot con ?start=...
 * BotFather → setWebhook a https://TU_DOMINIO/api/telegram/webhook
 */
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const update = req.body || {}
    const msg = update.message
    if (!msg?.chat?.id) {
      res.json({ ok: true })
      return
    }

    const chatId = msg.chat.id
    const text = String(msg.text || '')
    const from = msg.from?.username ? `@${msg.from.username}` : msg.from?.first_name || 'Usuario'

    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/)[1] || ''
      if (payload.startsWith('order_')) {
        const orderId = payload.slice('order_'.length)
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: [
            `Hola 👋 Soy el bot de Stackd.`,
            `Recibimos tu pedido ${orderId}.`,
            'Cuando el pago esté confirmado te avisamos por aquí y coordinamos la entrega (24–48 hrs).',
            'Si ya pagaste, respondé con el comprobante o el hash/TXID.',
          ].join('\n'),
        })
        if (configured()) {
          await notifyAdmin(`🤖 Cliente ${from} abrió el bot por pedido ${orderId}`)
        }
      } else if (payload === 'comment') {
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: 'Contanos tu comentario o consulta en el próximo mensaje. Un humano te responde acá.',
        })
      } else {
        await telegramApi('sendMessage', {
          chat_id: chatId,
          text: 'Bienvenido a Stackd. Escribí tu consulta o el ID de tu orden y te ayudamos.',
        })
      }
    } else if (text && configured()) {
      // Reenvía mensajes del cliente al chat admin
      await notifyAdmin(`📨 Mensaje de ${from} (chat ${chatId}):\n${text}`)
      await telegramApi('sendMessage', {
        chat_id: chatId,
        text: 'Gracias, ya le avisamos al equipo. Te respondemos pronto.',
      })
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('webhook error', error)
    res.json({ ok: true })
  }
})

const dist = path.join(root, 'dist')
app.use(express.static(dist))
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next()
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stackd API on http://0.0.0.0:${PORT}`)
  console.log(`Telegram configured: ${configured()}`)
  console.log(`Bot username: @${BOT_USERNAME}`)
  console.log(`Admin panel: http://0.0.0.0:${PORT}/admin`)
})
