import { useState, type FormEvent } from 'react'
import { storeConfig } from '../config'
import { notifyCommentToBot } from '../telegramApi'
import { botDeepLink, commentStartPayload, openBot } from '../telegramLinks'

type Props = {
  showToast: (message: string) => void
}

export function CommentSection({ showToast }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [telegram, setTelegram] = useState('')
  const [orderId, setOrderId] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    const result = await notifyCommentToBot({
      name,
      email,
      telegram,
      orderId: orderId || undefined,
      message,
    })
    setSending(false)

    if (result.ok) {
      showToast('Comentario enviado al bot de Telegram')
      setMessage('')
      openBot(commentStartPayload())
      return
    }

    // Fallback: abre el bot aunque el API no esté configurado
    showToast(result.error || 'Abrimos el bot para que envíes el comentario')
    openBot(commentStartPayload())
  }

  return (
    <section className="section" id="comentarios">
      <div className="container comment-layout">
        <div>
          <p className="section__eyebrow">Telegram bot</p>
          <h2 className="section__title">Comentarios y soporte</h2>
          <p className="section__lead">
            Dejá tu consulta o comentario acá. Se envía al bot de Stackd y te abrimos el chat para seguir la conversación.
          </p>
          <a className="btn btn--solid" href={botDeepLink()} target="_blank" rel="noreferrer">
            Abrir @{storeConfig.telegramBot}
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
              placeholder="Escribí tu comentario o consulta..."
            />
          </label>
          <button className="btn btn--mint" type="submit" disabled={sending}>
            {sending ? 'Enviando…' : 'Enviar y abrir bot'}
          </button>
        </form>
      </div>
    </section>
  )
}
