import { useState, type FormEvent } from 'react'
import { storeConfig } from '../config'
import { openSupport, supportDeepLink } from '../telegramLinks'

type Props = {
  showToast: (message: string) => void
}

export function CommentSection({ showToast }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [telegram, setTelegram] = useState('')
  const [orderId, setOrderId] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = [
      `Consulta Stackd`,
      `Nombre: ${name}`,
      email ? `Email: ${email}` : null,
      telegram ? `Telegram: @${telegram.replace(/^@/, '')}` : null,
      orderId ? `Orden: ${orderId}` : null,
      '',
      message,
    ]
      .filter(Boolean)
      .join('\n')

    openSupport(text)
    showToast(`Abrimos chat con @${storeConfig.telegramSupport}`)
    setMessage('')
  }

  return (
    <section className="section" id="comentarios">
      <div className="container comment-layout">
        <div>
          <p className="section__eyebrow">Consultas</p>
          <h2 className="section__title">Hablá con Stackd</h2>
          <p className="section__lead">
            Consultas, dudas y seguimiento van directo a @{storeConfig.telegramSupport}. Las compras se avisan
            automáticamente por el bot interno.
          </p>
          <a className="btn btn--solid" href={supportDeepLink()} target="_blank" rel="noreferrer">
            Abrir @{storeConfig.telegramSupport}
          </a>
        </div>

        <form className="form comment-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </label>
          <label>
            Email (opcional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </label>
          <label>
            Telegram (opcional)
            <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@tuusuario" />
          </label>
          <label>
            ID de orden (opcional)
            <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="STK-..." />
          </label>
          <label>
            Comentario
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribí tu consulta..."
            />
          </label>
          <button className="btn btn--mint" type="submit">
            Enviar por Telegram
          </button>
        </form>
      </div>
    </section>
  )
}
