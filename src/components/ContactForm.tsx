import { useState } from 'react'
import type { FormEvent } from 'react'

/** Destino fijo de todos los contactos del sitio */
const CONTACT_EMAIL = 'recepcion@soinver.cl'

type Status = 'idle' | 'sending' | 'success' | 'error'

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    // Destino y respuesta siempre a / desde el correo corporativo
    data.set('_to', CONTACT_EMAIL)
    data.set('_replyto', String(data.get('email') || ''))
    data.set('_subject', 'Nuevo contacto desde web Soinver')

    setStatus('sending')
    setErrorMsg('')

    try {
      const response = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: data,
      })

      const result = (await response.json().catch(() => null)) as
        | { success?: string | boolean; message?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.message || 'No se pudo enviar el mensaje')
      }

      form.reset()
      setStatus('success')
    } catch {
      const nombre = String(data.get('nombre') || '')
      const email = String(data.get('email') || '')
      const telefono = String(data.get('telefono') || '')
      const empresa = String(data.get('empresa') || '')
      const mensaje = String(data.get('mensaje') || '')

      const subject = encodeURIComponent(`Contacto web Soinver — ${nombre}`)
      const body = encodeURIComponent(
        [
          `Nombre: ${nombre}`,
          `Email: ${email}`,
          `Teléfono: ${telefono}`,
          empresa ? `Empresa: ${empresa}` : '',
          '',
          mensaje,
        ]
          .filter(Boolean)
          .join('\n'),
      )

      // Fallback: abre el correo dirigido a recepción
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
      setStatus('success')
      setErrorMsg('')
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} data-reveal noValidate>
      <input type="hidden" name="_subject" value="Nuevo contacto desde web Soinver" />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_captcha" value="false" />
      <input type="hidden" name="_to" value={CONTACT_EMAIL} />
      <input type="text" name="_honey" className="contact-form__honey" tabIndex={-1} autoComplete="off" />

      <div className="contact-form__row">
        <label>
          <span>Nombre</span>
          <input name="nombre" type="text" required placeholder="Tu nombre" autoComplete="name" />
        </label>
        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="tu@email.com"
            autoComplete="email"
          />
        </label>
      </div>

      <div className="contact-form__row">
        <label>
          <span>Teléfono</span>
          <input
            name="telefono"
            type="tel"
            placeholder="+56 9 0000 0000"
            autoComplete="tel"
          />
        </label>
        <label>
          <span>Empresa</span>
          <input name="empresa" type="text" placeholder="Opcional" autoComplete="organization" />
        </label>
      </div>

      <label className="contact-form__full">
        <span>Mensaje</span>
        <textarea
          name="mensaje"
          required
          rows={5}
          placeholder="Cuéntanos sobre tu proyecto o consulta"
        />
      </label>

      <p className="contact-form__destinatario">
        Los mensajes se envían a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <div className="contact-form__actions">
        <button className="btn" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
        </button>
        {status === 'success' && (
          <p className="contact-form__status contact-form__status--ok" role="status">
            Mensaje enviado a {CONTACT_EMAIL}. Gracias por contactarnos.
          </p>
        )}
        {status === 'error' && (
          <p className="contact-form__status contact-form__status--err" role="alert">
            {errorMsg || `No se pudo enviar. Escríbenos a ${CONTACT_EMAIL}.`}
          </p>
        )}
      </div>
    </form>
  )
}
