import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level6: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[3],
  origin: 'relative',
  x: 0,
  y: 80,
  from: 'right',
  to: 'bottom',
  data: {
    "config": {
      "columns": 8,
      "rows": 8,
      "spread": 1,
      "tetrominoCount": 5,
      "lockingMode": "auto",
      "finalVerificationMode": "auto",
      "completionScreenshotDelayMs": 400,
      "finalLockAnimationEnabled": true,
      "hideGameControls": false,
      "navigationEnabled": true
    },
    "gameMode": "c002",
    "pieces": [
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "bottom-right",
            "x": 4,
            "y": 3
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 4,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "top-right",
            "x": 4,
            "y": 1
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
            "corner": "bottom-right",
            "x": 6,
            "y": 1
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 6,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "top-right",
            "x": 5,
            "y": 2
          },
          {
            "cellId": "d",
            "corner": "top-left",
            "x": 5,
            "y": 3
          }
        ],
        "id": 2,
        "kind": "Z"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-left",
            "x": 1,
            "y": 2
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 2,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 1,
            "y": 3
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 2,
            "y": 3
          }
        ],
        "id": 3,
        "kind": "O"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "bottom-right",
            "x": 5,
            "y": 4
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 4,
            "y": 4
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
            "x": 3,
            "y": 5
          }
        ],
        "id": 4,
        "kind": "L"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-left",
            "x": 6,
            "y": 4
          },
          {
            "cellId": "b",
            "corner": "top-right",
            "x": 7,
            "y": 4
          },
          {
            "cellId": "c",
            "corner": "bottom-left",
            "x": 5,
            "y": 5
          },
          {
            "cellId": "d",
            "corner": "bottom-right",
            "x": 6,
            "y": 5
          }
        ],
        "id": 5,
        "kind": "S"
      }
    ],
    "version": 1,
    "customName": "",
    "seed": "custom-a1406134-2b57-4f79-b08f-6c382f0483fe",
    "source": "custom"
  }
}
