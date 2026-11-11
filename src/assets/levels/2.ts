import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level2: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[2],
  origin: 'relative',
  x: 0,
  y: 200,
  from: 'top',
  to: 'bottom',
  bonus: [
    { shape: 'O', count: 0 }
  ],

  data: {
    "config": {
      "columns": 5,
      "rows": 5,
      "spread": 0,
      "tetrominoCount": 2,
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
            "corner": "top-right",
            "x": 1,
            "y": 1
          },
          {
            "cellId": "b",
            "corner": "top-left",
            "x": 1,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "bottom-left",
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
        "id": 1,
        "kind": "L"
      },
      {
        "cells": [
          {
            "cellId": "a",
            "corner": "top-left",
            "x": 3,
            "y": 3
          },
          {
            "cellId": "b",
            "corner": "bottom-left",
            "x": 3,
            "y": 2
          },
          {
            "cellId": "c",
            "corner": "bottom-right",
            "x": 3,
            "y": 1
          },
          {
            "cellId": "d",
            "corner": "top-right",
            "x": 2,
            "y": 1
          }
        ],
        "id": 2,
        "kind": "L"
      }
    ],
    "version": 1,
    "customName": "hello world",
    "seed": "custom-f989feff-c31d-4b39-9b2d-b1d2ec3fe3",
    "source": "custom"
  },
}
