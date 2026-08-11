import { useState } from 'react'
import { login } from '../lib/auth'

type Props = {
  onLoggedIn: () => void
}

export function Login({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('josetomasmartinezg@gmail.com')
  const [password, setPassword] = useState('Edox2026!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-kicker">Sistema de control</div>
          <h1>Edox</h1>
          <p>Acceso según perfil: administración, terreno y mantenimiento.</p>
        </div>
      </header>

      <div className="panel">
        <div className="hero-strip">
          <h2>Iniciar sesión</h2>
          <p>Tu usuario principal tiene acceso total a maquinaria, usuarios y mantenimiento.</p>
        </div>
        <form className="panel-body" onSubmit={(e) => void handleSubmit(e)}>
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
            Usuario principal: <strong>josetomasmartinezg@gmail.com</strong> · clave{' '}
            <strong>Edox2026!</strong>
          </div>
        </form>
      </div>
    </div>
  )
}
