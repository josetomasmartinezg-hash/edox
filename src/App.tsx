import { useCallback, useEffect, useState } from 'react'
import { AdminPanel } from './admin/AdminPanel'
import { FieldApp } from './components/FieldApp'
import { Login } from './components/Login'
import { SyncProvider } from './hooks/useOnline'
import {
  SESSION_EXPIRED_EVENT,
  clearSession,
  fetchMe,
  getStoredPermissions,
  getStoredUser,
  getToken,
} from './lib/auth'
import { isNetworkError, permissionsForUser, screenForUser } from './lib/permissions'
import type { Permissions, User } from './types'

type Screen = 'loading' | 'login' | 'field' | 'admin'

const emptyPermissions: Permissions = {
  admin_panel: false,
  manage_users: false,
  manage_machines: false,
  view_machines: false,
  view_maintenance: false,
  manage_maintenance: false,
  assign_maintenance: false,
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

  const applySession = useCallback((nextUser: User, nextPermissions: Permissions) => {
    setUser(nextUser)
    setPermissions(nextPermissions)
    setLoginNotice('')
    setScreen(screenForUser(nextUser, nextPermissions))
  }, [])

  const bootstrap = useCallback(async () => {
    const storedUser = getStoredUser()
    const storedPerms = getStoredPermissions() || (storedUser ? permissionsForUser(storedUser) : null)

    if (!getToken()) {
      if (storedUser && storedPerms && !navigator.onLine) {
        applySession(storedUser, storedPerms)
        return
      }
      setScreen('login')
      return
    }

    try {
      const me = await fetchMe()
      applySession(me.user, me.permissions)
    } catch (err) {
      const expired = (err as { code?: string })?.code === 'expired'
      if (storedUser && storedPerms && (isNetworkError(err) || !expired)) {
        applySession(storedUser, storedPerms)
        return
      }
      if (expired) {
        clearSession()
        setUser(null)
        setPermissions(emptyPermissions)
        setLoginNotice(
          err instanceof Error ? err.message : 'Tu sesión expiró. Vuelve a iniciar sesión.',
        )
        setScreen('login')
        return
      }
      if (storedUser && storedPerms) {
        applySession(storedUser, storedPerms)
        return
      }
      setScreen('login')
    }
  }, [applySession])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      setPermissions(emptyPermissions)
      setScreen('login')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  function logout() {
    sessionStorage.setItem('edox_manual_logout', '1')
    clearSession()
    setUser(null)
    setPermissions(emptyPermissions)
    setScreen('login')
  }

  const loggedIn = Boolean(user) && screen !== 'login' && screen !== 'loading'

  let body
  if (screen === 'loading') {
    body = (
      <div className="app-shell">
        <div className="panel">
          <div className="panel-body">
            <div className="empty">Cargando sesión…</div>
          </div>
        </div>
      </div>
    )
  } else if (screen === 'login' || !user) {
    body = (
      <Login
        notice={loginNotice}
        onLoggedIn={() => {
          setLoginNotice('')
          void bootstrap()
        }}
      />
    )
  } else if (screen === 'admin') {
    body = (
      <AdminPanel
        user={user}
        permissions={permissions}
        onBackField={
          permissions.field_form || user.role === 'mecanico' ? () => setScreen('field') : undefined
        }
        onLogout={logout}
      />
    )
  } else {
    body = (
      <FieldApp
        user={user}
        onLogout={logout}
      />
    )
  }

  return <SyncProvider active={loggedIn}>{body}</SyncProvider>
}
