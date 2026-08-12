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
  | 'combustible'
  | 'revision_diaria'
  | 'mantenimiento'
  | 'programa_mantenimiento'
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
    subtitle: 'Listado de equipos, ficha e historial de ingresos',
  },
  combustible: {
    title: 'Combustible',
    subtitle: 'Cargas de combustible por equipo',
  },
  revision_diaria: {
    title: 'Revisión diaria',
    subtitle: 'Chequeos diarios antes de operar',
  },
  mantenimiento: {
    title: 'Mantenimiento',
    subtitle: 'Pauta 10.000 / 20.000 km con checklist OK',
  },
  programa_mantenimiento: {
    title: 'Programa de mantenimiento',
    subtitle: 'Registrar pauta por equipo: tipo, ítems OK y observaciones',
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
    if (permissions.view_all_records || permissions.field_form) {
      list.push({ id: 'combustible', label: 'Combustible' })
      list.push({ id: 'revision_diaria', label: 'Revisión diaria' })
      list.push({ id: 'mantenimiento', label: 'Mantenimiento' })
    }
    if (permissions.view_maintenance || permissions.manage_maintenance) {
      list.push({ id: 'programa_mantenimiento', label: 'Programa mant.' })
    }
    if (permissions.view_documents || permissions.manage_documents) {
      list.push({ id: 'documentacion', label: 'Documentación' })
    }
    if (permissions.manage_users) {
      list.push({ id: 'usuarios', label: 'Usuarios' })
    }
    return list
  }, [permissions])

  const [tab, setTab] = useState<Tab>(tabs[0]?.id || 'maquinaria')
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
          <img
            className="desktop-topbar-logo"
            src="/logo-soinver.png"
            alt="SOINVER"
          />
        </header>

        <main className="desktop-content">
          {tab === 'maquinaria' ? (
            <MachinesAdmin canManage={permissions.manage_machines || !!user.isPrincipal} />
          ) : null}
          {tab === 'combustible' ? (
            <FieldRecordsAdmin tipo="combustible" user={user} canManage={canEditRecords} />
          ) : null}
          {tab === 'revision_diaria' ? (
            <FieldRecordsAdmin tipo="revision_diaria" user={user} canManage={canEditRecords} />
          ) : null}
          {tab === 'mantenimiento' ? (
            <FieldRecordsAdmin tipo="mantenimiento" user={user} canManage={canEditRecords} />
          ) : null}
          {tab === 'programa_mantenimiento' ? (
            <MaintenanceAdmin canManage={permissions.manage_maintenance || !!user.isPrincipal} />
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
