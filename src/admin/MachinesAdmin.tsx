import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import type { Machine, MachineCategory, MachineDocument } from '../types'

const emptyForm = {
  categoriaId: '',
  marca: '',
  modelo: '',
  anio: '',
  sigla: '',
  capacidadEstanque: '',
  numeroChasis: '',
  numeroMotor: '',
  generateQr: true,
}

type TimelineItem = {
  id: string
  kind: 'combustible' | 'mantenimiento'
  title: string
  fecha: string
  createdAt: string
  operador?: string
  litrosEnEstanque?: string
  litrosCargados?: string
  guiaNumero?: string
  horasInicial?: string
  horasFinal?: string
  horometro?: string
  mecanicoNombre?: string
  tareas?: Array<{ id: string; label: string }>
  observaciones?: string
  photoUrl?: string | null
}

type HistorialResponse = {
  machine: Machine
  resumen: {
    totalRegistros: number
    totalMantenimientos: number
    totalDocumentos?: number
    ultimoRegistro: string | null
  }
  documents?: MachineDocument[]
  timeline: TimelineItem[]
}

function alertLabel(alert?: string) {
  if (alert === 'expired') return 'Doc. vencido'
  if (alert === 'soon') return 'Doc. por vencer'
  return ''
}

type View = 'list' | 'create' | 'detail' | 'edit' | 'categories'

type Props = {
  canManage: boolean
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

export function MachinesAdmin({ canManage }: Props) {
  const [view, setView] = useState<View>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [categories, setCategories] = useState<MachineCategory[]>([])
  const [form, setForm] = useState(emptyForm)
  const [catForm, setCatForm] = useState({ id: '', name: '' })
  const [editingCat, setEditingCat] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [historial, setHistorial] = useState<HistorialResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDocs, setFilterDocs] = useState<'all' | 'expired' | 'soon' | 'ok'>('all')

  const filteredMachines = useMemo(() => {
    const q = search.trim().toLowerCase()
    return machines.filter((machine) => {
      if (filterCategory) {
        const byId = machine.categoriaId === filterCategory
        const byName =
          categories.find((c) => c.id === filterCategory)?.name === machine.categoria
        if (!byId && !byName) return false
      }
      if (filterDocs === 'expired' && machine.documentAlert !== 'expired') return false
      if (filterDocs === 'soon' && machine.documentAlert !== 'soon') return false
      if (
        filterDocs === 'ok' &&
        (machine.documentAlert === 'expired' || machine.documentAlert === 'soon')
      ) {
        return false
      }
      if (!q) return true
      const haystack = [
        machine.sigla,
        machine.marca,
        machine.modelo,
        machine.anio,
        machine.categoria,
        machine.numeroChasis,
        machine.numeroMotor,
        machine.capacidadEstanque,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [machines, categories, search, filterCategory, filterDocs])

  async function loadCategories() {
    const res = await apiFetch('/api/categories')
    if (!res.ok) return []
    const data = (await res.json()) as MachineCategory[]
    setCategories(data)
    return data
  }

  async function loadList() {
    const [machinesRes] = await Promise.all([apiFetch('/api/machines'), loadCategories()])
    if (!machinesRes.ok) {
      setError('No se pudieron cargar las máquinas')
      return
    }
    setMachines(await machinesRes.json())
  }

  async function loadDetail(id: string) {
    setLoading(true)
    setError('')
    const res = await apiFetch(`/api/machines/${id}/historial`)
    setLoading(false)
    if (!res.ok) {
      setError('No se pudo abrir la máquina')
      return
    }
    const data = (await res.json()) as HistorialResponse
    setHistorial(data)
    setSelectedId(id)
    setView('detail')
  }

  useEffect(() => {
    void loadList()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    if (!form.categoriaId) {
      setError('Debes seleccionar una categoría')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch('/api/machines', {
      method: 'POST',
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Error al guardar')
      return
    }
    setForm(emptyForm)
    await loadList()
    await loadDetail(data.id)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage || !selectedId) return
    if (!form.categoriaId) {
      setError('Debes seleccionar una categoría')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch(`/api/machines/${selectedId}`, {
      method: 'PUT',
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'Error al actualizar')
      return
    }
    await loadList()
    await loadDetail(data.id)
  }

  async function generateQr(machine: Machine) {
    const res = await apiFetch(`/api/machines/${machine.id}/qr`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo generar QR')
      return
    }
    await loadDetail(machine.id)
    await loadList()
  }

  async function remove(machine: Machine) {
    if (!confirm(`¿Eliminar máquina ${machine.sigla}?`)) return
    await apiFetch(`/api/machines/${machine.id}`, { method: 'DELETE' })
    setHistorial(null)
    setSelectedId(null)
    setView('list')
    await loadList()
  }

  async function openCreate() {
    setError('')
    const cats = categories.length ? categories : await loadCategories()
    setForm({ ...emptyForm, categoriaId: cats[0]?.id || '' })
    setView('create')
  }

  function openEdit(machine: Machine) {
    setForm({
      categoriaId: machine.categoriaId || '',
      marca: machine.marca,
      modelo: machine.modelo,
      anio: machine.anio,
      sigla: machine.sigla,
      capacidadEstanque: machine.capacidadEstanque,
      numeroChasis: machine.numeroChasis || '',
      numeroMotor: machine.numeroMotor || '',
      generateQr: true,
    })
    setError('')
    setView('edit')
  }

  function openCategories() {
    setCatForm({ id: '', name: '' })
    setEditingCat(false)
    setError('')
    setView('categories')
    void loadCategories()
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    const name = catForm.name.trim()
    if (!name) {
      setError('Ingrese el nombre de la categoría')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch(editingCat ? `/api/categories/${catForm.id}` : '/api/categories', {
      method: editingCat ? 'PUT' : 'POST',
      body: JSON.stringify({ name }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar la categoría')
      return
    }
    setCatForm({ id: '', name: '' })
    setEditingCat(false)
    await loadList()
  }

  async function deleteCategory(category: MachineCategory) {
    if (!canManage) return
    if (!confirm(`¿Eliminar categoría "${category.name}"?`)) return
    setError('')
    const res = await apiFetch(`/api/categories/${category.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'No se pudo eliminar la categoría')
      return
    }
    await loadList()
  }

  function startEditCategory(category: MachineCategory) {
    setCatForm({ id: category.id, name: category.name })
    setEditingCat(true)
    setError('')
  }

  if (view === 'categories') {
    return (
      <div className="admin-section">
        <div className="section">
          <div className="meta-row" style={{ justifyContent: 'space-between' }}>
            <h3 className="section-title">Categorías de maquinaria</h3>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setView('list')}>
              Volver a lista
            </button>
          </div>
          <p className="section-help">
            Agrega, edita o elimina categorías. No se puede eliminar una categoría si hay equipos usándola.
          </p>
        </div>

        {canManage ? (
          <form className="admin-card" onSubmit={(e) => void saveCategory(e)}>
            <label className="field">
              <span>{editingCat ? 'Editar categoría' : 'Nueva categoría'}</span>
              <input
                value={catForm.name}
                onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                placeholder="Ej: Excavadora"
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Guardando…' : editingCat ? 'Guardar cambios' : 'Agregar categoría'}
              </button>
              {editingCat ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditingCat(false)
                    setCatForm({ id: '', name: '' })
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Equipos</th>
                {canManage ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const count = machines.filter((m) => m.categoriaId === category.id).length
                return (
                  <tr key={category.id}>
                    <td>
                      <strong>{category.name}</strong>
                    </td>
                    <td>{count}</td>
                    {canManage ? (
                      <td className="row-cta">
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => startEditCategory(category)}
                        >
                          Editar
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-danger btn-small"
                          onClick={() => void deleteCategory(category)}
                        >
                          Eliminar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
              {!categories.length ? (
                <tr>
                  <td colSpan={canManage ? 3 : 2} className="empty-cell">
                    No hay categorías.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div className="admin-section">
        <div className="section">
          <div className="meta-row" style={{ justifyContent: 'space-between' }}>
            <h3 className="section-title">
              {view === 'create' ? 'Agregar maquinaria' : 'Editar maquinaria'}
            </h3>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setView(view === 'edit' && selectedId ? 'detail' : 'list')}
            >
              Volver
            </button>
          </div>
          <p className="section-help">
            Completa los datos de la máquina. Puedes generar su QR al guardar.
          </p>
        </div>

        <form
          className="admin-card"
          onSubmit={(e) => void (view === 'create' ? handleCreate(e) : handleUpdate(e))}
        >
          <div className="field-grid two">
            <label className="field">
              <span>Categoría</span>
              <select
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                required
              >
                <option value="">Seleccione categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-small" onClick={openCategories}>
                Administrar categorías
              </button>
            </div>
            <label className="field">
              <span>Marca</span>
              <input
                value={form.marca}
                onChange={(e) => setForm({ ...form, marca: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Modelo</span>
              <input
                value={form.modelo}
                onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Año</span>
              <input
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Sigla</span>
              <input
                value={form.sigla}
                onChange={(e) => setForm({ ...form, sigla: e.target.value })}
                required
                placeholder="Ej: 75 D 35"
              />
            </label>
            <label className="field">
              <span>Capacidad estanque (L)</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={form.capacidadEstanque}
                onChange={(e) => {
                  const onlyNumbers = e.target.value.replace(/[^\d]/g, '')
                  setForm({ ...form, capacidadEstanque: onlyNumbers })
                }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault()
                }}
                placeholder="Solo números"
              />
            </label>
            <label className="field">
              <span>Número de chasis</span>
              <input
                value={form.numeroChasis}
                onChange={(e) => setForm({ ...form, numeroChasis: e.target.value })}
                placeholder="Nº de chasis"
              />
            </label>
            <label className="field">
              <span>Número de motor</span>
              <input
                value={form.numeroMotor}
                onChange={(e) => setForm({ ...form, numeroMotor: e.target.value })}
                placeholder="Nº de motor"
              />
            </label>
          </div>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={form.generateQr}
              onChange={(e) => setForm({ ...form, generateQr: e.target.checked })}
            />
            Generar / actualizar QR al guardar
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : view === 'create' ? 'Guardar máquina' : 'Actualizar'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (view === 'detail' && historial) {
    const machine = historial.machine
    return (
      <div className="admin-section">
        <div className="section">
          <div className="meta-row" style={{ justifyContent: 'space-between' }}>
            <h3 className="section-title">{machine.sigla}</h3>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => {
                setView('list')
                setHistorial(null)
              }}
            >
              Volver a lista
            </button>
          </div>
          <p className="section-help">
            Ficha de la máquina y todo lo que se ha ingresado (combustible y mantenimiento).
          </p>
        </div>

        <div className="desktop-grid-2">
          <div className="admin-card">
            <h4>Datos del equipo</h4>
            <div className="field-grid two">
              <div>
                <div className="detail-label">Categoría</div>
                <div className="detail-value">{machine.categoria || '—'}</div>
              </div>
              <div>
                <div className="detail-label">Marca</div>
                <div className="detail-value">{machine.marca}</div>
              </div>
              <div>
                <div className="detail-label">Modelo</div>
                <div className="detail-value">{machine.modelo}</div>
              </div>
              <div>
                <div className="detail-label">Año</div>
                <div className="detail-value">{machine.anio || '—'}</div>
              </div>
              <div>
                <div className="detail-label">Capacidad estanque</div>
                <div className="detail-value">
                  {machine.capacidadEstanque ? `${machine.capacidadEstanque} L` : '—'}
                </div>
              </div>
              <div>
                <div className="detail-label">Número de chasis</div>
                <div className="detail-value">{machine.numeroChasis || '—'}</div>
              </div>
              <div>
                <div className="detail-label">Número de motor</div>
                <div className="detail-value">{machine.numeroMotor || '—'}</div>
              </div>
            </div>

            <div className="stat-row">
              <div className="stat-box">
                <strong>{historial.resumen.totalRegistros}</strong>
                <span>Partes / combustible</span>
              </div>
              <div className="stat-box">
                <strong>{historial.resumen.totalMantenimientos}</strong>
                <span>Mantenimientos</span>
              </div>
              <div className="stat-box">
                <strong>{formatDate(historial.resumen.ultimoRegistro)}</strong>
                <span>Último ingreso</span>
              </div>
            </div>

            <div className="btn-row">
              {machine.qrDataUrl ? (
                <a
                  className="btn btn-primary btn-small"
                  href={machine.qrDataUrl}
                  download={`qr-${machine.sigla}.png`}
                >
                  Descargar QR
                </a>
              ) : canManage ? (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => void generateQr(machine)}
                >
                  Generar QR
                </button>
              ) : null}
              {canManage ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => openEdit(machine)}
                  >
                    Editar datos
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => void remove(machine)}
                  >
                    Eliminar
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="admin-card qr-card">
            <h4>Código QR</h4>
            {machine.qrDataUrl ? (
              <img src={machine.qrDataUrl} alt={`QR ${machine.sigla}`} className="qr-image" />
            ) : (
              <div className="empty">Sin QR generado</div>
            )}
          </div>
        </div>

        {historial.documents?.length ? (
          <>
            <div className="section">
              <h3 className="section-title">Documentos del equipo</h3>
            </div>
            <div className="table-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Nombre</th>
                    <th>Vencimiento</th>
                    <th>Archivo</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className={
                        doc.status === 'expired'
                          ? 'row-alert-expired'
                          : doc.status === 'soon'
                            ? 'row-alert-soon'
                            : ''
                      }
                    >
                      <td>
                        <span
                          className={`badge ${
                            doc.status === 'expired'
                              ? 'error'
                              : doc.status === 'soon'
                                ? 'pending'
                                : 'synced'
                          }`}
                        >
                          {alertLabel(doc.status) || 'Vigente'}
                        </span>
                      </td>
                      <td>{doc.name}</td>
                      <td>{doc.expiresAt || '—'}</td>
                      <td>
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="link-quiet">
                          Ver
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <div className="section">
          <h3 className="section-title">Historial de ingresos</h3>
          <p className="section-help">
            Registros de terreno y mantenimientos asociados a esta sigla.
          </p>
        </div>

        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>Responsable</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {historial.timeline.map((item) => (
                <tr key={`${item.kind}-${item.id}`}>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <span className={`badge ${item.kind === 'combustible' ? 'pending' : 'synced'}`}>
                      {item.kind === 'combustible' ? 'Combustible' : 'Mantenimiento'}
                    </span>
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    {item.kind === 'combustible' ? (
                      <div className="table-sub">
                        Estanque {item.litrosEnEstanque || '—'} L · Cargados{' '}
                        {item.litrosCargados || '—'} L
                        {item.guiaNumero ? ` · Guía ${item.guiaNumero}` : ''}
                      </div>
                    ) : (
                      <div className="table-sub">
                        Horómetro {item.horometro || '—'}
                        {item.tareas?.length ? ` · ${item.tareas.length} tareas` : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    {item.kind === 'combustible' ? item.operador : item.mecanicoNombre}
                  </td>
                  <td>{item.observaciones || '—'}</td>
                </tr>
              ))}
              {!historial.timeline.length ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    Aún no hay ingresos para esta máquina.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Lista de maquinaria</h3>
          <p className="section-help">
            Selecciona una máquina para ver su ficha e historial. Amarillo = documento por vencer,
            rojo = documento vencido.
          </p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={openCategories}>
            Categorías
          </button>
          {canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => void openCreate()}>
              Agregar maquinaria
            </button>
          ) : null}
        </div>
      </div>

      <div className="legend-row">
        <span className="legend-item soon">Documento por vencer</span>
        <span className="legend-item expired">Documento vencido</span>
      </div>

      <div className="machines-filters">
        <label className="field search-field">
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sigla, marca, modelo, chasis…"
          />
        </label>
        <label className="field">
          <span>Categoría</span>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Documentos</span>
          <select
            value={filterDocs}
            onChange={(e) => setFilterDocs(e.target.value as typeof filterDocs)}
          >
            <option value="all">Todos</option>
            <option value="expired">Vencidos</option>
            <option value="soon">Por vencer</option>
            <option value="ok">Sin alerta</option>
          </select>
        </label>
        {(search || filterCategory || filterDocs !== 'all') && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setSearch('')
              setFilterCategory('')
              setFilterDocs('all')
            }}
          >
            Limpiar
          </button>
        )}
      </div>
      <p className="section-help filter-count">
        Mostrando {filteredMachines.length} de {machines.length} equipos
      </p>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sigla</th>
              <th>Categoría</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Año</th>
              <th>Capacidad</th>
              <th>Nº chasis</th>
              <th>Nº motor</th>
              <th>Docs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredMachines.map((machine) => (
              <tr
                key={machine.id}
                className={`clickable-row ${
                  machine.documentAlert === 'expired'
                    ? 'row-alert-expired'
                    : machine.documentAlert === 'soon'
                      ? 'row-alert-soon'
                      : ''
                }`}
                onClick={() => void loadDetail(machine.id)}
              >
                <td>
                  <strong>{machine.sigla}</strong>
                </td>
                <td>{machine.categoria || '—'}</td>
                <td>{machine.marca}</td>
                <td>{machine.modelo}</td>
                <td>{machine.anio || '—'}</td>
                <td>{machine.capacidadEstanque ? `${machine.capacidadEstanque} L` : '—'}</td>
                <td>{machine.numeroChasis || '—'}</td>
                <td>{machine.numeroMotor || '—'}</td>
                <td>
                  {machine.documentAlert === 'expired' || machine.documentAlert === 'soon' ? (
                    <span
                      className={`badge ${
                        machine.documentAlert === 'expired' ? 'error' : 'pending'
                      }`}
                    >
                      {alertLabel(machine.documentAlert)}
                    </span>
                  ) : (
                    machine.documentsCount || 0
                  )}
                </td>
                <td className="row-cta">Abrir</td>
              </tr>
            ))}
            {!machines.length ? (
              <tr>
                <td colSpan={10} className="empty-cell">
                  No hay maquinaria.{' '}
                  {canManage ? 'Usa “Agregar maquinaria” para crear la primera.' : ''}
                </td>
              </tr>
            ) : null}
            {machines.length && !filteredMachines.length ? (
              <tr>
                <td colSpan={10} className="empty-cell">
                  Ningún equipo coincide con la búsqueda o el filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {loading ? <p className="section-help">Cargando…</p> : null}
    </div>
  )
}
