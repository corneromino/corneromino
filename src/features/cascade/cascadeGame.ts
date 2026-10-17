export type CascadeCorner = 0 | 1 | 2 | 3
export type CascadeCornerSpawnMode = 'random' | 'sequential' | 'balanced'

const SEQUENTIAL_CORNERS: readonly CascadeCorner[] = [0, 3, 2, 1]

export interface CascadePiece {
  column: number
  corner: CascadeCorner
  row: number
}

export interface CascadeGameState {
  activePiece: CascadePiece | null
  nextCornerIndex?: number
  settledPieces: CascadePiece[]
  upcomingCorners?: CascadeCorner[]
  /** Remaining shuffled corners, consumed only by balanced draws. */
  cornerBag?: CascadeCorner[]
  /** Most recently generated corner and its consecutive run length. */
  generatedCornerRun?: { corner: CascadeCorner; length: number }
}

export interface CascadeGridSize {
  columns: number
  rows: number
}

export interface CascadeGravityMove {
  fromCellKey: string
  toCellKey: string
}

export interface CascadeLockedCell {
  cellKey: string
  groupId: string
}

export interface CascadeLockedRowResolution {
  clearedCellKeys: string[]
  gravityMoves: CascadeGravityMove[]
  lockedCells: CascadeLockedCell[]
  state: CascadeGameState
}

export function isValidCascadeLockSelection(pieces: readonly CascadePiece[]): boolean {
  return pieces.length === 4
    && new Set(pieces.map((piece) => piece.corner)).size === 4
    && isTetrominoShape(pieces.map((piece) => ({ x: piece.column, y: piece.row })))
}

export function createCascadeGame(): CascadeGameState {
  return { activePiece: null, nextCornerIndex: 0, settledPieces: [], upcomingCorners: [] }
}

function isOccupied(pieces: readonly CascadePiece[], column: number, row: number): boolean {
  return pieces.some((piece) => piece.column === column && piece.row === row)
}

export function advanceCascadeGame(
  state: CascadeGameState,
  gridSize: CascadeGridSize,
  random: () => number = Math.random,
  cornerSpawnMode: CascadeCornerSpawnMode = 'random',
  cornerDifficulty = 0.25,
  maxConsecutiveSameCorner = 2,
): CascadeGameState {
  if (!state.activePiece) {
    const column = Math.floor(random() * gridSize.columns)
    if (isOccupied(state.settledPieces, column, 0)) return state

    let nextCornerIndex = state.nextCornerIndex ?? 0
    const upcomingCorners = [...(state.upcomingCorners ?? [])]
    const cornerBag = [...(state.cornerBag ?? [])]
    const maximumRunLength = Number.isFinite(maxConsecutiveSameCorner)
      ? Math.max(1, Math.floor(maxConsecutiveSameCorner))
      : Infinity
    const legacyGeneratedCorners = upcomingCorners
    const legacyLastCorner = legacyGeneratedCorners.at(-1)
    let legacyRunLength = 0
    if (legacyLastCorner !== undefined) {
      for (let index = legacyGeneratedCorners.length - 1; index >= 0 && legacyGeneratedCorners[index] === legacyLastCorner; index -= 1) {
        legacyRunLength += 1
      }
    }
    let generatedCornerRun = state.generatedCornerRun
      ?? (legacyLastCorner === undefined
        ? undefined
        : { corner: legacyLastCorner, length: legacyRunLength })
    const difficulty = Number.isNaN(cornerDifficulty) ? 0.25 : Math.max(0, Math.min(1, cornerDifficulty))
    function generateCorner(): CascadeCorner {
      let corner: CascadeCorner
      if (cornerSpawnMode === 'sequential') {
        corner = SEQUENTIAL_CORNERS[nextCornerIndex % SEQUENTIAL_CORNERS.length]!
      } else if (cornerSpawnMode === 'balanced' && difficulty < 1 && (difficulty === 0 || random() >= difficulty)) {
        if (cornerBag.length === 0) {
          cornerBag.push(0, 1, 2, 3)
          // Fisher–Yates shuffle: every ordering is equally likely.
          for (let index = cornerBag.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(random() * (index + 1))
            ;[cornerBag[index], cornerBag[swapIndex]] = [cornerBag[swapIndex], cornerBag[index]]
          }
        }
        corner = cornerBag.pop()!
      } else {
        // Random draws leave the bag intact so its missing corners remain available.
        corner = Math.floor(random() * 4) as CascadeCorner
      }
      if (generatedCornerRun?.corner === corner && generatedCornerRun.length >= maximumRunLength) {
        const alternatives = ([0, 1, 2, 3] as const).filter((candidate) => candidate !== corner)
        corner = alternatives[Math.floor(random() * alternatives.length)]!
      }
      generatedCornerRun = generatedCornerRun?.corner === corner
        ? { corner, length: generatedCornerRun.length + 1 }
        : { corner, length: 1 }
      nextCornerIndex += 1
      return corner
    }

    if (upcomingCorners.length === 0) {
      upcomingCorners.push(generateCorner(), generateCorner(), generateCorner(), generateCorner())
    }
    const corner = upcomingCorners.shift()
    if (corner === undefined) return state
    while (upcomingCorners.length < 3) upcomingCorners.push(generateCorner())

    return {
      ...state,
      activePiece: {
        column,
        corner,
        row: 0,
      },
      nextCornerIndex,
      upcomingCorners,
      ...(cornerSpawnMode === 'balanced' ? { cornerBag } : {}),
      generatedCornerRun,
    }
  }

  const nextRow = state.activePiece.row + 1
  if (nextRow < gridSize.rows && !isOccupied(state.settledPieces, state.activePiece.column, nextRow)) {
    return {
      ...state,
      activePiece: { ...state.activePiece, row: nextRow },
    }
  }

  return {
    ...state,
    activePiece: null,
    settledPieces: [...state.settledPieces, state.activePiece],
  }
}

export function moveCascadePiece(
  state: CascadeGameState,
  gridSize: CascadeGridSize,
  direction: -1 | 1,
): CascadeGameState {
  if (!state.activePiece) return state

  const nextColumn = state.activePiece.column + direction
  if (
    nextColumn < 0
    || nextColumn >= gridSize.columns
    || isOccupied(state.settledPieces, nextColumn, state.activePiece.row)
  ) {
    return state
  }

  return {
    ...state,
    activePiece: { ...state.activePiece, column: nextColumn },
  }
}

export function dropCascadePiece(state: CascadeGameState, gridSize: CascadeGridSize): CascadeGameState {
  if (!state.activePiece) return state

  const row = getCascadeLandingRow(state, gridSize)
  if (row === null) return state

  return {
    ...state,
    activePiece: null,
    settledPieces: [...state.settledPieces, { ...state.activePiece, row }],
  }
}

export function getCascadeLandingRow(state: CascadeGameState, gridSize: CascadeGridSize): number | null {
  if (!state.activePiece) return null

  let row = state.activePiece.row
  while (row + 1 < gridSize.rows && !isOccupied(state.settledPieces, state.activePiece.column, row + 1)) {
    row += 1
  }
  return row
}

export function resolveCascadeLockedRows(
  state: CascadeGameState,
  gridSize: CascadeGridSize,
  lockedCells: readonly CascadeLockedCell[],
): CascadeLockedRowResolution {
  const lockedCellKeys = new Set(lockedCells.map((cell) => cell.cellKey))
  const clearedRows = Array.from({ length: gridSize.rows }, (_, row) => row).filter((row) => (
    Array.from({ length: gridSize.columns }, (_, column) => lockedCellKeys.has(`${column},${row}`)).every(Boolean)
  ))
  if (clearedRows.length === 0) return { clearedCellKeys: [], gravityMoves: [], lockedCells: [...lockedCells], state }

  const clearedRowSet = new Set(clearedRows)
  const clearedCellKeys = lockedCells.filter((cell) => clearedRowSet.has(Number(cell.cellKey.split(',')[1]))).map((cell) => cell.cellKey)
  const remainingLockedCells = splitLockedFragments(lockedCells.filter((cell) => !clearedRowSet.has(Number(cell.cellKey.split(',')[1]))))
  const remainingLockedCellGroups = new Map(remainingLockedCells.map((cell) => [cell.cellKey, cell.groupId]))
  const entries = state.settledPieces
    .filter((piece) => !clearedRowSet.has(piece.row))
    .map((piece) => {
      const originalCellKey = `${piece.column},${piece.row}`
      return { bodyId: remainingLockedCellGroups.get(originalCellKey) ?? originalCellKey, originalCellKey, piece }
    })
  const gravityMoves = new Map<string, string>()
  let hasMoved = true

  while (hasMoved) {
    hasMoved = false
    const occupiedCells = new Map(entries.map((entry) => [`${entry.piece.column},${entry.piece.row}`, entry.bodyId]))
    const bodies = new Map<string, typeof entries>()
    for (const entry of entries) {
      const body = bodies.get(entry.bodyId) ?? []
      body.push(entry)
      bodies.set(entry.bodyId, body)
    }
    const descendingBodies = [...bodies.values()].sort((first, second) => (
      Math.max(...second.map((entry) => entry.piece.row)) - Math.max(...first.map((entry) => entry.piece.row))
    ))

    for (const body of descendingBodies) {
      const bodyId = body[0]?.bodyId
      if (!bodyId) continue
      const canMove = body.every(({ piece }) => {
        const nextCellKey = `${piece.column},${piece.row + 1}`
        const occupyingBodyId = occupiedCells.get(nextCellKey)
        return piece.row + 1 < gridSize.rows && (occupyingBodyId === undefined || occupyingBodyId === bodyId)
      })
      if (!canMove) continue

      for (const entry of body) {
        const { piece } = entry
        occupiedCells.delete(`${piece.column},${piece.row}`)
      }
      for (const entry of body) {
        const { piece } = entry
        const nextCellKey = `${piece.column},${piece.row + 1}`
        occupiedCells.set(nextCellKey, bodyId)
        entry.piece = { ...piece, row: piece.row + 1 }
        gravityMoves.set(entry.originalCellKey, nextCellKey)
      }
      hasMoved = true
    }
  }

  return {
    clearedCellKeys,
    gravityMoves: [...gravityMoves].map(([fromCellKey, toCellKey]) => ({ fromCellKey, toCellKey })),
    lockedCells: remainingLockedCells,
    state: {
      ...state,
      settledPieces: entries.map((entry) => entry.piece),
    },
  }
}

function splitLockedFragments(lockedCells: readonly CascadeLockedCell[]): CascadeLockedCell[] {
  const cellsByGroup = new Map<string, CascadeLockedCell[]>()
  for (const cell of lockedCells) {
    const group = cellsByGroup.get(cell.groupId) ?? []
    group.push(cell)
    cellsByGroup.set(cell.groupId, group)
  }

  return [...cellsByGroup].flatMap(([groupId, groupCells]) => {
    const cellsByKey = new Map(groupCells.map((cell) => [cell.cellKey, cell]))
    const fragments: CascadeLockedCell[][] = []

    while (cellsByKey.size > 0) {
      const [startingCell] = cellsByKey.values()
      if (!startingCell) break
      const fragment: CascadeLockedCell[] = []
      const pendingCells = [startingCell]
      cellsByKey.delete(startingCell.cellKey)

      while (pendingCells.length > 0) {
        const cell = pendingCells.pop()
        if (!cell) continue
        fragment.push(cell)
        const [column, row] = cell.cellKey.split(',').map(Number)
        for (const adjacentKey of [`${column - 1},${row}`, `${column + 1},${row}`, `${column},${row - 1}`, `${column},${row + 1}`]) {
          const adjacentCell = cellsByKey.get(adjacentKey)
          if (!adjacentCell) continue
          cellsByKey.delete(adjacentKey)
          pendingCells.push(adjacentCell)
        }
      }

      fragments.push(fragment)
    }

    return fragments.flatMap((fragment, index) => fragment.map((cell) => ({
      ...cell,
      groupId: fragments.length === 1 ? groupId : `${groupId}:fragment:${index + 1}`,
    })))
  })
}
import { isTetrominoShape } from '@/game/tetrominoes'
