import { useCallback, useEffect, useState } from 'react'
import { AdminPanel } from './admin/AdminPanel'
import { FieldApp } from './components/FieldApp'
import { Login } from './components/Login'
import { clearSession, fetchMe, getToken } from './lib/auth'
import type { Permissions, User } from './types'

type Screen = 'loading' | 'login' | 'field' | 'admin'

const emptyPermissions: Permissions = {
  modules: {
    panel: { view: false, edit: false, delete: false },
    maquinaria: { view: false, edit: false, delete: false },
    mantenimiento: { view: false, edit: false, delete: false },
    reparaciones: { view: false, edit: false, delete: false },
    usuarios: { view: false, edit: false, delete: false },
    documentacion: { view: false, edit: false, delete: false },
    combustible: { view: false, edit: false, delete: false },
    revision_diaria: { view: false, edit: false, delete: false },
  },
  maintenance_scope: 'none',
  repairs_scope: 'none',
  admin_panel: false,
  manage_users: false,
  manage_machines: false,
  view_machines: false,
  manage_maintenance: false,
  assign_maintenance: false,
  view_maintenance: false,
  manage_repairs: false,
  assign_repairs: false,
  view_repairs: false,
  manage_documents: false,
  view_documents: false,
  field_form: false,
  view_all_records: false,
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<Permissions>(emptyPermissions)
  const [loginNotice, setLoginNotice] = useState('')

  const bootstrap = useCallback(async () => {
    if (!getToken()) {
      setScreen('login')
      return
    }
    try {
      const me = await fetchMe()
      setUser(me.user)
      setPermissions(me.permissions)
      setLoginNotice('')
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
    } catch (err) {
      clearSession()
      setUser(null)
      setPermissions(emptyPermissions)
      setLoginNotice(
        err instanceof Error
          ? err.message
          : 'Tu sesión expiró. Vuelve a iniciar sesión.',
      )
      setScreen('login')
    }
  }, [])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  function logout() {
    sessionStorage.setItem('edox_manual_logout', '1')
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
    return (
      <Login
        notice={loginNotice}
        onLoggedIn={() => {
          setLoginNotice('')
          void bootstrap()
        }}
      />
    )
  }

  if (screen === 'admin') {
    return (
      <AdminPanel
        user={user}
        permissions={permissions}
        onBackField={
          permissions.field_form ||
          permissions.admin_panel ||
          user.role === 'mecanico' ||
          user.isPrincipal
            ? () => setScreen('field')
            : undefined
        }
        onLogout={logout}
        onSwitchUser={() => void bootstrap()}
      />
    )
  }

  return (
    <FieldApp
      user={user}
      canOpenAdmin={permissions.admin_panel}
      onOpenAdmin={() => setScreen('admin')}
      onLogout={logout}
      onSwitchUser={() => void bootstrap()}
    />
  )
}
