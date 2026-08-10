/** Editá estos datos con tus wallets, PayPal y Telegram reales. */
export const storeConfig = {
  brand: 'Stackd',
  /**
   * Bot que recibe avisos automáticos de compra (no es el chat de consultas).
   */
  telegramBot: import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'ADVAULTCL_BOT',
  /** Telegram humano para consultas y seguimiento con clientes */
  telegramSupport: 'Stackd2026',
  paypal: {
    /** Usuario de PayPal.me o email de cobro */
    me: 'stackd',
    email: 'pagos@stackd.space',
  },
  usdt: {
    trc20: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    bep20: '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  },
}
