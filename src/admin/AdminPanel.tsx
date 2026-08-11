import { useMemo, useState } from 'react'
import type { Permissions, User } from '../types'
import { ROLE_LABELS } from '../types'
import { MachinesAdmin } from './MachinesAdmin'
import { MaintenanceAdmin } from './MaintenanceAdmin'
import { UsersAdmin } from './UsersAdmin'

type Tab = 'maquinaria' | 'usuarios' | 'mantenimiento'

type Props = {
  user: User
  permissions: Permissions
  onBackField?: () => void
  onLogout: () => void
}

export function AdminPanel({ user, permissions, onBackField, onLogout }: Props) {
  const tabs = useMemo(() => {
    const list: { id: Tab; label: string }[] = []
    if (permissions.view_machines || permissions.manage_machines) {
      list.push({ id: 'maquinaria', label: 'Maquinaria' })
    }
    if (permissions.manage_users) {
      list.push({ id: 'usuarios', label: 'Usuarios' })
    }
    if (permissions.view_maintenance || permissions.manage_maintenance) {
      list.push({ id: 'mantenimiento', label: 'Mantenimiento' })
    }
    return list
  }, [permissions])

  const [tab, setTab] = useState<Tab>(tabs[0]?.id || 'maquinaria')

  return (
    <div className="app-shell admin-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-kicker">Panel administrativo</div>
          <h1>Edox</h1>
          <p>
            {user.name} · {ROLE_LABELS[user.role]}
            {user.isPrincipal ? ' · acceso total' : ''}
          </p>
        </div>
        <div className="topbar-actions">
          {permissions.field_form && onBackField ? (
            <button type="button" className="btn btn-accent btn-small" onClick={onBackField}>
              Terreno
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-small light" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      <div className="panel">
        <div className="hero-strip">
          <h2>Administración</h2>
          <p>Maquinaria con QR, perfiles de usuario y módulo de mantenimiento.</p>
        </div>
        <div className="panel-body">
          <div className="tab-row">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`tab-btn ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'maquinaria' ? (
            <MachinesAdmin canManage={permissions.manage_machines || !!user.isPrincipal} />
          ) : null}
          {tab === 'usuarios' ? <UsersAdmin /> : null}
          {tab === 'mantenimiento' ? (
            <MaintenanceAdmin canManage={permissions.manage_maintenance || !!user.isPrincipal} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
