export type Product = {
  id: string
  name: string
  badge: string
  price: number
  oldPrice?: number
  features: string[]
  stock: number
}

export const products: Product[] = [
  {
    id: 'bm-api',
    name: 'BM Verificado + API WhatsApp',
    badge: 'Más vendido',
    price: 189,
    oldPrice: 240,
    features: [
      'Verificación oficial Meta',
      'API de WhatsApp lista',
      'Entrega 5–30 min',
      'Soporte post-venta',
    ],
    stock: 12,
  },
  {
    id: 'bm-balloon',
    name: 'BM Balloon Verificado',
    badge: 'Escalado',
    price: 149,
    oldPrice: 190,
    features: [
      'Límites ampliados',
      'Ideal para agencias',
      'Múltiples ad accounts',
      'Entrega express',
    ],
    stock: 8,
  },
  {
    id: 'ad-account',
    name: 'Cuenta Publicitaria Lista',
    badge: 'Starter',
    price: 45,
    features: [
      'Lista para campañas',
      'Límite inicial activo',
      'Compatible con BM',
      'Entrega inmediata',
    ],
    stock: 24,
  },
  {
    id: 'pack-agencia',
    name: 'Pack Agencia ×3 BM',
    badge: 'Volumen',
    price: 499,
    oldPrice: 567,
    features: [
      '3 BM verificados',
      'API WhatsApp en todos',
      'Descuento por cantidad',
      'Prioridad en soporte',
    ],
    stock: 5,
  },
]

export const faqs = [
  {
    q: '¿Qué es un Business Manager Verificado?',
    a: 'Es una cuenta empresarial de Meta que completó el proceso oficial de verificación. Tiene acceso a mayores límites de gasto, más cuentas publicitarias y la API de WhatsApp habilitada.',
  },
  {
    q: '¿Qué es la API de WhatsApp?',
    a: 'La API de WhatsApp Business permite enviar mensajes masivos, automatizar comunicaciones y conectar WhatsApp con CRM o herramientas de marketing. Requiere un BM verificado.',
  },
  {
    q: '¿Cómo es la entrega?',
    a: 'Entre 5 y 30 minutos tras confirmar el pago. Accedés a las credenciales desde Mi Cuenta → Mis Órdenes.',
  },
  {
    q: '¿Cómo funciona el pago?',
    a: 'Aceptamos USDT (TRC20 / BEP20) y PayPal. En USDT generamos un monto único con centavos aleatorios para identificar tu depósito: enviá el monto exacto. En PayPal usás PayPal.me o checkout. Después confirmás la orden por Telegram para la entrega.',
  },
  {
    q: '¿Qué cubre la garantía?',
    a: 'Cubre productos que lleguen bloqueados o inutilizables al momento de la entrega. No cubre mal uso: conectar a CRM de inmediato, lanzar tráfico en las primeras horas, ni acciones que comprometan la cuenta.',
  },
  {
    q: '¿Cómo conecto el BM al CRM de forma segura?',
    a: 'Esperá al menos 4–6 horas (ideal 12–24) antes de conectar a un CRM. Luego esperá mínimo 24 horas más antes de enviar tráfico desde Meta.',
  },
  {
    q: '¿Necesito una cuenta personal de Facebook?',
    a: 'No. El BM viene listo para usar de forma independiente, sin asociar tu perfil personal.',
  },
  {
    q: '¿Cómo contacto al soporte?',
    a: 'Para consultas escribí a @Stackd2026 (sección Consultas o botones de Telegram). Cuando comprás, el bot interno avisa automáticamente la orden y después seguís la entrega con @Stackd2026.',
  },
]

export const comparisonRows = [
  {
    feature: 'Nivel de confianza Meta',
    regular: 'Bajo, alto riesgo',
    verified: 'Alto, riesgo reducido',
    alt: 'Medio, depende del proveedor',
  },
  {
    feature: 'Límite de cuentas publicitarias',
    regular: 'Limitado (1–2)',
    verified: 'Extendido (5+)',
    alt: 'Variable según contrato',
  },
  {
    feature: 'Métodos de pago',
    regular: 'Opciones limitadas',
    verified: 'Soporte completo',
    alt: 'Frecuentemente restringido',
  },
  {
    feature: 'Proceso de adquisición',
    regular: 'Gratis, sin documentos',
    verified: 'Documentos o compra',
    alt: 'Rápido, con riesgos',
  },
  {
    feature: 'Riesgo de baneo',
    regular: 'Alto',
    verified: 'Reducido',
    alt: 'Medio-alto',
  },
  {
    feature: 'Ideal para',
    regular: 'Pruebas y pymes',
    verified: 'Agencias y e-commerce',
    alt: 'Acceso rápido puntual',
  },
]
