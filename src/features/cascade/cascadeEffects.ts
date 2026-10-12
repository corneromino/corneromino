/** Distances are in cell widths unless specified otherwise. Times are seconds. */
export const CASCADE_LOCK_EFFECTS = {
  gridShake: {
    enabled: true,
    amplitudeCells: 1,
    durationSeconds: 0.3,
    frequencyHz: 50,
  },
  ripple: {
    enabled: true,
    durationSeconds: 0.7,
    speedCellsPerSecond: 6,
    radiusCells: 4,
    amplitudeCells: 0.12,
    wavelengthCells: 1.2,
    brightness: 1.08,
  },
  shake: {
    enabled: true,
    radiusCells: 3,
    amplitudeCells: 1,
    durationSeconds: 0.35,
    frequencyHz: 30,
    propagationCellsPerSecond: 10,
  },
}
