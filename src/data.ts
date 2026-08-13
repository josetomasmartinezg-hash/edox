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
    id: 'bm2500-verified',
    name: 'BM2500 Verified',
    badge: 'BM',
    price: 99,
    description: 'Business Manager 2500 verificado, listo para operar.',
    features: ['BM 2500 verified', 'Entrega por Telegram', 'Soporte incluido'],
    stock: 25,
    featured: true,
    cta: 'Comprar BM2500',
  },
  {
    id: 'bm1-verified',
    name: 'BM1 Verified',
    badge: 'BM',
    price: 99,
    description: 'Business Manager 1 verificado.',
    features: ['BM1 verified', 'Entrega por Telegram', 'Soporte incluido'],
    stock: 30,
    cta: 'Comprar BM1 Verified',
  },
  {
    id: 'bm1-standard',
    name: 'BM1 Standard',
    badge: 'BM',
    price: 89,
    description: 'Business Manager 1 estándar.',
    features: ['BM1 standard', 'Entrega por Telegram', 'Soporte incluido'],
    stock: 30,
    cta: 'Comprar BM1 Standard',
  },
  {
    id: 'perfil-fb-verified',
    name: 'Perfil FB Verified',
    badge: 'Perfil',
    price: 85,
    description: 'Perfil de Facebook verificado.',
    features: ['Perfil FB verified', 'Entrega por Telegram', 'Soporte incluido'],
    stock: 25,
    cta: 'Comprar Perfil Verified',
  },
  {
    id: 'perfil-fb',
    name: 'Perfil FB',
    badge: 'Perfil',
    price: 80,
    description: 'Perfil de Facebook listo para uso.',
    features: ['Perfil Facebook', 'Entrega por Telegram', 'Soporte incluido'],
    stock: 40,
    cta: 'Comprar Perfil FB',
  },
  {
    id: 'fan-page',
    name: 'Fan Page',
    badge: 'Page',
    price: 60,
    description: 'Fan page de Facebook.',
    features: ['Fan page', 'Entrega por Telegram', 'Soporte incluido'],
    stock: 40,
    cta: 'Comprar Fan Page',
  },
]

export const tickerItems = [
  'BM2500 Verified',
  'BM1 Verified',
  'BM1 Standard',
  'Perfiles FB',
  'Fan Pages',
  'Soporte Telegram',
]

export const processSteps = [
  {
    n: '01',
    title: 'Elegís tu producto',
    text: 'BM, perfil o fan page según lo que necesites para operar.',
  },
  {
    n: '02',
    title: 'Confirmás el pago',
    text: 'USDT o PayPal. Te llega la orden al instante por Telegram.',
  },
  {
    n: '03',
    title: 'Te entregamos',
    text: 'Accesos listos por Telegram en cuanto confirmamos el pago.',
  },
  {
    n: '04',
    title: 'Soporte directo',
    text: 'Canal por Telegram para dudas y seguimiento de tu compra.',
  },
]

export const valueProps = [
  {
    title: 'Entrega rápida',
    text: 'Confirmás el pago y te enviamos los accesos por Telegram.',
  },
  {
    title: 'Catálogo claro',
    text: 'BMs, perfiles y fan pages con precio fijo, sin vueltas.',
  },
  {
    title: 'Verified disponibles',
    text: 'Opciones verified para BM y perfiles cuando necesitás más confianza.',
  },
  {
    title: 'Soporte Telegram',
    text: 'Consultas directas con el equipo cuando lo necesites.',
  },
]

export const faqs = [
  {
    q: '¿Cuánto tarda la entrega?',
    a: 'En cuanto confirmamos el pago te enviamos los accesos por Telegram.',
  },
  {
    q: '¿Qué diferencia hay entre standard y verified?',
    a: 'Verified indica cuenta o BM con verificación. Standard es la opción base, a menor precio.',
  },
  {
    q: '¿Puedo comprar más de un producto?',
    a: 'Sí. Podés agregar varios al carrito y pagar todo junto en un solo checkout.',
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
