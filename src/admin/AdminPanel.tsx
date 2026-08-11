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

const TAB_COPY: Record<Tab, { title: string; subtitle: string }> = {
  maquinaria: {
    title: 'Maquinaria',
    subtitle: 'Listado de equipos, ficha e historial de ingresos',
  },
  usuarios: {
    title: 'Usuarios',
    subtitle: 'Perfiles y accesos del sistema',
  },
  mantenimiento: {
    title: 'Mantenimiento',
    subtitle: 'Programa por intervalos y registro de trabajos',
  },
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
  const copy = TAB_COPY[tab]

  return (
    <div className="desktop-app">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <div className="brand-kicker">Sistema Edox</div>
          <h1>Panel</h1>
          <p>Control operacional</p>
        </div>

        <nav className="sidebar-nav">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user.name}</strong>
            <span>
              {ROLE_LABELS[user.role]}
              {user.isPrincipal ? ' · Principal' : ''}
            </span>
          </div>
          <div className="sidebar-actions">
            {permissions.field_form && onBackField ? (
              <button type="button" className="btn btn-ghost btn-small" onClick={onBackField}>
                App terreno
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-small" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <div className="desktop-main">
        <header className="desktop-topbar">
          <div>
            <h2>{copy.title}</h2>
            <p>{copy.subtitle}</p>
          </div>
        </header>

        <main className="desktop-content">
          {tab === 'maquinaria' ? (
            <MachinesAdmin canManage={permissions.manage_machines || !!user.isPrincipal} />
          ) : null}
          {tab === 'usuarios' ? <UsersAdmin /> : null}
          {tab === 'mantenimiento' ? (
            <MaintenanceAdmin canManage={permissions.manage_maintenance || !!user.isPrincipal} />
          ) : null}
        </main>
      </div>
    </div>
  )
}
