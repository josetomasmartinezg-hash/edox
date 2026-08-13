import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  MODULE_LABELS,
  type ModuleAccess,
  type ModuleId,
  type UserType,
} from '../types'

type ModuleMeta = { id: ModuleId; label: string }

const MODULE_ORDER: ModuleId[] = [
  'panel',
  'maquinaria',
  'mantenimiento',
  'reparaciones',
  'usuarios',
  'documentacion',
  'combustible',
  'revision_diaria',
]

function emptyModules(): Record<ModuleId, ModuleAccess> {
  return Object.fromEntries(
    MODULE_ORDER.map((id) => [id, { view: false, edit: false, delete: false }]),
  ) as Record<ModuleId, ModuleAccess>
}

function emptyForm() {
  return {
    name: '',
    description: '',
    modules: emptyModules(),
  }
}

function toggleAccess(
  modules: Record<ModuleId, ModuleAccess>,
  moduleId: ModuleId,
  field: keyof ModuleAccess,
  value: boolean,
) {
  const next = { ...modules[moduleId], [field]: value }
  if (field === 'view' && !value) {
    next.edit = false
    next.delete = false
  }
  if ((field === 'edit' || field === 'delete') && value) {
    next.view = true
  }
  if (moduleId === 'mantenimiento' && (next.view || next.edit) && !next.scope) {
    next.scope = 'all'
  }
  if (moduleId === 'reparaciones' && (next.view || next.edit) && !next.scope) {
    next.scope = 'all'
  }
  return { ...modules, [moduleId]: next }
}

export function UserTypesAdmin() {
  const [types, setTypes] = useState<UserType[]>([])
  const [modulesMeta, setModulesMeta] = useState<ModuleMeta[]>([])
  const [form, setForm] = useState(emptyForm())
  const [editing, setEditing] = useState<UserType | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const [typesRes, metaRes] = await Promise.all([
      apiFetch('/api/user-types'),
      apiFetch('/api/user-types/meta'),
    ])
    if (typesRes.ok) setTypes(await typesRes.json())
    if (metaRes.ok) {
      const meta = await metaRes.json()
      setModulesMeta(meta.modules || [])
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function startCreate() {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
    setError('')
  }

  function startEdit(type: UserType) {
    setEditing(type)
    setForm({
      name: type.name,
      description: type.description || '',
      modules: { ...emptyModules(), ...type.modules },
    })
    setShowForm(true)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch(editing ? `/api/user-types/${editing.id}` : '/api/user-types', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar')
      return
    }
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm())
    await load()
  }

  async function remove(type: UserType) {
    if (type.system) return
    if (!confirm(`¿Eliminar el tipo "${type.name}"?`)) return
    const res = await apiFetch(`/api/user-types/${type.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'No se pudo eliminar')
      return
    }
    await load()
  }

  function moduleLabel(id: ModuleId) {
    return modulesMeta.find((m) => m.id === id)?.label || MODULE_LABELS[id] || id
  }

  function summary(type: UserType) {
    const parts = MODULE_ORDER.filter((id) => type.modules[id]?.view).map((id) => {
      const mod = type.modules[id]
      const actions = [
        mod.view ? 'ver' : '',
        mod.edit ? 'editar' : '',
        mod.delete ? 'eliminar' : '',
      ].filter(Boolean)
      const scope =
        (id === 'mantenimiento' || id === 'reparaciones') && mod.scope === 'assigned'
          ? ' (solo asignados)'
          : ''
      return `${moduleLabel(id)}: ${actions.join(', ')}${scope}`
    })
    return parts.length ? parts.join(' · ') : 'Sin acceso'
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Tipos de usuario</h3>
          <p className="section-help">
            Define qué puede ver, editar y eliminar cada perfil en cada módulo.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          Agregar tipo
        </button>
      </div>

      {showForm ? (
        <form className="admin-card" onSubmit={(e) => void handleSubmit(e)}>
          <h4>{editing ? `Editar ${editing.name}` : 'Nuevo tipo de usuario'}</h4>
          <div className="field-grid two">
            <label className="field">
              <span>Nombre</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Mecánico de taller"
                required
              />
            </label>
            <label className="field">
              <span>Descripción</span>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Qué hace este perfil"
              />
            </label>
          </div>

          <div className="table-panel">
            <table className="data-table perm-matrix">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Ver</th>
                  <th>Editar</th>
                  <th>Eliminar</th>
                  <th>Alcance</th>
                </tr>
              </thead>
              <tbody>
                {MODULE_ORDER.map((moduleId) => {
                  const mod = form.modules[moduleId]
                  return (
                    <tr key={moduleId}>
                      <td>{moduleLabel(moduleId)}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={mod.view}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              modules: toggleAccess(form.modules, moduleId, 'view', e.target.checked),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={mod.edit}
                          disabled={!mod.view}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              modules: toggleAccess(form.modules, moduleId, 'edit', e.target.checked),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={mod.delete}
                          disabled={!mod.view}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              modules: toggleAccess(
                                form.modules,
                                moduleId,
                                'delete',
                                e.target.checked,
                              ),
                            })
                          }
                        />
                      </td>
                      <td>
                        {moduleId === 'mantenimiento' || moduleId === 'reparaciones' ? (
                          moduleId === 'mantenimiento' && mod.view ? (
                          <select
                            value={mod.scope || 'all'}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                modules: {
                                  ...form.modules,
                                  mantenimiento: {
                                    ...mod,
                                    scope: e.target.value as 'all' | 'assigned',
                                  },
                                },
                              })
                            }
                          >
                            <option value="all">Todos los mantenimientos</option>
                            <option value="assigned">Solo asignados a él</option>
                          </select>
                          ) : moduleId === 'reparaciones' && mod.view ? (
                          <select
                            value={mod.scope || 'all'}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                modules: {
                                  ...form.modules,
                                  reparaciones: {
                                    ...mod,
                                    scope: e.target.value as 'all' | 'assigned',
                                  },
                                },
                              })
                            }
                          >
                            <option value="all">Todas las reparaciones</option>
                            <option value="assigned">Solo asignadas a él</option>
                          </select>
                          ) : (
                            '—'
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : editing ? 'Actualizar tipo' : 'Crear tipo'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false)
                setEditing(null)
                setForm(emptyForm())
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {error && !showForm ? <p className="form-error">{error}</p> : null}

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Permisos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.id}>
                <td>
                  <strong>{type.name}</strong>
                  {type.system ? <span className="badge pending">Sistema</span> : null}
                  {type.description ? (
                    <p className="section-help">{type.description}</p>
                  ) : null}
                </td>
                <td className="perm-summary">{summary(type)}</td>
                <td>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => startEdit(type)}
                    >
                      Editar
                    </button>
                    {!type.system ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={() => void remove(type)}
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
    </div>
  )
}
