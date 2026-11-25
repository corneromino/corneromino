import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level10: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[7],
  origin: 'relative',
  x: 0,
  y: 75*2,
  from: 'top',
  to: 'bottom',
  data: {
  "bonus": [],
  "config": {
    "columns": 6,
    "rows": 7,
    "spread": 0,
    "tetrominoCount": 6,
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
          "x": 5,
          "y": 0
        },
        {
          "cellId": "b",
          "corner": "top-right",
          "x": 4,
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
          "corner": "bottom-left",
          "x": 3,
          "y": 1
        }
      ],
      "id": 1,
      "kind": "L"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-right",
          "x": 2,
          "y": 1
        },
        {
          "cellId": "b",
          "corner": "bottom-left",
          "x": 1,
          "y": 1
        },
        {
          "cellId": "c",
          "corner": "top-left",
          "x": 0,
          "y": 1
        },
        {
          "cellId": "d",
          "corner": "bottom-right",
          "x": 0,
          "y": 2
        }
      ],
      "id": 2,
      "kind": "L"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-right",
          "x": 4,
          "y": 2
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 4,
          "y": 3
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 4,
          "y": 4
        },
        {
          "cellId": "d",
          "corner": "bottom-left",
          "x": 3,
          "y": 4
        }
      ],
      "id": 3,
      "kind": "J"
    },
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
          "corner": "bottom-left",
          "x": 4,
          "y": 6
        }
      ],
      "id": 4,
      "kind": "diagonal"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "bottom-left",
          "x": 0,
          "y": 6
        },
        {
          "cellId": "b",
          "corner": "bottom-right",
          "x": 1,
          "y": 6
        },
        {
          "cellId": "c",
          "corner": "top-left",
          "x": 2,
          "y": 6
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 3,
          "y": 6
        }
      ],
      "id": 5,
      "kind": "I"
    },
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
          "corner": "bottom-left",
          "x": 1,
          "y": 4
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 0,
          "y": 5
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 1,
          "y": 5
        }
      ],
      "id": 6,
      "kind": "O"
    }
  ],
  "version": 1,
  "customName": "cd",
  "seed": "custom-21c36bec-8265-4cac-abaa-f222ec91689f",
  "source": "custom"
}
}
