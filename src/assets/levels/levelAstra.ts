import type { ClassicGameDefinition } from '@/lib/db'

export const levelAstra: ClassicGameDefinition = {
  "version": 1,
  "seed": "level-astra",
  "gameMode": "c003",
  "bonus": [],
  "config": {
    "columns": 7,
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
  "pieces": [
    {
      "id": 1,
      "kind": "J",
      "cells": [
        { "cellId": "a", "corner": "top-left", "x": 3, "y": 4 },
        { "cellId": "b", "corner": "bottom-left", "x": 4, "y": 4 },
        { "cellId": "c", "corner": "bottom-right", "x": 5, "y": 4 },
        { "cellId": "d", "corner": "top-right", "x": 5, "y": 5 }
      ]
    },
    {
      "id": 2,
      "kind": "L",
      "cells": [
        { "cellId": "a", "corner": "top-left", "x": 4, "y": 0 },
        { "cellId": "b", "corner": "bottom-right", "x": 4, "y": 1 },
        { "cellId": "c", "corner": "top-right", "x": 4, "y": 2 },
        { "cellId": "d", "corner": "bottom-left", "x": 5, "y": 2 }
      ]
    },
    {
      "id": 3,
      "kind": "I",
      "cells": [
        { "cellId": "a", "corner": "bottom-right", "x": 3, "y": 3 },
        { "cellId": "b", "corner": "bottom-left", "x": 4, "y": 3 },
        { "cellId": "c", "corner": "top-left", "x": 5, "y": 3 },
        { "cellId": "d", "corner": "top-right", "x": 6, "y": 3 }
      ]
    },
    {
      "id": 4,
      "kind": "diagonal",
      "cells": [
        { "cellId": "a", "corner": "top-left", "x": 0, "y": 2 },
        { "cellId": "b", "corner": "bottom-left", "x": 1, "y": 3 },
        { "cellId": "c", "corner": "top-right", "x": 2, "y": 4 },
        { "cellId": "d", "corner": "bottom-right", "x": 3, "y": 5 }
      ]
    },
    {
      "id": 5,
      "kind": "Z",
      "cells": [
        { "cellId": "a", "corner": "bottom-left", "x": 3, "y": 1 },
        { "cellId": "b", "corner": "top-left", "x": 3, "y": 2 },
        { "cellId": "c", "corner": "bottom-right", "x": 2, "y": 2 },
        { "cellId": "d", "corner": "top-right", "x": 2, "y": 3 }
      ]
    },
    {
      "id": 6,
      "kind": "Z",
      "cells": [
        { "cellId": "a", "corner": "top-right", "x": 2, "y": 0 },
        { "cellId": "b", "corner": "top-left", "x": 2, "y": 1 },
        { "cellId": "c", "corner": "bottom-left", "x": 1, "y": 1 },
        { "cellId": "d", "corner": "bottom-right", "x": 1, "y": 2 }
      ]
    }
  ]
}
