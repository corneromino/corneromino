import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level4: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[6],
  origin: 'relative',
  x: -80,
  y: 0,
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
            "y": 4
          },
          {
            "cellId": "b",
            "corner": "bottom-right",
            "x": 1,
            "y": 4
          },
          {
            "cellId": "c",
            "corner": "top-right",
            "x": 0,
            "y": 5
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 1,
            "y": 5
          }
        ],
        "id": 1,
        "kind": "O"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "bottom-left",
            "x": 1,
            "y": 0
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 2,
            "y": 0
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 3,
            "y": 0
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 3,
            "y": 1
          }
        ],
        "id": 2,
        "kind": "J"
      },
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
            "x": 0,
            "y": 2
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 0,
            "y": 3
          }
        ],
        "id": 3,
        "kind": "Z"
      }
    ],
    "version": 1,
    "customName": "",
    "seed": "custom-0cda6425-394e-4588-92d3-f3834be3a880",
    "source": "custom"
  }
}
