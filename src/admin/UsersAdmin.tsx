import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/auth'
import { ROLE_LABELS, type RoleId, type User } from '../types'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'operador' as RoleId,
}

export function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const res = await apiFetch('/api/users')
    if (!res.ok) {
      setError('No se pudieron cargar los usuarios')
      return
    }
    setUsers(await res.json())
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const payload = editing
      ? {
          name: form.name,
          email: form.email,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        }
      : form

    const res = await apiFetch(editing ? `/api/users/${editing.id}` : '/api/users', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Error al guardar')
      return
    }
    setForm(emptyForm)
    setEditing(null)
    setShowForm(false)
    await load()
  }

  async function remove(user: User) {
    if (user.isPrincipal) return
    if (!confirm(`¿Eliminar a ${user.name}?`)) return
    const res = await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'No se pudo eliminar')
      return
    }
    await load()
  }

  function startEdit(user: User) {
    setEditing(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    })
    setShowForm(true)
  }

  function startCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Usuarios y perfiles</h3>
          <p className="section-help">
            Administradores, Supervisores, Operadores, Mecánicos y Operador surtidor.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          Agregar usuario
        </button>
      </div>

      {showForm ? (
        <form className="admin-card" onSubmit={(e) => void handleSubmit(e)}>
          <h4>{editing ? `Editar ${editing.name}` : 'Crear usuario'}</h4>
          <div className="field-grid two">
            <label className="field">
              <span>Nombre</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Correo</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                disabled={!!editing?.isPrincipal}
              />
            </label>
            <label className="field">
              <span>{editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editing}
              />
            </label>
            <label className="field">
              <span>Perfil</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as RoleId })}
                disabled={!!editing?.isPrincipal}
              >
                {Object.entries(ROLE_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : editing ? 'Actualizar' : 'Crear usuario'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false)
                setEditing(null)
                setForm(emptyForm)
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Perfil</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                </td>
                <td>{user.email}</td>
                <td>{ROLE_LABELS[user.role]}</td>
                <td>
                  {user.isPrincipal ? (
                    <span className="badge pending">Principal</span>
                  ) : (
                    <span className="badge synced">Activo</span>
                  )}
                </td>
                <td>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => startEdit(user)}
                    >
                      Editar
                    </button>
                    {!user.isPrincipal ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => void remove(user)}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
