import { useState, type FormEvent } from 'react'
import { storeConfig } from '../config'
import { openSupport, supportDeepLink } from '../telegramLinks'

type Props = {
  showToast: (message: string) => void
}

export function CommentSection({ showToast }: Props) {
  const [name, setName] = useState('')
  const [telegram, setTelegram] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = [
      `Consulta Stackd`,
      `Nombre: ${name}`,
      telegram ? `Telegram: @${telegram.replace(/^@/, '')}` : null,
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
    <section className="section section--consultas" id="comentarios">
      <div className="container comment-layout">
        <header className="comment-intro">
          <p className="section__eyebrow">Consultas</p>
          <h2 className="section__title">Hablá con Stackd</h2>
          <p className="section__lead">
            Escribinos a @{storeConfig.telegramSupport}. Respondemos por Telegram.
          </p>
          <a className="btn btn--mint" href={supportDeepLink()} target="_blank" rel="noreferrer">
            Abrir @{storeConfig.telegramSupport}
          </a>
        </header>

        <div className="comment-divider" role="presentation">
          <span>o dejá tu mensaje</span>
        </div>

        <form className="form comment-form" onSubmit={handleSubmit}>
          <div className="comment-fields">
            <label>
              Nombre
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
            </label>
            <label>
              Telegram <small>opcional</small>
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@tuusuario" />
            </label>
          </div>
          <label>
            Mensaje
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribí tu consulta..."
            />
          </label>
          <button className="btn btn--solid comment-submit" type="submit">
            Enviar por Telegram
          </button>
        </form>
      </div>
    </section>
  )
}
