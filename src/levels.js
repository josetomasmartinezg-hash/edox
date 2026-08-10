/**
 * Perfil de alturas del modelo Cesar:
 * - Izquierda (terraza / acceso): más baja
 * - Subida continua hacia el centro
 * - Centro elevado, coronación a 4 m
 */

export const LEVELS = {
  leftX: -15.2,
  rampEndX: -1.0,
  centerEndX: 5.5,
  floorLeft: 0,
  floorCenter: 0.85,
  floorRight: 0.35,
  roofLeft: 2.2,
  roofCenter: 4.0,
  roofRight: 2.8,
  /** Banda Z de la ala horizontal (izquierda → centro) */
  wingZMin: -0.5,
  wingZMax: 9.2,
};

export function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

/** Elevación de piso en (x, z) metros. */
export function floorElevation(x, _z = 0) {
  const { leftX, rampEndX, centerEndX, floorLeft, floorCenter, floorRight } =
    LEVELS;
  if (x <= leftX) return floorLeft;
  if (x < rampEndX) {
    const t = clamp01((x - leftX) / (rampEndX - leftX));
    // ease-in suave para la subida
    const e = t * t * (3 - 2 * t);
    return floorLeft + e * (floorCenter - floorLeft);
  }
  if (x <= centerEndX) return floorCenter;
  const t = clamp01((x - centerEndX) / 8);
  return floorCenter + t * (floorRight - floorCenter);
}

/** Cota superior (cubierta / coronación) en (x, z) metros. */
export function roofElevation(x, _z = 0) {
  const { leftX, rampEndX, centerEndX, roofLeft, roofCenter, roofRight } =
    LEVELS;
  if (x <= leftX) return roofLeft;
  if (x < rampEndX) {
    const t = clamp01((x - leftX) / (rampEndX - leftX));
    const e = t * t * (3 - 2 * t);
    return roofLeft + e * (roofCenter - roofLeft);
  }
  if (x <= centerEndX) return roofCenter;
  const t = clamp01((x - centerEndX) / 8);
  return roofCenter + t * (roofRight - roofCenter);
}

export function wallHeightsAt(a, b) {
  const y0a = floorElevation(a[0], a[1]);
  const y0b = floorElevation(b[0], b[1]);
  const y1a = roofElevation(a[0], a[1]);
  const y1b = roofElevation(b[0], b[1]);
  return { y0a, y0b, y1a, y1b };
}
