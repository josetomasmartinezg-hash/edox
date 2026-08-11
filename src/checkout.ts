import { storeConfig } from './config'
import { supportDeepLink } from './telegramLinks'
import type { Product } from './data'

export type PaymentMethod = 'usdt-trc20' | 'usdt-bep20' | 'paypal'

export type CartLine = {
  product: Product
  qty: number
}

export type CustomerData = {
  name: string
  email: string
  telegram: string
  notes: string
}

export type Order = {
  id: string
  createdAt: string
  customer: CustomerData
  lines: CartLine[]
  subtotal: number
  /** Monto exacto a pagar (con centavos únicos para USDT) */
  amountDue: number
  paymentMethod: PaymentMethod
  discountCode?: string
  discountPercent?: number
  discountAmount?: number
}

/** Códigos activos: código → % de descuento */
export const DISCOUNT_CODES: Record<string, number> = {
  SKALERS: 20,
}

export function normalizeDiscountCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

export function resolveDiscount(code: string): { code: string; percent: number } | null {
  const normalized = normalizeDiscountCode(code)
  const percent = DISCOUNT_CODES[normalized]
  if (!percent) return null
  return { code: normalized, percent }
}

export function applyDiscount(subtotal: number, percent: number): {
  discountAmount: number
  total: number
} {
  const discountAmount = Number(((subtotal * percent) / 100).toFixed(2))
  const total = Math.max(0, Number((subtotal - discountAmount).toFixed(2)))
  return { discountAmount, total }
}

export function cartLines(cart: Record<string, number>, products: Product[]): CartLine[] {
  return products
    .filter((product) => (cart[product.id] ?? 0) > 0)
    .map((product) => ({ product, qty: cart[product.id] }))
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.product.price * line.qty, 0)
}

/** Centavos aleatorios para identificar el depósito USDT. */
export function uniqueUsdtAmount(subtotal: number): number {
  const cents = Math.floor(Math.random() * 89) + 10 // 0.10 – 0.98
  return Number((subtotal + cents / 100).toFixed(2))
}

export function createOrderId(): string {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `STK-${stamp}-${rand}`
}

export function paymentLabel(method: PaymentMethod): string {
  switch (method) {
    case 'usdt-trc20':
      return 'USDT TRC20 (Tron)'
    case 'usdt-bep20':
      return 'USDT BEP20 (BSC)'
    case 'paypal':
      return 'PayPal'
  }
}

export function usdtAddress(method: PaymentMethod): string | null {
  if (method === 'usdt-trc20') return storeConfig.usdt.trc20 || null
  if (method === 'usdt-bep20') return storeConfig.usdt.bep20 || null
  return null
}

export function paypalCheckoutUrl(amount: number, orderId: string): string {
  const params = new URLSearchParams({
    currencyCode: 'USD',
    amount: amount.toFixed(2),
    item_name: `Stackd ${orderId}`,
  })
  return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(storeConfig.paypal.email)}&${params.toString()}`
}

export function paypalMeUrl(amount: number): string {
  return `https://www.paypal.me/${storeConfig.paypal.me}/${amount.toFixed(2)}USD`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** Mensaje limpio para el grupo Stackd_bot (HTML). */
export function buildGroupOrderMessage(order: Order): string {
  const tg = order.customer.telegram.replace(/^@/, '')
  const items = order.lines
    .map(
      (line) =>
        `  • ${line.qty}× ${escapeHtml(line.product.name)} — $${(line.product.price * line.qty).toFixed(2)}`,
    )
    .join('\n')

  const notes = order.customer.notes?.trim()
    ? `\n📝 <b>Notas</b>\n${escapeHtml(order.customer.notes.trim())}\n`
    : ''

  const discountBlock =
    order.discountCode && order.discountAmount
      ? [
          `Subtotal: $${order.subtotal.toFixed(2)}`,
          `Descuento ${escapeHtml(order.discountCode)} (−${order.discountPercent ?? 0}%): −$${order.discountAmount.toFixed(2)}`,
        ].join('\n')
      : `Subtotal: $${order.subtotal.toFixed(2)}`

  return [
    `<b>STACKD · NUEVA ORDEN</b>`,
    `<code>${escapeHtml(order.id)}</code>`,
    ``,
    `<b>Cliente</b>`,
    `Nombre: ${escapeHtml(order.customer.name)}`,
    `Email: ${escapeHtml(order.customer.email)}`,
    `Telegram: @${escapeHtml(tg)}`,
    ``,
    `<b>Pago</b>`,
    `Método: ${escapeHtml(paymentLabel(order.paymentMethod))}`,
    discountBlock,
    `Total: <b>$${order.amountDue.toFixed(2)} USD</b>`,
    ``,
    `<b>Productos</b>`,
    items,
    notes,
    `<b>Links</b>`,
    `Cliente: https://t.me/${escapeHtml(tg)}`,
    `Consultas: https://t.me/${storeConfig.telegramSupport}`,
  ]
    .filter((line) => line !== undefined)
    .join('\n')
}

/** Texto plano para abrir chat con @Stackd2026 (sin HTML). */
export function buildTelegramOrderMessage(order: Order): string {
  const tg = order.customer.telegram.replace(/^@/, '')
  const items = order.lines
    .map((line) => `• ${line.qty}x ${line.product.name} — $${(line.product.price * line.qty).toFixed(2)}`)
    .join('\n')

  return [
    `Hola Stackd, confirmo mi compra.`,
    ``,
    `Orden: ${order.id}`,
    `Nombre: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Telegram: @${tg}`,
    `Método: ${paymentLabel(order.paymentMethod)}`,
    order.discountCode
      ? `Descuento: ${order.discountCode} (−${order.discountPercent ?? 0}% / −$${(order.discountAmount ?? 0).toFixed(2)})`
      : '',
    `Total: $${order.amountDue.toFixed(2)} USD`,
    ``,
    `Productos:`,
    items,
    order.customer.notes ? `\nNotas: ${order.customer.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Abre el Telegram de consultas (@Stackd2026) con el pedido precargado. */
export function telegramOrderUrl(order: Order): string {
  return supportDeepLink(buildTelegramOrderMessage(order))
}

export function telegramSupportUrl(): string {
  return supportDeepLink()
}
