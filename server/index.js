import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const PRODUCTS_PATH = path.join(root, 'data', 'products.json')

const app = express()
const PORT = Number(process.env.PORT || 8787)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'stackd-admin'
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || process.env.VITE_TELEGRAM_BOT_USERNAME || 'ADVAULTCL_BOT').replace(
  /^@/,
  '',
)

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
    throw new Error(data.description || `Telegram API error (${method})`)
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
  return telegramApi('sendMessage', payload)
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    telegramConfigured: configured(),
    botUsername: BOT_USERNAME,
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

app.post('/api/telegram/order', async (req, res) => {
  try {
    const { text, orderId, startPayload, parseMode } = req.body || {}
    if (!text || !orderId) {
      res.status(400).json({ ok: false, error: 'Faltan text u orderId' })
      return
    }

    await notifyAdmin(String(text), parseMode || 'HTML')

    res.json({
      ok: true,
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
