import { CELL_CORNERS, type CellCorner, type GameConfig, type PlacedTetromino, type PlacedTetrominoCell } from './gameConfig'
import { createTetrominoCells, TETROMINOES, TETROMINO_KINDS, type TetrominoKind } from './tetrominoes'

interface PendingTetromino {
  corners: readonly CellCorner[]
  id: number
  kind: TetrominoKind
}

interface AnchorPosition {
  x: number
  y: number
}

interface SearchContext {
  iterations: number
  lastReportedIterations: number
  maxIterations: number
  onProgress?: (iterations: number) => void
  progressEvery: number
  random: () => number
  yieldEvery: number
}

export interface PlacementV2Options {
  maxIterations?: number
  onProgress?: (iterations: number) => void
  progressEvery?: number
  random?: () => number
  yieldEvery?: number
}

export class PlacementSearchLimitError extends Error {
  constructor(maxIterations: number) {
    super(`Placement search exceeded ${maxIterations} iterations.`)
    this.name = 'PlacementSearchLimitError'
  }
}

const DEFAULT_MAX_ITERATIONS = 5_000_000 //250_000
const DEFAULT_PROGRESS_EVERY = 10
const DEFAULT_YIELD_EVERY = 1_000

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffledItems = [...items]

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const currentItem = shuffledItems[index]
    shuffledItems[index] = shuffledItems[swapIndex]
    shuffledItems[swapIndex] = currentItem
  }

  return shuffledItems
}

function validateConfig(config: GameConfig): void {
  if (!Number.isInteger(config.columns) || !Number.isInteger(config.rows) || config.columns < 1 || config.rows < 1) {
    throw new Error('Board columns and rows must be positive integers.')
  }

  if (!Number.isInteger(config.tetrominoCount) || config.tetrominoCount < 0) {
    throw new Error('Tetromino count must be a non-negative integer.')
  }

  if (!Number.isFinite(config.spread) || config.spread < 0 || config.spread > 1) {
    throw new Error('Spread must be a number between 0 and 1.')
  }
}

function createPendingTetrominoes(config: GameConfig, random: () => number): PendingTetromino[] {
  return Array.from({ length: config.tetrominoCount }, (_, index) => ({
    corners: shuffle(CELL_CORNERS, random),
    id: index + 1,
    kind: TETROMINO_KINDS[Math.floor(random() * TETROMINO_KINDS.length)],
  }))
}

function getCenterWeight(x: number, y: number, maxX: number, maxY: number): number {
  const normalizedX = maxX === 0 ? 0 : Math.abs(x - maxX / 2) / (maxX / 2)
  const normalizedY = maxY === 0 ? 0 : Math.abs(y - maxY / 2) / (maxY / 2)
  return 1 - Math.min(1, Math.hypot(normalizedX, normalizedY) / Math.SQRT2)
}

/**
 * Uses the same weighted-position principle as pzr's generate_positions:
 * center anchors are duplicated before the seeded shuffle, making them more
 * likely to be attempted first while keeping every valid anchor available.
 */
function createCandidateAnchors(width: number, height: number, config: GameConfig, random: () => number): AnchorPosition[] {
  const maxX = config.columns - width
  const maxY = config.rows - height
  const weightedAnchors: AnchorPosition[] = []

  for (let y = 0; y <= maxY; y += 1) {
    for (let x = 0; x <= maxX; x += 1) {
      const multiplier = 1 + Math.round(config.spread * 5 * getCenterWeight(x, y, maxX, maxY))
      for (let duplicate = 0; duplicate < multiplier; duplicate += 1) {
        weightedAnchors.push({ x, y })
      }
    }
  }

  const seenAnchors = new Set<string>()
  return shuffle(weightedAnchors, random).filter((anchor) => {
    const key = `${anchor.x},${anchor.y}`
    if (seenAnchors.has(key)) return false
    seenAnchors.add(key)
    return true
  })
}

function createCandidatePieces(remainingPieces: readonly PendingTetromino[], random: () => number): PendingTetromino[] {
  const usedKinds = new Set<TetrominoKind>()

  return shuffle(remainingPieces, random).filter((piece) => {
    if (usedKinds.has(piece.kind)) return false
    usedKinds.add(piece.kind)
    return true
  })
}

function createPlacedCells(piece: PendingTetromino, turns: number, anchor: AnchorPosition): PlacedTetrominoCell[] {
  return createTetrominoCells(piece.kind, turns).map((cell, index) => ({
    cellId: cell.id,
    corner: piece.corners[index],
    x: cell.x + anchor.x,
    y: cell.y + anchor.y,
  }))
}

function canPlace(cells: readonly PlacedTetrominoCell[], occupiedCells: ReadonlySet<string>): boolean {
  return !cells.some((cell) => occupiedCells.has(`${cell.x},${cell.y}`))
}

function reportProgress(context: SearchContext): void {
  if (context.lastReportedIterations === context.iterations) return
  context.lastReportedIterations = context.iterations
  context.onProgress?.(context.iterations)
}

async function recordIteration(context: SearchContext): Promise<void> {
  context.iterations += 1

  if (context.iterations > context.maxIterations) {
    throw new PlacementSearchLimitError(context.maxIterations)
  }

  if (context.iterations % context.progressEvery === 0) {
    reportProgress(context)
  }

  if (context.iterations % context.yieldEvery === 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

async function placeTetrominoes(
  config: GameConfig,
  remainingPieces: readonly PendingTetromino[],
  placedTetrominoes: readonly PlacedTetromino[],
  occupiedCells: Set<string>,
  context: SearchContext,
): Promise<PlacedTetromino[] | null> {
  if (remainingPieces.length === 0) {
    return [...placedTetrominoes].sort((left, right) => left.id - right.id)
  }

  for (const piece of createCandidatePieces(remainingPieces, context.random)) {
    for (const rotation of shuffle(TETROMINOES[piece.kind].rotations, context.random)) {
      const localCells = createTetrominoCells(piece.kind, rotation.turns)
      const width = Math.max(...localCells.map((cell) => cell.x)) + 1
      const height = Math.max(...localCells.map((cell) => cell.y)) + 1
      const anchors = createCandidateAnchors(width, height, config, context.random)

      for (const anchor of anchors) {
        await recordIteration(context)

        const cells = createPlacedCells(piece, rotation.turns, anchor)
        if (!canPlace(cells, occupiedCells)) continue

        for (const cell of cells) {
          occupiedCells.add(`${cell.x},${cell.y}`)
        }

        const nextPieces = remainingPieces.filter((remainingPiece) => remainingPiece.id !== piece.id)
        const solution = await placeTetrominoes(
          config,
          nextPieces,
          [...placedTetrominoes, { cells, id: piece.id, kind: piece.kind }],
          occupiedCells,
          context,
        )

        if (solution) return solution

        for (const cell of cells) {
          occupiedCells.delete(`${cell.x},${cell.y}`)
        }
      }
    }
  }

  return null
}

export async function generateTetrominoPlacementsV2(
  config: GameConfig,
  options: PlacementV2Options = {},
): Promise<PlacedTetromino[]> {
  validateConfig(config)

  const context: SearchContext = {
    iterations: 0,
    lastReportedIterations: -1,
    maxIterations: options.maxIterations ?? DEFAULT_MAX_ITERATIONS,
    onProgress: options.onProgress,
    progressEvery: options.progressEvery ?? DEFAULT_PROGRESS_EVERY,
    random: options.random ?? Math.random,
    yieldEvery: options.yieldEvery ?? DEFAULT_YIELD_EVERY,
  }
  const pendingPieces = createPendingTetrominoes(config, context.random)
  const solution = await placeTetrominoes(config, pendingPieces, [], new Set(), context)
  reportProgress(context)

  if (!solution) {
    throw new Error('No valid tetromino placement exists for this configuration.')
  }

  return solution
}
