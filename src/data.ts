export type Product = {
  id: string
  name: string
  badge: string
  price: number
  oldPrice?: number
  features: string[]
  stock: number
  description?: string
  featured?: boolean
  cta?: string
}

/** Catálogo por defecto (fallback si el API no responde). */
export const defaultProducts: Product[] = [
  {
    id: 'plan-starter',
    name: 'Starter',
    badge: 'Starter',
    price: 99,
    description: 'Para empezar a escalar con estructura.',
    features: [
      '1 perfil Ads Power',
      '1 Business Manager',
      '2 cuentas de ads',
      '1 proxy residencial',
      'Garantía 15 días',
      'Soporte Telegram',
    ],
    stock: 20,
    cta: 'Elegir Starter',
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    badge: 'Más popular',
    price: 249,
    description: 'El setup que usa quien escala en serio.',
    features: [
      '2 perfiles Ads Power',
      '2 Business Managers',
      '3 cuentas por BM (6 total)',
      '2 proxies residenciales',
      'Garantía 15 días',
      'Onboarding 1:1',
      'Soporte prioritario',
    ],
    stock: 15,
    featured: true,
    cta: 'Contratar Pro →',
  },
  {
    id: 'plan-agency',
    name: 'Agency',
    badge: 'Agency',
    price: 449,
    description: 'Para agencias y buyers de alto volumen.',
    features: [
      '4 perfiles Ads Power',
      '4 Business Managers',
      '3 cuentas por BM (12 total)',
      '4 proxies móviles',
      'Garantía 20 días',
      'Onboarding extendido',
      'Soporte VIP',
    ],
    stock: 8,
    cta: 'Elegir Agency',
  },
]

export const tickerItems = [
  'Proxies residenciales',
  'Ads Power',
  'Setup personalizado',
  'Soporte 1:1',
  'Multi-cuentas',
  'Business Managers',
]

export const processSteps = [
  {
    n: '01',
    title: 'Elegís tu plan',
    text: 'Starter, Pro o Agency según el volumen con el que vas a operar.',
  },
  {
    n: '02',
    title: 'Confirmás el pago',
    text: 'USDT o PayPal. Te llega la orden al instante por Telegram.',
  },
  {
    n: '03',
    title: 'Armamos tu setup',
    text: 'Perfiles, BMs, cuentas y proxies listos en 24–48 hrs.',
  },
  {
    n: '04',
    title: 'Escalá con soporte',
    text: 'Canal directo por Telegram para dudas y reposición en garantía.',
  },
]

export const valueProps = [
  {
    title: 'Setup en 24–48 hrs',
    text: 'Tu infraestructura queda operativa en menos de dos días hábiles.',
  },
  {
    title: 'Garantía real',
    text: 'Si una cuenta cae en garantía, la reponemos. Sin vueltas.',
  },
  {
    title: 'Todo integrado',
    text: 'Perfiles, cuentas, BMs y proxies listos juntos.',
  },
  {
    title: 'Hecho para buyers',
    text: 'Conocemos el media buying y armamos setups que escalan.',
  },
]

export const faqs = [
  {
    q: '¿Cuánto tarda en estar listo mi setup?',
    a: 'Entre 24 y 48 hrs después de confirmar el pago. Te enviamos los accesos por Telegram.',
  },
  {
    q: '¿Qué pasa si me banean una cuenta?',
    a: 'Si cae dentro del período de garantía y no hubo mal uso, la reponemos. La garantía no cubre calentamiento agresivo ni acciones que comprometan la cuenta.',
  },
  {
    q: '¿Qué tipo de proxies usan?',
    a: 'Residenciales en Starter/Pro y móviles en Agency, asignados al setup para que operes con menor riesgo de flags.',
  },
  {
    q: '¿Necesito saber de técnico?',
    a: 'No. Te entregamos todo configurado y en Pro/Agency hacemos onboarding 1:1 para que arranques sin fricción.',
  },
  {
    q: '¿Cómo funciona el pago?',
    a: 'Aceptamos USDT (TRC20 / BEP20) y PayPal. En USDT generamos un monto único con centavos para identificar tu depósito. Después confirmás por Telegram.',
  },
  {
    q: '¿Cómo contacto al soporte?',
    a: 'Escribí a @Stackd2026. Cuando comprás, el bot interno avisa la orden al equipo automáticamente.',
  },
]
