import { expect, it, vi } from 'vitest'
import { TETROMINOES } from '@/game/tetrominoes'
import { isClassicGameDefinition } from '@/lib/db'
import { levelAstra } from './levelAstra'

vi.mock('@/lib/gameDatabase', () => ({ openGameDatabase: () => Promise.resolve({}) }))

it('is an importable small puzzle with one complete solution and no obvious forced cells', () => {
  expect(isClassicGameDefinition(levelAstra)).toBe(true)
  const { config, pieces } = levelAstra
  const cells = pieces.flatMap((piece) => piece.cells)
  expect(config.columns * config.rows - cells.length).toBeGreaterThanOrEqual(10)

  // Enumerate every legal group, including diagonal shapes; gameplay accepts
  // regroupings of the occupied cells, not just the authored pieces.
  const cellIndex = new Map(cells.map((cell, index) => [`${cell.x},${cell.y}`, index]))
  const candidates = new Set<number>()
  for (const shape of Object.values(TETROMINOES)) {
    for (const rotation of shape.rotations) {
      for (let y = 0; y < config.rows; y++) {
        for (let x = 0; x < config.columns; x++) {
          const indices = rotation.cells.map((cell) => cellIndex.get(`${x + cell.x},${y + cell.y}`))
          if (indices.some((index) => index === undefined)) continue
          const validIndices = indices as number[]
          if (new Set(validIndices.map((index) => cells[index].corner)).size !== 4) continue
          candidates.add(validIndices.reduce((mask, index) => mask | (1 << index), 0))
        }
      }
    }
  }
  const containing = cells.map((_, index) => [...candidates].filter((mask) => (mask & (1 << index)) !== 0))
  expect(candidates.size).toBe(49)
  expect(Math.min(...containing.map((groups) => groups.length))).toBeGreaterThanOrEqual(2)

  function countSolutions(remaining: number): number {
    if (remaining === 0) return 1
    let best: number[] | undefined
    for (let index = 0; index < cells.length; index++) {
      if (!(remaining & (1 << index))) continue
      const options = containing[index].filter((mask) => (mask & remaining) === mask)
      if (!best || options.length < best.length) best = options
    }
    return best!.reduce((count, mask) => count + countSolutions(remaining ^ mask), 0)
  }
  expect(countSolutions((1 << cells.length) - 1)).toBe(1)
})
