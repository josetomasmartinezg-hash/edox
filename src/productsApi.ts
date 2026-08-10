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
