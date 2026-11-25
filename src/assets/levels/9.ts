import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level9: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[6],
  origin: 'relative',
  x: 0,
  y: 75*2,
  from: 'top',
  to: 'bottom',
  data: {
  "bonus": [],
  "config": {
    "columns": 4,
    "rows": 4,
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
          "corner": "bottom-right",
          "x": 2,
          "y": 0
        },
        {
          "cellId": "c",
          "corner": "top-left",
          "x": 1,
          "y": 0
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 0,
          "y": 0
        }
      ],
      "id": 1,
      "kind": "T"
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
          "corner": "top-right",
          "x": 0,
          "y": 1
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 0,
          "y": 2
        },
        {
          "cellId": "d",
          "corner": "top-left",
          "x": 0,
          "y": 3
        }
      ],
      "id": 2,
      "kind": "T"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "bottom-left",
          "x": 2,
          "y": 2
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 1,
          "y": 3
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 2,
          "y": 3
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 3,
          "y": 3
        }
      ],
      "id": 3,
      "kind": "T"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "bottom-left",
          "x": 2,
          "y": 1
        },
        {
          "cellId": "b",
          "corner": "top-right",
          "x": 3,
          "y": 2
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
          "x": 3,
          "y": 0
        }
      ],
      "id": 4,
      "kind": "T"
    }
  ],
  "version": 1,
  "customName": "otherr",
  "seed": "custom-5391fe55-2828-4117-ab84-232f91f741f2",
  "source": "custom"
}
}
