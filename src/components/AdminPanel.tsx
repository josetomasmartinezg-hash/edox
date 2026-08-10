import { useEffect, useState, type FormEvent } from 'react'
import type { Product } from '../data'
import {
  adminLogin,
  fetchAdminStats,
  fetchProducts,
  saveProducts,
  type AdminOrder,
  type AdminStats,
} from '../productsApi'
import './AdminPanel.css'

const TOKEN_KEY = 'stackd-admin-token'

const emptyStats: AdminStats = {
  totalOrders: 0,
  usdtOrders: 0,
  paypalOrders: 0,
  otherOrders: 0,
  totalRevenue: 0,
  usdtRevenue: 0,
  paypalRevenue: 0,
}

type Draft = {
  id: string
  name: string
  badge: string
  price: string
  oldPrice: string
  stock: string
}

function toDraft(products: Product[]): Draft[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    badge: product.badge,
    price: String(product.price),
    oldPrice: product.oldPrice !== undefined ? String(product.oldPrice) : '',
    stock: String(product.stock),
  }))
}

function money(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function categoryLabel(category: AdminOrder['paymentCategory']) {
  if (category === 'usdt') return 'USDT'
  if (category === 'paypal') return 'PayPal'
  return 'Otro'
}

export function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [stats, setStats] = useState<AdminStats>(emptyStats)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  async function loadDashboard(authToken: string) {
    setLoading(true)
    setError(null)
    const [list, statsResult] = await Promise.all([fetchProducts(), fetchAdminStats(authToken)])
    setProducts(list)
    setDrafts(toDraft(list))

    if (!statsResult.ok) {
      if (statsResult.error?.toLowerCase().includes('autorizado')) {
        localStorage.removeItem(TOKEN_KEY)
        setToken('')
      }
      setError(statsResult.error || 'No se pudieron cargar las compras')
      setStats(emptyStats)
      setOrders([])
    } else {
      setStats(statsResult.stats || emptyStats)
      setOrders(statsResult.orders || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    void loadDashboard(token)
  }, [token])

  async function handleLogin(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setOkMsg(null)
    const result = await adminLogin(password)
    if (!result.ok || !result.token) {
      setError(result.error || 'Login fallido')
      return
    }
    localStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setPassword('')
    setOkMsg('Sesión iniciada')
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setStats(emptyStats)
    setOrders([])
    setOkMsg('Sesión cerrada')
  }

  function updateDraft(id: string, key: keyof Draft, value: string) {
    setDrafts((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)))
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError(null)
    setOkMsg(null)

    const cleaned: Product[] = drafts.map((draft) => {
      const base = products.find((item) => item.id === draft.id)!
      const oldPrice = draft.oldPrice.trim() === '' ? undefined : Number(draft.oldPrice)
      const next: Product = {
        ...base,
        name: draft.name.trim() || base.name,
        badge: draft.badge.trim() || base.badge,
        price: Number(draft.price),
        stock: Number(draft.stock),
      }
      if (oldPrice !== undefined) next.oldPrice = oldPrice
      else delete next.oldPrice
      return next
    })

    const result = await saveProducts(token, cleaned)
    setSaving(false)

    if (!result.ok) {
      if (result.error?.toLowerCase().includes('autorizado')) {
        logout()
      }
      setError(result.error || 'No se pudo guardar')
      return
    }

    const next = result.products || cleaned
    setProducts(next)
    setDrafts(toDraft(next))
    setOkMsg('Cambios guardados. Ya se ven en la tienda.')
  }

  if (!token) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--login">
          <p className="admin-eyebrow">Stackd Admin</p>
          <h1>Panel de control</h1>
          <p className="admin-lead">Ingresá para ver compras, precios y stock del catálogo.</p>
          <form className="admin-form" onSubmit={handleLogin}>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="ADMIN_PASSWORD"
              />
            </label>
            {error && <p className="admin-error">{error}</p>}
            <button className="btn btn--mint" type="submit">
              Entrar
            </button>
          </form>
          <a className="admin-back" href="/">
            ← Volver a la tienda
          </a>
        </div>
      </div>
    )
  }

  const usdtShare = stats.totalOrders ? Math.round((stats.usdtOrders / stats.totalOrders) * 100) : 0
  const paypalShare = stats.totalOrders ? Math.round((stats.paypalOrders / stats.totalOrders) * 100) : 0

  return (
    <div className="admin">
      <div className="admin-card">
        <header className="admin-head">
          <div>
            <p className="admin-eyebrow">Stackd Admin</p>
            <h1>Panel de operaciones</h1>
            <p className="admin-lead">Compras por método de pago, catálogo y stock en un solo lugar.</p>
          </div>
          <div className="admin-head__actions">
            <button className="btn btn--line" type="button" onClick={() => void loadDashboard(token)}>
              Actualizar
            </button>
            <a className="btn btn--line" href="/">
              Ver tienda
            </a>
            <button className="btn btn--ghost" type="button" onClick={logout}>
              Salir
            </button>
          </div>
        </header>

        {loading ? (
          <p className="admin-lead">Cargando panel…</p>
        ) : (
          <>
            <section className="admin-stats" aria-label="Resumen de compras">
              <article className="admin-stat admin-stat--total">
                <p className="admin-stat__label">Compras totales</p>
                <p className="admin-stat__value">{stats.totalOrders}</p>
                <p className="admin-stat__meta">Ingresos {money(stats.totalRevenue)}</p>
              </article>
              <article className="admin-stat admin-stat--usdt">
                <p className="admin-stat__label">Compras USDT</p>
                <p className="admin-stat__value">{stats.usdtOrders}</p>
                <p className="admin-stat__meta">
                  {money(stats.usdtRevenue)} · {usdtShare}% del total
                </p>
              </article>
              <article className="admin-stat admin-stat--paypal">
                <p className="admin-stat__label">Compras PayPal</p>
                <p className="admin-stat__value">{stats.paypalOrders}</p>
                <p className="admin-stat__meta">
                  {money(stats.paypalRevenue)} · {paypalShare}% del total
                </p>
              </article>
            </section>

            <div className="admin-breakdown" aria-label="Distribución por categoría">
              <div className="admin-breakdown__bar" role="presentation">
                <span className="admin-breakdown__usdt" style={{ width: `${usdtShare}%` }} />
                <span className="admin-breakdown__paypal" style={{ width: `${paypalShare}%` }} />
              </div>
              <div className="admin-breakdown__legend">
                <span>
                  <i className="admin-dot admin-dot--usdt" /> USDT {stats.usdtOrders}
                </span>
                <span>
                  <i className="admin-dot admin-dot--paypal" /> PayPal {stats.paypalOrders}
                </span>
                {stats.otherOrders > 0 && (
                  <span>
                    <i className="admin-dot admin-dot--other" /> Otros {stats.otherOrders}
                  </span>
                )}
              </div>
            </div>

            <section className="admin-section">
              <div className="admin-section__head">
                <h2>Compras recientes</h2>
                <p>Últimas órdenes registradas al confirmar el checkout.</p>
              </div>
              {orders.length === 0 ? (
                <p className="admin-empty">Todavía no hay compras. Cuando un cliente complete el pago, aparecen acá.</p>
              ) : (
                <div className="admin-orders-wrap">
                  <table className="admin-table admin-table--orders">
                    <thead>
                      <tr>
                        <th>Orden</th>
                        <th>Cliente</th>
                        <th>Método</th>
                        <th>Monto</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <strong>{order.id}</strong>
                            <span className="admin-order-items">
                              {order.lines.length
                                ? order.lines.map((line) => `${line.qty}× ${line.name || line.productId}`).join(' · ')
                                : '—'}
                            </span>
                          </td>
                          <td>
                            <strong>{order.customer.name || '—'}</strong>
                            <span className="admin-order-items">
                              {order.customer.telegram ? `@${order.customer.telegram}` : order.customer.email || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={`admin-pill admin-pill--${order.paymentCategory}`}>
                              {categoryLabel(order.paymentCategory)}
                            </span>
                            <span className="admin-order-items">{order.paymentMethod}</span>
                          </td>
                          <td>{money(order.amountDue)}</td>
                          <td>{formatDate(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="admin-section">
              <div className="admin-section__head">
                <h2>Precios y stock</h2>
                <p>Los cambios se publican al instante en el catálogo.</p>
              </div>
              <form className="admin-table-wrap" onSubmit={handleSave}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Badge</th>
                      <th>Precio USD</th>
                      <th>Antes</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            value={row.name}
                            onChange={(e) => updateDraft(row.id, 'name', e.target.value)}
                            aria-label={`Nombre ${row.id}`}
                          />
                        </td>
                        <td>
                          <input
                            value={row.badge}
                            onChange={(e) => updateDraft(row.id, 'badge', e.target.value)}
                            aria-label={`Badge ${row.id}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            required
                            value={row.price}
                            onChange={(e) => updateDraft(row.id, 'price', e.target.value)}
                            aria-label={`Precio ${row.id}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.oldPrice}
                            onChange={(e) => updateDraft(row.id, 'oldPrice', e.target.value)}
                            aria-label={`Precio anterior ${row.id}`}
                            placeholder="—"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            required
                            value={row.stock}
                            onChange={(e) => updateDraft(row.id, 'stock', e.target.value)}
                            aria-label={`Stock ${row.id}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {error && <p className="admin-error">{error}</p>}
                {okMsg && <p className="admin-ok">{okMsg}</p>}

                <div className="admin-actions">
                  <button className="btn btn--mint" type="submit" disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button
                    className="btn btn--line"
                    type="button"
                    onClick={() => setDrafts(toDraft(products))}
                    disabled={saving}
                  >
                    Descartar
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
