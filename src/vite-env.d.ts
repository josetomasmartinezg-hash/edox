/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TELEGRAM_BOT_USERNAME?: string
  readonly VITE_TELEGRAM_SUPPORT?: string
  readonly VITE_API_URL?: string
  readonly VITE_PAYPAL_ME?: string
  readonly VITE_PAYPAL_EMAIL?: string
  readonly VITE_USDT_TRC20?: string
  readonly VITE_USDT_BEP20?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
