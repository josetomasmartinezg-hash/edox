import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import type { Machine, MachineCategory, MachineDocument, MaintenanceRecord } from '../types'
import {
  MachinePautaEditor,
  cleanPauta,
  emptyPautaList,
} from './MaintenancePautaBlock'

const emptyForm = {
  categoriaId: '',
  marca: '',
  modelo: '',
  anio: '',
  sigla: '',
  capacidadEstanque: '',
  capacidadEstanque2: '',
  numeroChasis: '',
  numeroMotor: '',
  generateQr: true,
  pauta: emptyPautaList(),
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
}

function alertLabel(alert?: string) {
  if (alert === 'expired') return 'Doc. vencido'
  if (alert === 'soon') return 'Doc. por vencer'
  return ''
}

function documentStatusLabel(status?: string, kind?: string) {
  if (kind === 'pauta') return 'Pauta'
  if (status === 'expired') return 'Vencido'
  if (status === 'soon') return 'Por vencer'
  if (status === 'ok') return 'Vigente'
  return 'Sin fecha'
}

function formatDocDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-CL')
  } catch {
    return value
  }
}

type View = 'list' | 'create' | 'detail' | 'edit' | 'categories'
type DetailTab = 'ficha' | 'historial' | 'documentacion'

type Props = {
  canManage: boolean
  canViewMaintenance?: boolean
  onOpenMaintenance?: (id: string) => void
}

function tankCapacityLabel(machine: Pick<Machine, 'capacidadEstanque' | 'capacidadEstanque2'>) {
  const first = machine.capacidadEstanque?.trim()
  const second = machine.capacidadEstanque2?.trim()
  if (first && second) return `${first} L / ${second} L`
  if (first) return `${first} L`
  if (second) return `${second} L`
  return '—'
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

function maintenanceStatusLabel(status?: string) {
  if (status === 'assigned' || status === 'pending') return 'Asignado'
  if (status === 'in_progress') return 'En curso'
  if (status === 'completed') return 'Completado'
  return 'Asignado'
}

function maintenanceStatusClass(status?: string) {
  if (status === 'completed') return 'synced'
  if (status === 'in_progress') return 'pending'
  return 'assigned'
}

export function MachinesAdmin({ canManage, canViewMaintenance, onOpenMaintenance }: Props) {
  const [view, setView] = useState<View>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [categories, setCategories] = useState<MachineCategory[]>([])
  const [form, setForm] = useState(emptyForm)
  const [catForm, setCatForm] = useState({ id: '', name: '' })
  const [editingCat, setEditingCat] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [historial, setHistorial] = useState<HistorialResponse | null>(null)
  const [maintenances, setMaintenances] = useState<MaintenanceRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDocs, setFilterDocs] = useState<'all' | 'expired' | 'soon' | 'ok'>('all')
  const [pautaFile, setPautaFile] = useState<File | null>(null)
  const [pautaParsing, setPautaParsing] = useState(false)
  const [pautaParseMsg, setPautaParseMsg] = useState('')
  const [pautaParseError, setPautaParseError] = useState('')
  const [showDocForm, setShowDocForm] = useState(false)
  const [docName, setDocName] = useState('')
  const [docExpiresAt, setDocExpiresAt] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('ficha')

  const machineMaintenances = useMemo(() => {
    if (!historial?.machine) return []
    const sigla = historial.machine.sigla
    return maintenances.filter(
      (m) => m.machineId === historial.machine.id || m.sigla === sigla,
    )
  }, [maintenances, historial])

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
        machine.capacidadEstanque2,
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
    const [machinesRes, maintRes] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/maintenance'),
      loadCategories(),
    ])
    if (!machinesRes.ok) {
      setError('No se pudieron cargar las máquinas')
      return
    }
    setMachines(await machinesRes.json())
    if (maintRes.ok) setMaintenances(await maintRes.json())
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
    setDetailTab('ficha')
    setShowDocForm(false)
    resetDocForm()
    setView('detail')
  }

  useEffect(() => {
    void loadList()
  }, [])

  function resetDocForm() {
    setShowDocForm(false)
    setDocName('')
    setDocExpiresAt('')
    setDocFile(null)
    setDocLoading(false)
  }

  async function saveDocument(machine: Machine) {
    if (!canManage) return
    if (!docName.trim()) {
      setError('El nombre del documento es obligatorio')
      return
    }
    if (!docFile) {
      setError('Debes subir un PDF o una imagen JPG')
      return
    }
    setDocLoading(true)
    setError('')
    const payload = new FormData()
    payload.append('name', docName.trim())
    payload.append('machineId', machine.id)
    if (docExpiresAt) payload.append('expiresAt', docExpiresAt)
    payload.append('file', docFile)

    const res = await apiFetch('/api/documents', { method: 'POST', body: payload })
    const data = await res.json().catch(() => ({}))
    setDocLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar el documento')
      return
    }
    resetDocForm()
    await loadList()
    await loadDetail(machine.id)
  }

  async function removeDocument(doc: MachineDocument, machineId: string) {
    if (!canManage) return
    if (doc.kind === 'pauta') {
      setError('La pauta se gestiona al editar el equipo')
      return
    }
    if (!confirm(`¿Eliminar documento “${doc.name}”?`)) return
    setError('')
    const res = await apiFetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'No se pudo eliminar el documento')
      return
    }
    await loadList()
    await loadDetail(machineId)
  }

  function resetPautaFile() {
    setPautaFile(null)
    setPautaParsing(false)
    setPautaParseMsg('')
    setPautaParseError('')
  }

  async function handlePautaFile(file: File | null) {
    setPautaFile(file)
    setPautaParseMsg('')
    setPautaParseError('')
    if (!file) return
    setPautaParsing(true)
    const payload = new FormData()
    payload.append('file', file)
    const res = await apiFetch('/api/pauta/parse', { method: 'POST', body: payload })
    const data = await res.json().catch(() => ({}))
    setPautaParsing(false)
    if (!res.ok) {
      setPautaParseError(data.error || 'No se pudo leer el archivo')
      return
    }
    setForm((current) => ({ ...current, pauta: data.pauta || emptyPautaList() }))
    setPautaParseMsg(
      `Pauta extraída: ${data.tipos} tipos, ${data.items} ítems. Revisa y corrige si hace falta.`,
    )
  }

  async function attachPautaFile(machineId: string) {
    if (!pautaFile) return true
    const payload = new FormData()
    payload.append('file', pautaFile)
    const res = await apiFetch(`/api/machines/${machineId}/pauta-file`, {
      method: 'POST',
      body: payload,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'La máquina se guardó, pero no se pudo adjuntar el archivo de pauta')
      return false
    }
    resetPautaFile()
    return true
  }

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
      body: JSON.stringify({ ...form, pauta: cleanPauta(form.pauta) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setLoading(false)
      setError(data.error || 'Error al guardar')
      return
    }
    await attachPautaFile(data.id)
    setLoading(false)
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
      body: JSON.stringify({ ...form, pauta: cleanPauta(form.pauta) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setLoading(false)
      setError(data.error || 'Error al actualizar')
      return
    }
    await attachPautaFile(data.id)
    setLoading(false)
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
    const categoriaId = cats[0]?.id || ''
    setForm({ ...emptyForm, categoriaId, pauta: emptyPautaList() })
    resetPautaFile()
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
      capacidadEstanque2: machine.capacidadEstanque2 || '',
      numeroChasis: machine.numeroChasis || '',
      numeroMotor: machine.numeroMotor || '',
      generateQr: true,
      pauta: machine.pauta?.length ? machine.pauta : emptyPautaList(),
    })
    resetPautaFile()
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
            Completa los datos de la máquina. Puedes subir la pauta en PDF o Excel y generar su QR
            al guardar.
          </p>
        </div>

        <form
          className="admin-card machine-form-card"
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
              <span>Capacidad estanque 2 (L) (opcional)</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={form.capacidadEstanque2}
                onChange={(e) => {
                  const onlyNumbers = e.target.value.replace(/[^\d]/g, '')
                  setForm({ ...form, capacidadEstanque2: onlyNumbers })
                }}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault()
                }}
                placeholder="Opcional"
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

          <p className="section-help field-hint-row">
            <button type="button" className="link-quiet" onClick={openCategories}>
              Administrar categorías
            </button>
          </p>

          <label className="check-inline">
            <input
              type="checkbox"
              checked={form.generateQr}
              onChange={(e) => setForm({ ...form, generateQr: e.target.checked })}
            />
            <span>Generar / actualizar QR al guardar</span>
          </label>

          {canManage ? (
            <MachinePautaEditor
              value={form.pauta}
              onChange={(pauta) => setForm({ ...form, pauta })}
              disabled={loading}
              fileName={pautaFile?.name}
              existingFileName={view === 'edit' ? historial?.machine.pautaFileName : ''}
              parsing={pautaParsing}
              parseMessage={pautaParseMsg}
              parseError={pautaParseError}
              onSelectFile={(file) => void handlePautaFile(file)}
            />
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}
          <div className="machine-form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading || pautaParsing}>
              {loading ? 'Guardando…' : view === 'create' ? 'Guardar máquina' : 'Actualizar'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setView(view === 'edit' && selectedId ? 'detail' : 'list')}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (view === 'detail' && historial) {
    const machine = historial.machine
    const docCount = historial.documents?.length || 0
    const maintCount = machineMaintenances.length

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
                setDetailTab('ficha')
                resetDocForm()
              }}
            >
              Volver a lista
            </button>
          </div>
          <p className="section-help">
            {machine.marca} {machine.modelo}
            {machine.categoria ? ` · ${machine.categoria}` : ''}
          </p>
        </div>

        <div className="detail-tabs" role="tablist" aria-label="Secciones del equipo">
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'ficha'}
            className={`detail-tab ${detailTab === 'ficha' ? 'active' : ''}`}
            onClick={() => setDetailTab('ficha')}
          >
            Ficha
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'historial'}
            className={`detail-tab ${detailTab === 'historial' ? 'active' : ''}`}
            onClick={() => setDetailTab('historial')}
          >
            Historial{maintCount ? ` (${maintCount})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'documentacion'}
            className={`detail-tab ${detailTab === 'documentacion' ? 'active' : ''}`}
            onClick={() => setDetailTab('documentacion')}
          >
            Documentación{docCount ? ` (${docCount})` : ''}
          </button>
        </div>

        {detailTab === 'ficha' ? (
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
                  <div className="detail-value">{tankCapacityLabel(machine)}</div>
                </div>
                <div>
                  <div className="detail-label">Número de chasis</div>
                  <div className="detail-value">{machine.numeroChasis || '—'}</div>
                </div>
                <div>
                  <div className="detail-label">Número de motor</div>
                  <div className="detail-value">{machine.numeroMotor || '—'}</div>
                </div>
                <div>
                  <div className="detail-label">Pauta (archivo)</div>
                  <div className="detail-value">
                    {machine.pautaFileUrl ? (
                      <a
                        href={machine.pautaFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="link-quiet"
                      >
                        {machine.pautaFileName || 'Ver archivo'}
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
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
        ) : null}

        {detailTab === 'historial' ? (
          <div className="admin-card">
            <h4>Historial de mantenimiento</h4>
            <p className="section-help">
              Mantenimientos registrados para este equipo en el módulo Trabajos.
            </p>
            <div className="table-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Asignado a</th>
                    <th>Medidor</th>
                    <th>Ítems OK</th>
                    <th>Observaciones</th>
                    {canViewMaintenance ? <th></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {machineMaintenances.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className={`badge ${maintenanceStatusClass(item.status)}`}>
                          {maintenanceStatusLabel(item.status)}
                        </span>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.tipoMantenimiento}</td>
                      <td>{item.asignadoNombre || item.mecanicoNombre || '—'}</td>
                      <td>{item.horometro || '—'}</td>
                      <td>
                        {item.tareas?.filter((t) => t.realizado).length || 0}
                        {item.tareas?.length ? ` / ${item.tareas.length}` : ''}
                      </td>
                      <td>{item.observaciones || '—'}</td>
                      {canViewMaintenance ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() => onOpenMaintenance?.(item.id)}
                          >
                            Ver detalle
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!machineMaintenances.length ? (
                    <tr>
                      <td colSpan={canViewMaintenance ? 8 : 7} className="empty-cell">
                        Aún no hay mantenimientos registrados para este equipo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {detailTab === 'documentacion' ? (
          <div className="admin-card">
            <div className="meta-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h4>Documentación</h4>
                <p className="section-help">
                  Permisos, seguros y otros archivos del equipo. PDF o JPG con fecha de vencimiento
                  opcional.
                </p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  onClick={() => {
                    setShowDocForm((current) => !current)
                    setError('')
                  }}
                >
                  {showDocForm ? 'Cerrar' : 'Agregar documento'}
                </button>
              ) : null}
            </div>

            {showDocForm && canManage ? (
              <form
                className="admin-card"
                style={{ marginBottom: 16 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveDocument(machine)
                }}
              >
                <div className="field-grid two">
                  <label className="field">
                    <span>Nombre</span>
                    <input
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      required
                      placeholder="Ej: Permiso de circulación"
                    />
                  </label>
                  <label className="field">
                    <span>Fecha de vencimiento (opcional)</span>
                    <input
                      type="date"
                      value={docExpiresAt}
                      onChange={(e) => setDocExpiresAt(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Archivo (PDF o JPG)</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                      required
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <div className="btn-row">
                  <button type="submit" className="btn btn-primary" disabled={docLoading}>
                    {docLoading ? 'Subiendo…' : 'Guardar documento'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={resetDocForm}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}

            <div className="legend-row">
              <span className="legend-item soon">Por vencer (≤ 30 días)</span>
              <span className="legend-item expired">Vencido</span>
            </div>

            <div className="table-panel">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Nombre</th>
                    <th>Vencimiento</th>
                    <th>Archivo</th>
                    {canManage ? <th></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {(historial.documents || []).map((doc) => (
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
                          {documentStatusLabel(doc.status, doc.kind)}
                        </span>
                      </td>
                      <td>{doc.name}</td>
                      <td>{doc.kind === 'pauta' ? '—' : formatDocDate(doc.expiresAt)}</td>
                      <td>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="link-quiet"
                        >
                          {doc.fileName || 'Ver archivo'}
                        </a>
                      </td>
                      {canManage ? (
                        <td>
                          {doc.kind !== 'pauta' ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-small"
                              onClick={() => void removeDocument(doc, machine.id)}
                            >
                              Eliminar
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {!historial.documents?.length ? (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} className="empty-cell">
                        Aún no hay documentos para este equipo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

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
                <td>{tankCapacityLabel(machine)}</td>
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
