import { TETROMINOES, type CellId, type TetrominoKind } from '@/game/tetrominoes'
import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'

export const CAREER_PATH_THICKNESS_PX = 6
export const CAREER_PATH_DASH_LENGTH_PX = 14
export const CAREER_PATH_DASH_GAP_PX = 10

export interface CareerChapter {
  id: string
  /** English fallback; translations can use career.chapters.<id>. */
  title: string
  shape: TetrominoKind
  /** Clockwise quarter-turns, including rotations of symmetrical shapes. */
  rotation: 0 | 1 | 2 | 3
  levelOrder: readonly [CellId, CellId, CellId, CellId]
  colors: Readonly<Record<CellId, string>>
  backgroundColor: string
}

// Colors are CSS values, keyed by stable cell IDs rather than screen position.
export const chapters: readonly CareerChapter[] = [
  {
    id: "the-beginning",
    title: "The Beginning",
    shape: "L",
    rotation: 0,
    levelOrder: ["a", "b", "c", "d"],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[0],
      b: "var(--paper)",
      c: LOCKED_CELL_COLOR_HEX[5],
      d: "var(--paper)",
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[0],
  },
  {
    id: "a-new-perspective",
    title: "A New Perspective",
    shape: "O",
    rotation: 1,
    levelOrder: ["c", "a", "d", "b"],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[6],
      b: "var(--paper)",
      c: LOCKED_CELL_COLOR_HEX[6],
      d: "var(--paper)",
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[5],
  },
  {
    id: "finding-balance",
    title: "Finding Balance",
    shape: "T",
    rotation: 2,
    levelOrder: ["d", "c", "b", "a"],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[5],
      b: "var(--paper)",
      c: LOCKED_CELL_COLOR_HEX[5],
      d: "var(--paper)",
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[8],
  },
  {
    id: "a-different-turn",
    title: "A Different Turn",
    shape: "S",
    rotation: 3,
    levelOrder: ["b", "a", "d", "c"],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[4],
      b: "var(--paper)",
      c: "var(--paper)",
      d: LOCKED_CELL_COLOR_HEX[4],
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[4],
  },
];

export function getCareerChapterLayout(chapter: CareerChapter, startLevel = 1) {
  if (new Set(chapter.levelOrder).size !== 4) {
    throw new Error(`Chapter "${chapter.id}" must use each cell ID once in levelOrder.`)
  }

  // Gameplay deduplicates symmetrical rotations. Rotate the spawn cells here
  // so a colored cell still moves on every quarter-turn (including O and I).
  let cells = TETROMINOES[chapter.shape].rotations[0].cells.map((cell) => ({ ...cell }))
  for (let turn = 0; turn < chapter.rotation; turn += 1) {
    cells = cells.map(({ id, x, y }) => ({ id, x: -y, y: x }))
  }
  const minX = Math.min(...cells.map((cell) => cell.x))
  const minY = Math.min(...cells.map((cell) => cell.y))
  const normalized = cells.map((cell) => ({ ...cell, x: cell.x - minX, y: cell.y - minY }))

  return {
    columns: Math.max(...normalized.map((cell) => cell.x)) + 1,
    rows: Math.max(...normalized.map((cell) => cell.y)) + 1,
    cells: chapter.levelOrder.map((id, index) => ({
      ...normalized.find((cell) => cell.id === id)!,
      color: chapter.colors[id],
      level: startLevel + index,
    })),
  }
}
