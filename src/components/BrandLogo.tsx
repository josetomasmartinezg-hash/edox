type BrandLogoProps = {
  compact?: boolean
}

/** Logo Soinver oficial (imagen), colores originales sin filtros. */
export default function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <img
      className={`soinver-logo-img ${compact ? 'soinver-logo-img--compact' : ''}`}
      src="/logo-soinver-h.png"
      alt="Soinver Ingenieria"
      width={compact ? 140 : 180}
      height={compact ? 88 : 113}
      decoding="async"
    />
  )
}
