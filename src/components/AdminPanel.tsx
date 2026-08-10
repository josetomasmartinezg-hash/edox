import { useEffect, useState, type FormEvent } from 'react'
import type { Product } from '../data'
import { adminLogin, fetchProducts, saveProducts } from '../productsApi'
import './AdminPanel.css'

const TOKEN_KEY = 'stackd-admin-token'

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

export function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [password, setPassword] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  async function loadCatalog(authToken?: string) {
    setLoading(true)
    setError(null)
    const list = await fetchProducts()
    setProducts(list)
    setDrafts(toDraft(list))
    setLoading(false)
    if (authToken) {
      /* keep session */
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

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
    await loadCatalog(result.token)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
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
          <p className="admin-lead">Ingresá para editar precios y stock del catálogo.</p>
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

  return (
    <div className="admin">
      <div className="admin-card">
        <header className="admin-head">
          <div>
            <p className="admin-eyebrow">Stackd Admin</p>
            <h1>Precios y stock</h1>
            <p className="admin-lead">Los cambios se publican al instante en el catálogo.</p>
          </div>
          <div className="admin-head__actions">
            <a className="btn btn--line" href="/">
              Ver tienda
            </a>
            <button className="btn btn--ghost" type="button" onClick={logout}>
              Salir
            </button>
          </div>
        </header>

        {loading ? (
          <p className="admin-lead">Cargando catálogo…</p>
        ) : (
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
        )}
      </div>
    </div>
  )
}
