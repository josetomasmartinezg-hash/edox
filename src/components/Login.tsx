import { useEffect, useState } from 'react'
import { clearSession, login } from '../lib/auth'

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

export function Login({ onLoggedIn, notice }: Props) {
  const [email, setEmail] = useState<string>(ACCOUNTS[0].email)
  const [password, setPassword] = useState<string>(ACCOUNTS[0].password)
  const [showPassword, setShowPassword] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    clearSession()
  }, [])

  function fillAccount(account: (typeof ACCOUNTS)[number]) {
    setEmail(account.email)
    setPassword(account.password)
    setShowPassword(true)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email.trim(), password)
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell login-shell">
      <div className="panel login-panel">
        <div className="hero-strip login-hero">
          <img className="brand-logo" src="/logo-soinver.png" alt="SOINVER Ingeniería" />
          <p>Control de maquinaria · acceso por perfil</p>
        </div>
        <form className="panel-body" onSubmit={(e) => void handleSubmit(e)}>
          <h2 className="section-title">Iniciar sesión</h2>
          {notice ? <div className="demo-hint">{notice}</div> : null}

          <div className="login-account-row">
            {ACCOUNTS.map((account) => (
              <button
                key={account.id}
                type="button"
                className={`type-pill ${email === account.email ? 'active' : ''}`}
                onClick={() => fillAccount(account)}
              >
                {account.label}
              </button>
            ))}
          </div>

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
            <div className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          <div className="demo-hint">
            <strong>Administrador</strong>
            <br />
            {ACCOUNTS[0].email} / {ACCOUNTS[0].password}
            <br />
            <br />
            <strong>Principal</strong>
            <br />
            {ACCOUNTS[1].email} / {ACCOUNTS[1].password}
          </div>
        </form>
      </div>
    </div>
  )
}
