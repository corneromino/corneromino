import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level5: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[2],
  origin: 'relative',
  x: 0,
  y: 75 * 2,
  from: 'top',
  to: 'bottom',
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
          "x": 2,
          "y": 5
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 2,
          "y": 4
        },
        {
          "cellId": "c",
          "corner": "top-right",
          "x": 2,
          "y": 3
        },
        {
          "cellId": "d",
          "corner": "bottom-right",
          "x": 1,
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
          "corner": "bottom-left",
          "x": 3,
          "y": 5
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 3,
          "y": 4
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 3,
          "y": 3
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 4,
          "y": 3
        }
      ],
      "id": 2,
      "kind": "J"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "bottom-left",
          "x": 0,
          "y": 1
        },
        {
          "cellId": "b",
          "corner": "top-right",
          "x": 1,
          "y": 1
        },
        {
          "cellId": "c",
          "corner": "top-left",
          "x": 0,
          "y": 2
        },
        {
          "cellId": "d",
          "corner": "bottom-right",
          "x": 1,
          "y": 2
        }
      ],
      "id": 3,
      "kind": "O"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "bottom-left",
          "x": 0,
          "y": 0
        },
        {
          "cellId": "b",
          "corner": "top-right",
          "x": 1,
          "y": 0
        },
        {
          "cellId": "c",
          "corner": "top-left",
          "x": 2,
          "y": 0
        },
        {
          "cellId": "d",
          "corner": "bottom-right",
          "x": 3,
          "y": 0
        }
      ],
      "id": 4,
      "kind": "I"
    }
  ],
  "version": 1,
  "customName": "yes",
  "seed": "custom-af8dab63-89a0-410d-bd3d-a08cecbb858b",
  "source": "custom"
}
}
