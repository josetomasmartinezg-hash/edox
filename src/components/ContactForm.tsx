import { useState } from 'react'
import type { FormEvent } from 'react'

type Status = 'idle' | 'sending' | 'success' | 'error'

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    setStatus('sending')
    setErrorMsg('')

    try {
      const response = await fetch('https://formsubmit.co/ajax/e.latorre@soinver.cl', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: data,
      })

      if (!response.ok) {
        throw new Error('No se pudo enviar el mensaje')
      }

      form.reset()
      setStatus('success')
    } catch {
      // Fallback: abrir cliente de correo del usuario
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

      window.location.href = `mailto:e.latorre@soinver.cl?subject=${subject}&body=${body}`
      setStatus('success')
      setErrorMsg('')
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} data-reveal noValidate>
      <input type="hidden" name="_subject" value="Nuevo contacto desde web Soinver" />
      <input type="hidden" name="_template" value="table" />
      <input type="hidden" name="_captcha" value="false" />
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

      <div className="contact-form__actions">
        <button className="btn" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
        </button>
        {status === 'success' && (
          <p className="contact-form__status contact-form__status--ok" role="status">
            Mensaje listo. Gracias por contactarnos.
          </p>
        )}
        {status === 'error' && (
          <p className="contact-form__status contact-form__status--err" role="alert">
            {errorMsg || 'No se pudo enviar. Intenta nuevamente o escribe a e.latorre@soinver.cl.'}
          </p>
        )}
      </div>
    </form>
  )
}
