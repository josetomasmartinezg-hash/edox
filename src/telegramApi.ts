import type { Order } from './checkout'
import { buildTelegramOrderMessage, paymentLabel } from './checkout'
import {
  commentStartPayload,
  orderStartPayload,
} from './telegramLinks'

export type CommentPayload = {
  name: string
  email?: string
  telegram?: string
  message: string
  orderId?: string
}

function apiBase(): string {
  return import.meta.env.VITE_API_URL?.replace(/\/$/, '') || ''
}

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Error ${res.status}` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudo contactar al servidor de Telegram' }
  }
}

export async function notifyOrderToBot(order: Order) {
  const text = [
    '🛒 Nueva compra desde la web',
    buildTelegramOrderMessage(order),
    '',
    `Abrí chat con el cliente: https://t.me/${order.customer.telegram}`,
  ].join('\n')

  return postJson('/api/telegram/order', {
    orderId: order.id,
    text,
    customer: order.customer,
    amountDue: order.amountDue,
    paymentMethod: paymentLabel(order.paymentMethod),
    startPayload: orderStartPayload(order.id),
  })
}

export async function notifyCommentToBot(payload: CommentPayload) {
  const text = [
    '💬 Nuevo comentario desde la web',
    `Nombre: ${payload.name}`,
    payload.email ? `Email: ${payload.email}` : null,
    payload.telegram ? `Telegram: @${payload.telegram.replace(/^@/, '')}` : null,
    payload.orderId ? `Orden: ${payload.orderId}` : null,
    '',
    payload.message,
  ]
    .filter(Boolean)
    .join('\n')

  return postJson('/api/telegram/comment', {
    ...payload,
    text,
    startPayload: commentStartPayload(),
  })
}
