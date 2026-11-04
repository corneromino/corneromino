import { describe, expect, it } from 'vitest'
import { CAREER_CHAPTERS } from './chapters'
import { createCareerMapLayout } from './careerMapLayout'

describe('career map layout', () => {
  it('places story chapters from bottom to top in an alternating right-left path', () => {
    const layout = createCareerMapLayout(CAREER_CHAPTERS, 360, 640)

    expect(layout.chapters).toHaveLength(CAREER_CHAPTERS.length)
    expect(layout.chapters.every((chapter) => chapter.cells.length === 4)).toBe(true)
    expect(layout.chapters[0]!.centerY).toBeGreaterThan(layout.chapters[1]!.centerY)
    expect(layout.chapters[1]!.centerY).toBeGreaterThan(layout.chapters[2]!.centerY)
    expect(layout.chapters[0]!.centerX).toBeGreaterThan(layout.chapters[1]!.centerX)
    expect(layout.chapters[1]!.centerX).toBeLessThan(layout.chapters[2]!.centerX)
    for (const chapter of layout.chapters) {
      const tileWidth = layout.tileWidth * chapter.chapter.size
      const projectedCenters = chapter.cells.map((cell) => chapter.centerX + (cell.x - cell.y) * tileWidth / 2)
      expect(Math.min(...projectedCenters) - tileWidth / 2).toBeGreaterThanOrEqual(0)
      expect(Math.max(...projectedCenters) + tileWidth / 2).toBeLessThanOrEqual(360)
    }
  })
})
