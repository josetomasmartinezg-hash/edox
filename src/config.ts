/** Editá estos datos con tus wallets, PayPal y Telegram reales. */
export const storeConfig = {
  brand: 'Stackd',
  /**
   * Username del bot (sin @), ej: ADVAULTCL_BOT
   * La gente abre este bot al terminar una compra o dejar un comentario.
   */
  telegramBot: import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'ADVAULTCL_BOT',
  /** Usuario humano de soporte (fallback si el bot no está listo) */
  telegramSupport: 'stackd_support',
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
