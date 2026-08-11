import { useEffect, useState } from 'react'
import { clearSession, login } from '../lib/auth'

type Props = {
  onLoggedIn: () => void
  notice?: string
}

export function Login({ onLoggedIn, notice }: Props) {
  const [email, setEmail] = useState('josetomasmartinezg@gmail.com')
  const [password, setPassword] = useState('Edox2026!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    clearSession()
  }, [])

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
          <div className="demo-hint">
            Usuario: <strong>josetomasmartinezg@gmail.com</strong>
            <br />
            Clave: <strong>Edox2026!</strong>
          </div>
        </form>
      </div>
    </div>
  )
}
