import type { Permissions, User } from '../types'

const TOKEN_KEY = 'edox_token'
const USER_KEY = 'edox_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {})
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, {
    ...init,
    headers,
    cache: 'no-store',
  })
  if (res.status === 401) {
    clearSession()
  }
  return res
}

export async function login(email: string, password: string) {
  clearSession()
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión')
  if (!data.token || !data.user) throw new Error('Respuesta de login inválida')
  setSession(data.token, data.user)
  return data as { token: string; user: User }
}

export async function fetchMe() {
  const res = await apiFetch('/api/auth/me')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Tu sesión expiró. Vuelve a iniciar sesión.')
  }
  return (await res.json()) as { user: User; permissions: Permissions }
}
