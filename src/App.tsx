import { useEffect, useRef, useState } from 'react'
import ContactForm from './components/ContactForm'
import './App.css'

const navLinks = [
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#capacidades', label: 'Capacidades' },
  { href: '#proyectos', label: 'Proyectos' },
  { href: '#equipo', label: 'Equipo' },
  { href: '#contacto', label: 'Contacto' },
]

const teamGroups = [
  {
    title: 'Ingenieros & constructores',
    people: [
      { name: 'Mario Lisperguer Basaure', role: 'Constructor Civil' },
      { name: 'Rodrigo Mallea Araya', role: 'Constructor Civil' },
      { name: 'Ricardo Leiva Castillo', role: 'Ingeniero Constructor' },
      { name: 'Juan Álamos Vásquez', role: 'Ingeniero Civil' },
    ],
  },
  {
    title: 'Especialistas técnicos',
    people: [
      { name: 'Andrés Quezada Castillo', role: 'Téc. Prev. Riesgos' },
      { name: 'Belén Rojas Rivas', role: 'Ing. Ambiental' },
      { name: 'Luis Salinas Chacana', role: 'Geógrafo' },
    ],
  },
  {
    title: 'Laboratorio & topografía',
    people: [
      { name: 'Alexis Arancibia Sierra', role: 'Laboratorista Clase B · Vialidad' },
      { name: 'Eduardo Vargas González', role: 'Téc. Nivel Superior · Topografía' },
    ],
  },
]

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )

    el.querySelectorAll('[data-reveal]').forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return ref
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pageRef = useReveal()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="page" ref={pageRef}>
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="site-header__inner">
          <a className="brand-mark" href="#inicio" onClick={closeMenu}>
            <img
              className="brand-mark__logo"
              src="/logo-soinver-h.svg"
              alt="Soinver Ingeniería"
              width={168}
              height={55}
            />
          </a>

          <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Principal">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
            <a className="btn btn--small" href="#contacto" onClick={closeMenu}>
              Hablemos
            </a>
          </nav>

          <button
            className={`menu-toggle ${menuOpen ? 'is-open' : ''}`}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero__media" aria-hidden="true">
            <img src="/images/hero-obra.jpg" alt="" />
            <div className="hero__veil" />
          </div>

          <div className="hero__content">
            <p className="eyebrow hero__eyebrow">Capacidades · Edición 2026</p>
            <h1 className="hero__brand">
              SOINVER
              <span>INGENIERÍA</span>
            </h1>
            <p className="hero__lead">
              Ingeniería, construcción y obras civiles para minería e infraestructura en Chile.
            </p>
            <div className="hero__actions">
              <a className="btn" href="#contacto">
                Contactar
              </a>
              <a className="btn btn--ghost" href="#proyectos">
                Ver proyectos
              </a>
            </div>

            <div className="hero__facts" aria-label="Datos clave">
              <div>
                <span>Fundación</span>
                <strong>1992 — Santiago</strong>
              </div>
              <div>
                <span>Sector</span>
                <strong>Minería · Vialidad · Civil</strong>
              </div>
              <div>
                <span>Registro MOP</span>
                <strong>Obras Mayores III</strong>
              </div>
              <div className="hero__facts-years">
                <strong>34</strong>
                <span>Años construyendo el norte de Chile</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section about" id="nosotros">
          <div className="shell about__layout">
            <div className="section-head" data-reveal>
              <p className="eyebrow">Quiénes somos</p>
              <h2>
                Experiencia y excelencia en <em>construcción.</em>
              </h2>
              <p className="lead">
                Fundada en 1992, Soinver Ingeniería S.A. se ha consolidado como una empresa líder
                en construcción. Desde 2004, enfoca su energía en movimiento de tierra y obras
                civiles para proyectos públicos y mineros en el norte de Chile.
              </p>
            </div>

            <div className="purpose-pair" data-reveal>
              <article>
                <h3>Misión</h3>
                <p>
                  Soluciones confiables e integrales con altos estándares de calidad, cuidando al
                  equipo, al medio ambiente y a la comunidad.
                </p>
              </article>
              <article>
                <h3>Visión</h3>
                <p>
                  Ser una empresa respetada por su excelencia y confiabilidad, donde cada
                  integrante se sienta orgulloso de firmar lo que construye.
                </p>
              </article>
            </div>

            <div className="stat-row" data-reveal>
              <div>
                <strong>1992</strong>
                <span>Año de fundación</span>
              </div>
              <div>
                <strong>20+</strong>
                <span>Años en construcción minera y vial</span>
              </div>
              <div>
                <strong>III</strong>
                <span>Categoría Registro MOP N° 1396</span>
              </div>
              <div>
                <strong>1.900+</strong>
                <span>Km conservados en Chañaral</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section capabilities" id="capacidades">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">Capacidades</p>
              <h2>
                Operación integral de <em>obra.</em>
              </h2>
              <p className="lead">
                Dirección con experiencia operativa, equipo multidisciplinario y flota propia para
                vialidad, minería y obra civil.
              </p>
            </div>

            <div className="capability-grid">
              <article data-reveal>
                <h3>Vialidad & conservación</h3>
                <p>
                  Conservación global, ripiados, bischofita, carpeta granular y cape seal en rutas
                  estratégicas de Atacama.
                </p>
              </article>
              <article data-reveal>
                <h3>Minería & movimiento de tierra</h3>
                <p>
                  Caminos mineros, botaderos, excavaciones y terraplenes para operaciones de cobre
                  en faena.
                </p>
              </article>
              <article data-reveal>
                <h3>Obras civiles e industriales</h3>
                <p>
                  Hormigón estructural, pavimentos, galpones y complejos logísticos llave en mano.
                </p>
              </article>
              <article data-reveal>
                <h3>Flota propia</h3>
                <p>
                  Buldózeres, excavadoras, motoniveladoras, tolvas y camas bajas Komatsu,
                  Caterpillar y John Deere.
                </p>
              </article>
            </div>

            <figure className="band-media" data-reveal>
              <img src="/images/mina.jpg" alt="Operación minera en terreno montañoso" />
              <figcaption>
                Operación a escala industrial · Minería e infraestructura en Chile
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="section projects" id="proyectos">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">Proyectos</p>
              <h2>
                Obra que sostiene el <em>norte.</em>
              </h2>
              <p className="lead">
                Trayectoria en minería, vialidad pública, energía renovable y cartera activa 2025.
              </p>
            </div>

            <div className="project-showcase">
              <article className="project-feature" data-reveal>
                <img src="/images/vialidad.jpg" alt="Conservación de caminos en Atacama" />
                <div>
                  <span>En ejecución · 1.900 km</span>
                  <h3>Conservación Global Chañaral</h3>
                  <p>
                    Mantención de caminos en la Provincia de Chañaral con reperfilado, bischofita
                    y carpeta granular.
                  </p>
                </div>
              </article>

              <div className="project-list">
                <article data-reveal>
                  <span>Minería</span>
                  <h3>Anglo American · Mantoverde</h3>
                  <p>Modificación Camino C-203 y variante Quebrada Guamanga.</p>
                </article>
                <article data-reveal>
                  <span>Minería</span>
                  <h3>Mantos Copper</h3>
                  <p>Retiro de ripios lixiviados y mantención de botaderos interiores.</p>
                </article>
                <article data-reveal>
                  <span>Minería</span>
                  <h3>KGHM Minera Franke</h3>
                  <p>Reconstrucción de caminos con bischofita para control de polución.</p>
                </article>
                <article data-reveal>
                  <span>Energía</span>
                  <h3>PFV Sol de Los Andes & Guanchoi</h3>
                  <p>Movimiento de tierras, caminos interiores y zanjas para cableado.</p>
                </article>
                <article data-reveal>
                  <span>Vialidad</span>
                  <h3>Ruta C-451 · Tramos I y II</h3>
                  <p>43,8 km de mejoramiento vial con pavimento cape seal.</p>
                </article>
                <article data-reveal>
                  <span>Civil</span>
                  <h3>Centros logísticos e industriales</h3>
                  <p>Galpones, oficinas y pavimentos en Leyda y Los Yacimientos.</p>
                </article>
              </div>
            </div>

            <div className="timeline-strip" data-reveal>
              <div>
                <strong>2004 — 2006</strong>
                <p>Inicio de conservación vial en Copiapó y Chañaral.</p>
              </div>
              <div>
                <strong>2006 — 2015</strong>
                <p>Conservación global en Chañaral, Huasco y Copiapó.</p>
              </div>
              <div>
                <strong>2015 — Hoy</strong>
                <p>Continuidad con bischofita, carpeta granular y lechada asfáltica.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section team" id="equipo">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">Personas</p>
              <h2>
                El equipo <em>profesional.</em>
              </h2>
              <p className="lead">
                Liderazgo técnico, especialistas certificados y profesionales de terreno en cada
                frente de obra.
              </p>
            </div>

            <div className="team-grid">
              {teamGroups.map((group) => (
                <article key={group.title} data-reveal>
                  <h3>{group.title}</h3>
                  <ul>
                    {group.people.map((person) => (
                      <li key={person.name}>
                        <span className="avatar" aria-hidden="true">
                          {initials(person.name)}
                        </span>
                        <div>
                          <strong>{person.name}</strong>
                          <span>{person.role}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section trust">
          <div className="shell trust__layout">
            <div data-reveal>
              <p className="eyebrow">Compromiso</p>
              <h2>
                Seguridad, entorno y <em>acreditación.</em>
              </h2>
              <p className="lead">
                Tres pilares no negociables y registro vigente ante el Ministerio de Obras
                Públicas.
              </p>
            </div>

            <div className="trust__grid">
              <article data-reveal>
                <span>SST</span>
                <h3>Seguridad laboral</h3>
                <p>Protocolos rigurosos y prevención de riesgos en cada obra.</p>
              </article>
              <article data-reveal>
                <span>ENV</span>
                <h3>Gestión ambiental</h3>
                <p>Prácticas sostenibles en proyectos viales y mineros.</p>
              </article>
              <article data-reveal>
                <span>RSE</span>
                <h3>Comunidad</h3>
                <p>Empleo local e iniciativas de mejora social en Atacama.</p>
              </article>
              <aside className="credential-badge" data-reveal>
                <span>Registro MOP</span>
                <strong>III</strong>
                <p>Obras Mayores · N° 1396</p>
                <em>Inscripción vigente — contratos del Estado</em>
              </aside>
            </div>
          </div>
        </section>

        <section className="section contact" id="contacto">
          <div className="shell">
            <div className="contact__intro" data-reveal>
              <p className="eyebrow">Contacto</p>
              <h2>Hablemos.</h2>
              <p className="contact__tag">Escríbenos y te respondemos</p>
            </div>

            <div className="contact__layout">
              <ContactForm />

              <aside className="contact__details" data-reveal>
                <div>
                  <span>Dirección</span>
                  <strong>
                    Vista Hermosa N° 9790
                    <br />
                    Cerrillos, Santiago
                    <br />
                    Chile
                  </strong>
                </div>
                <div>
                  <span>Teléfono</span>
                  <strong>
                    <a href="tel:+56227073900">+56 2 2707 3900</a>
                  </strong>
                </div>
                <div>
                  <span>Correo electrónico</span>
                  <strong>
                    <a href="mailto:recepcion@soinver.cl">recepcion@soinver.cl</a>
                  </strong>
                </div>
                <p className="contact__closing">
                  Construyendo el norte de Chile desde 1992.
                </p>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell site-footer__inner">
          <div className="brand-mark">
            <img
              className="brand-mark__logo"
              src="/logo-soinver-h.svg"
              alt="Soinver Ingeniería"
              width={168}
              height={55}
            />
          </div>
          <p>© {new Date().getFullYear()} Soinver Ingeniería S.A. · Capacidades 2026</p>
        </div>
      </footer>
    </div>
  )
}
