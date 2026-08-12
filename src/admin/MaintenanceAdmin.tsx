import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/auth'
import {
  ROLE_LABELS,
  type Machine,
  type MaintenanceRecord,
  type User,
} from '../types'
import {
  MachinePautaRun,
  cleanPauta,
  emptyPautaRun,
  machineHasPauta,
  type PautaRunDraft,
} from './MaintenancePautaBlock'

type Assignee = {
  id: string
  name: string
  role: User['role']
}

type Props = {
  user: User
  canAssign: boolean
  canManage: boolean
}

function statusLabel(status?: string) {
  if (status === 'pending') return 'Pendiente'
  if (status === 'in_progress') return 'En curso'
  if (status === 'completed') return 'Completado'
  return 'Pendiente'
}

function statusClass(status?: string) {
  if (status === 'completed') return 'synced'
  if (status === 'in_progress') return 'pending'
  return 'error'
}

function formatDate(value?: string) {
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

function draftFromPauta(
  pauta: ReturnType<typeof cleanPauta>,
  item?: MaintenanceRecord | null,
): PautaRunDraft {
  const doneTasks: Record<string, boolean> = {}
  for (const task of item?.tareas || []) doneTasks[task.id] = !!task.realizado
  return {
    tipoId: item?.intervaloId || pauta[0]?.id || 'tipo',
    horometro: item?.horometro || '',
    doneTasks,
    observaciones: item?.observaciones || '',
  }
}

function pautaForMachine(machine?: Machine | null, item?: MaintenanceRecord | null) {
  const fromJob = cleanPauta(item?.pauta || [])
  if (fromJob.length) return fromJob
  const fromMachine = cleanPauta(machine?.pauta || [])
  if (fromMachine.length) return fromMachine
  if (item?.tareas?.length) {
    return [
      {
        id: item.intervaloId || 'tipo',
        nombre: item.tipoMantenimiento || 'Pauta',
        items: item.tareas.map((task) => ({ id: task.id, label: task.label })),
      },
    ]
  }
  return []
}

function openJobFor(items: MaintenanceRecord[], machineId: string) {
  return (
    items.find(
      (item) =>
        item.machineId === machineId &&
        (item.status === 'pending' || item.status === 'in_progress'),
    ) || null
  )
}

export function MaintenanceAdmin({ user, canAssign, canManage }: Props) {
  const [view, setView] = useState<'list' | 'pauta'>('list')
  const [machines, setMachines] = useState<Machine[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [items, setItems] = useState<MaintenanceRecord[]>([])
  const [runDraft, setRunDraft] = useState<PautaRunDraft>(emptyPautaRun())
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null)
  const [selected, setSelected] = useState<MaintenanceRecord | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState('')

  const machinesWithPauta = useMemo(
    () => machines.filter((m) => machineHasPauta(m)),
    [machines],
  )

  const myJobs = useMemo(
    () =>
      items.filter(
        (item) =>
          item.asignadoId === user.id &&
          (item.status === 'pending' || item.status === 'in_progress'),
      ),
    [items, user.id],
  )

  async function load() {
    const [mRes, iRes, oRes] = await Promise.all([
      apiFetch('/api/machines'),
      apiFetch('/api/maintenance'),
      apiFetch('/api/operators'),
    ])
    let nextMachines: Machine[] = []
    let nextItems: MaintenanceRecord[] = []
    if (mRes.ok) {
      nextMachines = await mRes.json()
      setMachines(nextMachines)
    }
    if (iRes.ok) {
      nextItems = await iRes.json()
      setItems(nextItems)
    }
    if (oRes.ok) {
      const people = (await oRes.json()) as Assignee[]
      setAssignees(
        people.filter(
          (p) => p.role === 'mecanico' || p.role === 'supervisor' || p.role === 'administrador',
        ),
      )
    }
    return { machines: nextMachines, items: nextItems }
  }

  useEffect(() => {
    void load()
  }, [])

  function openPauta(machine: Machine, job?: MaintenanceRecord | null) {
    const open = job || openJobFor(items, machine.id)
    const pauta = pautaForMachine(machine, open)
    setSelectedMachine(machine)
    setSelected(open)
    setRunDraft(draftFromPauta(pauta, open))
    setError('')
    setView('pauta')
  }

  function openJob(item: MaintenanceRecord) {
    const machine =
      machines.find((m) => m.id === item.machineId) ||
      machines.find((m) => m.sigla === item.sigla) ||
      null
    if (machine) {
      openPauta(machine, item)
      return
    }
    const pauta = pautaForMachine(null, item)
    setSelectedMachine(null)
    setSelected(item)
    setRunDraft(draftFromPauta(pauta, item))
    setError('')
    setView('pauta')
  }

  function closePauta() {
    setView('list')
    setSelected(null)
    setSelectedMachine(null)
  }

  async function assignPerson(machine: Machine, personId: string) {
    if (!canAssign) return
    const pauta = cleanPauta(machine.pauta || [])
    if (!pauta.length && !machine.pautaFileUrl) {
      setError('Este equipo no tiene pauta. Súbela en Maquinaria (PDF o Excel).')
      return
    }
    if (!personId) return
    const open = openJobFor(items, machine.id)
    setSavingId(machine.id)
    setError('')
    const res = open
      ? await apiFetch(`/api/maintenance/${open.id}`, {
          method: 'PUT',
          body: JSON.stringify({ asignadoId: personId }),
        })
      : await apiFetch('/api/maintenance', {
          method: 'POST',
          body: JSON.stringify({
            machineId: machine.id,
            sigla: machine.sigla,
            pauta,
            asignadoId: personId,
            status: 'pending',
            tipoMantenimiento: machine.pautaFileName || 'Pauta',
          }),
        })
    const data = await res.json().catch(() => ({}))
    setSavingId('')
    if (!res.ok) {
      setError(data.error || 'No se pudo asignar')
      return
    }
    const next = await load()
    const nextMachine = next.machines.find((m) => m.id === machine.id) || machine
    const nextJob = openJobFor(next.items, machine.id)
    if (view === 'pauta') openPauta(nextMachine, nextJob)
  }

  async function saveProgress(complete: boolean) {
    if (!selected || !canManage) return
    if (complete && !runDraft.horometro.trim()) {
      setError('Ingresa el kilometraje u horómetro para completar')
      return
    }
    const pauta = pautaForMachine(selectedMachine, selected)
    const tareas = pauta.flatMap((tipo) =>
      tipo.items.map((item) => ({
        id: item.id,
        label: item.label,
        realizado: !!runDraft.doneTasks[item.id],
      })),
    )
    if (complete && !tareas.some((t) => t.realizado) && !runDraft.observaciones.trim()) {
      setError('Marca al menos un ítem o deja un comentario')
      return
    }
    setLoading(true)
    setError('')
    const res = await apiFetch(`/api/maintenance/${selected.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        horometro: runDraft.horometro.trim(),
        observaciones: runDraft.observaciones.trim(),
        intervaloId: runDraft.tipoId,
        tipoMantenimiento:
          pauta.find((t) => t.id === runDraft.tipoId)?.nombre || selected.tipoMantenimiento,
        pauta,
        tareas,
        status: complete
          ? 'completed'
          : tareas.some((t) => t.realizado)
            ? 'in_progress'
            : 'pending',
      }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(data.error || 'No se pudo guardar')
      return
    }
    closePauta()
    await load()
  }

  if (view === 'pauta' && (selectedMachine || selected)) {
    const machine = selectedMachine
    const job = selected
    const pauta = pautaForMachine(machine, job)
    const mine = job?.asignadoId === user.id
    const canEdit = Boolean(
      job && canManage && (mine || canAssign) && job.status !== 'completed',
    )
    const fileUrl = machine?.pautaFileUrl || job?.pautaFileUrl
    const fileName = machine?.pautaFileName || job?.pautaFileName
    const mimeType = machine?.pautaMimeType || job?.pautaMimeType

    return (
      <div className="admin-section">
        <div className="toolbar">
          <div>
            <h3 className="section-title">
              {machine?.sigla || job?.sigla} · {fileName || job?.tipoMantenimiento || 'Pauta'}
            </h3>
            <p className="section-help">
              {machine ? `${machine.marca} ${machine.modelo}` : ''}
              {job
                ? ` · Asignado a ${job.asignadoNombre || '—'} · ${statusLabel(job.status)}`
                : ' · Aún sin asignar'}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={closePauta}>
            Volver
          </button>
        </div>

        {canAssign && machine ? (
          <div className="admin-card">
            <label className="field">
              <span>Asignar a</span>
              <select
                value={job?.asignadoId || ''}
                disabled={savingId === machine.id || job?.status === 'completed'}
                onChange={(e) => void assignPerson(machine, e.target.value)}
              >
                <option value="">Seleccionar persona…</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {ROLE_LABELS[person.role] || person.role}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="admin-card">
          <MachinePautaRun
            pauta={pauta}
            draft={runDraft}
            onChange={setRunDraft}
            disabled={loading || !canEdit}
            title="Pauta del PDF"
            help="Aquí está la pauta completa del archivo. Revisa el PDF y marca OK lo que vas haciendo."
            commentLabel="Comentario extra"
            commentPlaceholder="Hallazgos, repuestos, algo que no estaba en la pauta…"
            fileUrl={fileUrl}
            fileName={fileName}
            mimeType={mimeType}
          />
          {error ? <p className="form-error">{error}</p> : null}
          {canEdit ? (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading}
                onClick={() => void saveProgress(false)}
              >
                {loading ? 'Guardando…' : 'Guardar avance'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading}
                onClick={() => void saveProgress(true)}
              >
                Completar mantenimiento
              </button>
            </div>
          ) : (
            <p className="section-help">
              {job?.status === 'completed'
                ? 'Este mantenimiento ya está completado.'
                : job
                  ? 'Solo el asignado puede ir marcando la pauta.'
                  : 'Asigna una persona para que pueda marcar los ítems.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!canAssign) {
    return (
      <div className="admin-section">
        <div className="toolbar">
          <div>
            <h3 className="section-title">Mantenimiento</h3>
            <p className="section-help">
              Estos son los equipos que te asignaron. Ábrelos para ver la pauta del PDF, marca OK y
              deja un comentario si hay algo extra.
            </p>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Equipo</th>
                <th>Pauta</th>
                <th>Avance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {myJobs.map((item) => {
                const machine = machines.find((m) => m.id === item.machineId)
                const pauta = pautaForMachine(machine, item)
                const done = item.tareas?.filter((t) => t.realizado).length || 0
                const total = item.tareas?.length || pauta.reduce((sum, tipo) => sum + tipo.items.length, 0)
                return (
                  <tr key={item.id} className="row-alert-soon">
                    <td>
                      <span className={`badge ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      <strong>{item.sigla}</strong>
                    </td>
                    <td>
                      {machine?.pautaFileName || item.tipoMantenimiento}
                      <div className="table-sub">
                        {pauta.length} tipos · {total} ítems
                      </div>
                    </td>
                    <td>
                      {done} / {total} OK
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => openJob(item)}
                      >
                        Ver pauta
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!myJobs.length ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No tienes mantenimientos asignados por ahora.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-section">
      <div className="toolbar">
        <div>
          <h3 className="section-title">Mantenimiento</h3>
          <p className="section-help">
            Equipos con pauta PDF o Excel. Abre la pauta para verla completa y, si corresponde,
            asigna a un mecánico o supervisor.
          </p>
        </div>
      </div>
      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Pauta</th>
              <th>Asignar a</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {machinesWithPauta.map((machine) => {
              const job = openJobFor(items, machine.id)
              const tipos = cleanPauta(machine.pauta || [])
              const itemsCount = tipos.reduce((sum, tipo) => sum + tipo.items.length, 0)
              return (
                <tr key={machine.id}>
                  <td>
                    <strong>{machine.sigla}</strong>
                    <div className="table-sub">
                      {machine.categoria || 'Sin categoría'} · {machine.marca} {machine.modelo}
                    </div>
                  </td>
                  <td>
                    {machine.pautaFileName || 'Pauta cargada'}
                    <div className="table-sub">
                      {tipos.length
                        ? `${tipos.length} tipos · ${itemsCount} ítems`
                        : 'Archivo adjunto'}
                    </div>
                  </td>
                  <td>
                    <select
                      value={job?.asignadoId || ''}
                      disabled={savingId === machine.id}
                      onChange={(e) => void assignPerson(machine, e.target.value)}
                    >
                      <option value="">Seleccionar persona…</option>
                      {assignees.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} · {ROLE_LABELS[person.role] || person.role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {job ? (
                      <span className={`badge ${statusClass(job.status)}`}>
                        {statusLabel(job.status)}
                      </span>
                    ) : (
                      <span className="badge">Sin asignar</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-small"
                      onClick={() => openPauta(machine, job)}
                    >
                      Ver pauta
                    </button>
                  </td>
                </tr>
              )
            })}
            {!machinesWithPauta.length ? (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No hay equipos con pauta. En Maquinaria, crea el equipo y sube el PDF o Excel.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {items.some((item) => item.status === 'completed') ? (
        <div className="admin-card" style={{ marginTop: 18 }}>
          <h4>Completados</h4>
          <div className="table-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Equipo</th>
                  <th>Responsable</th>
                  <th>Avance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((item) => item.status === 'completed')
                  .map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.updatedAt || item.createdAt)}</td>
                      <td>
                        <strong>{item.sigla}</strong>
                      </td>
                      <td>{item.asignadoNombre || item.mecanicoNombre}</td>
                      <td>
                        {item.tareas?.filter((t) => t.realizado).length || 0} /{' '}
                        {item.tareas?.length || 0} OK
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => openJob(item)}
                        >
                          Ver pauta
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
