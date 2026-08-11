type BrandLogoProps = {
  compact?: boolean
}

/** Logo oficial Soinver (horizontal). Colores originales, sin filtros. */
export default function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <img
      className={`soinver-logo-img ${compact ? 'soinver-logo-img--compact' : ''}`}
      src="/logo-soinver-h.png"
      alt="Soinver Ingenieria"
      width={compact ? 132 : 160}
      height={compact ? 40 : 48}
      decoding="async"
    />
  )
}
