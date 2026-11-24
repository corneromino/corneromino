import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level1: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[7],
  x: 0,
  y: 0,
  from: 'top',
  to: 'bottom',
  rendering: {
    emptyCellOpacity: 0.5,
  },
  tutorial: {
    steps: [
      {
        content: 'career.tutorial.level1.cell',
        area: 'board',
        board: { x: 1, y: 1, columns: 1, rows: 1 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: 'career.tutorial.level1.cantomino',
        area: 'board',
        board: { x: 1, y: 1, columns: 2, rows: 3 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: 'career.tutorial.level1.corners',
        area: 'board',
        board: { x: 1, y: 1, columns: 2, rows: 3 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: 'career.tutorial.level1.play',
        area: 'board',
        showUI: false,
        advanceOn: ['complete']
      },
    ]
  },
  data: [{
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
  }],
}
