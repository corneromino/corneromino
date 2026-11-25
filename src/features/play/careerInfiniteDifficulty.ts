import { CLASSIC_FINAL_VERIFICATION_MODE, CLASSIC_LOCKING_MODE, COMPLETION_SCREENSHOT_DELAY_MS, type GameModeConfig } from '@/game/gameConfig'

const FIRST_LEVEL = 10
const MIN_EMPTY_CELLS = 10
const MAX_OCCUPANCY = 0.68
const MAX_TETROMINOES = 32

const MILESTONES = [
  { level: 10, count: 4, spread: 0, density: 16 / 35 },
  { level: 20, count: 6, spread: 0.2, density: 24 / 42 },
  // A spacious approach makes the compact level 50 a noticeable change.
  { level: 49, count: 10, spread: 0.4, density: 0.5 },
  { level: 50, count: 11, spread: 0.45, density: 44 / 72 },
  { level: 70, count: 14, spread: 0.62, density: 56 / 90 },
  { level: 100, count: 19, spread: 0.78, density: 76 / 120 },
] as const

// Bound board dimensions for mobile, and leave enough 2x2 blocks for a
// guaranteed constructive fallback if randomized placement takes too long.
const BOARD_SIZES = Array.from({ length: 8 }, (_, index) => index + 5).flatMap((columns) =>
  Array.from({ length: 10 }, (_, index) => index + 7).map((rows) => ({
    columns, rows, area: columns * rows, blockCapacity: Math.floor(columns / 2) * Math.floor(rows / 2),
  })),
)

/** Deterministic configuration for the repeating Career section, starting at level 10. */
export function getCareerInfiniteDifficulty(level: number): GameModeConfig {
  if (!Number.isSafeInteger(level) || level < FIRST_LEVEL) throw new Error('Infinite Career level must be an integer of at least 10.')

  let tetrominoCount: number
  let spread: number
  let density: number
  if (level <= 100) {
    const index = MILESTONES.findIndex((milestone) => level <= milestone.level)
    const next = MILESTONES[index]!
    const previous = MILESTONES[Math.max(0, index - 1)]!
    const progress = next.level === previous.level ? 0 : (level - previous.level) / (next.level - previous.level)
    tetrominoCount = Math.floor(previous.count + (next.count - previous.count) * progress + 1e-9)
    spread = previous.spread + (next.spread - previous.spread) * progress
    density = previous.density + (next.density - previous.density) * progress
  } else {
    tetrominoCount = Math.min(MAX_TETROMINOES, 19 + Math.floor(3 * Math.log2(1 + (level - 100) / 25)))
    spread = Math.min(0.9, 0.78 + (level - 100) * 0.002)
    density = 76 / 120 + Math.min(0.65 - 76 / 120, (level - 100) * 0.00017)
  }

  // Short breathing spaces alternate with compact boards without resetting progress.
  if (level > 50) density -= 0.045 * Math.max(0, Math.sin(2 * Math.PI * ((level - 50) % 10) / 10))
  const occupied = tetrominoCount * 4
  const targetArea = occupied / density
  let best: typeof BOARD_SIZES[number] | undefined
  let bestScore = Infinity
  for (const board of BOARD_SIZES) {
    if (board.area - occupied < MIN_EMPTY_CELLS || occupied / board.area > MAX_OCCUPANCY || board.blockCapacity < tetrominoCount) continue
    const score = Math.abs(board.area - targetArea) + Math.abs(board.rows / board.columns - 1.3) * 5
    if (score < bestScore) {
      best = board
      bestScore = score
    }
  }
  if (!best) throw new Error('No suitable infinite Career board size exists.')

  return {
    columns: best.columns,
    rows: best.rows,
    spread: Math.round(spread * 100) / 100,
    tetrominoCount,
    title: 'level',
    lockingMode: CLASSIC_LOCKING_MODE,
    finalVerificationMode: CLASSIC_FINAL_VERIFICATION_MODE,
    completionScreenshotDelayMs: COMPLETION_SCREENSHOT_DELAY_MS,
    finalLockAnimationEnabled: true,
  }
}
