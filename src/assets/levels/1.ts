import type { ClassicGameDefinition } from "@/lib/db";

export default {
  "config": {
    "columns": 4,
    "rows": 5,
    "spread": 0,
    "tetrominoCount": 1,
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
          "x": 1,
          "y": 1
        },
        {
          "cellId": "b",
          "corner": "bottom-right",
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
          "corner": "bottom-left",
          "x": 2,
          "y": 3
        }
      ],
      "id": 1,
      "kind": "L"
    }
  ],
  "version": 1,
  "customName": "hello world",
  "seed": "custom-35fc886e-50e3-46d3-9e9d-052d7fb71509",
  "source": "custom"
} as ClassicGameDefinition