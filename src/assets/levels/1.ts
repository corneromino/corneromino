import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level1: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[7],
  x: 0,
  y: 0,
  from: 'top',
  to: 'bottom',
  rendering: {
    // emptyCellOpacity: 0.5,
  },
  tutorial: {
    steps: [
      {
        content: "Voici un grand carré avec un autre petit carré foncé à l'interieur.",
        area: 'board',
        board: { x: 1, y: 1, columns: 1, rows: 1 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: "Avec 4 grands carrés qui se touchent, tu obtiens un Cantomino. Chaque grand carré doit avoir sont petit carré.",
        area: 'board',
        board: { x: 1, y: 1, columns: 2, rows: 3 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: "Un Cantomino, possède des petits carrés dans chaque coin, en haut à gauche ...",
        area: 'board',
        board: { x: 1, y: 1, columns: 1, rows: 1 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: "... en bas à droite ...",
        area: 'board',
        board: { x: 1, y: 2, columns: 1, rows: 1 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: "... en haut à droite ...",
        area: 'board',
        board: { x: 1, y: 3, columns: 1, rows: 1 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: "... et en bas à gauche !",
        area: 'board',
        board: { x: 2, y: 3, columns: 1, rows: 1 },
        boardInteractive: false,
        showUI: false,
      }, {
        content: "Selectionne les grands carrés qui forme le Cantomino pour passer au niveau suivant.",
        area: 'board',
        showUI: false,
        // advanceOn: ['complete']
      }
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
