import type { Order } from './checkout'
import { buildGroupOrderMessage, paymentLabel } from './checkout'
import { orderStartPayload } from './telegramLinks'

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

/** Avisa la compra al grupo Stackd_bot con formato ordenado. */
export async function notifyOrderToBot(order: Order) {
  return postJson('/api/telegram/order', {
    orderId: order.id,
    text: buildGroupOrderMessage(order),
    parseMode: 'HTML',
    customer: order.customer,
    amountDue: order.amountDue,
    paymentMethod: paymentLabel(order.paymentMethod),
    startPayload: orderStartPayload(order.id),
  })
}
