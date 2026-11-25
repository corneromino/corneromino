import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level6: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[3],
  origin: 'relative',
  x: 0,
  y: 75*2,
  from: 'top',
  to: 'bottom',
  data: {
  "config": {
    "columns": 7,
    "rows": 7,
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
          "corner": "bottom-right",
          "x": 2,
          "y": 3
        },
        {
          "cellId": "b",
          "corner": "top-right",
          "x": 2,
          "y": 4
        },
        {
          "cellId": "c",
          "corner": "top-left",
          "x": 1,
          "y": 2
        },
        {
          "cellId": "d",
          "corner": "bottom-left",
          "x": 1,
          "y": 3
        }
      ],
      "id": 2,
      "kind": "S"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-right",
          "x": 4,
          "y": 3
        },
        {
          "cellId": "b",
          "corner": "bottom-right",
          "x": 4,
          "y": 4
        },
        {
          "cellId": "c",
          "corner": "bottom-left",
          "x": 3,
          "y": 4
        },
        {
          "cellId": "d",
          "corner": "top-left",
          "x": 3,
          "y": 5
        }
      ],
      "id": 3,
      "kind": "Z"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "bottom-left",
          "x": 3,
          "y": 2
        },
        {
          "cellId": "b",
          "corner": "top-right",
          "x": 3,
          "y": 3
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 2,
          "y": 1
        },
        {
          "cellId": "d",
          "corner": "top-left",
          "x": 2,
          "y": 2
        }
      ],
      "id": 4,
      "kind": "S"
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
          "corner": "top-left",
          "x": 5,
          "y": 3
        },
        {
          "cellId": "c",
          "corner": "bottom-left",
          "x": 4,
          "y": 1
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 4,
          "y": 2
        }
      ],
      "id": 5,
      "kind": "S"
    }
  ],
  "version": 1,
  "seed": "custom-c8369bd8-bc9f-4e7b-ab00-97ba2c22024e",
  "source": "custom"
}
}
