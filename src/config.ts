/** Editá estos datos con tus wallets, PayPal y Telegram reales. */
export const storeConfig = {
  brand: 'ADVAULT',
  /**
   * Username del bot (sin @), ej: AdvaultBot
   * La gente abre este bot al terminar una compra o dejar un comentario.
   */
  telegramBot: import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'AdvaultBot',
  /** Usuario humano de soporte (fallback si el bot no está listo) */
  telegramSupport: 'advault_support',
  paypal: {
    /** Usuario de PayPal.me o email de cobro */
    me: 'advault',
    email: 'pagos@advault.space',
  },
  usdt: {
    trc20: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    bep20: '0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  },
}
