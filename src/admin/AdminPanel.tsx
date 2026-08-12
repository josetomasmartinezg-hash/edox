import { useMemo, useState } from 'react'
import type { Permissions, User } from '../types'
import { ROLE_LABELS } from '../types'
import { DocumentsAdmin } from './DocumentsAdmin'
import { FieldRecordsAdmin } from './FieldRecordsAdmin'
import { MachinesAdmin } from './MachinesAdmin'
import { MaintenanceAdmin } from './MaintenanceAdmin'
import { UsersAdmin } from './UsersAdmin'

type Tab =
  | 'maquinaria'
  | 'mantenimiento'
  | 'combustible'
  | 'revision_diaria'
  | 'usuarios'
  | 'documentacion'

type Props = {
  user: User
  permissions: Permissions
  onBackField?: () => void
  onLogout: () => void
}

const TAB_COPY: Record<Tab, { title: string; subtitle: string }> = {
  maquinaria: {
    title: 'Maquinaria',
    subtitle: 'Equipos, ficha, QR y pauta (PDF o Excel)',
  },
  mantenimiento: {
    title: 'Mantenimiento',
    subtitle: 'Equipos con pauta PDF: ábrela para ver el archivo y todos los ítems',
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

export function AdminPanel({ user, permissions, onBackField, onLogout }: Props) {
  const tabs = useMemo(() => {
    const list: { id: Tab; label: string }[] = []
    if (permissions.view_machines || permissions.manage_machines) {
      list.push({ id: 'maquinaria', label: 'Maquinaria' })
    }
    list.push({ id: 'mantenimiento', label: 'Mantenimiento' })
    if (permissions.view_all_records || permissions.field_form) {
      list.push({ id: 'combustible', label: 'Combustible' })
      list.push({ id: 'revision_diaria', label: 'Revisión diaria' })
    }
    if (permissions.view_documents || permissions.manage_documents) {
      list.push({ id: 'documentacion', label: 'Documentación' })
    }
    if (permissions.manage_users) {
      list.push({ id: 'usuarios', label: 'Usuarios' })
    }
    return list
  }, [permissions])

  const [tab, setTab] = useState<Tab>(
    user.role === 'mecanico' ? 'mantenimiento' : tabs[0]?.id || 'maquinaria',
  )
  const copy = TAB_COPY[tab]
  const canEditRecords =
    permissions.field_form || permissions.view_all_records || !!user.isPrincipal

  return (
    <div className="desktop-app">
      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <img
            className="sidebar-logo"
            src="/logo-soinver.png"
            alt="SOINVER Ingeniería"
          />
          <p>Panel de control operacional</p>
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
            {onBackField ? (
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
          <img
            className="desktop-topbar-logo"
            src="/logo-soinver.png"
            alt="SOINVER"
          />
        </header>

        <main className="desktop-content">
          {tab === 'maquinaria' ? (
            <MachinesAdmin
              canManage={permissions.manage_machines || !!user.isPrincipal}
              canManageMaintenance={permissions.manage_maintenance || !!user.isPrincipal}
            />
          ) : null}
          {tab === 'mantenimiento' ? (
            <MaintenanceAdmin
              user={user}
              canAssign={permissions.assign_maintenance || !!user.isPrincipal}
              canManage={permissions.manage_maintenance || !!user.isPrincipal}
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
