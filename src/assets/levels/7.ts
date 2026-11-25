import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level7: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[4],
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
    "tetrominoCount": 5,
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
          "x": 6,
          "y": 3
        },
        {
          "cellId": "b",
          "corner": "bottom-right",
          "x": 5,
          "y": 4
        },
        {
          "cellId": "c",
          "corner": "top-right",
          "x": 4,
          "y": 5
        },
        {
          "cellId": "d",
          "corner": "bottom-left",
          "x": 3,
          "y": 6
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
          "x": 5,
          "y": 3
        },
        {
          "cellId": "b",
          "corner": "top-right",
          "x": 4,
          "y": 4
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 3,
          "y": 5
        },
        {
          "cellId": "d",
          "corner": "top-left",
          "x": 2,
          "y": 6
        }
      ],
      "id": 2,
      "kind": "diagonal"
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
          "corner": "bottom-left",
          "x": 2,
          "y": 2
        },
        {
          "cellId": "c",
          "corner": "top-left",
          "x": 3,
          "y": 2
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 4,
          "y": 2
        }
      ],
      "id": 3,
      "kind": "T"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-left",
          "x": 2,
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
          "corner": "bottom-left",
          "x": 0,
          "y": 0
        },
        {
          "cellId": "d",
          "corner": "bottom-right",
          "x": 0,
          "y": 1
        }
      ],
      "id": 4,
      "kind": "L"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "bottom-left",
          "x": 0,
          "y": 2
        },
        {
          "cellId": "b",
          "corner": "top-left",
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
          "corner": "bottom-right",
          "x": 2,
          "y": 3
        }
      ],
      "id": 5,
      "kind": "Z"
    }
  ],
  "version": 1,
  "seed": "custom-4a3a14f4-07ee-401d-b2c5-8d222b0aa8ee",
  "source": "custom"
}
}
