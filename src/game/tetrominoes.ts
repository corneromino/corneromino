export const TETROMINO_KINDS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z', 'diagonal'] as const

export type TetrominoKind = (typeof TETROMINO_KINDS)[number]
export type CellId = 'a' | 'b' | 'c' | 'd'

export interface TetrominoCell {
  /** Stable within a piece, including when it rotates. */
  id: CellId
  x: number
  y: number
}

export interface TetrominoRotation {
  /** Clockwise quarter-turns from the piece's spawn orientation. */
  turns: number
  cells: readonly TetrominoCell[]
}

export interface TetrominoDefinition {
  kind: TetrominoKind
  rotations: readonly TetrominoRotation[]
}

export interface GridPosition {
  x: number
  y: number
}

type CellPosition = Pick<TetrominoCell, 'x' | 'y'>

const CELL_IDS: readonly CellId[] = ['a', 'b', 'c', 'd']

const SPAWN_CELLS: Readonly<Record<TetrominoKind, readonly CellPosition[]>> = {
  I: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ],
  J: [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 0, y: 2 },
  ],
  L: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
  O: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  S: [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  T: [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  Z: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  // This custom piece uses corner-to-corner adjacency rather than standard edge adjacency.
  diagonal: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ],
}

function rotateClockwise(cells: readonly TetrominoCell[]): TetrominoCell[] {
  const rotated = cells.map(({ id, x, y }) => ({ id, x: -y, y: x }))
  const minX = Math.min(...rotated.map((cell) => cell.x))
  const minY = Math.min(...rotated.map((cell) => cell.y))

  return rotated.map((cell) => ({
    ...cell,
    x: cell.x - minX,
    y: cell.y - minY,
  }))
}

function rotationKey(cells: readonly GridPosition[]): string {
  return cells
    .map(({ x, y }) => `${x},${y}`)
    .sort()
    .join('|')
}

function createRotations(spawnCells: readonly CellPosition[]): readonly TetrominoRotation[] {
  const cells = spawnCells.map(({ x, y }, index) => ({ id: CELL_IDS[index], x, y }))
  const rotations: TetrominoRotation[] = []
  const seen = new Set<string>()
  let current = cells

  for (let turns = 0; turns < 4; turns += 1) {
    const key = rotationKey(current)
    if (seen.has(key)) break

    seen.add(key)
    rotations.push({ turns, cells: current })
    current = rotateClockwise(current)
  }

  return rotations
}

export const TETROMINOES: Readonly<Record<TetrominoKind, TetrominoDefinition>> = Object.fromEntries(
  TETROMINO_KINDS.map((kind) => [
    kind,
    {
      kind,
      rotations: createRotations(SPAWN_CELLS[kind]),
    },
  ]),
) as Readonly<Record<TetrominoKind, TetrominoDefinition>>

const TETROMINO_SHAPE_KINDS = new Map(
  Object.values(TETROMINOES).flatMap((tetromino) => tetromino.rotations.map((rotation) => [rotationKey(rotation.cells), tetromino.kind] as const)),
)

/** Identifies a shape regardless of position or rotation; mirrored kinds remain distinct. */
export function getTetrominoKind(cells: readonly GridPosition[]): TetrominoKind | null {
  if (cells.length !== 4 || new Set(cells.map((cell) => `${cell.x},${cell.y}`)).size !== 4) {
    return null
  }

  const minX = Math.min(...cells.map((cell) => cell.x))
  const minY = Math.min(...cells.map((cell) => cell.y))
  const normalizedCells = cells.map((cell) => ({ x: cell.x - minX, y: cell.y - minY }))

  return TETROMINO_SHAPE_KINDS.get(rotationKey(normalizedCells)) ?? null
}

/** Checks whether four coordinates match a tetromino rotation after translation. */
export function isTetrominoShape(cells: readonly GridPosition[]): boolean {
  return getTetrominoKind(cells) !== null
}

/** Returns a copy that gameplay code may decorate (for example, with per-cell colors). */
export function createTetrominoCells(kind: TetrominoKind, turns = 0): TetrominoCell[] {
  const rotations = TETROMINOES[kind].rotations
  const normalizedTurns = ((turns % rotations.length) + rotations.length) % rotations.length

  return TETROMINOES[kind].rotations[normalizedTurns].cells.map((cell) => ({ ...cell }))
}
