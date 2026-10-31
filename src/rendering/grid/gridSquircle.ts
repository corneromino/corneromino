/**
 * Pixi has no equivalent of CSS `corner-shape: superellipse()`. A generous,
 * proportional rounded-rectangle radius is the closest crisp canvas treatment
 * and keeps every grid layer visually consistent at every zoom level.
 */
/** Cell bodies, selections, overlays, and other full-cell surfaces. */
export const GRID_CELL_SQUIRCLE_RADIUS_RATIO = 0.06

/** Smaller corner markers use a more pronounced radius than their cells. */
export const GRID_CORNER_SQUIRCLE_RADIUS_RATIO = 0.1

export function getGridSquircleRadius(width: number, height = width): number {
  return Math.max(0, Math.min(width, height) * GRID_CELL_SQUIRCLE_RADIUS_RATIO)
}

export function getGridCornerSquircleRadius(width: number, height = width): number {
  return Math.max(0, Math.min(width, height) * GRID_CORNER_SQUIRCLE_RADIUS_RATIO)
}
