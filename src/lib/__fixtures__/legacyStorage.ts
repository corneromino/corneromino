// Historical on-disk formats. These literal values must remain frozen so the
// migration tests exercise real saved data independently of today's branding.
export const ORIGINAL_STORAGE = {
  label: 'original storage',
  databaseName: 'corneromino',
  databaseVersion: 3,
  languageKey: 'corneromino:language',
  placedCellsField: 'placedCornerominoes',
  lockedShapesField: 'lockedCornerominoes',
  lockedShapeCountField: 'lockedCornerominoCount',
} as const

export const PREVIOUS_STORAGE = {
  label: 'previous storage',
  databaseName: 'nokomino',
  databaseVersion: 1,
  languageKey: 'nokomino:language',
  placedCellsField: 'placedNokominos',
  lockedShapesField: 'lockedNokominos',
  lockedShapeCountField: 'lockedNokominoCount',
} as const

export const HISTORICAL_STORAGE = [ORIGINAL_STORAGE, PREVIOUS_STORAGE] as const
