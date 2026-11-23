import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level2: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[2],
  origin: 'relative',
  x: 0,
  y: 75 * 2,
  from: 'top',
  to: 'bottom',
  tutorial: {
    steps: [
      {
        content: "N'importe quel forme est valide tant que les 4 carrés se touchent.",
        boardInteractive: false,
        showUI: false,
        area: 'board',
      }, {
        content: "Trouve les 4 Cantominos et connecte les grands carrés. Et n'oublie pas la règle des petits carrés !",
        advanceOn: ['complete'],
        showUI: false,
        area: 'board'
      }
    ]
  },
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
            "corner": "bottom-left",
            "x": 1,
            "y": 5
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 2,
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
            "corner": "bottom-right",
            "x": 0,
            "y": 0
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 1,
            "y": 0
          },
          {
            "cellId": "c",
            "corner": "top-right",
            "x": 0,
            "y": 1
          },
          {
            "cellId": "d",
            "corner": "top-left",
            "x": 1,
            "y": 1
          }
        ],
        "id": 4,
        "kind": "O"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-left",
            "x": 2,
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
            "x": 3,
            "y": 2
          },
          {
            "cellId": "d",
            "corner": "bottom-left",
            "x": 3,
            "y": 1
          }
        ],
        "id": 5,
        "kind": "T"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "bottom-left",
            "x": 5,
            "y": 1
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 5,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "top-right",
            "x": 5,
            "y": 3
          },
          {
            "cellId": "d",
            "corner": "bottom-right",
            "x": 5,
            "y": 4
          }
        ],
        "id": 6,
        "kind": "I"
      }
    ],
    "version": 1,
    "customName": "",
    "seed": "custom-9f77f3f0-1a17-4976-8c2b-c504c16180ee",
    "source": "custom"
  },
}
