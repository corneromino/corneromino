export type VsTrapResolution = 'points' | 'draw'
export const VS_LOCAL_BOARD_SIZES = [8, 10] as const
export type VsLocalBoardSize = (typeof VS_LOCAL_BOARD_SIZES)[number]
export const VS_LOCAL_DEFAULT_BOARD_SIZE: VsLocalBoardSize = 10

export function isVsLocalBoardSize(value: unknown): value is VsLocalBoardSize {
  return value === 8 || value === 10
}

export interface VsLocalConfig {
  /** Allow a confirmed move from an earlier position to replace all later moves. */
  allowHistoryRewrite: boolean
  /** Count overlapping captures toward combination victory. If false, counted shapes may share only the newly placed cell. */
  allowOverlappingCombinationWin: boolean
  /** Minimum eligible shapes captured in one turn to win. Integer >= 2. */
  combinationWinCount: number
  /** Own consecutive turns with a lock, uninterrupted by an opponent lock. Integer >= 2. */
  consecutiveTurnWinCount: number
  /** Resolve a trapping capture by locked-cell points, or always declare a draw. */
  trapResolution: VsTrapResolution
}

export const VS_LOCAL_CONFIG: Readonly<VsLocalConfig> = {
  allowHistoryRewrite: true,
  allowOverlappingCombinationWin: false,
  combinationWinCount: 2,
  consecutiveTurnWinCount: 2,
  trapResolution: 'points',
}

export function isVsWinCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 2
}

export function isVsTrapResolution(value: unknown): value is VsTrapResolution {
  return value === 'points' || value === 'draw'
}
