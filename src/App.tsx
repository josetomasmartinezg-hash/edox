import { useMemo, useState, type FormEvent } from 'react'
import './App.css'
import { cartLines, cartSubtotal, telegramSupportUrl } from './checkout'
import { CartDrawer } from './components/CartDrawer'
import { CheckoutModal } from './components/CheckoutModal'
import { comparisonRows, faqs, products, type Product } from './data'

type AuthMode = 'login' | 'register' | null

function App() {
  const [cart, setCart] = useState<Record<string, number>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>(null)
  const [toast, setToast] = useState<string | null>(null)

  const lines = useMemo(() => cartLines(cart, products), [cart])
  const subtotal = useMemo(() => cartSubtotal(lines), [lines])
  const cartCount = lines.reduce((sum, line) => sum + line.qty, 0)
  const supportUrl = telegramSupportUrl()

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2400)
  }

  function addToCart(product: Product) {
    setCart((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] ?? 0) + 1,
    }))
    showToast(`${product.name} agregado al carrito`)
    setCartOpen(true)
  }

  function setQty(productId: string, qty: number) {
    setCart((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[productId]
      else next[productId] = qty
      return next
    })
  }

  function removeItem(productId: string) {
    setCart((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  function openCheckout() {
    if (!lines.length) {
      showToast('Agregá al menos un producto')
      return
    }
    setCartOpen(false)
    setCheckoutOpen(true)
  }

  function handleOrderCompleted() {
    setCheckoutOpen(false)
    setCart({})
    showToast('Pedido registrado. Te contactamos por Telegram.')
  }

  function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const mode = authMode === 'login' ? 'Sesión iniciada' : 'Cuenta creada'
    setAuthMode(null)
    showToast(`${mode}. Ya podés comprar.`)
  }

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <a className="brand" href="#top" aria-label="ADVAULT inicio">
            <span className="brand__mark">A</span>
            <span className="brand__text">ADVAULT</span>
          </a>

          <nav className="nav" aria-label="Principal">
            <a href="#catalogo">Catálogo</a>
            <a href="#guia">Guía</a>
            <a href="#comparativa">Comparativa</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="header-actions">
            <button className="btn btn--ghost" type="button" onClick={() => setAuthMode('login')}>
              Iniciar sesión
            </button>
            <button className="btn btn--solid" type="button" onClick={() => setAuthMode('register')}>
              Registrarse
            </button>
            <button className="cart-btn" type="button" aria-label="Carrito" onClick={() => setCartOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="20" r="1.4" fill="currentColor" />
                <circle cx="17" cy="20" r="1.4" fill="currentColor" />
              </svg>
              {cartCount > 0 && <span className="cart-btn__count">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-label="Portada">
          <div className="hero__media" role="img" aria-label="Escritorio de media buying con campañas activas" />
          <div className="hero__orb" aria-hidden="true" />
          <div className="hero__scan" aria-hidden="true" />
          <div className="hero__content">
            <h1 className="hero__brand reveal">ADVAULT</h1>
            <p className="hero__headline reveal reveal-delay-1">
              Business Managers verificados con API de WhatsApp
            </p>
            <p className="hero__support reveal reveal-delay-2">
              Infraestructura lista para afiliados, agencias y media buyers que necesitan cuentas estables y entrega en minutos.
            </p>
            <div className="hero__cta reveal reveal-delay-3">
              <a className="btn btn--mint" href="#catalogo">
                Ver catálogo
              </a>
              <a className="btn btn--line" href={supportUrl} target="_blank" rel="noreferrer">
                Hablar por Telegram
              </a>
            </div>
          </div>
        </section>

        <section className="trust">
          <div className="container">
            <ul className="trust__list">
              <li>
                <span className="trust__icon">5m</span>
                Entrega en 5–30 min
              </li>
              <li>
                <span className="trust__icon">$</span>
                USDT / PayPal
              </li>
              <li>
                <span className="trust__icon">OK</span>
                Compra segura
              </li>
              <li>
                <span className="trust__icon">%</span>
                Descuentos por cantidad
              </li>
            </ul>
          </div>
        </section>

        <section className="section" id="por-que">
          <div className="container">
            <p className="section__eyebrow">Por qué ADVAULT</p>
            <h2 className="section__title">Cuentas listas para escalar Meta Ads</h2>
            <p className="section__lead">
              ADVAULT es tu fuente de Business Managers verificados de Facebook con API de WhatsApp habilitada desde el primer día. Pensado para equipos que necesitan confianza alta y mínimo fricción al lanzar campañas.
            </p>
            <div className="benefits">
              <div className="benefit">
                <span className="benefit__check" aria-hidden="true">✓</span>
                <div>
                  <strong>Verificación oficial Meta</strong>
                  <p>BMs que ya pasaron el proceso de verificación, listos para presupuestos altos.</p>
                </div>
              </div>
              <div className="benefit">
                <span className="benefit__check" aria-hidden="true">✓</span>
                <div>
                  <strong>API de WhatsApp desde día uno</strong>
                  <p>Integrá CRM, automatizaciones y mensajería sin esperar semanas.</p>
                </div>
              </div>
              <div className="benefit">
                <span className="benefit__check" aria-hidden="true">✓</span>
                <div>
                  <strong>Entrega express post-pago</strong>
                  <p>Confirmás USDT o PayPal y recibís accesos en 5 a 30 minutos.</p>
                </div>
              </div>
              <div className="benefit">
                <span className="benefit__check" aria-hidden="true">✓</span>
                <div>
                  <strong>Catálogo completo</strong>
                  <p>BM Verificados, BM Balloon, cuentas publicitarias y packs para agencias.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--tight" id="catalogo">
          <div className="container">
            <div className="catalog-head">
              <div>
                <p className="section__eyebrow">Catálogo</p>
                <h2 className="section__title">Elegí tu estructura</h2>
                <p className="section__lead">Precios en USD. Pagá con USDT (TRC20/BEP20) o PayPal y confirmá por Telegram.</p>
              </div>
            </div>

            <div className="catalog-panel">
              <div className="catalog-grid">
                {products.map((product) => (
                  <article className="product" key={product.id}>
                    <div className="product__top">
                      <div>
                        <span className="product__badge">{product.badge}</span>
                        <h3 className="product__name">{product.name}</h3>
                      </div>
                      <div className="product__price">
                        <strong>${product.price}</strong>
                        {product.oldPrice ? <s>${product.oldPrice}</s> : null}
                      </div>
                    </div>
                    <ul className="product__features">
                      {product.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                    <div className="product__footer">
                      <span className="stock">{product.stock} en stock</span>
                      <button className="btn btn--solid" type="button" onClick={() => addToCart(product)}>
                        Agregar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="guia">
          <div className="container">
            <p className="section__eyebrow">Guía rápida</p>
            <h2 className="section__title">¿Qué es un BM verificado?</h2>
            <p className="section__lead">
              Un Facebook Business Manager verificado es una cuenta corporativa confirmada con documentos de empresa y validada por Meta. Funciona como un pasaporte dentro del ecosistema publicitario: más límites, más confianza y acceso a herramientas avanzadas.
            </p>

            <div className="explain-grid">
              <div className="explain-block">
                <h3>¿Por qué lo necesitás?</h3>
                <p>
                  Para conectar métodos de pago con estabilidad, gestionar páginas de clientes y reducir la probabilidad de restricciones automáticas al escalar.
                </p>
              </div>
              <div className="explain-block">
                <h3>Ventajas clave</h3>
                <ul>
                  <li>Crear y escalar múltiples cuentas publicitarias</li>
                  <li>Conectar distintos métodos de pago</li>
                  <li>Gestionar páginas y dominios con más margen</li>
                  <li>Menor probabilidad de bloqueos preventivos</li>
                </ul>
              </div>
              <div className="explain-block">
                <h3>Uso correcto</h3>
                <p>
                  Distribuye presupuesto entre varias ad accounts, configurá dominios y píxeles, y respetá tiempos de warm-up antes de conectar CRM o enviar tráfico.
                </p>
              </div>
              <div className="explain-block">
                <h3>Para quién es</h3>
                <ul>
                  <li>Agencias de marketing digital</li>
                  <li>E-commerce y performance teams</li>
                  <li>Especialistas en arbitraje de tráfico</li>
                  <li>Operaciones con WhatsApp API</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--tight" id="comparativa">
          <div className="container">
            <p className="section__eyebrow">Comparativa</p>
            <h2 className="section__title">BM Regular vs Verificado</h2>
            <p className="section__lead">
              Una vista clara de qué cambia cuando pasás a una estructura verificada frente a alternativas de alquiler o intermediarios.
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Característica</th>
                    <th>BM Regular</th>
                    <th>BM Verificado</th>
                    <th>Alternativas</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td>{row.regular}</td>
                      <td>{row.verified}</td>
                      <td>{row.alt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="container">
            <p className="section__eyebrow">FAQ</p>
            <h2 className="section__title">Preguntas frecuentes</h2>
            <div className="faq-list">
              {faqs.map((item) => (
                <details className="faq-item" key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <div className="container">
          <section className="cta-band" aria-label="Llamado a la acción">
            <h2>Activá tu estructura hoy</h2>
            <p>Elegí un BM, cargá tus datos y pagá con USDT o PayPal. Confirmamos por Telegram y entregamos en minutos.</p>
            <div className="cta-band__actions">
              <a className="btn btn--mint" href="#catalogo">
                Ir al catálogo
              </a>
              <a className="btn btn--line" href={supportUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--sand)', borderColor: 'rgba(242,232,213,0.35)' }}>
                Soporte Telegram
              </a>
            </div>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div>
            <strong>ADVAULT</strong>
            <p>Business Manager Facebook Verificado · API WhatsApp</p>
          </div>
          <div className="footer-links">
            <a href="#faq">FAQ</a>
            <a href="#catalogo">Catálogo</a>
            <a href={supportUrl} target="_blank" rel="noreferrer">
              Telegram
            </a>
          </div>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen}
        lines={lines}
        subtotal={subtotal}
        onClose={() => setCartOpen(false)}
        onCheckout={openCheckout}
        onChangeQty={setQty}
        onRemove={removeItem}
      />

      <CheckoutModal
        open={checkoutOpen}
        lines={lines}
        subtotal={subtotal}
        onClose={() => setCheckoutOpen(false)}
        onCompleted={handleOrderCompleted}
        showToast={showToast}
      />

      {authMode && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAuthMode(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="auth-title">{authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
            <p>
              {authMode === 'login'
                ? 'Entrá para ver tus órdenes y comprar más rápido.'
                : 'Solo email y contraseña. Empezás a comprar en minutos.'}
            </p>
            <form className="form" onSubmit={handleAuthSubmit}>
              <label>
                Email
                <input type="email" name="email" required placeholder="tu@email.com" autoComplete="email" />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                />
              </label>
              <div className="modal__actions">
                <button className="btn btn--ghost" type="button" onClick={() => setAuthMode(null)}>
                  Cancelar
                </button>
                <button className="btn btn--mint" type="submit">
                  {authMode === 'login' ? 'Entrar' : 'Registrarme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}

export default App
