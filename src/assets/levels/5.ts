import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level5: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[2],
  origin: 'relative',
  x: 0,
  y: 80,
  from: 'top',
  to: 'bottom',
  data: {
    "config": {
      "columns": 4,
      "rows": 6,
      "spread": 0,
      "tetrominoCount": 3,
      "lockingMode": "auto",
      "finalVerificationMode": "auto",
      "completionScreenshotDelayMs": 400,
      "finalLockAnimationEnabled": true,
      "hideGameControls": false,
      "navigationEnabled": true
    },
    "gameMode": "c001",
    "pieces": [
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-left",
            "x": 0,
            "y": 0
          },
          {
            "cellId": "b",
            "corner": "top-right",
            "x": 1,
            "y": 1
          },
          {
            "cellId": "c",
            "corner": "bottom-left",
            "x": 2,
            "y": 2
          },
          {
            "cellId": "d",
            "corner": "bottom-right",
            "x": 3,
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
            "corner": "bottom-left",
            "x": 1,
            "y": 2
          },
          {
            "cellId": "b",
            "corner": "bottom-right",
            "x": 1,
            "y": 3
          },
          {
            "cellId": "c",
            "corner": "top-left",
            "x": 1,
            "y": 4
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 1,
            "y": 5
          }
        ],
        "id": 2,
        "kind": "I"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-right",
            "x": 3,
            "y": 1
          },
          {
            "cellId": "b",
            "corner": "bottom-right",
            "x": 3,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "top-left",
            "x": 2,
            "y": 0
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 2,
            "y": 1
          }
        ],
        "id": 3,
        "kind": "S"
      }
    ],
    "version": 1,
    "customName": "",
    "seed": "custom-7bb66210-bdbd-4ec9-8cc3-384743e8b3d4",
    "source": "custom"
  }
}
