import { useEffect, useMemo, useState } from 'react'
import type { Permissions, User } from '../types'
import { ROLE_LABELS } from '../types'
import { useOnlineStatus } from '../hooks/useOnline'
import { DocumentsAdmin } from './DocumentsAdmin'
import { FieldRecordsAdmin } from './FieldRecordsAdmin'
import { MachinesAdmin } from './MachinesAdmin'
import { MaintenanceAdmin } from './MaintenanceAdmin'
import { RepairsAdmin } from './RepairsAdmin'
import { UsersAdmin } from './UsersAdmin'
import { UserSwitcher } from '../components/UserSwitcher'

type Tab =
  | 'maquinaria'
  | 'mantenimiento'
  | 'reparaciones'
  | 'combustible'
  | 'revision_diaria'
  | 'usuarios'
  | 'documentacion'

type NavEntry =
  | { kind: 'link'; id: Tab; label: string }
  | { kind: 'group'; id: 'trabajos'; label: string; children: { id: Tab; label: string }[] }

type Props = {
  user: User
  permissions: Permissions
  onBackField?: () => void
  onLogout: () => void
  onSwitchUser: () => void
}

const TAB_COPY: Record<Tab, { title: string; subtitle: string }> = {
  maquinaria: {
    title: 'Maquinaria',
    subtitle: 'Equipos, ficha, QR y pauta (PDF o Excel)',
  },
  mantenimiento: {
    title: 'Mantenimiento',
    subtitle: 'Agrega un mantenimiento y asígnalo a un mecánico o supervisor',
  },
  reparaciones: {
    title: 'Reparaciones',
    subtitle: 'Registra fallas o trabajos correctivos y asígnalos a un mecánico',
  },
  combustible: {
    title: 'Combustible',
    subtitle: 'Cargas de combustible por equipo',
  },
  revision_diaria: {
    title: 'Revisión diaria',
    subtitle: 'Chequeos diarios antes de operar',
  },
  usuarios: {
    title: 'Usuarios',
    subtitle: 'Perfiles y accesos del sistema',
  },
  documentacion: {
    title: 'Documentación',
    subtitle: 'PDF y fotos por equipo, con control de vencimiento',
  },
}

function userInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

function NavIcon({ id }: { id: Tab | 'trabajos' }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
  }
  switch (id) {
    case 'maquinaria':
      return (
        <svg {...common}>
          <path d="M4 17h16M6 17l1-7h10l1 7M8 10l1.5-4h5L16 10" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'trabajos':
    case 'mantenimiento':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-1.3 1.3 3 3 1.3-1.3z" />
          <path d="M3 21l3.8-1 9.9-9.9-2.8-2.8L4 18l-1 3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'reparaciones':
      return (
        <svg {...common}>
          <path d="M12 6v12M6 12h12" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
    case 'combustible':
      return (
        <svg {...common}>
          <path d="M6 4h8v16H6z" strokeLinejoin="round" />
          <path d="M14 8h2l2 3v9h-4V8z" strokeLinejoin="round" />
          <path d="M8 8h4M8 12h4" strokeLinecap="round" />
        </svg>
      )
    case 'revision_diaria':
      return (
        <svg {...common}>
          <path d="M9 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="4" y="5" width="16" height="14" rx="2" />
        </svg>
      )
    case 'documentacion':
      return (
        <svg {...common}>
          <path d="M8 4h8l4 4v12H8z" strokeLinejoin="round" />
          <path d="M16 4v4h4M12 12h4M12 16h4M8 12h.01M8 16h.01" strokeLinecap="round" />
        </svg>
      )
    case 'usuarios':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c.6-3 3-5 6-5s5.4 2 6 5" strokeLinecap="round" />
          <path d="M16 11h5M18.5 8.5v5" strokeLinecap="round" />
        </svg>
      )
  }
}

function defaultTab(user: User, permissions: Permissions, entries: NavEntry[]): Tab {
  if (user.role === 'mecanico') {
    if (permissions.view_maintenance) return 'mantenimiento'
    if (permissions.view_repairs) return 'reparaciones'
  }
  for (const entry of entries) {
    if (entry.kind === 'link') return entry.id
    if (entry.children[0]) return entry.children[0].id
  }
  return 'maquinaria'
}

export function AdminPanel({ user, permissions, onBackField, onLogout, onSwitchUser }: Props) {
  const {
    pendingCount,
    syncing,
    lastSyncMessage,
    setLastSyncMessage,
    forceSync,
  } = useOnlineStatus()
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!lastSyncMessage) return
    setToast(lastSyncMessage)
    setLastSyncMessage('')
  }, [lastSyncMessage, setLastSyncMessage])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  const navEntries = useMemo(() => {
    const list: NavEntry[] = []
    if (permissions.view_machines || permissions.manage_machines) {
      list.push({ kind: 'link', id: 'maquinaria', label: 'Maquinaria' })
    }

    const trabajosChildren: { id: Tab; label: string }[] = []
    const canTrabajos =
      permissions.view_maintenance ||
      permissions.manage_maintenance ||
      permissions.view_repairs ||
      permissions.manage_repairs

    if (canTrabajos) {
      trabajosChildren.push({ id: 'mantenimiento', label: 'Mantenimiento' })
      trabajosChildren.push({ id: 'reparaciones', label: 'Reparaciones' })
    }
    if (trabajosChildren.length) {
      list.push({ kind: 'group', id: 'trabajos', label: 'Trabajos', children: trabajosChildren })
    }

    if (permissions.view_all_records || permissions.field_form) {
      list.push({ kind: 'link', id: 'combustible', label: 'Combustible' })
      list.push({ kind: 'link', id: 'revision_diaria', label: 'Revisión diaria' })
    }
    if (permissions.view_documents || permissions.manage_documents) {
      list.push({ kind: 'link', id: 'documentacion', label: 'Documentación' })
    }
    if (permissions.manage_users) {
      list.push({ kind: 'link', id: 'usuarios', label: 'Usuarios' })
    }
    return list
  }, [permissions])

  const [tab, setTab] = useState<Tab>(() => defaultTab(user, permissions, navEntries))
  const [openMaintenanceId, setOpenMaintenanceId] = useState<string | null>(null)
  const copy = TAB_COPY[tab]
  const canEditRecords =
    permissions.field_form || permissions.view_all_records || !!user.isPrincipal

  const trabajosActive = tab === 'mantenimiento' || tab === 'reparaciones'

  function handleOpenMaintenance(id: string) {
    setOpenMaintenanceId(id)
    setTab('mantenimiento')
  }

  return (
    <div className="desktop-app">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <img
              className="sidebar-logo"
              src="/logo-soinver.svg"
              alt="SOINVER Ingeniería"
            />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Menú principal">
          <div className="sidebar-nav-list">
            {navEntries.map((entry) => {
              if (entry.kind === 'link') {
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`sidebar-link ${tab === entry.id ? 'active' : ''}`}
                    onClick={() => setTab(entry.id)}
                  >
                    <span className="sidebar-link-icon" aria-hidden="true">
                      <NavIcon id={entry.id} />
                    </span>
                    <span className="sidebar-link-text">{entry.label}</span>
                  </button>
                )
              }

              return (
                <div key={entry.id} className="sidebar-group">
                  <div className={`sidebar-group-label ${trabajosActive ? 'active' : ''}`}>
                    <span className="sidebar-link-icon" aria-hidden="true">
                      <NavIcon id="trabajos" />
                    </span>
                    <span className="sidebar-link-text">{entry.label}</span>
                  </div>
                  <div className="sidebar-subnav">
                    {entry.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        className={`sidebar-sublink ${tab === child.id ? 'active' : ''}`}
                        onClick={() => setTab(child.id)}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">{userInitials(user.name) || 'U'}</div>
            <div className="sidebar-user">
              <strong>{user.name}</strong>
              <span>
                {ROLE_LABELS[user.role]}
                {user.isPrincipal ? ' · Principal' : ''}
              </span>
            </div>
          </div>
          <UserSwitcher currentUser={user} onSwitched={onSwitchUser} />
          <div className="sidebar-actions">
            {onBackField ? (
              <button type="button" className="btn btn-sidebar btn-small" onClick={onBackField}>
                App terreno
              </button>
            ) : null}
            <button type="button" className="btn btn-sidebar btn-small" onClick={onLogout}>
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
          {toast ? <div className="toast">{toast}</div> : null}
          {pendingCount > 0 ? (
            <div className="sync-banner">
              <p>
                {syncing
                  ? `Subiendo ${pendingCount} registro(s) guardados sin señal…`
                  : `${pendingCount} registro(s) en el celular esperando subir.`}
              </p>
              <button
                type="button"
                className="btn btn-accent btn-small"
                disabled={syncing}
                onClick={() => void forceSync()}
              >
                {syncing ? 'Subiendo…' : 'Subir ahora'}
              </button>
            </div>
          ) : null}
          {tab === 'maquinaria' ? (
            <MachinesAdmin
              canManage={permissions.manage_machines || !!user.isPrincipal}
              canViewMaintenance={
                permissions.view_maintenance || permissions.manage_maintenance || !!user.isPrincipal
              }
              onOpenMaintenance={handleOpenMaintenance}
            />
          ) : null}
          {tab === 'mantenimiento' ? (
            <MaintenanceAdmin
              user={user}
              canAssign={permissions.assign_maintenance || !!user.isPrincipal}
              canManage={permissions.manage_maintenance || !!user.isPrincipal}
              openMaintenanceId={openMaintenanceId}
              onOpenMaintenanceHandled={() => setOpenMaintenanceId(null)}
            />
          ) : null}
          {tab === 'reparaciones' ? (
            <RepairsAdmin
              user={user}
              canAssign={permissions.assign_repairs || !!user.isPrincipal}
              canManage={permissions.manage_repairs || !!user.isPrincipal}
            />
          ) : null}
          {tab === 'combustible' ? (
            <FieldRecordsAdmin tipo="combustible" user={user} canManage={canEditRecords} />
          ) : null}
          {tab === 'revision_diaria' ? (
            <FieldRecordsAdmin tipo="revision_diaria" user={user} canManage={canEditRecords} />
          ) : null}
          {tab === 'documentacion' ? (
            <DocumentsAdmin canManage={permissions.manage_documents || !!user.isPrincipal} />
          ) : null}
          {tab === 'usuarios' ? <UsersAdmin /> : null}
        </main>
      </div>
    </div>
  )
}
