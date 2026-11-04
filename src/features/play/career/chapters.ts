import type { TetrominoKind } from '@/game/tetrominoes'

export interface CareerChapter {
  /** Stable identifier for future progress and level data. */
  id: string
  /** Display text reserved for the future chapter UI. */
  title: string
  /** Vertical space from the previous chapter, in reference map pixels. */
  distance: number
  /** Existing Nokomino geometry. */
  shape: TetrominoKind
  /** Clockwise quarter-turns of the Nokomino. */
  rotation: 0 | 1 | 2 | 3
  /** Relative platform scale. */
  size: number
  /** Optional future per-chapter top-face color. */
  color?: string
}

/** Story order: the first chapter begins at the bottom of the map. */
export const CAREER_CHAPTERS: readonly CareerChapter[] = [
  {
    id: "beginning",
    title: "The Beginning",
    distance: 0,
    shape: "L",
    rotation: 0,
    size: 1,
  },
  {
    id: "crossroads",
    title: "Crossroads",
    distance: 150,
    shape: "T",
    rotation: 1,
    size: 0.92,
  },
  {
    id: "turning-point",
    title: "Turning Point",
    distance: 150,
    shape: "S",
    rotation: 0,
    size: 0.88,
  },
  {
    id: "turning-point2",
    title: "Turning Point",
    distance: 150,
    shape: "O",
    rotation: 0,
    size: 0.88,
  },
  {
    id: "turning-point3",
    title: "Turning Point",
    distance: 300,
    shape: "diagonal",
    rotation: 0,
    size: 0.88,
  },
];
