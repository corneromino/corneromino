import type { GameConfig, LockedCellGroup, PlacedTetromino } from './gameConfig'
import { getTetrominoKind, isTetrominoRotation, TETROMINOES, TETROMINO_KINDS, type TetrominoKind } from './tetrominoes'

export type BonusShapeRotation = 0 | 1 | 2 | 3

export interface BonusRequirement {
  /** Tetromino kind that must occur in the completed board. */
  shape: TetrominoKind
  /** Optional clockwise quarter-turn count from the spawn orientation. */
  rotation?: BonusShapeRotation
  /** Minimum required count; zero forbids matching shapes. */
  count: number
}

interface ShapeRotation {
  rotation: BonusShapeRotation
  shape: TetrominoKind
}

const SHAPE_ROTATIONS: readonly ShapeRotation[] = TETROMINO_KINDS.flatMap((shape) => (
  TETROMINOES[shape].rotations.map((rotation) => ({ rotation: rotation.turns as BonusShapeRotation, shape }))
))

function parseLockedCellGroup(group: LockedCellGroup) {
  return group.cellKeys.map((cellKey) => {
    const [x, y] = cellKey.split(',').map(Number)
    return { x, y }
  })
}

function matchesBonusRequirement(group: LockedCellGroup, requirement: BonusRequirement) {
  const cells = parseLockedCellGroup(group)
  if (getTetrominoKind(cells) !== requirement.shape) return false
  return requirement.rotation === undefined || isTetrominoRotation(cells, requirement.shape, requirement.rotation)
}

function getPlacedRotation(piece: PlacedTetromino): BonusShapeRotation {
  const rotation = TETROMINOES[piece.kind].rotations.find((candidate) => (
    isTetrominoRotation(piece.cells, piece.kind, candidate.turns)
  ))
  if (!rotation) throw new Error(`Placed ${piece.kind} tetromino has no recognized rotation.`)
  return rotation.turns as BonusShapeRotation
}

function getRequirementKey(shape: TetrominoKind, rotation: BonusShapeRotation) {
  return `${shape}:${rotation}`
}

function choose<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!
}

function getRandomInteger(minimum: number, maximum: number, random: () => number) {
  return minimum + Math.min(maximum - minimum, Math.floor(random() * (maximum - minimum + 1)))
}

/** Percentage of configured bonus requirements met by the final locked shapes. */
export function getBonusPercentage(bonus: readonly BonusRequirement[] | undefined, lockedGroups: readonly LockedCellGroup[]) {
  if (!bonus || bonus.length === 0) return 0
  const fulfilledRequirementCount = bonus.filter((requirement) => {
    const matchingShapeCount = lockedGroups.filter((group) => matchesBonusRequirement(group, requirement)).length
    return requirement.count === 0 ? matchingShapeCount === 0 : matchingShapeCount >= requirement.count
  }).length
  return fulfilledRequirementCount / bonus.length * 100
}

/** Generates solution-achievable bonuses from a finished Classic board. */
export function generateBonusRequirements(
  pieces: readonly PlacedTetromino[],
  config: Pick<GameConfig, 'bonusMax' | 'bonusMin'>,
  random: () => number = Math.random,
): BonusRequirement[] {
  const { bonusMax, bonusMin } = config
  if (bonusMin === undefined || bonusMax === undefined || bonusMin > bonusMax) return []

  const placedShapes = pieces.map((piece) => ({ rotation: getPlacedRotation(piece), shape: piece.kind }))
  const shapeCounts = new Map<string, number>()
  for (const { rotation, shape } of placedShapes) {
    const key = getRequirementKey(shape, rotation)
    shapeCounts.set(key, (shapeCounts.get(key) ?? 0) + 1)
  }

  const absentShapes = SHAPE_ROTATIONS.filter(({ rotation, shape }) => !shapeCounts.has(getRequirementKey(shape, rotation)))
  const bonusCount = getRandomInteger(bonusMin, bonusMax, random)
  return Array.from({ length: bonusCount }, () => {
    const wantsZeroCount = random() < 0.5
    if (wantsZeroCount && absentShapes.length > 0) {
      const { rotation, shape } = choose(absentShapes, random)
      return { count: 0, rotation, shape }
    }

    if (placedShapes.length > 0) {
      const { rotation, shape } = choose(placedShapes, random)
      return { count: shapeCounts.get(getRequirementKey(shape, rotation))!, rotation, shape }
    }

    // A zero-piece board cannot create a positive-count requirement.
    const { rotation, shape } = choose(absentShapes, random)
    return { count: 0, rotation, shape }
  })
}
