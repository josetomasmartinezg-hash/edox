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
      width={compact ? 64 : 72}
      height={compact ? 64 : 72}
      decoding="async"
    />
  )
}
