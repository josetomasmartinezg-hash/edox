import { storeConfig } from './config'
import { botDeepLink, orderStartPayload } from './telegramLinks'
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
  if (method === 'usdt-trc20') return storeConfig.usdt.trc20
  if (method === 'usdt-bep20') return storeConfig.usdt.bep20
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

export function buildTelegramOrderMessage(order: Order): string {
  const items = order.lines
    .map((line) => `• ${line.qty}x ${line.product.name} ($${line.product.price})`)
    .join('\n')

  return [
    `Nuevo pedido ${order.id}`,
    `Cliente: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Telegram: @${order.customer.telegram.replace(/^@/, '')}`,
    `Método: ${paymentLabel(order.paymentMethod)}`,
    `Total a pagar: $${order.amountDue.toFixed(2)} USD`,
    '',
    'Productos:',
    items,
    order.customer.notes ? `\nNotas: ${order.customer.notes}` : '',
    '',
    'Ya realicé / voy a realizar el pago. Por favor confirmen la orden.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Abre el bot con el pedido precargado en el start payload. */
export function telegramOrderUrl(order: Order): string {
  return botDeepLink(orderStartPayload(order.id))
}

/** Fallback: mensaje prearmado a soporte humano. */
export function telegramSupportOrderUrl(order: Order): string {
  const text = buildTelegramOrderMessage(order)
  return `https://t.me/${storeConfig.telegramSupport}?text=${encodeURIComponent(text)}`
}

export function telegramSupportUrl(): string {
  return botDeepLink()
}
