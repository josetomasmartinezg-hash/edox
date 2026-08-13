import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/auth'
import type { User, UserType } from '../types'
import { UserTypesAdmin } from './UserTypesAdmin'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  userTypeId: '',
}

type Tab = 'users' | 'types'

export function UsersAdmin() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<User[]>([])
  const [userTypes, setUserTypes] = useState<UserType[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<User | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const [usersRes, typesRes] = await Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/user-types'),
    ])
    if (usersRes.ok) setUsers(await usersRes.json())
    if (typesRes.ok) setUserTypes(await typesRes.json())
  }

  useEffect(() => {
    void load()
  }, [])

  function typeName(user: User) {
    return userTypes.find((t) => t.id === user.userTypeId)?.name || '—'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.userTypeId) {
      setError('Selecciona un tipo de usuario')
      return
    }
    setLoading(true)
    setError('')
    const payload = editing
      ? {
          name: form.name,
          email: form.email,
          userTypeId: form.userTypeId,
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
      userTypeId: user.userTypeId || userTypes[0]?.id || '',
    })
    setShowForm(true)
  }

  function startCreate() {
    setEditing(null)
    setForm({ ...emptyForm, userTypeId: userTypes[0]?.id || '' })
    setShowForm(true)
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Usuarios y perfiles</h3>
          <p className="section-help">
            Crea usuarios y define tipos con permisos por módulo (ver, editar, eliminar).
          </p>
        </div>
        {tab === 'users' ? (
          <button type="button" className="btn btn-primary" onClick={startCreate}>
            Agregar usuario
          </button>
        ) : null}
      </div>

      <div className="legend-row">
        <button
          type="button"
          className={`btn btn-small ${tab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('users')}
        >
          Usuarios
        </button>
        <button
          type="button"
          className={`btn btn-small ${tab === 'types' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('types')}
        >
          Tipos de usuario
        </button>
      </div>

      {tab === 'types' ? <UserTypesAdmin /> : null}

      {tab === 'users' ? (
        <>
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
                  <span>Tipo de usuario</span>
                  <select
                    value={form.userTypeId}
                    onChange={(e) => setForm({ ...form, userTypeId: e.target.value })}
                    disabled={!!editing?.isPrincipal}
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {userTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
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
                  <th>Tipo</th>
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
                    <td>{typeName(user)}</td>
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
        </>
      ) : null}
    </div>
  )
}
