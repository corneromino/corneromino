import { describe, expect, it } from 'vitest'
import { createTetrominoCells, getTetrominoKind, isTetrominoShape, TETROMINOES, TETROMINO_KINDS } from './tetrominoes'

const rotationCounts = {
  I: 2,
  J: 4,
  L: 4,
  O: 1,
  S: 2,
  T: 4,
  Z: 2,
  diagonal: 2,
} as const

describe('tetromino definitions', () => {
  it('defines every standard piece and the custom diagonal piece', () => {
    expect(Object.keys(TETROMINOES)).toEqual(TETROMINO_KINDS)
  })

  it.each(TETROMINO_KINDS)('%s has four uniquely positioned, independently identified cells', (kind) => {
    for (const rotation of TETROMINOES[kind].rotations) {
      expect(rotation.cells).toHaveLength(4)
      expect(new Set(rotation.cells.map((cell) => cell.id))).toEqual(new Set(['a', 'b', 'c', 'd']))
      expect(new Set(rotation.cells.map((cell) => `${cell.x},${cell.y}`))).toHaveLength(4)
    }
  })

  it.each(TETROMINO_KINDS)('%s exposes its unique rotations', (kind) => {
    expect(TETROMINOES[kind].rotations).toHaveLength(rotationCounts[kind])
  })

  it('returns mutable cell copies while preserving the rotation cell IDs', () => {
    const cells = createTetrominoCells('L', 1)
    cells[0].x = 42

    expect(cells[0].x).toBe(42)
    expect(createTetrominoCells('L', 1)[0].x).not.toBe(42)
    expect(createTetrominoCells('L', 1).map((cell) => cell.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('recognizes every tetromino rotation regardless of its board position', () => {
    for (const kind of TETROMINO_KINDS) {
      for (const rotation of TETROMINOES[kind].rotations) {
        expect(isTetrominoShape(rotation.cells.map((cell) => ({ x: cell.x + 7, y: cell.y + 11 })))).toBe(true)
        expect(getTetrominoKind(rotation.cells.map((cell) => ({ x: cell.x + 7, y: cell.y + 11 })).reverse())).toBe(kind)
      }
    }
  })

  it('rejects selections that do not form a tetromino', () => {
    expect(isTetrominoShape([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ])).toBe(false)
  })

  it('does not identify incomplete or duplicate-cell shapes', () => {
    const cells = createTetrominoCells('T')
    expect(getTetrominoKind(cells.slice(0, 3))).toBeNull()
    expect(getTetrominoKind([cells[0]!, cells[1]!, cells[1]!, cells[3]!])).toBeNull()
  })
})
