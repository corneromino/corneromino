import { CELL_CORNERS, type CellCorner, type GameConfig, type PlacedTetromino } from '@/game/gameConfig'
import { generateTetrominoPlacementsV2, PlacementSearchLimitError } from '@/game/placementV2'
import { createSeededRandom } from '@/game/random'
import { createTetrominoCells, TETROMINOES, TETROMINO_KINDS, type TetrominoCell, type TetrominoKind } from '@/game/tetrominoes'

export const CAREER_PLACEMENT_ATTEMPTS = 3
export const CAREER_PLACEMENT_ITERATIONS_PER_ATTEMPT = 10_000

interface TemplatePiece {
  kind: TetrominoKind
  cells: TetrominoCell[]
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

/** All valid pairs of pieces that exactly tile a 4×2 rectangle. */
function createPairTemplates(): readonly (readonly [TemplatePiece, TemplatePiece])[] {
  const placements = new Map<number, TemplatePiece>()
  for (const kind of TETROMINO_KINDS) {
    for (const rotation of TETROMINOES[kind].rotations) {
      const cells = createTetrominoCells(kind, rotation.turns)
      const width = Math.max(...cells.map((cell) => cell.x)) + 1
      const height = Math.max(...cells.map((cell) => cell.y)) + 1
      for (let y = 0; y <= 2 - height; y++) {
        for (let x = 0; x <= 4 - width; x++) {
          const placed = cells.map((cell) => ({ ...cell, x: cell.x + x, y: cell.y + y }))
          const mask = placed.reduce((value, cell) => value | (1 << (cell.y * 4 + cell.x)), 0)
          placements.set(mask, { kind, cells: placed })
        }
      }
    }
  }
  const pairs: [TemplatePiece, TemplatePiece][] = []
  for (const [mask, piece] of placements) {
    const other = placements.get(0xff ^ mask)
    if (other && mask < (0xff ^ mask)) pairs.push([piece, other])
  }
  return pairs
}

const PAIR_TEMPLATES = createPairTemplates()
const SQUARE_TEMPLATE: TemplatePiece = { kind: 'O', cells: createTetrominoCells('O', 0) }

/** A bounded, constructive fallback: selected 2×2 blocks are tiled without search. */
export function createCareerFallbackPieces(config: GameConfig, seed: string): PlacedTetromino[] {
  const random = createSeededRandom(seed)
  const blockColumns = Math.floor(config.columns / 2)
  const blockRows = Math.floor(config.rows / 2)
  if (blockColumns * blockRows < config.tetrominoCount) throw new Error('Career fallback requires more 2×2 blocks.')

  const blocks = Array.from({ length: blockRows }, (_, y) => Array.from({ length: blockColumns }, (_, x) => {
    const dx = (x - (blockColumns - 1) / 2) / Math.max(1, blockColumns / 2)
    const dy = (y - (blockRows - 1) / 2) / Math.max(1, blockRows / 2)
    const centerWeight = Math.max(0, 1 - Math.hypot(dx, dy) / Math.SQRT2)
    return { x, y, score: Math.log(Math.max(Number.MIN_VALUE, random())) / (1 + config.spread * 3 * centerWeight) }
  })).flat().sort((a, b) => b.score - a.score).slice(0, config.tetrominoCount)
  const remaining = new Set(blocks.map(({ x, y }) => `${x},${y}`))
  const pieces: PlacedTetromino[] = []

  function addPiece(template: TemplatePiece, offsetX: number, offsetY: number) {
    const corners: CellCorner[] = shuffle(CELL_CORNERS, random)
    pieces.push({
      id: pieces.length + 1,
      kind: template.kind,
      cells: template.cells.map((cell, index) => ({
        cellId: cell.id, corner: corners[index]!, x: cell.x + offsetX, y: cell.y + offsetY,
      })),
    })
  }

  for (const block of blocks) {
    const key = `${block.x},${block.y}`
    if (!remaining.delete(key)) continue
    const neighborX = [block.x + 1, block.x - 1].find((x) => remaining.has(`${x},${block.y}`))
    if (neighborX !== undefined && PAIR_TEMPLATES.length > 0) {
      remaining.delete(`${neighborX},${block.y}`)
      const pair = PAIR_TEMPLATES[Math.floor(random() * PAIR_TEMPLATES.length)]!
      const x = Math.min(block.x, neighborX) * 2
      addPiece(pair[0], x, block.y * 2)
      addPiece(pair[1], x, block.y * 2)
    } else {
      addPiece(SQUARE_TEMPLATE, block.x * 2, block.y * 2)
    }
  }
  return pieces
}

/** Retry only bounded search exhaustion; other generator failures remain visible. */
export async function generateCareerInfinitePieces(config: GameConfig, seed: string): Promise<PlacedTetromino[]> {
  for (let attempt = 0; attempt < CAREER_PLACEMENT_ATTEMPTS; attempt++) {
    try {
      return await generateTetrominoPlacementsV2(config, {
        maxIterations: CAREER_PLACEMENT_ITERATIONS_PER_ATTEMPT,
        random: createSeededRandom(attempt === 0 ? seed : `${seed}:retry:${attempt}`),
        yieldEvery: 250,
      })
    } catch (error) {
      if (!(error instanceof PlacementSearchLimitError)) throw error
    }
  }
  return createCareerFallbackPieces(config, `${seed}:fallback`)
}
