import type { CellId, TetrominoKind } from './tetrominoes'

/** Switch all Classic difficulties between automatic and button-driven locking. */
export const CLASSIC_LOCKING_MODE: GameConfig['lockingMode'] = 'auto'

export interface GameConfig {
  lockingMode: 'manual' | 'auto'
  columns: number
  rows: number
  /** 0 uses the full board; 1 strongly favors placements around its center. */
  spread: number
  tetrominoCount: number
}

export interface GameModeConfig extends GameConfig {
  /** i18next key for the user-visible difficulty label. */
  title: string
}

export const GAME_CONFIGS = {
  'super-easy': { columns: 8, rows: 8, spread: 1, tetrominoCount: 5, title: 'difficulty.superEasy', lockingMode: CLASSIC_LOCKING_MODE },
  easy: { columns: 8, rows: 8, spread: 0, tetrominoCount: 10, title: 'difficulty.easy', lockingMode: CLASSIC_LOCKING_MODE },
  medium: { columns: 10, rows: 15, spread: 0.5, tetrominoCount: 20, title: 'difficulty.medium', lockingMode: CLASSIC_LOCKING_MODE },
  hard: { columns: 12, rows: 18, spread: 0.8, tetrominoCount: 35, title: 'difficulty.hard', lockingMode: CLASSIC_LOCKING_MODE },
} as const satisfies Record<string, GameModeConfig>

export type GameMode = keyof typeof GAME_CONFIGS
export const GAME_MODES = Object.keys(GAME_CONFIGS) as GameMode[]

export function isGameMode(value: string | null): value is GameMode {
  return value !== null && value in GAME_CONFIGS
}

export const CELL_CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const
export type CellCorner = (typeof CELL_CORNERS)[number]

export interface PlacedTetrominoCell {
  cellId: CellId
  corner: CellCorner
  x: number
  y: number
}

export interface PlacedTetromino {
  id: number
  kind: TetrominoKind
  cells: readonly PlacedTetrominoCell[]
}

export interface LockedCellGroup {
  cellKeys: string[]
  color: string
  id: string
}

export type CellMarkerColor = 'black' | 'white'

export interface CellMarker {
  cellKey: string
  color: CellMarkerColor
}

export interface GameSelectionState {
  elapsedSeconds: number
  gameGridScreenshot: Blob | null
  isCompleted: boolean
  lockedCellGroups: LockedCellGroup[]
  markers: CellMarker[]
  moveCount: number
  savedAt: number | null
  selectedCellKeys: string[]
}
