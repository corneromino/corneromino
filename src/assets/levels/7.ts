import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level7: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[4],
  origin: 'relative',
  x: 130,
  y: 80,
  from: 'right',
  to: 'left',
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
            "corner": "top-right",
            "x": 5,
            "y": 3
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 5,
            "y": 4
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 4,
            "y": 2
          },
          {
            "cellId": "d",
            "corner": "top-left",
            "x": 4,
            "y": 3
          }
        ],
        "id": 1,
        "kind": "S"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-right",
            "x": 7,
            "y": 3
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 7,
            "y": 4
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 6,
            "y": 4
          },
          {
            "cellId": "d",
            "corner": "top-left",
            "x": 6,
            "y": 5
          }
        ],
        "id": 2,
        "kind": "Z"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-right",
            "x": 3,
            "y": 0
          },
          {
            "cellId": "b",
            "corner": "bottom-right",
            "x": 4,
            "y": 0
          },
          {
            "cellId": "c",
            "corner": "top-left",
            "x": 5,
            "y": 0
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 6,
            "y": 0
          }
        ],
        "id": 3,
        "kind": "I"
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
            "corner": "bottom-right",
            "x": 1,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "top-left",
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
        "id": 4,
        "kind": "Z"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-left",
            "x": 2,
            "y": 5
          },
          {
            "cellId": "b",
            "corner": "top-right",
            "x": 3,
            "y": 4
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 2,
            "y": 4
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 1,
            "y": 4
          }
        ],
        "id": 5,
        "kind": "T"
      }
    ],
    "version": 1,
    "customName": "",
    "seed": "custom-898ad101-ba15-46e4-be09-31af756116d0",
    "source": "custom"
  }
}
