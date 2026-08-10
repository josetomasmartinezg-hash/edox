import { useEffect, useMemo, useState } from 'react'
import {
  fetchAdminStats,
  updateOrderStatus,
  type AdminOrder,
  type AdminStats,
  type OrderStatus,
} from '../productsApi'
import {
  AdminNav,
  TOKEN_KEY,
  categoryLabel,
  emptyStats,
  formatDate,
  money,
  statusLabel,
} from './adminShared'
import './AdminPanel.css'

type Filter = 'all' | 'pending' | 'completed'

export function AdminSales() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [stats, setStats] = useState<AdminStats>(emptyStats)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  async function loadSales(authToken: string) {
    setLoading(true)
    setError(null)
    const result = await fetchAdminStats(authToken)
    if (!result.ok) {
      if (result.error?.toLowerCase().includes('autorizado')) {
        localStorage.removeItem(TOKEN_KEY)
        setToken('')
        window.location.href = '/admin'
        return
      }
      setError(result.error || 'No se pudieron cargar las ventas')
      setStats(emptyStats)
      setOrders([])
    } else {
      setStats(result.stats || emptyStats)
      setOrders(result.orders || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!token) {
      window.location.href = '/admin'
      return
    }
    void loadSales(token)
  }, [token])

  const visible = useMemo(() => {
    if (filter === 'all') return orders
    return orders.filter((order) => order.status === filter)
  }, [orders, filter])

  async function setStatus(orderId: string, status: OrderStatus) {
    if (!token) return
    setBusyId(orderId)
    setError(null)
    setOkMsg(null)
    const result = await updateOrderStatus(token, orderId, status)
    setBusyId(null)

    if (!result.ok || !result.order) {
      if (result.error?.toLowerCase().includes('autorizado')) {
        localStorage.removeItem(TOKEN_KEY)
        setToken('')
        window.location.href = '/admin'
        return
      }
      setError(result.error || 'No se pudo actualizar')
      return
    }

    setOrders((prev) => prev.map((row) => (row.id === orderId ? { ...row, ...result.order! } : row)))
    if (result.stats) setStats(result.stats)
    setOkMsg(
      status === 'completed'
        ? `Orden ${orderId} marcada como completada`
        : `Orden ${orderId} marcada como pendiente`,
    )
  }

  if (!token) return null

  return (
    <div className="admin">
      <div className="admin-card">
        <header className="admin-head">
          <div>
            <p className="admin-eyebrow">Stackd Admin</p>
            <h1>Ventas</h1>
            <p className="admin-lead">Seguí cada compra y marcá si ya fue entregada / completada.</p>
            <AdminNav page="ventas" />
          </div>
          <div className="admin-head__actions">
            <button className="btn btn--line" type="button" onClick={() => void loadSales(token)}>
              Actualizar
            </button>
            <a className="btn btn--line" href="/">
              Ver tienda
            </a>
          </div>
        </header>

        {loading ? (
          <p className="admin-lead">Cargando ventas…</p>
        ) : (
          <>
            <section className="admin-stats admin-stats--sales" aria-label="Estado de ventas">
              <article className="admin-stat admin-stat--total">
                <p className="admin-stat__label">Ventas totales</p>
                <p className="admin-stat__value">{stats.totalOrders}</p>
                <p className="admin-stat__meta">{money(stats.totalRevenue)}</p>
              </article>
              <article className="admin-stat admin-stat--pending">
                <p className="admin-stat__label">Pendientes</p>
                <p className="admin-stat__value">{stats.pendingOrders}</p>
                <p className="admin-stat__meta">{money(stats.pendingRevenue)}</p>
              </article>
              <article className="admin-stat admin-stat--done">
                <p className="admin-stat__label">Completadas</p>
                <p className="admin-stat__value">{stats.completedOrders}</p>
                <p className="admin-stat__meta">{money(stats.completedRevenue)}</p>
              </article>
            </section>

            <div className="admin-filters" role="tablist" aria-label="Filtrar ventas">
              <button
                type="button"
                className={filter === 'all' ? 'is-active' : undefined}
                onClick={() => setFilter('all')}
              >
                Todas ({stats.totalOrders})
              </button>
              <button
                type="button"
                className={filter === 'pending' ? 'is-active' : undefined}
                onClick={() => setFilter('pending')}
              >
                Pendientes ({stats.pendingOrders})
              </button>
              <button
                type="button"
                className={filter === 'completed' ? 'is-active' : undefined}
                onClick={() => setFilter('completed')}
              >
                Completadas ({stats.completedOrders})
              </button>
            </div>

            {error && <p className="admin-error">{error}</p>}
            {okMsg && <p className="admin-ok">{okMsg}</p>}

            {visible.length === 0 ? (
              <p className="admin-empty">No hay ventas en este filtro.</p>
            ) : (
              <div className="admin-orders-wrap">
                <table className="admin-table admin-table--orders admin-table--sales">
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Cliente</th>
                      <th>Pago</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((order) => {
                      const completed = order.status === 'completed'
                      return (
                        <tr key={order.id} className={completed ? 'is-completed' : undefined}>
                          <td>
                            <strong>{order.id}</strong>
                            <span className="admin-order-items">{formatDate(order.createdAt)}</span>
                            <span className="admin-order-items">
                              {order.lines.length
                                ? order.lines
                                    .map((line) => `${line.qty}× ${line.name || line.productId}`)
                                    .join(' · ')
                                : '—'}
                            </span>
                          </td>
                          <td>
                            <strong>{order.customer.name || '—'}</strong>
                            <span className="admin-order-items">
                              {order.customer.telegram
                                ? `@${order.customer.telegram}`
                                : order.customer.email || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={`admin-pill admin-pill--${order.paymentCategory}`}>
                              {categoryLabel(order.paymentCategory)}
                            </span>
                            <span className="admin-order-items">{order.paymentMethod}</span>
                          </td>
                          <td>{money(order.amountDue)}</td>
                          <td>
                            <span
                              className={`admin-pill admin-pill--status-${order.status}`}
                            >
                              {statusLabel(order.status)}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={completed ? 'btn btn--line btn--sm' : 'btn btn--mint btn--sm'}
                              disabled={busyId === order.id}
                              onClick={() =>
                                void setStatus(order.id, completed ? 'pending' : 'completed')
                              }
                            >
                              {busyId === order.id
                                ? 'Guardando…'
                                : completed
                                  ? 'Marcar pendiente'
                                  : 'Marcar completado'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
