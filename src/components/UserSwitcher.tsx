import { useEffect, useState } from 'react'
import { fetchSwitchUsers, switchUser } from '../lib/auth'
import { ROLE_LABELS, type User } from '../types'

type Props = {
  currentUser: User
  onSwitched: () => void
  compact?: boolean
}

export function UserSwitcher({ currentUser, onSwitched, compact }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetchSwitchUsers().then(setUsers)
  }, [])

  if (!users.length) return null

  async function handleChange(userId: string) {
    if (!userId || userId === currentUser.id) return
    setLoading(true)
    setError('')
    try {
      await switchUser(userId)
      onSwitched()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar de usuario')
      setLoading(false)
    }
  }

  function label(user: User) {
    const role = ROLE_LABELS[user.role] || user.role
    const extra = user.isPrincipal ? ' · Principal' : ''
    return `${user.name} · ${role}${extra}`
  }

  return (
    <div className={`user-switcher ${compact ? 'compact' : ''}`}>
      <label className="field">
        <span>Cambiar usuario (prueba)</span>
        <select
          value={currentUser.id}
          disabled={loading}
          onChange={(e) => void handleChange(e.target.value)}
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {label(user)}
            </option>
          ))}
        </select>
      </label>
      {loading ? <p className="section-help">Cambiando perfil…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  )
}
