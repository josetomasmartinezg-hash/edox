import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const app = express()
const PORT = Number(process.env.PORT || 8787)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''
const BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || process.env.VITE_TELEGRAM_BOT_USERNAME || 'ADVAULTCL_BOT').replace(
  /^@/,
  '',
)

app.use(cors())
app.use(express.json({ limit: '100kb' }))

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
            'Cuando el pago esté confirmado te avisamos por aquí y coordinamos la entrega (5–30 min).',
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
})
