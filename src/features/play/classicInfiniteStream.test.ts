import { describe, expect, it, vi } from 'vitest'
import type { PlacedTetromino } from '@/game/gameConfig'
import { advanceInfiniteDifficulty, CLASSIC_INFINITE_CONFIG, ClassicInfiniteStream, createInfiniteDifficultyState, createInfiniteSectionGenerator, type InfiniteDifficultyCycle } from './classicInfiniteStream'

const config = { ...CLASSIC_INFINITE_CONFIG, columns: 8, rows: 8, visibleRows: 4, tetrominoCount: 2, scrollRowsPerSecond: 10 }
const pieces: PlacedTetromino[] = [{ id: 1, kind: 'O', cells: [
  { x: 0, y: 0, cellId: 'a', corner: 'top-left' },
  { x: 1, y: 0, cellId: 'b', corner: 'top-right' },
  { x: 0, y: 1, cellId: 'c', corner: 'bottom-left' },
  { x: 1, y: 1, cellId: 'd', corner: 'bottom-right' },
] }]

describe('Classic Infinite section recycling', () => {
  it('applies configured difficulty cycles in order after their lock intervals', () => {
    let difficulty = createInfiniteDifficultyState(config)

    difficulty = advanceInfiniteDifficulty(difficulty, 4)
    expect(difficulty).toMatchObject({
      config: { spread: 0, tetrominoCount: 2 },
      cycleIndex: 0,
      totalCycle: 0,
      validLockCountAtLastCycleCheck: 0,
    })

    difficulty = advanceInfiniteDifficulty(difficulty, 5)
    expect(difficulty).toMatchObject({
      config: { spread: 0, tetrominoCount: 4 },
      cycleIndex: 1,
      totalCycle: 1,
      validLockCountAtLastCycleCheck: 5,
    })

    difficulty = advanceInfiniteDifficulty(difficulty, 10)
    expect(difficulty).toMatchObject({
      config: { spread: 0.05, tetrominoCount: 4 },
      cycleIndex: 0,
      totalCycle: 2,
      validLockCountAtLastCycleCheck: 10,
    })
  })

  it('does not adopt the copied configuration or advance when a cycle returns false', () => {
    const totalCycles: number[] = []
    const cycles: readonly InfiniteDifficultyCycle[] = [{
      apply: (_oldConfig, newConfig, totalCycle) => {
        totalCycles.push(totalCycle)
        newConfig.tetrominoCount += 10
        return false
      },
      applyEvery: 5,
      name: 'refuse',
    }]

    const difficulty = advanceInfiniteDifficulty(createInfiniteDifficultyState(config), 5, cycles)

    expect(difficulty).toMatchObject({
      config: { tetrominoCount: 2 },
      cycleIndex: 0,
      totalCycle: 0,
      validLockCountAtLastCycleCheck: 5,
    })
    expect(totalCycles).toEqual([0])
  })

  it('recycles only a fully departed section, keeping two adjacent sections across many cycles', async () => {
    const generate = vi.fn().mockResolvedValue(pieces)
    const recycled = vi.fn()
    const stream = new ClassicInfiniteStream(config, generate, recycled, vi.fn())
    await stream.start()
    await Promise.resolve()
    await Promise.resolve()
    expect(stream.getOffsetRows()).toBe(2)
    expect(stream.sections[1].firstRow + stream.getOffsetRows()).toBe(-6)
    expect(stream.sections[0].firstRow + stream.getOffsetRows()).toBe(2)
    expect(stream.sections.map((section) => section.firstRow)).toEqual([0, -8])
    expect(stream.sections[0].pieces).toEqual([])
    expect(generate).toHaveBeenCalledTimes(2)

    for (let cycle = 0; cycle < 30; cycle++) {
      const survivingSection = stream.sections[1]
      const recycleOffset = config.visibleRows - stream.sections[0].firstRow
      const framesBeforeRecycle = recycleOffset - stream.getOffsetRows() - 1
      for (let frame = 0; frame < framesBeforeRecycle; frame++) stream.advance(100)
      expect(recycled).toHaveBeenCalledTimes(cycle)
      // The old section still covers the last visible row.
      expect(stream.sections[0].firstRow + stream.getOffsetRows()).toBe(3)
      stream.advance(100)
      expect(recycled).toHaveBeenCalledTimes(cycle + 1)
      expect(stream.sections).toHaveLength(2)
      expect(stream.sections[0]).toBe(survivingSection)
      expect(stream.sections[0].firstRow - stream.sections[1].firstRow).toBe(config.rows)
      expect(stream.sections[1].firstRow + stream.getOffsetRows()).toBeLessThanOrEqual(0)
      expect(stream.sections[0].firstRow + config.rows + stream.getOffsetRows()).toBeGreaterThanOrEqual(config.visibleRows)
      expect(stream.sections[1].pieces[0].cells[0].y).toBe(stream.sections[1].firstRow)
      expect(stream.sections[1].pieces[0].id).not.toBe(stream.sections[0].pieces[0].id)
      await Promise.resolve()
      await Promise.resolve()
    }
    expect(generate).toHaveBeenCalledTimes(32)
    stream.destroy()
  })

  it('waits for a late replacement without exposing an empty section', async () => {
    let finish!: (pieces: readonly PlacedTetromino[]) => void
    const pending = new Promise<readonly PlacedTetromino[]>((resolve) => { finish = resolve })
    const generate = vi.fn((index: number) => index === 2 ? pending : Promise.resolve(pieces))
    const recycled = vi.fn()
    const stream = new ClassicInfiniteStream(config, generate, recycled, vi.fn())
    await stream.start()
    for (let frame = 0; frame < 100; frame++) stream.advance(100)
    expect(stream.getOffsetRows()).toBe(4)
    expect(recycled).not.toHaveBeenCalled()
    finish(pieces)
    await pending
    await Promise.resolve()
    stream.advance(100)
    expect(recycled).toHaveBeenCalledOnce()
    expect(stream.sections.map((section) => section.index)).toEqual([1, 2])
    stream.destroy()
  })

  it('limits elapsed time after a stall and ignores frames and pending generation after disposal', async () => {
    const recycled = vi.fn()
    const generate = vi.fn().mockResolvedValue(pieces)
    const stream = new ClassicInfiniteStream(config, generate, recycled, vi.fn())
    await stream.start()
    stream.advance(60000)
    expect(stream.getOffsetRows()).toBe(3)
    stream.destroy()
    for (let frame = 0; frame < 100; frame++) stream.advance(100)
    expect(stream.getOffsetRows()).toBe(3)
    expect(stream.sections).toEqual([])
    expect(recycled).not.toHaveBeenCalled()
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('reports a generation failure once and freezes the existing board', async () => {
    const error = new Error('generation failed')
    const onError = vi.fn()
    const generate = vi.fn((index: number) => index === 2 ? Promise.reject(error) : Promise.resolve(pieces))
    const stream = new ClassicInfiniteStream(config, generate, vi.fn(), onError)
    await stream.start()
    await Promise.resolve()
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    stream.advance(100)
    expect(stream.getOffsetRows()).toBe(2)
    expect(stream.sections).toHaveLength(2)
    stream.destroy()
  })

  it('uses the existing placement generator deterministically per section', async () => {
    const generate = createInfiniteSectionGenerator(config, 'infinite-test')
    const first = await generate(0)
    expect(first).toEqual(await generate(0))
    expect(await generate(1)).not.toEqual(first)
    expect(first).toHaveLength(config.tetrominoCount)
    expect(new Set(first.flatMap((piece) => piece.cells.map(({ x, y }) => `${x},${y}`))).size).toBe(config.tetrominoCount * 4)
    expect(first.flatMap((piece) => piece.cells).every(({ x, y }) => x >= 0 && x < config.columns && y >= 0 && y < config.rows)).toBe(true)
  })
})
