import { useEffect, useRef, useState } from 'react'

const stages = [
  {
    word: 'MINERÍA',
    title: 'Movimiento de tierra en faena',
    text: 'Excavadoras, buldózeres y tolvas para caminos, botaderos y terraplenes.',
    image: '/images/mina.jpg',
    machine: 'Excavadora · Buldózer',
  },
  {
    word: 'VIALIDAD',
    title: 'Conservación de rutas del norte',
    text: 'Motoniveladoras y compactación para ripiado, bischofita y carpeta granular.',
    image: '/images/vialidad.jpg',
    machine: 'Motoniveladora · Compactador',
  },
  {
    word: 'ENERGÍA',
    title: 'Plataformas para renovables',
    text: 'Preparación de terrenos, caminos interiores y zanjas para parques solares.',
    image: '/images/energia.jpg',
    machine: 'Cargador · Camión tolva',
  },
  {
    word: 'FLOTA',
    title: 'Maquinaria propia en terreno',
    text: 'Equipos Komatsu, Caterpillar y John Deere listos para operar en Atacama.',
    image: '/images/mina-2.jpg',
    machine: 'Komatsu · CAT · John Deere',
  },
]

function scrambleTo(target: string, onFrame: (value: string) => void) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ'
  const chars = target.split('')
  let frame = 0
  const total = 10

  const id = window.setInterval(() => {
    frame += 1
    const next = chars
      .map((char, index) => {
        if (char === ' ' || char === '·') return char
        if (frame / total > index / chars.length) return char
        return alphabet[Math.floor(Math.random() * alphabet.length)]
      })
      .join('')
    onFrame(next)
    if (frame >= total) {
      window.clearInterval(id)
      onFrame(target)
    }
  }, 28)

  return () => window.clearInterval(id)
}

export default function MachineScroll() {
  const trackRef = useRef<HTMLElement | null>(null)
  const [active, setActive] = useState(0)
  const [displayWord, setDisplayWord] = useState(stages[0].word)
  const [progress, setProgress] = useState(0)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const rect = track.getBoundingClientRect()
        const total = track.offsetHeight - window.innerHeight
        if (total <= 0) return
        const raw = Math.min(1, Math.max(0, -rect.top / total))
        setProgress(raw)
        const index = Math.min(stages.length - 1, Math.floor(raw * stages.length))
        setActive(index)
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    const target = stages[active].word
    if (reduceMotion.current) {
      setDisplayWord(target)
      return
    }
    const stop = scrambleTo(target, setDisplayWord)
    return stop
  }, [active])

  const stage = stages[active]

  return (
    <section className="machine-scroll" id="maquinaria" ref={trackRef} aria-label="Maquinaria en obra">
      <div className="machine-scroll__sticky">
        <div className="machine-scroll__shell">
          <div className="machine-scroll__copy">
            <p className="eyebrow machine-scroll__eyebrow">En terreno</p>
            <p className="machine-scroll__kicker">Construimos con</p>
            <h2 className="machine-scroll__word" aria-live="polite">
              {displayWord}
            </h2>
            <div className="machine-scroll__detail" key={stage.word}>
              <h3>{stage.title}</h3>
              <p>{stage.text}</p>
              <span>{stage.machine}</span>
            </div>

            <div className="machine-scroll__steps" role="tablist" aria-label="Etapas">
              {stages.map((item, index) => (
                <button
                  key={item.word}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  className={index === active ? 'is-active' : ''}
                  onClick={() => {
                    setActive(index)
                    const track = trackRef.current
                    if (!track) return
                    const total = track.offsetHeight - window.innerHeight
                    if (total <= 80) return
                    const top = track.offsetTop + (total * (index + 0.15)) / stages.length
                    window.scrollTo({ top, behavior: reduceMotion.current ? 'auto' : 'smooth' })
                  }}
                >
                  {item.word}
                </button>
              ))}
            </div>
          </div>

          <div className="machine-scroll__stage">
            {stages.map((item, index) => (
              <figure
                key={item.word}
                className={`machine-scroll__frame ${index === active ? 'is-active' : ''}`}
                aria-hidden={index !== active}
              >
                <img src={item.image} alt="" />
                <figcaption>{item.machine}</figcaption>
              </figure>
            ))}
            <div className="machine-scroll__progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
