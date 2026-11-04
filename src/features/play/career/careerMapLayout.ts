import { createTetrominoCells } from '@/game/tetrominoes'
import type { CareerChapter } from './chapters'

export interface CareerMapChapterLayout {
  cells: readonly { x: number; y: number }[]
  chapter: CareerChapter
  centerX: number
  centerY: number
}

export interface CareerMapLayout {
  chapters: readonly CareerMapChapterLayout[]
  tileHeight: number
  tileWidth: number
}

function projectedHorizontalBounds(cells: readonly { x: number; y: number }[], tileWidth: number) {
  const centers = cells.map((cell) => (cell.x - cell.y) * tileWidth / 2)
  return {
    max: Math.max(...centers) + tileWidth / 2,
    min: Math.min(...centers) - tileWidth / 2,
  }
}

/** Lays out the configured story from bottom to top in isometric screen coordinates. */
export function createCareerMapLayout(chapters: readonly CareerChapter[], width: number, height: number): CareerMapLayout {
  const tileWidth = Math.max(56, Math.min(104, width * 0.28))
  const tileHeight = tileWidth * 0.5
  const layouts: CareerMapChapterLayout[] = []
  // Shape cells use their normalized top-left grid coordinates, so reserve
  // enough room for the first Nokomino's projected footprint and slab depth.
  let centerY = height - tileHeight * 3

  for (const [index, chapter] of chapters.entries()) {
    if (layouts.length > 0) centerY -= chapter.distance
    const cells = createTetrominoCells(chapter.shape, chapter.rotation)
    const horizontalBounds = projectedHorizontalBounds(cells, tileWidth * chapter.size)
    const horizontalPadding = tileWidth * 0.2
    const minCenterX = horizontalPadding - horizontalBounds.min
    const maxCenterX = width - horizontalPadding - horizontalBounds.max
    const desiredCenterX = width * (index % 2 === 0 ? 0.68 : 0.32)
    layouts.push({
      cells,
      // The journey zigzags upward on one plane: right, left, right, then left.
      centerX: Math.max(minCenterX, Math.min(maxCenterX, desiredCenterX)),
      centerY,
      chapter,
    })
  }

  return { chapters: layouts, tileHeight, tileWidth }
}
