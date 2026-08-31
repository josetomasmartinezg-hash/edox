import logoLight from '../assets/logo-soinver-h-light.png'

type BrandLogoProps = {
  compact?: boolean
}

/** Logo horizontal Soinver para fondos oscuros: ícono rojo + tipografía clara. */
export default function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <img
      className={`soinver-logo-img ${compact ? 'soinver-logo-img--compact' : ''}`}
      src={logoLight}
      alt="Soinver Ingenieria"
      width={compact ? 148 : 176}
      height={compact ? 33 : 39}
      decoding="async"
    />
  )
}
