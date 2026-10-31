function cssVariableToPixiColor(variableName: string): number {
  if (typeof document === 'undefined') return 0

  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
  const match = /^#([\da-f]{6})$/i.exec(value)
  if (!match) throw new Error(`Expected ${variableName} to contain a six-digit CSS hex colour.`)

  return Number.parseInt(match[1]!, 16)
}

/** Shared Pixi palette. CSS custom properties remain the palette source of truth. */
export const GAME_COLORS = {
  get cellFill() { return cssVariableToPixiColor('--paper') },
  cellBorder: 0x773526,
  cornerMarker: 0x713324,
  ink: 0x15100e,
  markerWhite: 0x8d8d8d,
} as const

/** Shared capture palette for Classic, Cascade, and player colours in Local VS. */
export const LOCKED_CELL_COLORS = [
  0x55c7df, 0x8270d8, 0xbe69d6, 0xde5d9b, 0xe4555c, 0x5fc47a,
  0x4db9a7, 0x73a9ee, 0x9d71dc, 0x41ead4, 0x0b987e,
] as const

export function pixiColorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/** CSS form for persisted Classic lock groups and DOM colour styles. */
export const LOCKED_CELL_COLOR_HEX = LOCKED_CELL_COLORS.map(pixiColorToCss)
