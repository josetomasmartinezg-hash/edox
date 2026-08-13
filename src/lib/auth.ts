import type { Permissions, User } from '../types'

const TOKEN_KEY = 'edox_token'
const USER_KEY = 'edox_user'
const PERMS_KEY = 'edox_permissions'

export const SESSION_EXPIRED_EVENT = 'edox-session-expired'

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

export function getStoredPermissions(): Permissions | null {
  try {
    const raw = localStorage.getItem(PERMS_KEY)
    return raw ? (JSON.parse(raw) as Permissions) : null
  } catch {
    return null
  }
}

export function setSession(token: string, user: User, permissions?: Permissions) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  if (permissions) localStorage.setItem(PERMS_KEY, JSON.stringify(permissions))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(PERMS_KEY)
}

type FetchInit = RequestInit & { clearOn401?: boolean }

export async function apiFetch(path: string, init: FetchInit = {}) {
  const headers = new Headers(init.headers || {})
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const { clearOn401 = true, ...rest } = init
  const res = await fetch(path, {
    ...rest,
    headers,
    cache: 'no-store',
  })
  if (res.status === 401 && clearOn401) {
    clearSession()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
  }
  return res
}

export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión')
  if (!data.token || !data.user) throw new Error('Respuesta de login inválida')
  setSession(data.token, data.user, data.permissions)
  return data as { token: string; user: User; permissions?: Permissions }
}

export async function fetchMe() {
  const res = await apiFetch('/api/auth/me', { clearOn401: false })
  if (res.status === 401) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error || 'Tu sesión expiró. Vuelve a iniciar sesión.'), {
      code: 'expired',
    })
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'No se pudo validar la sesión')
  }
  const me = (await res.json()) as { user: User; permissions: Permissions }
  const token = getToken()
  if (token) setSession(token, me.user, me.permissions)
  return me
}
