import { defaultProducts, type Product } from './data'

function apiBase(): string {
  return import.meta.env.VITE_API_URL?.replace(/\/$/, '') || ''
}

export async function fetchProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${apiBase()}/api/products`)
    const data = (await res.json()) as { ok?: boolean; products?: Product[] }
    if (!res.ok || !data.ok || !Array.isArray(data.products)) {
      return defaultProducts
    }
    return data.products
  } catch {
    return defaultProducts
  }
}

export async function adminLogin(password: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch(`${apiBase()}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = (await res.json()) as { ok?: boolean; token?: string; error?: string }
    if (!res.ok || !data.ok || !data.token) {
      return { ok: false, error: data.error || 'Login fallido' }
    }
    return { ok: true, token: data.token }
  } catch {
    return { ok: false, error: 'No se pudo conectar al servidor' }
  }
}

export async function saveProducts(
  token: string,
  products: Product[],
): Promise<{ ok: boolean; products?: Product[]; error?: string }> {
  try {
    const res = await fetch(`${apiBase()}/api/products`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ products }),
    })
    const data = (await res.json()) as { ok?: boolean; products?: Product[]; error?: string }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'No se pudo guardar' }
    }
    return { ok: true, products: data.products }
  } catch {
    return { ok: false, error: 'No se pudo conectar al servidor' }
  }
}

export type AdminStats = {
  totalOrders: number
  usdtOrders: number
  paypalOrders: number
  otherOrders: number
  totalRevenue: number
  usdtRevenue: number
  paypalRevenue: number
}

export type AdminOrder = {
  id: string
  createdAt: string
  paymentMethod: string
  paymentCategory: 'usdt' | 'paypal' | 'other'
  amountDue: number
  customer: {
    name: string
    email: string
    telegram: string
  }
  lines: Array<{ productId: string; name: string; qty: number; price: number }>
}

export async function fetchAdminStats(
  token: string,
): Promise<{ ok: boolean; stats?: AdminStats; orders?: AdminOrder[]; error?: string }> {
  try {
    const res = await fetch(`${apiBase()}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = (await res.json()) as {
      ok?: boolean
      stats?: AdminStats
      orders?: AdminOrder[]
      error?: string
    }
    if (!res.ok || !data.ok || !data.stats) {
      return { ok: false, error: data.error || 'No se pudieron cargar las estadísticas' }
    }
    return { ok: true, stats: data.stats, orders: data.orders || [] }
  } catch {
    return { ok: false, error: 'No se pudo conectar al servidor' }
  }
}
