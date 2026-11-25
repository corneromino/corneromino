import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level8: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[5],
  origin: 'relative',
  x: 0,
  y: 75*2,
  from: 'top',
  to: 'bottom',
  data: {
  "bonus": [],
  "config": {
    "columns": 6,
    "rows": 6,
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
          "corner": "bottom-left",
          "x": 2,
          "y": 0
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 1,
          "y": 0
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 0,
          "y": 0
        },
        {
          "cellId": "d",
          "corner": "top-right",
          "x": 0,
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
          "corner": "bottom-left",
          "x": 1,
          "y": 1
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 2,
          "y": 2
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
          "y": 4
        }
      ],
      "id": 2,
      "kind": "diagonal"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-right",
          "x": 3,
          "y": 5
        },
        {
          "cellId": "b",
          "corner": "bottom-right",
          "x": 4,
          "y": 5
        },
        {
          "cellId": "c",
          "corner": "bottom-left",
          "x": 5,
          "y": 5
        },
        {
          "cellId": "d",
          "corner": "top-left",
          "x": 5,
          "y": 4
        }
      ],
      "id": 3,
      "kind": "L"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-left",
          "x": 4,
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
          "corner": "bottom-left",
          "x": 2,
          "y": 3
        },
        {
          "cellId": "d",
          "corner": "bottom-right",
          "x": 1,
          "y": 4
        }
      ],
      "id": 4,
      "kind": "diagonal"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "bottom-right",
          "x": 0,
          "y": 3
        },
        {
          "cellId": "b",
          "corner": "top-left",
          "x": 0,
          "y": 4
        },
        {
          "cellId": "c",
          "corner": "bottom-left",
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
      "id": 5,
      "kind": "L"
    },
    {
      "cells": [
        {
          "cellId": "a",
          "corner": "top-left",
          "x": 5,
          "y": 2
        },
        {
          "cellId": "b",
          "corner": "top-right",
          "x": 5,
          "y": 1
        },
        {
          "cellId": "c",
          "corner": "bottom-right",
          "x": 5,
          "y": 0
        },
        {
          "cellId": "d",
          "corner": "bottom-left",
          "x": 4,
          "y": 0
        }
      ],
      "id": 6,
      "kind": "L"
    }
  ],
  "version": 1,
  "customName": "waka",
  "seed": "custom-072ed991-6083-4686-bf88-17e2a3ea7c7c",
  "source": "custom"
}
}
