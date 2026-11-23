import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level3: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[5],
  origin: 'relative',
  x: 0,
  y: 75 * 2,
  from: 'top',
  to: 'bottom',
  rendering: {
    emptyCellOpacity: 0.8,
  },
  tutorial: {
    steps: [{
        content: "Un ligne de 4 grands carrés en diagonale est aussi un Cantomino",
        area: "board",
        boardInteractive: false,
        showUI: false,
      }, {
        content: "Trouve les 2 Cantomino en diagonal.",
        area: "board",
        showUI: false,
        advanceOn: ["complete"]
      }
    ]
  },
  data: {
    "config": {
      "columns": 6,
      "rows": 7,
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
            "x": 2,
            "y": 0
          },
          {
            "cellId": "b",
            "corner": "bottom-right",
            "x": 3,
            "y": 1
          },
          {
            "cellId": "c",
            "corner": "top-left",
            "x": 4,
            "y": 2
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 5,
            "y": 3
          }
        ],
        "id": 1,
        "kind": "diagonal"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-right",
            "x": 3,
            "y": 3
          },
          {
            "cellId": "b",
            "corner": "bottom-right",
            "x": 2,
            "y": 4
          },
          {
            "cellId": "c",
            "corner": "top-left",
            "x": 1,
            "y": 5
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 0,
            "y": 6
          }
        ],
        "id": 2,
        "kind": "diagonal"
      }
    ],
    "version": 1,
    "customName": "",
    "seed": "custom-434cda17-c849-4cf7-aedd-3cbc27e25145",
    "source": "custom"
  }
}
