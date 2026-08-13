import { useEffect, useState } from 'react'
import { login } from '../lib/auth'

type Props = {
  onLoggedIn: () => void
  notice?: string
}

const ACCOUNTS = [
  {
    id: 'admin',
    label: 'Administrador',
    email: 'admin@soinver.cl',
    password: 'admin1234',
  },
  {
    id: 'principal',
    label: 'Principal',
    email: 'josetomasmartinezg@gmail.com',
    password: 'Edox2026!',
  },
] as const

const LAST_PROFILE_KEY = 'edox_last_profile'
const MANUAL_LOGOUT_KEY = 'edox_manual_logout'

function lastAccount() {
  const id = localStorage.getItem(LAST_PROFILE_KEY)
  return ACCOUNTS.find((account) => account.id === id) || ACCOUNTS[0]
}

export function Login({ onLoggedIn, notice }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function enterAccount(account: (typeof ACCOUNTS)[number]) {
    setLoading(true)
    setError('')
    try {
      await login(account.email, account.password)
      localStorage.setItem(LAST_PROFILE_KEY, account.id)
      onLoggedIn()
    } catch (err) {
      setShowForm(true)
      setEmail(account.email)
      setError(err instanceof Error ? err.message : 'Error al entrar')
      setLoading(false)
    }
  }

  useEffect(() => {
    const skipped = sessionStorage.getItem(MANUAL_LOGOUT_KEY)
    if (skipped) {
      sessionStorage.removeItem(MANUAL_LOGOUT_KEY)
      setShowForm(true)
      setLoading(false)
      return
    }
    void enterAccount(lastAccount())
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email.trim(), password)
      const known = ACCOUNTS.find((account) => account.email === email.trim().toLowerCase())
      if (known) localStorage.setItem(LAST_PROFILE_KEY, known.id)
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al entrar')
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <div className="app-shell login-shell">
        <div className="panel login-panel">
          <div className="hero-strip login-hero">
            <img className="brand-logo" src="/logo-soinver.svg" alt="SOINVER Ingeniería" />
            <p>Control de maquinaria</p>
          </div>
          <div className="panel-body">
            <p className="empty">{loading ? 'Entrando…' : 'Cargando perfil…'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell login-shell">
      <div className="panel login-panel">
        <div className="hero-strip login-hero">
          <img className="brand-logo" src="/logo-soinver.svg" alt="SOINVER Ingeniería" />
          <p>Control de maquinaria · acceso por perfil</p>
        </div>
        <form className="panel-body" onSubmit={(e) => void handleSubmit(e)}>
          <h2 className="section-title">Iniciar sesión</h2>
          {notice ? <div className="demo-hint">{notice}</div> : null}
          <label className="field">
            <span>Correo</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
