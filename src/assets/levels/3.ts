import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level3: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[5],
  origin: 'relative',
  x: 0,
  y: 200,
  from: 'left',
  to: 'right',
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
            "corner": "top-right",
            "x": 1,
            "y": 3
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 2,
            "y": 3
          },
          {
            "cellId": "c",
            "corner": "bottom-left",
            "x": 0,
            "y": 4
          },
          {
            "cellId": "d",
            "corner": "bottom-right",
            "x": 1,
            "y": 4
          }
        ],
        "id": 1,
        "kind": "S"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "bottom-right",
            "x": 3,
            "y": 1
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 3,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "bottom-left",
            "x": 3,
            "y": 3
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 3,
            "y": 4
          }
        ],
        "id": 2,
        "kind": "I"
      },
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
            "corner": "bottom-left",
            "x": 1,
            "y": 0
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 2,
            "y": 0
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 2,
            "y": 1
          }
        ],
        "id": 3,
        "kind": "J"
      }
    ],
    "version": 1,
    "customName": "",
    "seed": "custom-db689fac-8410-406f-b609-48bee88208c0",
    "source": "custom"
  }
}
