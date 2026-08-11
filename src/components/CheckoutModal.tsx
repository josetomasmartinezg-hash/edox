import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { isPlaceholderWallet, storeConfig } from '../config'
import {
  applyDiscount,
  createOrderId,
  paymentLabel,
  paypalCheckoutUrl,
  paypalMeUrl,
  resolveDiscount,
  telegramOrderUrl,
  uniqueUsdtAmount,
  usdtAddress,
  type CartLine,
  type CustomerData,
  type Order,
  type PaymentMethod,
} from '../checkout'
import { useBodyLock } from '../hooks/useBodyLock'
import { notifyOrderToBot } from '../telegramApi'
import { openSupport } from '../telegramLinks'

const PAY_OPTIONS: Array<{
  value: PaymentMethod
  title: string
  hint: string
}> = [
  { value: 'usdt-trc20', title: 'USDT TRC20', hint: 'Red Tron · fee bajo' },
  { value: 'usdt-bep20', title: 'USDT BEP20', hint: 'Binance Smart Chain' },
  { value: 'paypal', title: 'PayPal', hint: 'Tarjeta o saldo PayPal' },
]

type Step = 'datos' | 'pago' | 'instrucciones' | 'listo'

type Props = {
  open: boolean
  lines: CartLine[]
  subtotal: number
  onClose: () => void
  onCompleted: () => void
  showToast: (message: string) => void
}

const emptyCustomer: CustomerData = {
  name: '',
  email: '',
  telegram: '',
  notes: '',
}

export function CheckoutModal({ open, lines, subtotal, onClose, onCompleted, showToast }: Props) {
  const [step, setStep] = useState<Step>('datos')
  const [customer, setCustomer] = useState<CustomerData>(emptyCustomer)
  const [method, setMethod] = useState<PaymentMethod>('paypal')
  const [order, setOrder] = useState<Order | null>(null)
  const [sendingBot, setSendingBot] = useState(false)
  const [botNotified, setBotNotified] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number } | null>(
    null,
  )
  const [discountError, setDiscountError] = useState('')

  useBodyLock(open)

  const pricing = useMemo(() => {
    if (!appliedDiscount) {
      return { discountAmount: 0, total: subtotal }
    }
    return applyDiscount(subtotal, appliedDiscount.percent)
  }, [subtotal, appliedDiscount])

  const availableMethods = useMemo(() => {
    return PAY_OPTIONS.filter((option) => {
      if (option.value === 'paypal') return true
      const address = usdtAddress(option.value)
      return Boolean(address) && !isPlaceholderWallet(address)
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const preferred =
      availableMethods.find((m) => m.value === 'usdt-trc20')?.value ||
      availableMethods.find((m) => m.value === 'usdt-bep20')?.value ||
      'paypal'
    setMethod(preferred)
  }, [open, availableMethods])

  if (!open) return null

  function updateCustomer<K extends keyof CustomerData>(key: K, value: CustomerData[K]) {
    setCustomer((prev) => ({ ...prev, [key]: value }))
  }

  function applyCode() {
    const resolved = resolveDiscount(discountInput)
    if (!resolved) {
      setAppliedDiscount(null)
      setDiscountError('Código inválido')
      showToast('Código de descuento inválido')
      return
    }
    setAppliedDiscount(resolved)
    setDiscountInput(resolved.code)
    setDiscountError('')
    showToast(`Descuento ${resolved.percent}% aplicado`)
  }

  function clearDiscount() {
    setAppliedDiscount(null)
    setDiscountInput('')
    setDiscountError('')
  }

  function handleDatos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStep('pago')
  }

  function handlePago(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payable = pricing.total
    const due = method.startsWith('usdt') ? uniqueUsdtAmount(payable) : payable
    const nextOrder: Order = {
      id: createOrderId(),
      createdAt: new Date().toISOString(),
      customer: {
        ...customer,
        telegram: customer.telegram.replace(/^@/, ''),
      },
      lines,
      subtotal,
      amountDue: due,
      paymentMethod: method,
      ...(appliedDiscount
        ? {
            discountCode: appliedDiscount.code,
            discountPercent: appliedDiscount.percent,
            discountAmount: pricing.discountAmount,
          }
        : {}),
    }
    setOrder(nextOrder)
    setBotNotified(false)
    try {
      localStorage.setItem(`stackd-order-${nextOrder.id}`, JSON.stringify(nextOrder))
    } catch {
      /* ignore */
    }
    setStep('instrucciones')

    void notifyOrderToBot(nextOrder).then((result) => {
      if (result.ok) {
        setBotNotified(true)
        showToast('Orden enviada al bot de Stackd')
      } else {
        showToast(result.error || 'No se pudo avisar al bot — reintentá al confirmar')
      }
    })
  }

  async function copyText(value: string, label: string, key?: string) {
    try {
      await navigator.clipboard.writeText(value)
      showToast(`${label} copiado`)
      if (key) {
        setCopiedKey(key)
        window.setTimeout(() => setCopiedKey(null), 1600)
      }
    } catch {
      showToast('No se pudo copiar. Seleccioná el texto manualmente.')
    }
  }

  async function openTelegramConfirm() {
    if (!order) return

    if (!botNotified) {
      setSendingBot(true)
      const result = await notifyOrderToBot(order)
      setSendingBot(false)
      if (result.ok) {
        setBotNotified(true)
        showToast('Compra avisada al bot · abrimos consultas')
      } else {
        showToast(result.error || 'Abrimos Telegram de consultas')
      }
    } else {
      showToast('Abrimos consultas con @Stackd2026')
    }

    openSupport(
      [
        `Hola Stackd, confirmo mi pago.`,
        ``,
        `Orden: ${order.id}`,
        `Total: $${order.amountDue.toFixed(2)} USD`,
        `Método: ${paymentLabel(order.paymentMethod)}`,
        order.discountCode
          ? `Descuento: ${order.discountCode} (−${order.discountPercent}%)`
          : '',
        `Mi Telegram: @${order.customer.telegram}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    setStep('listo')
  }

  function resetCheckoutState() {
    setCustomer(emptyCustomer)
    setOrder(null)
    setBotNotified(false)
    setStep('datos')
    clearDiscount()
  }

  function finish() {
    resetCheckoutState()
    onCompleted()
  }

  function closeAll() {
    resetCheckoutState()
    onClose()
  }

  const address = order ? usdtAddress(order.paymentMethod) : null

  return (
    <div className="modal-backdrop" role="presentation" onClick={closeAll}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="checkout-head">
          <div>
            <p className="section__eyebrow">Checkout</p>
            <h2 id="checkout-title">
              {step === 'datos' && 'Tus datos'}
              {step === 'pago' && 'Método de pago'}
              {step === 'instrucciones' && 'Realizá el pago'}
              {step === 'listo' && 'Pedido enviado'}
            </h2>
          </div>
          <button className="icon-btn" type="button" onClick={closeAll} aria-label="Cerrar">
            ×
          </button>
        </header>

        <ol className="checkout-steps" aria-label="Progreso">
          <li className={step === 'datos' ? 'is-active' : ''}>1. Datos</li>
          <li className={step === 'pago' ? 'is-active' : ''}>2. Pago</li>
          <li className={step === 'instrucciones' || step === 'listo' ? 'is-active' : ''}>3. Confirmar</li>
        </ol>

        <div className="checkout-summary">
          <span>
            {lines.reduce((n, l) => n + l.qty, 0)}{' '}
            {lines.reduce((n, l) => n + l.qty, 0) === 1 ? 'producto' : 'productos'}
          </span>
          <div className="checkout-summary__totals">
            {appliedDiscount ? (
              <>
                <span className="checkout-summary__strike">${subtotal.toFixed(2)}</span>
                <strong>Total ${pricing.total.toFixed(2)} USD</strong>
              </>
            ) : (
              <strong>Subtotal ${subtotal.toFixed(2)} USD</strong>
            )}
          </div>
        </div>

        {(step === 'datos' || step === 'pago') && (
          <div className="discount-box">
            <div className="discount-box__head">
              <strong>Código de descuento</strong>
            </div>
            <div className="discount-box__row">
              <input
                name="discount"
                value={discountInput}
                onChange={(e) => {
                  setDiscountInput(e.target.value)
                  setDiscountError('')
                }}
                placeholder="Ej: SKALERS"
                autoComplete="off"
                aria-label="Código de descuento"
                disabled={Boolean(appliedDiscount)}
              />
              {appliedDiscount ? (
                <button className="btn btn--line" type="button" onClick={clearDiscount}>
                  Quitar
                </button>
              ) : (
                <button className="btn btn--purple" type="button" onClick={applyCode}>
                  Aplicar
                </button>
              )}
            </div>
            {appliedDiscount && (
              <p className="discount-box__ok">
                {appliedDiscount.code} aplicado: −{appliedDiscount.percent}% (−$
                {pricing.discountAmount.toFixed(2)})
              </p>
            )}
            {discountError && <p className="discount-box__err">{discountError}</p>}
          </div>
        )}

        {step === 'datos' && (
          <form className="form checkout-body" onSubmit={handleDatos}>
            <label>
              Nombre completo
              <input
                required
                name="name"
                value={customer.name}
                onChange={(e) => updateCustomer('name', e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                name="email"
                value={customer.email}
                onChange={(e) => updateCustomer('email', e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </label>
            <label>
              Usuario de Telegram
              <input
                required
                name="telegram"
                value={customer.telegram}
                onChange={(e) => updateCustomer('telegram', e.target.value)}
                placeholder="@tuusuario"
                autoComplete="off"
              />
            </label>
            <label>
              Notas (opcional)
              <input
                name="notes"
                value={customer.notes}
                onChange={(e) => updateCustomer('notes', e.target.value)}
                placeholder="Ej: necesito entrega urgente"
              />
            </label>
            <div className="modal__actions">
              <button className="btn btn--ghost" type="button" onClick={closeAll}>
                Volver al carrito
              </button>
              <button className="btn btn--mint" type="submit">
                Continuar
              </button>
            </div>
          </form>
        )}

        {step === 'pago' && (
          <form className="form checkout-body" onSubmit={handlePago}>
            <fieldset className="pay-methods">
              <legend>Elegí cómo pagar</legend>
              {availableMethods.map(({ value, title, hint }) => (
                <label className={`pay-option ${method === value ? 'is-selected' : ''}`} key={value}>
                  <input
                    type="radio"
                    name="payment"
                    value={value}
                    checked={method === value}
                    onChange={() => setMethod(value)}
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {availableMethods.length === 1 && availableMethods[0].value === 'paypal' && (
              <p className="checkout-hint checkout-hint--warn">
                USDT todavía no está configurado. Podés pagar con PayPal o coordinar por @
                {storeConfig.telegramSupport}.
              </p>
            )}
            <p className="checkout-hint">
              {method.startsWith('usdt')
                ? `Vas a pagar un monto exacto cercano a $${pricing.total.toFixed(2)} (con centavos únicos) para identificar tu depósito.`
                : `PayPal se cobra por $${pricing.total.toFixed(2)} USD. Luego confirmamos la orden por Telegram.`}
            </p>
            <div className="modal__actions">
              <button className="btn btn--ghost" type="button" onClick={() => setStep('datos')}>
                Atrás
              </button>
              <button className="btn btn--mint" type="submit">
                Ver instrucciones
              </button>
            </div>
          </form>
        )}

        {step === 'instrucciones' && order && (
          <div className="pay-panel checkout-body">
            <div className="order-id-row">
              <p className="order-id">
                Orden <strong>{order.id}</strong>
                <span> · {paymentLabel(order.paymentMethod)}</span>
              </p>
              <button
                className="btn btn--line"
                type="button"
                onClick={() => copyText(order.id, 'Orden', 'order')}
              >
                {copiedKey === 'order' ? 'ID copiado' : 'Copiar ID'}
              </button>
            </div>
            <div className="amount-box">
              <span>Total a enviar</span>
              <strong>${order.amountDue.toFixed(2)} USD</strong>
              {order.discountCode && (
                <p className="discount-box__ok">
                  Incluye {order.discountCode} (−{order.discountPercent}% / −$
                  {(order.discountAmount ?? 0).toFixed(2)})
                </p>
              )}
              {order.paymentMethod.startsWith('usdt') && (
                <button
                  className="btn btn--line"
                  type="button"
                  onClick={() => copyText(order.amountDue.toFixed(2), 'Monto', 'amount')}
                >
                  {copiedKey === 'amount' ? 'Monto copiado' : 'Copiar monto'}
                </button>
              )}
            </div>

            {order.paymentMethod.startsWith('usdt') && address && !isPlaceholderWallet(address) && (
              <div className="address-box">
                <span>Wallet {order.paymentMethod === 'usdt-trc20' ? 'TRC20' : 'BEP20'}</span>
                <div className="qr-wrap">
                  <img
                    className="qr-image"
                    src={
                      order.paymentMethod === 'usdt-trc20'
                        ? storeConfig.usdt.trc20Qr
                        : storeConfig.usdt.bep20Qr
                    }
                    alt={`QR USDT ${order.paymentMethod === 'usdt-trc20' ? 'TRC20' : 'BEP20'} ${address}`}
                    width={220}
                    height={220}
                  />
                  <p className="qr-caption">Escaneá el QR o copiá la wallet</p>
                </div>
                <code>{address}</code>
                <button
                  className="btn btn--solid"
                  type="button"
                  onClick={() => copyText(address, 'Wallet', 'wallet')}
                >
                  {copiedKey === 'wallet' ? 'Wallet copiada' : 'Copiar wallet'}
                </button>
                <p className="checkout-hint">
                  {order.paymentMethod === 'usdt-trc20'
                    ? 'Solo red TRC20 (Tron). Enviá el monto exacto; si usás otra red o otro monto, el pago no se detecta.'
                    : 'Solo red BEP20 (BSC). Enviá el monto exacto; si usás otra red o otro monto, el pago no se detecta.'}
                </p>
              </div>
            )}

            {order.paymentMethod === 'paypal' && (
              <div className="address-box">
                <span>PayPal</span>
                <p className="checkout-hint">
                  Email de cobro: <strong>{storeConfig.paypal.email}</strong>
                </p>
                <div className="pay-actions">
                  <a
                    className="btn btn--mint"
                    href={paypalMeUrl(order.amountDue)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Pagar con PayPal.me
                  </a>
                  <a
                    className="btn btn--line"
                    href={paypalCheckoutUrl(order.amountDue, order.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Checkout PayPal
                  </a>
                </div>
              </div>
            )}

            <div className="modal__actions modal__actions--stack">
              <button
                className="btn btn--mint btn--block"
                type="button"
                onClick={openTelegramConfirm}
                disabled={sendingBot}
              >
                {sendingBot ? 'Avisando compra…' : 'Ya pagué · continuar en Telegram'}
              </button>
              <button className="btn btn--ghost btn--block" type="button" onClick={() => setStep('pago')}>
                Cambiar método
              </button>
            </div>
          </div>
        )}

        {step === 'listo' && order && (
          <div className="pay-panel checkout-body checkout-success">
            <p className="checkout-success__lead">Tu pedido ya está registrado.</p>
            <div className="checkout-success__id">
              <span>Número de orden</span>
              <strong>{order.id}</strong>
            </div>
            <p className="checkout-success__text">
              Para consultas y entrega escribile a{' '}
              <strong>@{storeConfig.telegramSupport}</strong>. Te respondemos por Telegram.
            </p>
            <p className="checkout-hint">
              Si no se abrió Telegram, usá el botón de abajo o buscá @{storeConfig.telegramSupport}.
            </p>
            <div className="modal__actions modal__actions--stack">
              <a className="btn btn--mint btn--block" href={telegramOrderUrl(order)} target="_blank" rel="noreferrer">
                Escribir a @{storeConfig.telegramSupport}
              </a>
              <button className="btn btn--line btn--block" type="button" onClick={finish}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
