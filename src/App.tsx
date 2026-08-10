import { useEffect, useRef, useState } from 'react'
import './App.css'

const navLinks = [
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#capacidades', label: 'Capacidades' },
  { href: '#proyectos', label: 'Proyectos' },
  { href: '#equipo', label: 'Equipo' },
  { href: '#contacto', label: 'Contacto' },
]

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
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
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
            <span className="brand-mark__square" aria-hidden="true" />
            <span>
              SOINVER <em>/ INGENIERÍA</em>
            </span>
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
          </div>
        </section>

        <section className="facts-bar" aria-label="Datos clave">
          <div className="shell facts-bar__grid">
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
            <div className="facts-bar__years">
              <strong>34</strong>
              <span>Años construyendo el norte de Chile</span>
            </div>
          </div>
        </section>

        <section className="section about" id="nosotros">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">01 · Quiénes somos</p>
              <h2>
                Experiencia y excelencia en <em>construcción.</em>
              </h2>
              <p className="lead">
                Fundada en 1992, Soinver Ingeniería S.A. se ha consolidado como una empresa líder
                en el sector inmobiliario y de construcción. Desde 2004, enfoca su energía en
                movimiento de tierra y obras civiles para proyectos públicos y mineros.
              </p>
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

        <section className="section purpose">
          <div className="shell purpose__grid">
            <article data-reveal>
              <p className="eyebrow">02 · Propósito</p>
              <h2>
                Misión <em>& visión.</em>
              </h2>
            </article>
            <article data-reveal style={{ transitionDelay: '80ms' }}>
              <h3>Misión</h3>
              <p>
                Proporcionar soluciones confiables e integrales con altos estándares de calidad en
                ingeniería y obras. Cuidamos al equipo humano, al medio ambiente y a la comunidad,
                generando valor para clientes y accionistas.
              </p>
              <blockquote>Soluciones que duran tanto como las rutas que construimos.</blockquote>
            </article>
            <article data-reveal style={{ transitionDelay: '160ms' }}>
              <h3>Visión</h3>
              <p>
                Ser una empresa respetada por su excelencia, confiabilidad y la calidad de sus
                obras. Aspiramos a que cada integrante se sienta orgulloso de pertenecer y
                contribuir al reconocimiento del sector.
              </p>
              <blockquote>
                Una organización donde la gente quiere quedarse, crecer y firmar lo que construye.
              </blockquote>
            </article>
          </div>
        </section>

        <section className="section capabilities" id="capacidades">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">03 · Organización</p>
              <h2>
                Estructura <em>organizativa.</em>
              </h2>
            </div>

            <div className="capability-list">
              <article data-reveal>
                <span>01</span>
                <div>
                  <h3>Dirección</h3>
                  <p>
                    Eduardo Latorre Salas y Mario Lisperguer Basaure encabezan la empresa como
                    accionistas principales, aportando vasta experiencia en gestión y
                    administración.
                  </p>
                </div>
              </article>
              <article data-reveal>
                <span>02</span>
                <div>
                  <h3>Equipo profesional</h3>
                  <p>
                    Ingenieros civiles, constructores y técnicos especializados en vialidad,
                    operaciones mineras, prevención, laboratorio y topografía.
                  </p>
                </div>
              </article>
              <article data-reveal>
                <span>03</span>
                <div>
                  <h3>Áreas de especialización</h3>
                  <p>
                    Vialidad y conservación, minería y movimiento de tierra, obras civiles e
                    industriales — capaces de operar simultáneamente en proyectos públicos y
                    privados.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section fleet">
          <div className="shell fleet__grid">
            <div className="section-head" data-reveal>
              <p className="eyebrow">04 · Flota</p>
              <h2>
                Maquinaria <em>& equipos.</em>
              </h2>
              <p className="lead">Una flota propia para mover el norte, mantenida a régimen de mina.</p>
            </div>

            <div className="fleet__items">
              <article data-reveal>
                <h3>Equipos pesados</h3>
                <p>Buldózeres, motoniveladoras, excavadoras y cargadores frontales.</p>
                <ul>
                  <li>Komatsu</li>
                  <li>Caterpillar</li>
                  <li>John Deere</li>
                </ul>
              </article>
              <article data-reveal>
                <h3>Transporte</h3>
                <p>Logística de obra a escala industrial entre frentes.</p>
                <ul>
                  <li>Aljibe</li>
                  <li>Tolva</li>
                  <li>Cama baja</li>
                </ul>
              </article>
              <article data-reveal>
                <h3>Especializados</h3>
                <p>Plantas y herramientas para obras viales y caminos mineros.</p>
                <ul>
                  <li>Seleccionadoras</li>
                  <li>Gravilladoras</li>
                  <li>Imprimación</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section trajectory">
          <div className="shell trajectory__layout">
            <div data-reveal>
              <p className="eyebrow">05 · Trayectoria</p>
              <h2>
                Experiencia en obras <em>viales.</em>
              </h2>
              <p className="lead">
                Más de dos décadas de continuidad en la Región de Atacama, conservando rutas
                estratégicas para el Estado y para la operación minera del norte.
              </p>

              <ol className="timeline">
                <li>
                  <strong>2004 — 2006</strong>
                  <span>Etapa I</span>
                  <p>
                    Conservación de caminos en Atacama: ripiados, mantención con bischofita y
                    señalización en Copiapó y Chañaral.
                  </p>
                </li>
                <li>
                  <strong>2006 — 2015</strong>
                  <span>Etapa II</span>
                  <p>
                    Múltiples proyectos de conservación global en Chañaral, Huasco y Copiapó,
                    abarcando miles de kilómetros.
                  </p>
                </li>
                <li>
                  <strong>2015 — Hoy</strong>
                  <span>Etapa III</span>
                  <p>
                    Continuidad en conservación global: reperfilado con bischofita, carpeta
                    granular y lechada asfáltica.
                  </p>
                </li>
              </ol>
            </div>

            <figure className="media-panel" data-reveal>
              <img src="/images/vialidad.jpg" alt="Conservación de caminos en la Región de Atacama" />
              <figcaption>
                <span>Kilómetros conservados</span>
                <strong>1.900+</strong>
                <span>Provincia de Chañaral</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="section projects" id="proyectos">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">06 · Minería</p>
              <h2>
                Proyectos destacados en <em>minería.</em>
              </h2>
            </div>

            <div className="project-rows">
              <article data-reveal>
                <span>Cliente 01</span>
                <h3>Anglo American Chile</h3>
                <p>
                  Modificación del Camino Público C-203 y variante Quebrada Guamanga para la
                  División Mantoverde: excavaciones, terraplenes y obras de hormigón.
                </p>
                <em>Cobre — Atacama</em>
              </article>
              <article data-reveal>
                <span>Cliente 02</span>
                <h3>Mantos Copper</h3>
                <p>
                  Retiro de ripios lixiviados desde Pad Dinámico y mantenimiento de botaderos y
                  caminos interiores en Mantoverde.
                </p>
                <em>Mantoverde — Atacama</em>
              </article>
              <article data-reveal>
                <span>Cliente 03</span>
                <h3>KGHM Minera Franke</h3>
                <p>
                  Reconstrucción y mantenimiento de caminos interiores y exteriores con
                  aplicación de bischofita para control de polución en faena.
                </p>
                <em>Franke — Atacama</em>
              </article>
            </div>
          </div>
        </section>

        <section className="section civil">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">07 · Obra civil</p>
              <h2>
                Obras civiles <em>destacadas.</em>
              </h2>
            </div>

            <div className="table-like" data-reveal>
              <div className="table-like__head">
                <span>Proyecto</span>
                <span>Cliente</span>
                <span>Descripción</span>
                <span>Tipo</span>
              </div>
              <div>
                <strong>Canalización Estero El Guindo</strong>
                <span>Inmobiliaria Nollagam</span>
                <p>Excavación, rellenos y hormigón estructural para encauzamiento de cauce natural.</p>
                <em>Hidráulica</em>
              </div>
              <div>
                <strong>Centro Logístico Leyda</strong>
                <span>Logística El Cardal</span>
                <p>Construcción de galpones, oficinas y pavimentos exteriores en complejo logístico.</p>
                <em>Industrial</em>
              </div>
              <div>
                <strong>Centro Industrial Los Yacimientos</strong>
                <span>Rentas Soinver Ltda.</span>
                <p>Galpones, oficinas y pavimentos exteriores en parque industrial de operación propia.</p>
                <em>Industrial</em>
              </div>
            </div>

            <div className="pillars" data-reveal>
              <p>Hormigón estructural</p>
              <p>Pavimentos & explanadas</p>
              <p>Galpones & oficinas llave en mano</p>
            </div>
          </div>
        </section>

        <section className="section energy">
          <div className="shell energy__layout">
            <div data-reveal>
              <p className="eyebrow">08 · Energía</p>
              <h2>
                Proyectos de energía <em>renovable.</em>
              </h2>
            </div>

            <ol className="numbered-list">
              <li data-reveal>
                <strong>Parque Fotovoltaico Sol de Los Andes</strong>
                <p>
                  Movimiento de tierra y construcción de caminos interiores para Eiffage Energía
                  Chile en Diego de Almagro.
                </p>
              </li>
              <li data-reveal>
                <strong>PFV Guanchoi</strong>
                <p>
                  Escarpe, desmonte y terraplén para el parque fotovoltaico operado por Soltec
                  Chile SpA.
                </p>
              </li>
              <li data-reveal>
                <strong>Cableado PFV Guanchoi</strong>
                <p>
                  Excavación de zanjas, relleno y compactación para instalación de cables —
                  especialidad en obras eléctricas civiles.
                </p>
              </li>
            </ol>

            <figure className="media-panel media-panel--accent" data-reveal>
              <img src="/images/energia.jpg" alt="Infraestructura para energía renovable" />
            </figure>
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
                Un equipo multidisciplinario que combina liderazgo técnico, especialistas
                certificados y profesionales de terreno.
              </p>
            </div>

            <div className="team-grid">
              <article data-reveal>
                <h3>Ingenieros & constructores</h3>
                <ul>
                  <li>
                    <strong>Mario Lisperguer Basaure</strong>
                    <span>Constructor Civil</span>
                  </li>
                  <li>
                    <strong>Rodrigo Mallea Araya</strong>
                    <span>Constructor Civil</span>
                  </li>
                  <li>
                    <strong>Ricardo Leiva Castillo</strong>
                    <span>Ingeniero Constructor</span>
                  </li>
                  <li>
                    <strong>Juan Álamos Vásquez</strong>
                    <span>Ingeniero Civil</span>
                  </li>
                </ul>
              </article>
              <article data-reveal>
                <h3>Especialistas técnicos</h3>
                <ul>
                  <li>
                    <strong>Andrés Quezada Castillo</strong>
                    <span>Téc. Prev. Riesgos</span>
                  </li>
                  <li>
                    <strong>Belén Rojas Rivas</strong>
                    <span>Ing. Ambiental</span>
                  </li>
                  <li>
                    <strong>Luis Salinas Chacana</strong>
                    <span>Geógrafo</span>
                  </li>
                </ul>
              </article>
              <article data-reveal>
                <h3>Laboratorio & topografía</h3>
                <ul>
                  <li>
                    <strong>Alexis Arancibia Sierra</strong>
                    <span>Laboratorista Clase B · Vialidad</span>
                  </li>
                  <li>
                    <strong>Eduardo Vargas González</strong>
                    <span>Téc. Nivel Superior · Topografía</span>
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section responsibility">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">10 · Responsabilidad</p>
              <h2>
                Seguridad & <em>medio ambiente.</em>
              </h2>
              <p className="lead">
                Tres compromisos no negociables: la integridad del equipo, la protección del
                entorno y el aporte a las comunidades donde trabajamos.
              </p>
            </div>

            <div className="commitments">
              <article data-reveal>
                <span>SST</span>
                <h3>Seguridad laboral</h3>
                <p>
                  Protocolos rigurosos y especialistas en prevención de riesgos presentes en cada
                  obra.
                </p>
              </article>
              <article data-reveal>
                <span>ENV</span>
                <h3>Gestión ambiental</h3>
                <p>
                  Prácticas sostenibles en proyectos viales y mineros, con ingenieros ambientales
                  en el equipo.
                </p>
              </article>
              <article data-reveal>
                <span>RSE</span>
                <h3>Responsabilidad social</h3>
                <p>
                  Empleo local y participación en iniciativas de mejora social en Atacama.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section innovation">
          <div className="shell innovation__layout">
            <div data-reveal>
              <p className="eyebrow">11 · Innovación</p>
              <h2>
                Innovación & <em>tecnología.</em>
              </h2>
              <p className="lead">
                Inversión continua en equipos, software y técnicas para cumplir plazos y
                estándares exigentes.
              </p>
              <p className="highlight-note">
                Técnica destacada: bischofita para control de polución en caminos mineros.
              </p>
            </div>
            <ol className="numbered-list">
              <li data-reveal>
                <strong>Equipos de última generación</strong>
                <p>Maquinaria tecnológicamente avanzada para eficiencia y calidad en cada frente.</p>
              </li>
              <li data-reveal>
                <strong>Sistemas de gestión</strong>
                <p>Software para planificación, seguimiento y control con trazabilidad operacional.</p>
              </li>
              <li data-reveal>
                <strong>Técnicas innovadoras</strong>
                <p>Uso de bischofita para control de polvo, optimizando vida útil y huella ambiental.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="section active">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">12 · Cartera activa</p>
              <h2>
                Proyectos en <em>ejecución.</em>
              </h2>
            </div>

            <div className="active-list">
              <article data-reveal>
                <span>SOI-CGCH / 2025</span>
                <h3>Conservación Global Chañaral</h3>
                <p>
                  Mantención de 1.900 km de caminos en la Provincia de Chañaral con reperfilado,
                  bischofita y carpeta granular.
                </p>
                <div>
                  <strong>1.900 km</strong>
                  <em>Atacama</em>
                </div>
              </article>
              <article data-reveal>
                <span>SOI-C451-I / 2025</span>
                <h3>Ruta C-451 · Tramo I</h3>
                <p>
                  Camino básico por conservación, km 26,919 al 59,440. Terraplenes, excavación y
                  pavimento tipo cape seal.
                </p>
                <div>
                  <strong>32,5 km</strong>
                  <em>Cape seal</em>
                </div>
              </article>
              <article data-reveal>
                <span>SOI-C451-II / 2025</span>
                <h3>Ruta C-451 · Tramo II</h3>
                <p>
                  Continuación del tramo anterior, km 59,440 al 70,765, con mejoramiento vial
                  análogo.
                </p>
                <div>
                  <strong>11,3 km</strong>
                  <em>Cape seal</em>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section future">
          <div className="shell">
            <div className="section-head" data-reveal>
              <p className="eyebrow">13 · Hacia adelante</p>
              <h2>
                Perspectivas de <em>futuro.</em>
              </h2>
            </div>
            <div className="future-grid">
              <article data-reveal>
                <span>↗</span>
                <h3>Expansión geográfica</h3>
                <p>
                  Llevar la experiencia en obras viales y mineras a nuevas regiones de Chile,
                  replicando el modelo operacional probado en Atacama.
                </p>
              </article>
              <article data-reveal>
                <span>⊕</span>
                <h3>Diversificación de servicios</h3>
                <p>
                  Ampliar la cartera en infraestructuras para energías renovables y obras civiles
                  de mayor escala.
                </p>
              </article>
              <article data-reveal>
                <span>∞</span>
                <h3>Desarrollo sostenible</h3>
                <p>
                  Profundizar prácticas sostenibles en cada proyecto, contribuyendo al desarrollo
                  responsable del país.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section credentials">
          <div className="shell credentials__layout">
            <div data-reveal>
              <p className="eyebrow">14 · Acreditaciones</p>
              <h2>
                Certificaciones <em>& registros.</em>
              </h2>
              <ul className="credential-list">
                <li>
                  <strong>A · Registro MOP</strong>
                  <p>Obras Mayores III · N° 1396 — Ministerio de Obras Públicas de Chile.</p>
                </li>
                <li>
                  <strong>B · Especialidades</strong>
                  <p>Tierra · Hormigón · Pavimentos · Tuberías.</p>
                </li>
                <li>
                  <strong>C · Calidad</strong>
                  <p>Altos estándares sostenidos en todos los proyectos y servicios.</p>
                </li>
              </ul>
            </div>
            <aside className="credential-badge" data-reveal>
              <span>Categoría</span>
              <strong>III</strong>
              <p>Registro N° 1396</p>
              <em>Inscripción vigente — Sector contratos del Estado</em>
            </aside>
          </div>
        </section>

        <section className="section partners">
          <div className="shell partners__layout">
            <div data-reveal>
              <p className="eyebrow">15 · Alianzas estratégicas</p>
              <h2>
                Alianzas <em>estratégicas.</em>
              </h2>
              <p className="lead">
                Soinver amplía su capacidad operativa mediante alianzas con empresas
                especializadas que complementan su oferta en minería y reutilización de
                maquinaria.
              </p>
            </div>
            <article className="partner" data-reveal>
              <span>Partner 01</span>
              <h3>SM Equipos Mineros</h3>
              <p>
                Especialistas en compra, venta y reparación de maquinaria para minería
                subterránea. Soluciones orientadas a la reparación y reutilización de equipos.
              </p>
              <ul>
                <li>Compra y venta de equipos y maquinaria minera</li>
                <li>Overhaul y reconstrucción de maquinaria pesada</li>
                <li>Servicio post-venta y capacitación de operadores</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="section contact" id="contacto">
          <div className="shell">
            <div className="contact__intro" data-reveal>
              <p className="eyebrow">Contacto</p>
              <h2>Hablemos.</h2>
              <p className="contact__tag">Ubicación & contacto</p>
            </div>

            <div className="contact__grid" data-reveal>
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
                  <a href="mailto:e.latorre@soinver.cl">e.latorre@soinver.cl</a>
                </strong>
              </div>
            </div>

            <p className="contact__closing" data-reveal>
              Construyendo el norte de Chile desde 1992.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell site-footer__inner">
          <div className="brand-mark">
            <span className="brand-mark__square" aria-hidden="true" />
            <span>
              SOINVER <em>/ INGENIERÍA</em>
            </span>
          </div>
          <p>© {new Date().getFullYear()} Soinver Ingeniería S.A. · Capacidades 2026</p>
        </div>
      </footer>
    </div>
  )
}
