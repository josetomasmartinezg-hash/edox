function env(name: keyof ImportMetaEnv, fallback = ''): string {
  const value = import.meta.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

/** Datos de cobro y contacto. Preferí variables VITE_* en .env */
export const storeConfig = {
  brand: 'Stackd',
  /**
   * Bot que recibe avisos automáticos de compra (no es el chat de consultas).
   */
  telegramBot: env('VITE_TELEGRAM_BOT_USERNAME', 'ADVAULTCL_BOT'),
  /** Telegram humano para consultas y seguimiento con clientes */
  telegramSupport: env('VITE_TELEGRAM_SUPPORT', 'Stackd2026'),
  paypal: {
    me: env('VITE_PAYPAL_ME', 'stackd'),
    email: env('VITE_PAYPAL_EMAIL', 'pagos@stackd.space'),
  },
  usdt: {
    trc20: env('VITE_USDT_TRC20', 'TSbh8JPcucyd7yQS6Z1KzhutWh1xS7cbBc'),
    bep20: env('VITE_USDT_BEP20', ''),
    /** QR estático en /public (generado para la wallet TRC20) */
    trc20Qr: '/qr-usdt-trc20.png',
  },
}

export function isPlaceholderWallet(address: string | null | undefined): boolean {
  if (!address) return true
  const value = address.trim()
  if (!value) return true
  return /^TX?x+$/i.test(value) || /^0xX+$/i.test(value) || /x{6,}/i.test(value)
}
