import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { cartLines, cartSubtotal, telegramSupportUrl } from './checkout'
import { CartDrawer } from './components/CartDrawer'
import { CheckoutModal } from './components/CheckoutModal'
import {
  defaultProducts,
  faqs,
  processSteps,
  tickerItems,
  valueProps,
  type Product,
} from './data'
import { fetchProducts } from './productsApi'

const CART_KEY = 'stackd-cart'

function loadCart(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function App() {
  const [products, setProducts] = useState<Product[]>(defaultProducts)
  const [cart, setCart] = useState<Record<string, number>>(loadCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    void fetchProducts().then(setProducts)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      /* ignore */
    }
  }, [cart])

  const lines = useMemo(() => cartLines(cart, products), [cart, products])
  const subtotal = useMemo(() => cartSubtotal(lines), [lines])
  const cartCount = lines.reduce((sum, line) => sum + line.qty, 0)
  const supportUrl = telegramSupportUrl()
  const tickerLoop = [...tickerItems, ...tickerItems]

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2400)
  }

  function addToCart(product: Product) {
    const current = cart[product.id] ?? 0
    if (current >= product.stock) {
      showToast(`Stock máximo: ${product.stock}`)
      setCartOpen(true)
      return
    }
    setCart((prev) => ({
      ...prev,
      [product.id]: current + 1,
    }))
    showToast(`${product.name} agregado al carrito`)
    setCartOpen(true)
  }

  function setQty(productId: string, qty: number) {
    const product = products.find((item) => item.id === productId)
    const max = product?.stock ?? qty
    setCart((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[productId]
      else next[productId] = Math.min(qty, max)
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

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <a className="brand" href="#top" aria-label="STACKD inicio">
            STACK<span>D</span>
          </a>

          <nav className="nav" aria-label="Principal">
            <a href="#proceso">Cómo funciona</a>
            <a href="#planes">Catálogo</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="header-actions">
            <a className="btn btn--purple header-cta" href="#planes">
              <span className="header-cta__full">Ver catálogo →</span>
              <span className="header-cta__short">Catálogo →</span>
            </a>
            <button className="cart-btn" type="button" aria-label="Carrito" onClick={() => setCartOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
          <div className="hero__glow" aria-hidden="true" />
          <div className="hero__content">
            <p className="hero__badge reveal">• Infraestructura para media buyers</p>
            <h1 className="hero__title reveal reveal-delay-1">
              Escala tus ads.
              <span> Sin perder cuentas</span>
              <em> en el intento.</em>
            </h1>
            <p className="hero__support reveal reveal-delay-2">
              Setup completo de multi-cuentas, Business Managers, Ads Power y proxies. Listo para usar en
              48 hrs.
            </p>
            <div className="hero__cta reveal reveal-delay-3">
              <a className="btn btn--purple" href="#planes">
                Ver catálogo y precios
              </a>
              <a className="btn btn--ghost-purple" href="#proceso">
                ¿Cómo funciona?
              </a>
            </div>
          </div>

          <div className="hero-stats container reveal reveal-delay-3">
            <div>
              <strong>+50</strong>
              <span>Buyers activos</span>
            </div>
            <div>
              <strong>24–48 hrs</strong>
              <span>Tiempo de setup</span>
            </div>
            <div>
              <strong>15 días</strong>
              <span>Garantía</span>
            </div>
            <div>
              <strong>Telegram</strong>
              <span>Soporte directo</span>
            </div>
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div className="ticker__track">
            {tickerLoop.map((item, index) => (
              <span key={`${item}-${index}`}>
                {item}
                <i />
              </span>
            ))}
          </div>
        </div>

        <section className="section" id="proceso">
          <div className="container">
            <p className="section__eyebrow">// Proceso</p>
            <h2 className="section__title">De cero a escalar en 4 pasos</h2>
            <p className="section__lead">Sin vueltas técnicas. Pedís, pagás y operás.</p>
            <div className="process-grid">
              {processSteps.map((step, index) => (
                <article className={`process-card${index === 0 ? ' is-active' : ''}`} key={step.n}>
                  <span className="process-card__n">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="planes">
          <div className="container">
            <p className="section__eyebrow">// Catálogo</p>
            <h2 className="section__title">Productos y precios</h2>
            <p className="section__lead">BMs, perfiles y fan pages. Entrega por Telegram.</p>

            <div className="plans-grid">
              {products.map((product) => {
                const featured = Boolean(product.featured) || /popular/i.test(product.badge)
                return (
                  <article className={`plan-card${featured ? ' is-featured' : ''}`} key={product.id}>
                    {featured && <div className="plan-card__ribbon">Más popular</div>}
                    <p className="plan-card__name">{product.name}</p>
                    <p className="plan-card__price">
                      <strong>${product.price}</strong>
                      <span>USD</span>
                    </p>
                    <p className="plan-card__desc">
                      {product.description || 'Setup listo para operar.'}
                    </p>
                    <ul className="plan-card__features">
                      {product.features.map((feature) => (
                        <li key={feature}>
                          <span aria-hidden="true">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      className={featured ? 'btn btn--purple' : 'btn btn--ghost-purple'}
                      type="button"
                      onClick={() => addToCart(product)}
                    >
                      {product.cta || `Elegir ${product.name}`}
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="section" id="estructura">
          <div className="container">
            <h2 className="section__title section__title--split">
              No vendemos cuentas. <span>Vendemos estructura.</span>
            </h2>
            <p className="section__lead">
              Cualquiera vende cuentas. Nosotros te entregamos un sistema que realmente escala.
            </p>
            <div className="value-grid">
              {valueProps.map((item) => (
                <article className="value-card" key={item.title}>
                  <span className="value-card__icon" aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="container">
            <p className="section__eyebrow">// FAQ</p>
            <h2 className="section__title">Todo lo que querés saber</h2>
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

        <section className="section section--cta">
          <div className="container">
            <div className="cta-panel">
              <div className="cta-panel__glow" aria-hidden="true" />
              <h2>
                ¿Listo para escalar
                <span> sin miedo a perder cuentas?</span>
              </h2>
              <p>Sumate a los media buyers que ya operan con infraestructura profesional.</p>
              <a className="btn btn--purple" href="#planes">
                Ver catálogo →
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <a className="brand brand--footer" href="#top">
            STACK<span>D</span>
          </a>
          <p>© {new Date().getFullYear()} STACKD · Infraestructura para media buyers</p>
          <a href={supportUrl} target="_blank" rel="noreferrer">
            Contacto vía Telegram
          </a>
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

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}

export default App
