import { TETROMINOES, type CellId, type TetrominoKind } from '@/game/tetrominoes'
import type { ClassicGameDefinition } from '@/lib/db'
import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'

export const CAREER_PATH_THICKNESS_PX = 5
export const CAREER_PATH_DASH_LENGTH_PX = 20
export const CAREER_PATH_DASH_GAP_PX = 20

export interface CareerChapter {
  id: string
  /** English fallback; translations can use career.chapters.<id>. */
  title: string
  shape: TetrominoKind
  /** Clockwise quarter-turns, including rotations of symmetrical shapes. */
  rotation: 0 | 1 | 2 | 3
  levelOrder: readonly [CellId, CellId, CellId, CellId]
  /** Definitions are ordered by levelOrder, rather than their on-screen position. */
  levelsData: readonly ClassicGameDefinition[]
  colors: Readonly<Record<CellId, string>>
  backgroundColor: string
}

export interface CareerLevel {
  chapter: CareerChapter
  chapterIndex: number
  definition: ClassicGameDefinition
  levelIndex: number
  number: number
}

// Colors are CSS values, keyed by stable cell IDs rather than screen position.
export const chapters: readonly CareerChapter[] = [
  {
    id: "the-beginning",
    title: "The Beginning",
    shape: "L",
    rotation: 0,
    levelOrder: ["a", "b", "c", "d"],
    levelsData: [
      {
  "config": {
    "columns": 5,
    "rows": 5,
    "spread": 0,
    "tetrominoCount": 1,
    "lockingMode": "auto",
    "finalVerificationMode": "auto",
    "completionScreenshotDelayMs": 400,
    "finalLockAnimationEnabled": true,
    "hideGameControls": false,
    "navigationEnabled": true
  },
  "gameMode": "c003",
  "pieces": [
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-right",
          "x": 2,
          "y": 2
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 3,
          "y": 1
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 2,
          "y": 1
        },
        {
          "cellId": "d",
          "corner": "bottom-left",
          "x": 1,
          "y": 1
        }
      ],
      "id": 1,
      "kind": "T"
    }
  ],
  "version": 1,
  "customName": "",
  "seed": "custom-611cfe2e-805e-47fa-b5b1-6a67fe18c2b8",
  "source": "custom"
}
    ],
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
    levelsData: [],
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
    levelsData: [],
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
    levelsData: [],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[4],
      b: "var(--paper)",
      c: "var(--paper)",
      d: LOCKED_CELL_COLOR_HEX[4],
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[4],
  },
    {
    id: "a-different-turn2",
    title: "A Different Turn",
    shape: "S",
    rotation: 3,
    levelOrder: ["b", "a", "d", "c"],
    levelsData: [],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[4],
      b: "var(--paper)",
      c: "var(--paper)",
      d: LOCKED_CELL_COLOR_HEX[4],
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[4],
  },
    {
    id: "a-different-turn3",
    title: "A Different Turn",
    shape: "S",
    rotation: 3,
    levelOrder: ["b", "a", "d", "c"],
    levelsData: [],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[4],
      b: "var(--paper)",
      c: "var(--paper)",
      d: LOCKED_CELL_COLOR_HEX[4],
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[4],
  },
    {
    id: "a-different-turn4",
    title: "A Different Turn",
    shape: "S",
    rotation: 3,
    levelOrder: ["b", "a", "d", "c"],
    levelsData: [],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[4],
      b: "var(--paper)",
      c: "var(--paper)",
      d: LOCKED_CELL_COLOR_HEX[4],
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[4],
  },
    {
    id: "a-different-turn5-test",
    title: "A Different Turn",
    shape: "S",
    rotation: 3,
    levelOrder: ["b", "a", "d", "c"],
    levelsData: [],
    colors: {
      a: LOCKED_CELL_COLOR_HEX[4],
      b: "var(--paper)",
      c: "var(--paper)",
      d: LOCKED_CELL_COLOR_HEX[4],
    },
    backgroundColor: LOCKED_CELL_COLOR_HEX[4],
  },
];

function findCareerLevel(chapterIndex: number, levelIndex: number): CareerLevel | null {
  const chapter = chapters[chapterIndex]
  const definition = levelIndex < (chapter?.levelOrder.length ?? 0) ? chapter?.levelsData[levelIndex] : undefined
  if (!chapter || !definition) return null
  return { chapter, chapterIndex, definition, levelIndex, number: chapterIndex * chapter.levelOrder.length + levelIndex + 1 }
}

export function getCareerLevel(chapterId: string, levelIndex: number): CareerLevel | null {
  if (!Number.isSafeInteger(levelIndex) || levelIndex < 0) return null
  return findCareerLevel(chapters.findIndex((chapter) => chapter.id === chapterId), levelIndex)
}

export function getNextCareerLevel(level: CareerLevel): CareerLevel | null {
  for (let chapterIndex = level.chapterIndex; chapterIndex < chapters.length; chapterIndex += 1) {
    const firstLevelIndex = chapterIndex === level.chapterIndex ? level.levelIndex + 1 : 0
    for (let levelIndex = firstLevelIndex; levelIndex < chapters[chapterIndex]!.levelOrder.length; levelIndex += 1) {
      const next = findCareerLevel(chapterIndex, levelIndex)
      if (next) return next
    }
  }
  return null
}

/** Progress is independent from a chapter's name, placement, or level number. */
export function getCareerGameId(definition: ClassicGameDefinition) {
  return `career:${definition.seed}`
}

export function getCareerLevelPath(level: CareerLevel) {
  const query = new URLSearchParams({ career: level.chapter.id, level: String(level.levelIndex), mode: level.definition.gameMode })
  return `/play?${query.toString()}`
}

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
