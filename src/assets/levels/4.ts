import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level4: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[6],
  origin: 'relative',
  x: 0,
  y: 75 * 2,
  from: 'top',
  to: 'bottom',
  tutorial: {
    steps: [{
      content: 'career.tutorial.level4.play',
      showUI: false,
      advanceOn: ['select'],
      area: 'board'
    }]
  },
  data: {
    "config": {
      "columns": 6,
      "rows": 6,
      "spread": 0,
      "tetrominoCount": 4,
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
            "corner": "bottom-left",
            "x": 1,
            "y": 1
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 2,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "top-right",
            "x": 3,
            "y": 3
          },
          {
            "cellId": "d",
            "corner": "bottom-right",
            "x": 4,
            "y": 4
          }
        ],
        "id": 1,
        "kind": "diagonal"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "bottom-right",
            "x": 5,
            "y": 2
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 4,
            "y": 3
          },
          {
            "cellId": "c",
            "corner": "top-right",
            "x": 3,
            "y": 4
          },
          {
            "cellId": "d",
            "corner": "top-left",
            "x": 2,
            "y": 5
          }
        ],
        "id": 2,
        "kind": "diagonal"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-right",
            "x": 3,
            "y": 0
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 4,
            "y": 0
          },
          {
            "cellId": "c",
            "corner": "top-left",
            "x": 3,
            "y": 1
          },
          {
            "cellId": "d",
            "corner": "bottom-right",
            "x": 4,
            "y": 1
          }
        ],
        "id": 3,
        "kind": "O"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-left",
            "x": 0,
            "y": 2
          },
          {
            "cellId": "b",
            "corner": "top-right",
            "x": 0,
            "y": 3
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 0,
            "y": 4
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 0,
            "y": 5
          }
        ],
        "id": 4,
        "kind": "I"
      }
    ],
    "version": 1,
    "customName": "...",
    "seed": "custom-c5eb301f-64e6-40d5-98a9-c69cb73eddf1",
    "source": "custom"
  }
}
