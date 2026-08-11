type BrandLogoProps = {
  compact?: boolean
}

/** Logo Soinver con colores fijos (rojo / negro / gris). No hereda currentColor. */
export default function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? 'brand-logo--compact' : ''}`}>
      <svg
        className="brand-logo__mark"
        viewBox="0 0 80 108"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M14 20 C14 8 26 2 40 2 C58 2 70 16 70 30 C70 46 56 54 40 62 C26 68 14 78 14 92 C14 104 28 112 48 112"
          fill="none"
          stroke="#E30613"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="brand-logo__text">
        <strong>SOINVER</strong>
        <span>INGENIERIA</span>
      </span>
    </span>
  )
}
