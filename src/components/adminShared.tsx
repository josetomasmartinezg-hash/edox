import type { AdminOrder, AdminStats } from '../productsApi'

export const TOKEN_KEY = 'stackd-admin-token'

export const emptyStats: AdminStats = {
  totalOrders: 0,
  usdtOrders: 0,
  paypalOrders: 0,
  otherOrders: 0,
  completedOrders: 0,
  pendingOrders: 0,
  totalRevenue: 0,
  usdtRevenue: 0,
  paypalRevenue: 0,
  completedRevenue: 0,
  pendingRevenue: 0,
}

export function money(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function categoryLabel(category: AdminOrder['paymentCategory']) {
  if (category === 'usdt') return 'USDT'
  if (category === 'paypal') return 'PayPal'
  return 'Otro'
}

export function statusLabel(status: AdminOrder['status']) {
  return status === 'completed' ? 'Completado' : 'Pendiente'
}

export function AdminNav({ page }: { page: 'resumen' | 'ventas' }) {
  return (
    <nav className="admin-nav" aria-label="Secciones del admin">
      <a className={page === 'resumen' ? 'is-active' : undefined} href="/admin">
        Resumen
      </a>
      <a className={page === 'ventas' ? 'is-active' : undefined} href="/admin/ventas">
        Ventas
      </a>
    </nav>
  )
}
