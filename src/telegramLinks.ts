import { storeConfig } from './config'

export function botDeepLink(payload?: string): string {
  const user = storeConfig.telegramBot.replace(/^@/, '')
  if (!payload) return `https://t.me/${user}`
  return `https://t.me/${user}?start=${encodeURIComponent(payload)}`
}

/** start= solo permite A-Z a-z 0-9 _ - (máx 64) */
export function orderStartPayload(orderId: string): string {
  const clean = orderId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 56)
  return `order_${clean}`
}

export function commentStartPayload(): string {
  return 'comment'
}

export function openBot(payload?: string) {
  window.open(botDeepLink(payload), '_blank', 'noopener,noreferrer')
}
