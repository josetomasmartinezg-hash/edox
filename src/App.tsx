import { useCallback, useEffect, useState } from 'react'
import { AdminPanel } from './admin/AdminPanel'
import { FieldApp } from './components/FieldApp'
import { Login } from './components/Login'
import { clearSession, fetchMe, getToken } from './lib/auth'
import type { Permissions, User } from './types'

type Screen = 'loading' | 'login' | 'field' | 'admin'

const emptyPermissions: Permissions = {
  admin_panel: false,
  manage_users: false,
  manage_machines: false,
  view_machines: false,
  manage_maintenance: false,
  view_maintenance: false,
  field_form: false,
  view_all_records: false,
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<Permissions>(emptyPermissions)

  const bootstrap = useCallback(async () => {
    if (!getToken()) {
      setScreen('login')
      return
    }
    try {
      const me = await fetchMe()
      setUser(me.user)
      setPermissions(me.permissions)
      // Principal / admin entran al panel; terreno para operadores y surtidor
      if (me.user.isPrincipal || me.user.role === 'administrador' || me.user.role === 'mecanico') {
        setScreen(me.permissions.admin_panel ? 'admin' : 'field')
      } else if (me.permissions.field_form) {
        setScreen('field')
      } else if (me.permissions.admin_panel) {
        setScreen('admin')
      } else {
        setScreen('field')
      }
    } catch {
      clearSession()
      setScreen('login')
    }
  }, [])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  function logout() {
    clearSession()
    setUser(null)
    setPermissions(emptyPermissions)
    setScreen('login')
  }

  if (screen === 'loading') {
    return (
      <div className="app-shell">
        <div className="panel">
          <div className="panel-body">
            <div className="empty">Cargando sesión…</div>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'login' || !user) {
    return <Login onLoggedIn={() => void bootstrap()} />
  }

  if (screen === 'admin') {
    return (
      <AdminPanel
        user={user}
        permissions={permissions}
        onBackField={permissions.field_form ? () => setScreen('field') : undefined}
        onLogout={logout}
      />
    )
  }

  return (
    <FieldApp
      user={user}
      canOpenAdmin={permissions.admin_panel}
      onOpenAdmin={() => setScreen('admin')}
      onLogout={logout}
    />
  )
}
