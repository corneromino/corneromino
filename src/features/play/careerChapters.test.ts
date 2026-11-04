import { describe, expect, it } from 'vitest'
import { TETROMINO_KINDS } from '@/game/tetrominoes'
import { chapters, getCareerChapterLayout, type CareerChapter } from './careerChapters'

describe('career chapter layout', () => {
  it('keeps colors and level sequence attached to cell IDs after a quarter turn', () => {
    const chapter: CareerChapter = {
      ...chapters[0],
      shape: 'L',
      rotation: 1,
      levelOrder: ['d', 'c', 'b', 'a'],
      colors: { a: 'red', b: 'green', c: 'blue', d: 'yellow' },
    }
    expect(getCareerChapterLayout(chapter)).toEqual({
      columns: 3,
      rows: 2,
      cells: [
        { id: 'd', x: 0, y: 1, color: 'yellow', level: 1 },
        { id: 'c', x: 0, y: 0, color: 'blue', level: 2 },
        { id: 'b', x: 1, y: 0, color: 'green', level: 3 },
        { id: 'a', x: 2, y: 0, color: 'red', level: 4 },
      ],
    })
  })

  it('rotates the identities of square cells even though the silhouette stays the same', () => {
    const positions = ([0, 1, 2, 3] as const).map((rotation) => {
      const { cells } = getCareerChapterLayout({ ...chapters[0], shape: 'O', rotation })
      const a = cells.find((cell) => cell.id === 'a')!
      return [a.x, a.y]
    })
    expect(positions).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]])
  })

  it.each(TETROMINO_KINDS)('fits all four rotations of %s inside their declared bounds', (shape) => {
    for (const rotation of [0, 1, 2, 3] as const) {
      const layout = getCareerChapterLayout({ ...chapters[0], shape, rotation })
      expect(new Set(layout.cells.map(({ x, y }) => `${x},${y}`)).size).toBe(4)
      for (const cell of layout.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0)
        expect(cell.x).toBeLessThan(layout.columns)
        expect(cell.y).toBeGreaterThanOrEqual(0)
        expect(cell.y).toBeLessThan(layout.rows)
      }
    }
  })

  it('rejects an order which duplicates a level and omits another', () => {
    expect(() => getCareerChapterLayout({ ...chapters[0], levelOrder: ['a', 'a', 'c', 'd'] })).toThrow('each cell ID once')
  })
})
