import type { CartLine } from '../checkout'

type Props = {
  open: boolean
  lines: CartLine[]
  subtotal: number
  onClose: () => void
  onCheckout: () => void
  onChangeQty: (productId: string, qty: number) => void
  onRemove: (productId: string) => void
}

export function CartDrawer({
  open,
  lines,
  subtotal,
  onClose,
  onCheckout,
  onChangeQty,
  onRemove,
}: Props) {
  if (!open) return null

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cart-drawer__head">
          <h2 id="cart-title">Tu carrito</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar carrito">
            ×
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="cart-empty">
            <p>Todavía no agregaste productos.</p>
            <button className="btn btn--solid" type="button" onClick={onClose}>
              Ver catálogo
            </button>
          </div>
        ) : (
          <>
            <ul className="cart-lines">
              {lines.map(({ product, qty }) => (
                <li className="cart-line" key={product.id}>
                  <div className="cart-line__info">
                    <strong>{product.name}</strong>
                    <span>${product.price} c/u</span>
                  </div>
                  <div className="cart-line__controls">
                    <div className="qty">
                      <button type="button" onClick={() => onChangeQty(product.id, qty - 1)} aria-label="Restar">
                        −
                      </button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => onChangeQty(product.id, qty + 1)} aria-label="Sumar">
                        +
                      </button>
                    </div>
                    <strong className="cart-line__total">${product.price * qty}</strong>
                    <button className="linkish" type="button" onClick={() => onRemove(product.id)}>
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="cart-drawer__foot">
              <div className="cart-subtotal">
                <span>Subtotal</span>
                <strong>${subtotal.toFixed(2)} USD</strong>
              </div>
              <button className="btn btn--mint btn--block" type="button" onClick={onCheckout}>
                Continuar compra
              </button>
              <p className="cart-note">Pagás con USDT o PayPal. Luego confirmamos por Telegram.</p>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
