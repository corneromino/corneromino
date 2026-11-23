import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level4: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[6],
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
            "corner": "bottom-left",
            "x": 1,
            "y": 1
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 0,
            "y": 0
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 0,
            "y": 1
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 0,
            "y": 2
          }
        ],
        "id": 1,
        "kind": "T"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "bottom-right",
            "x": 0,
            "y": 5
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 0,
            "y": 4
          },
          {
            "cellId": "c",
            "corner": "top-left",
            "x": 0,
            "y": 3
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 1,
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
            "corner": "top-right",
            "x": 2,
            "y": 4
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 3,
            "y": 4
          },
          {
            "cellId": "c",
            "corner": "bottom-left",
            "x": 4,
            "y": 4
          },
          {
            "cellId": "d",
            "corner": "bottom-right",
            "x": 5,
            "y": 4
          }
        ],
        "id": 3,
        "kind": "I"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-right",
            "x": 1,
            "y": 2
          },
          {
            "cellId": "b",
            "corner": "bottom-right",
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
            "corner": "bottom-left",
            "x": 4,
            "y": 2
          }
        ],
        "id": 4,
        "kind": "I"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-left",
            "x": 4,
            "y": 0
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 5,
            "y": 0
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 4,
            "y": 1
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 5,
            "y": 1
          }
        ],
        "id": 5,
        "kind": "O"
      }
    ],
    "version": 1,
    "customName": "",
    "seed": "custom-2e92a02e-f708-4f8e-b7b9-abf5834f2f19",
    "source": "custom"
  }
}
