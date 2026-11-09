import type { ClassicGameDefinition } from '@/lib/db'
import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'

export type CareerLevelEdge = 'top' | 'bottom' | 'left' | 'right'
export type CareerLevelOrigin = 'absolute' | 'relative'

/** A Career map position, which may be shown before it has an authored board. */
export interface CareerLevel {
  /** Optional face color for the level card. */
  bgColor?: string
  data?: ClassicGameDefinition
  /** Outgoing edge on this card, connecting it to the following level. */
  from?: CareerLevelEdge
  /** Coordinates are absolute map positions by default, or offsets from the prior level. */
  origin?: CareerLevelOrigin
  /** Edge on the following card where this card's connection arrives. */
  to?: CareerLevelEdge
  x: number
  y: number
}

interface PlayableCareerLevel extends CareerLevel {
  data: ClassicGameDefinition
}

export interface ResolvedCareerLevel extends PlayableCareerLevel {
  index: number
  number: number
}

/** Career levels are played in this list order. */
export const careerLevels: CareerLevel[] = [
  {
    bgColor: LOCKED_CELL_COLOR_HEX[7],
    data: {
  "config": {
    "columns": 4,
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
          "corner": "top-left",
          "x": 1,
          "y": 1
        },
        {
          "cellId": "b",
          "corner": "bottom-right",
          "x": 1,
          "y": 2
        },
        {
          "cellId": "c",
          "corner": "top-right",
          "x": 1,
          "y": 3
        },
        {
          "cellId": "d",
          "corner": "bottom-left",
          "x": 2,
          "y": 3
        }
      ],
      "id": 1,
      "kind": "L"
    }
  ],
  "version": 1,
  "customName": "hello world",
  "seed": "custom-35fc886e-50e3-46d3-9e9d-052d7fb71509",
  "source": "custom"
},
    x: 0,
    y: 0,
    from: 'top',
    to: 'bottom'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[2],
    data: {
  "config": {
    "columns": 5,
    "rows": 5,
    "spread": 0,
    "tetrominoCount": 2,
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
          "x": 1,
          "y": 1
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 1,
          "y": 2
        },
        {
          "cellId": "c",
          "corner": "bottom-left",
          "x": 1,
          "y": 3
        },
        {
          "cellId": "d",
          "corner": "bottom-right",
          "x": 2,
          "y": 3
        }
      ],
      "id": 1,
      "kind": "L"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-left",
          "x": 3,
          "y": 3
        },
        {
          "cellId": "b",
          "corner": "bottom-left",
          "x": 3,
          "y": 2
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 3,
          "y": 1
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 2,
          "y": 1
        }
      ],
      "id": 2,
      "kind": "L"
    }
  ],
  "version": 1,
  "customName": "hello world",
  "seed": "custom-f989feff-c31d-4b39-9b2d-b1d2ec2e3fe3",
  "source": "custom"
},
    origin: 'relative',
    x: 0,
    y: 200,
    from: 'top',
    to: 'bottom'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[5],
    origin: 'relative',
    x: 0,
    y: 200,
    from: 'left',
    to: 'right'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[6],
    origin: 'relative',
    x: -75,
    y: 0,
    from: 'top',
    to: 'bottom'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[2],
    origin: 'relative',
    x: -0,
    y: 75,
    from: 'top',
    to: 'bottom'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[3],
    origin: 'relative',
    x: -0,
    y: 75,
    from: 'right',
    to: 'bottom'
  },
  // PART
  {
    bgColor: LOCKED_CELL_COLOR_HEX[4],
    origin: 'relative',
    x: 130,
    y: 75,
    from: 'right',
    to: 'left'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[5],
    origin: 'relative',
    x: 75,
    y: 0,
    from: 'top',
    to: 'bottom'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[6],
    origin: 'relative',
    x: -0,
    y: 75,
    from: 'left',
    to: 'right'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[7],
    origin: 'relative',
    x: -75,
    y: 0,
    from: 'left',
    to: 'right'
  },
  // PART
  {
    bgColor: LOCKED_CELL_COLOR_HEX[8],
    origin: 'relative',
    x: -150,
    y: 0,
    from: 'top',
    to: 'bottom'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[9],
    origin: 'relative',
    x: 0,
    y: 75,
    from: 'top',
    to: 'bottom'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[10],
    origin: 'relative',
    x: 0,
    y: 75,
    from: 'top',
    to: 'bottom'
  }, {
    bgColor: LOCKED_CELL_COLOR_HEX[0],
    origin: 'relative',
    x: 0,
    y: 75,
    from: 'top',
    to: 'bottom'
  },
]

export interface CareerLevelPosition {
  level: CareerLevel
  x: number
  y: number
}

/** Resolves relative authored offsets into absolute map coordinates. */
export function resolveCareerLevelPositions(levels: readonly CareerLevel[] = careerLevels): CareerLevelPosition[] {
  let previous = { x: 0, y: 0 }
  return levels.map((level) => {
    const position = level.origin === 'relative'
      ? { x: previous.x + level.x, y: previous.y + level.y }
      : { x: level.x, y: level.y }
    previous = position
    return { level, ...position }
  })
}

function resolveCareerLevel(level: PlayableCareerLevel, index: number): ResolvedCareerLevel {
  return { ...level, index, number: index + 1 }
}

export function getCareerLevel(seed: string): ResolvedCareerLevel | null {
  const index = careerLevels.findIndex((level) => level.data?.seed === seed)
  const level = careerLevels[index]
  return level?.data ? resolveCareerLevel(level as PlayableCareerLevel, index) : null
}

export function getNextCareerLevel(level: ResolvedCareerLevel): ResolvedCareerLevel | null {
  for (let index = level.index + 1; index < careerLevels.length; index += 1) {
    const next = careerLevels[index]
    if (next?.data) return resolveCareerLevel(next as PlayableCareerLevel, index)
  }
  return null
}

/** Progress is independent from a level's order or future map position. */
export function getCareerGameId(definition: ClassicGameDefinition) {
  return `career:${definition.seed}`
}

export function getCareerLevelPath(level: PlayableCareerLevel) {
  return `/play?${new URLSearchParams({ career: level.data.seed }).toString()}`
}
