import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'
import { GridSurface } from '@/rendering/grid/GridSurface'
import { PixiCanvasHost } from '@/rendering/pixi/PixiCanvasHost'
import { GAME_COLORS } from '@/rendering/colors'
import { attachGridInput } from '@/rendering/grid/gridInput'
import { drawCellBody, drawCornerMarker, getCornerMarkerPosition as getSharedMarkerPosition } from '@/rendering/grid/drawCorneromino'
import type { SandboxWorldState } from '@/lib/db'
import { SandboxCellSystem, type SandboxCornerMarker, updatePowerStateFromNeighbors } from './cellSystem'

const BASE_CELL_SIZE = 56
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const CELL_FILL_COLOR = GAME_COLORS.cellFill
const CELL_BORDER_COLOR = GAME_COLORS.cellBorder
const CORNER_MARKER_COLOR = GAME_COLORS.cornerMarker
const PAN_THRESHOLD = 4
const SANDBOX_TICK_INTERVAL_MS = 2
const MAX_UPDATES_PER_TICK = 10_000
const UPDATE_BUDGET_MS = 100
const CORNER_TRANSITION_DURATION_MS = 20

interface PointerPosition {
  x: number
  y: number
}

interface CellPosition {
  column: number
  row: number
}

type SelectionBound = 'upper' | 'lower'

interface CornerTransition {
  fromCorner: number
  startedAt: number
  toCorner: number
}

interface SandboxCanvasProps {
  deleteEnabled: boolean
  drawEnabled: boolean
  initialState: SandboxWorldState | null
  moveEnabled: boolean
  selectEnabled: boolean
}

export interface SandboxCanvasHandle {
  captureWorld: () => Promise<{ screenshot: Blob; state: SandboxWorldState }>
  captureSelectedWorld: () => Promise<{ screenshot: Blob; state: SandboxWorldState }>
  beginPaste: (state: SandboxWorldState) => void
  commitMove: (copy?: boolean) => void
  cancelMove: () => void
  deleteSelectedCells: () => void
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not capture the sandbox canvas.'))
      }
    }, 'image/png')
  })
}

function cropCanvasToBlob(canvas: HTMLCanvasElement, sourceX: number, sourceY: number, sourceWidth: number, sourceHeight: number): Promise<Blob> {
  const croppedCanvas = document.createElement('canvas')
  const left = Math.max(0, Math.floor(sourceX))
  const top = Math.max(0, Math.floor(sourceY))
  const right = Math.min(canvas.width, Math.ceil(sourceX + sourceWidth))
  const bottom = Math.min(canvas.height, Math.ceil(sourceY + sourceHeight))
  croppedCanvas.width = Math.max(1, right - left)
  croppedCanvas.height = Math.max(1, bottom - top)
  const context = croppedCanvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Could not create the selected world preview.'))
  context.drawImage(canvas, left, top, croppedCanvas.width, croppedCanvas.height, 0, 0, croppedCanvas.width, croppedCanvas.height)
  return canvasToBlob(croppedCanvas)
}

export const SandboxCanvas = forwardRef<SandboxCanvasHandle, SandboxCanvasProps>(function SandboxCanvas(props, ref) {
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const deleteEnabledRef = useRef(props.deleteEnabled)
  const drawEnabledRef = useRef(props.drawEnabled)
  const selectEnabledRef = useRef(props.selectEnabled)
  const moveEnabledRef = useRef(props.moveEnabled)
  const captureWorldRef = useRef<SandboxCanvasHandle['captureWorld'] | null>(null)
  const captureSelectedWorldRef = useRef<SandboxCanvasHandle['captureSelectedWorld'] | null>(null)
  const beginPasteRef = useRef<((state: SandboxWorldState) => void) | null>(null)
  const deleteSelectedCellsRef = useRef<(() => void) | null>(null)
  const commitMoveRef = useRef<((copy?: boolean) => void) | null>(null)
  const cancelMoveRef = useRef<(() => void) | null>(null)
  const setSelectModeRef = useRef<((enabled: boolean) => void) | null>(null)
  const redrawRef = useRef<(() => void) | null>(null)
  deleteEnabledRef.current = props.deleteEnabled
  drawEnabledRef.current = props.drawEnabled
  selectEnabledRef.current = props.selectEnabled
  moveEnabledRef.current = props.moveEnabled

  useEffect(() => {
    setSelectModeRef.current?.(props.selectEnabled)
  }, [props.selectEnabled])

  useEffect(() => {
    if (!props.moveEnabled) cancelMoveRef.current?.()
    else redrawRef.current?.()
  }, [props.moveEnabled])

  useImperativeHandle(ref, () => ({
    captureWorld: async () => {
      if (!captureWorldRef.current) throw new Error('Sandbox canvas is not ready.')
      return captureWorldRef.current()
    },
    captureSelectedWorld: async () => {
      if (!captureSelectedWorldRef.current) throw new Error('Sandbox canvas is not ready.')
      return captureSelectedWorldRef.current()
    },
    beginPaste: (state) => beginPasteRef.current?.(state),
    commitMove: (copy = false) => commitMoveRef.current?.(copy),
    cancelMove: () => cancelMoveRef.current?.(),
    deleteSelectedCells: () => deleteSelectedCellsRef.current?.(),
  }), [])

  useEffect(() => {
    const canvasContainer = canvasContainerRef.current
    if (!canvasContainer) return
    const stableCanvasContainer: HTMLDivElement = canvasContainer

    const app = new Application()
    let host: PixiCanvasHost | undefined
    const grid = new Graphics()
    let surface: GridSurface | undefined
    let detachInput: (() => void) | undefined
    let initialized = false
    let gridOffsetX = props.initialState?.gridOffsetX ?? 0
    let gridOffsetY = props.initialState?.gridOffsetY ?? 0
    let hasInitialPosition = props.initialState !== null
    let isPanning = false
    let hasPanned = false
    let interactionWasPinch = false
    let lastPointerX = 0
    let lastPointerY = 0
    const activePointers = new Map<number, PointerPosition>()
    let pinchGridX = 0
    let pinchGridY = 0
    let pinchStartDistance = 0
    let pinchStartZoom = 1
    let zoom = props.initialState?.zoom ?? 1
    const cellSystem = new SandboxCellSystem(props.initialState?.cornerMarkers ?? [], [updatePowerStateFromNeighbors])
    const cornerTransitions = new Map<string, CornerTransition>()
    let cornerAnimationFrame = 0
    let lastCornerStates = new Map<string, number>()
    let updateTimer: number | undefined
    let upperSelectionBound: CellPosition | null = null
    let lowerSelectionBound: CellPosition | null = null
    let draggedSelectionBound: SelectionBound | null = null
    let isMovingSelection = false
    let moveOffset = { column: 0, row: 0 }
    let moveStartCell: CellPosition | null = null
    let moveStartOffset = { column: 0, row: 0 }
    let pastedMarkers: SandboxCornerMarker[] | null = null

    function getCornerMarkerPosition(corner: number, x: number, y: number, cellSize: number) {
      const markerSize = cellSize / 2
      const markerPadding = (cellSize - markerSize) / 4
      const position = getSharedMarkerPosition(corner, cellSize, cellSize, { size: markerSize, paddingX: markerPadding, paddingY: markerPadding })
      return {
        markerSize,
        x: x + position.x,
        y: y + position.y,
      }
    }

    function scheduleCornerAnimation() {
      if (cornerTransitions.size === 0 || cornerAnimationFrame !== 0) return

      cornerAnimationFrame = window.requestAnimationFrame(() => {
        cornerAnimationFrame = 0
        drawGrid()
      })
    }

    function drawGrid(includeSelection = true) {
      const cellSize = BASE_CELL_SIZE * zoom
      const borderWidth = 2 * zoom
      surface?.update({ width: app.screen.width, height: app.screen.height, cellSize: BASE_CELL_SIZE, fit: 'manual', zoom, offsetX: gridOffsetX, offsetY: gridOffsetY })
      const now = performance.now()
      // Read only visible cells; exporting every marker would make each frame
      // scale with the entire infinite world, including offscreen cells.
      const currentCornerStates = new Map<string, number>()

      const firstColumn = Math.floor(-gridOffsetX / cellSize) - 1
      const lastColumn = Math.ceil((app.renderer.width - gridOffsetX) / cellSize) + 1
      const firstRow = Math.floor(-gridOffsetY / cellSize) - 1
      const lastRow = Math.ceil((app.renderer.height - gridOffsetY) / cellSize) + 1

      grid.clear()
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const x = column * cellSize + gridOffsetX
          const y = row * cellSize + gridOffsetY
          const cellKey = `${column},${row}`
          const state = cellSystem.getState(cellKey)
          const cornerMarker = state?.corner
          if (cornerMarker === undefined) continue
          const isCornerOn = state?.isOn ?? false
          if (isCornerOn) {
            // Cover the light background tile, including the inset brown gaps.
            const cellInset = borderWidth * 1.5
            drawCellBody(grid, x, y, cellSize, cellSize, { fillColor: CORNER_MARKER_COLOR, borderColor: CELL_BORDER_COLOR, borderSize: cellInset, borderRadius: 0, innerRadius: cellSize * 0.02 })
          }

          currentCornerStates.set(cellKey, cornerMarker)
          const previousCorner = lastCornerStates.get(cellKey)
          if (previousCorner !== undefined && previousCorner !== cornerMarker) {
            cornerTransitions.set(cellKey, { fromCorner: previousCorner, startedAt: now, toCorner: cornerMarker })
          }
          const transition = cornerTransitions.get(cellKey)
          const transitionProgress = transition ? Math.min(1, (now - transition.startedAt) / CORNER_TRANSITION_DURATION_MS) : 1
          const fromPosition = getCornerMarkerPosition(transition?.fromCorner ?? cornerMarker, x, y, cellSize)
          const toPosition = getCornerMarkerPosition(cornerMarker, x, y, cellSize)
          const markerX = fromPosition.x + (toPosition.x - fromPosition.x) * transitionProgress
          const markerY = fromPosition.y + (toPosition.y - fromPosition.y) * transitionProgress

          if (transition && transitionProgress === 1) cornerTransitions.delete(cellKey)

          drawCornerMarker(grid, markerX, markerY, { color: isCornerOn ? CELL_FILL_COLOR : CORNER_MARKER_COLOR, size: toPosition.markerSize, paddingX: 0, paddingY: 0, radius: toPosition.markerSize * 0.1 })
        }
      }
      lastCornerStates = currentCornerStates

      for (const [cellKey, transition] of cornerTransitions) {
        if (now - transition.startedAt >= CORNER_TRANSITION_DURATION_MS) cornerTransitions.delete(cellKey)
      }
      if (includeSelection) drawSelection(cellSize)
      if (includeSelection) drawMoveSilhouette(cellSize)
      scheduleCornerAnimation()
    }

    function drawSelection(cellSize: number) {
      if (!upperSelectionBound || !lowerSelectionBound) return

      const leftColumn = Math.min(upperSelectionBound.column, lowerSelectionBound.column)
      const rightColumn = Math.max(upperSelectionBound.column, lowerSelectionBound.column)
      const topRow = Math.min(upperSelectionBound.row, lowerSelectionBound.row)
      const bottomRow = Math.max(upperSelectionBound.row, lowerSelectionBound.row)
      const x = leftColumn * cellSize + gridOffsetX
      const y = topRow * cellSize + gridOffsetY
      const width = (rightColumn - leftColumn + 1) * cellSize
      const height = (bottomRow - topRow + 1) * cellSize
      const handleSize = Math.max(8, cellSize * 0.22)
      const handleOffset = (cellSize - handleSize) / 2

      grid.rect(x, y, width, height).fill({ color: 0x808080, alpha: 0.52 }).stroke({ color: 0xd6d6d6, width: Math.max(1, cellSize * 0.045) })
      for (const bound of [upperSelectionBound, lowerSelectionBound]) {
        grid
          .roundRect(
            bound.column * cellSize + gridOffsetX + handleOffset,
            bound.row * cellSize + gridOffsetY + handleOffset,
            handleSize,
            handleSize,
            handleSize * 0.2,
          )
          .fill({ color: 0xd6d6d6 })
          .stroke({ color: 0x4d4d4d, width: Math.max(1, cellSize * 0.035) })
      }
    }

    function drawMoveSilhouette(cellSize: number) {
      if (!moveEnabledRef.current || !upperSelectionBound || !lowerSelectionBound || (moveOffset.column === 0 && moveOffset.row === 0 && !pastedMarkers)) return
      const sourceLeftColumn = Math.min(upperSelectionBound.column, lowerSelectionBound.column)
      const sourceRightColumn = Math.max(upperSelectionBound.column, lowerSelectionBound.column)
      const sourceTopRow = Math.min(upperSelectionBound.row, lowerSelectionBound.row)
      const sourceBottomRow = Math.max(upperSelectionBound.row, lowerSelectionBound.row)
      const leftColumn = sourceLeftColumn + moveOffset.column
      const rightColumn = sourceRightColumn + moveOffset.column
      const topRow = sourceTopRow + moveOffset.row
      const bottomRow = sourceBottomRow + moveOffset.row
      const x = leftColumn * cellSize + gridOffsetX
      const y = topRow * cellSize + gridOffsetY
      grid
        .rect(x, y, (rightColumn - leftColumn + 1) * cellSize, (bottomRow - topRow + 1) * cellSize)
        .fill({ color: 0xb8b8b8, alpha: 0.28 })

      const borderWidth = 2 * zoom
      const pastedStates = pastedMarkers ? new Map(pastedMarkers.map((marker) => [marker.cellKey, marker])) : null
      for (let row = sourceTopRow; row <= sourceBottomRow; row += 1) {
        for (let column = sourceLeftColumn; column <= sourceRightColumn; column += 1) {
          const state = pastedStates ? pastedStates.get(`${column},${row}`) : cellSystem.getState(`${column},${row}`)
          if (!state) continue
          const targetX = (column + moveOffset.column) * cellSize + gridOffsetX
          const targetY = (row + moveOffset.row) * cellSize + gridOffsetY
          const cellInset = state.isOn ? borderWidth * 1.5 : borderWidth / 2
          const cellGraphic = grid
            .roundRect(targetX + cellInset, targetY + cellInset, cellSize - cellInset * 2, cellSize - cellInset * 2, cellSize * 0.02)
            .fill({ color: state.isOn ? CORNER_MARKER_COLOR : CELL_FILL_COLOR, alpha: 0.72 })
          if (!state.isOn) cellGraphic.stroke({ color: CELL_BORDER_COLOR, width: borderWidth, alpha: 0.72 })

          const markerPosition = getCornerMarkerPosition(state.corner, targetX, targetY, cellSize)
          drawCornerMarker(grid, markerPosition.x, markerPosition.y, { color: state.isOn ? CELL_FILL_COLOR : CORNER_MARKER_COLOR, alpha: 0.72, size: markerPosition.markerSize, paddingX: 0, paddingY: 0, radius: markerPosition.markerSize * 0.1 })
        }
      }

      grid
        .rect(x, y, (rightColumn - leftColumn + 1) * cellSize, (bottomRow - topRow + 1) * cellSize)
        .stroke({ color: 0xe6e6e6, width: Math.max(1, cellSize * 0.05) })
    }

    function getCellPosition(event: PointerEvent): CellPosition {
      return surface!.pointerToCell(event)
    }

    function isSameCell(first: CellPosition, second: CellPosition | null): boolean {
      return second !== null && first.column === second.column && first.row === second.row
    }

    function rotateCornerMarker(event: PointerEvent) {
      const { column, row } = getCellPosition(event)
      const cellKey = `${column},${row}`
      cellSystem.rotateCornerFromUser(cellKey)
      drawGrid()
    }

    function isInsideSelection(cell: CellPosition): boolean {
      if (!upperSelectionBound || !lowerSelectionBound) return false
      return cell.column >= Math.min(upperSelectionBound.column, lowerSelectionBound.column)
        && cell.column <= Math.max(upperSelectionBound.column, lowerSelectionBound.column)
        && cell.row >= Math.min(upperSelectionBound.row, lowerSelectionBound.row)
        && cell.row <= Math.max(upperSelectionBound.row, lowerSelectionBound.row)
    }

    function isInsideMoveSilhouette(cell: CellPosition): boolean {
      if (!upperSelectionBound || !lowerSelectionBound) return false
      return cell.column >= Math.min(upperSelectionBound.column, lowerSelectionBound.column) + moveOffset.column
        && cell.column <= Math.max(upperSelectionBound.column, lowerSelectionBound.column) + moveOffset.column
        && cell.row >= Math.min(upperSelectionBound.row, lowerSelectionBound.row) + moveOffset.row
        && cell.row <= Math.max(upperSelectionBound.row, lowerSelectionBound.row) + moveOffset.row
    }

    function rotateSelectedCorners() {
      if (!upperSelectionBound || !lowerSelectionBound) return
      const leftColumn = Math.min(upperSelectionBound.column, lowerSelectionBound.column)
      const rightColumn = Math.max(upperSelectionBound.column, lowerSelectionBound.column)
      const topRow = Math.min(upperSelectionBound.row, lowerSelectionBound.row)
      const bottomRow = Math.max(upperSelectionBound.row, lowerSelectionBound.row)
      for (let row = topRow; row <= bottomRow; row += 1) {
        for (let column = leftColumn; column <= rightColumn; column += 1) {
          cellSystem.rotateCornerFromUser(`${column},${row}`)
        }
      }
      drawGrid()
    }

    function deleteCornerMarker(event: PointerEvent) {
      const { column, row } = getCellPosition(event)

      cellSystem.removeCornerFromUser(`${column},${row}`)
      drawGrid()
    }

    function processUpdateTick() {
      if (cellSystem.processTick(MAX_UPDATES_PER_TICK, UPDATE_BUDGET_MS) > 0) drawGrid()
    }

    function deleteSelectedCells() {
      if (!upperSelectionBound || !lowerSelectionBound) return

      const leftColumn = Math.min(upperSelectionBound.column, lowerSelectionBound.column)
      const rightColumn = Math.max(upperSelectionBound.column, lowerSelectionBound.column)
      const topRow = Math.min(upperSelectionBound.row, lowerSelectionBound.row)
      const bottomRow = Math.max(upperSelectionBound.row, lowerSelectionBound.row)
      for (let row = topRow; row <= bottomRow; row += 1) {
        for (let column = leftColumn; column <= rightColumn; column += 1) {
          cellSystem.removeCornerFromUser(`${column},${row}`)
        }
      }
      drawGrid()
    }

    function cancelMove() {
      isMovingSelection = false
      moveStartCell = null
      moveStartOffset = { column: 0, row: 0 }
      moveOffset = { column: 0, row: 0 }
      pastedMarkers = null
      if (initialized) drawGrid()
    }

    function beginPaste(state: SandboxWorldState) {
      if (state.cornerMarkers.length === 0) return
      const parsedMarkers = state.cornerMarkers.map((marker) => {
        const separator = marker.cellKey.indexOf(',')
        return { ...marker, column: Number(marker.cellKey.slice(0, separator)), row: Number(marker.cellKey.slice(separator + 1)) }
      })
      const leftColumn = Math.min(...parsedMarkers.map((marker) => marker.column))
      const rightColumn = Math.max(...parsedMarkers.map((marker) => marker.column))
      const topRow = Math.min(...parsedMarkers.map((marker) => marker.row))
      const bottomRow = Math.max(...parsedMarkers.map((marker) => marker.row))
      const cellSize = BASE_CELL_SIZE * zoom
      const centerColumn = Math.floor((app.renderer.width / 2 - gridOffsetX) / cellSize)
      const centerRow = Math.floor((app.renderer.height / 2 - gridOffsetY) / cellSize)
      const targetLeftColumn = centerColumn - Math.floor((rightColumn - leftColumn) / 2)
      const targetTopRow = centerRow - Math.floor((bottomRow - topRow) / 2)
      const sourceKeys = new Set(state.cornerMarkers.map((marker) => marker.cellKey))
      pastedMarkers = parsedMarkers.map((marker) => {
        const column = targetLeftColumn + marker.column - leftColumn
        const row = targetTopRow + marker.row - topRow
        let sourceKey = marker.sourceKey ?? null
        if (sourceKey && sourceKeys.has(sourceKey)) {
          const separator = sourceKey.indexOf(',')
          sourceKey = `${targetLeftColumn + Number(sourceKey.slice(0, separator)) - leftColumn},${targetTopRow + Number(sourceKey.slice(separator + 1)) - topRow}`
        }
        return { cellKey: `${column},${row}`, corner: marker.corner, isOn: marker.isOn ?? false, sourceKey }
      })
      upperSelectionBound = { column: targetLeftColumn, row: targetTopRow }
      lowerSelectionBound = {
        column: targetLeftColumn + rightColumn - leftColumn,
        row: targetTopRow + bottomRow - topRow,
      }
      moveOffset = { column: 0, row: 0 }
      drawGrid()
    }

    function commitMove(copy = false) {
      if (!upperSelectionBound || !lowerSelectionBound || (moveOffset.column === 0 && moveOffset.row === 0 && !pastedMarkers)) {
        cancelMove()
        return
      }
      const leftColumn = Math.min(upperSelectionBound.column, lowerSelectionBound.column)
      const rightColumn = Math.max(upperSelectionBound.column, lowerSelectionBound.column)
      const topRow = Math.min(upperSelectionBound.row, lowerSelectionBound.row)
      const bottomRow = Math.max(upperSelectionBound.row, lowerSelectionBound.row)
      const movingMarkers = pastedMarkers ?? cellSystem.getMarkers().filter((marker) => {
        const separator = marker.cellKey.indexOf(',')
        const column = Number(marker.cellKey.slice(0, separator))
        const row = Number(marker.cellKey.slice(separator + 1))
        return column >= leftColumn && column <= rightColumn && row >= topRow && row <= bottomRow
      })
      const movingKeys = new Set(movingMarkers.map((marker) => marker.cellKey))
      cellSystem.moveCornerStatesFromUser(movingMarkers.map((marker) => {
        const separator = marker.cellKey.indexOf(',')
        const column = Number(marker.cellKey.slice(0, separator))
        const row = Number(marker.cellKey.slice(separator + 1))
        const toCellKey = `${column + moveOffset.column},${row + moveOffset.row}`
        return {
          fromCellKey: marker.cellKey,
          state: {
            corner: marker.corner,
            isOn: marker.isOn ?? false,
            sourceKey: marker.sourceKey && movingKeys.has(marker.sourceKey)
              ? `${Number(marker.sourceKey.slice(0, marker.sourceKey.indexOf(','))) + moveOffset.column},${Number(marker.sourceKey.slice(marker.sourceKey.indexOf(',') + 1)) + moveOffset.row}`
              : marker.sourceKey ?? null,
          },
          toCellKey,
        }
      }), pastedMarkers ? false : !copy)
      upperSelectionBound = { column: upperSelectionBound.column + moveOffset.column, row: upperSelectionBound.row + moveOffset.row }
      lowerSelectionBound = { column: lowerSelectionBound.column + moveOffset.column, row: lowerSelectionBound.row + moveOffset.row }
      pastedMarkers = null
      cancelMove()
    }

    async function captureSelectedWorld() {
      if (!upperSelectionBound || !lowerSelectionBound) throw new Error('No selected cells to save.')
      const leftColumn = Math.min(upperSelectionBound.column, lowerSelectionBound.column)
      const rightColumn = Math.max(upperSelectionBound.column, lowerSelectionBound.column)
      const topRow = Math.min(upperSelectionBound.row, lowerSelectionBound.row)
      const bottomRow = Math.max(upperSelectionBound.row, lowerSelectionBound.row)
      const cornerMarkers = cellSystem.getMarkers().filter((marker) => {
        const separator = marker.cellKey.indexOf(',')
        const column = Number(marker.cellKey.slice(0, separator))
        const row = Number(marker.cellKey.slice(separator + 1))
        return column >= leftColumn && column <= rightColumn && row >= topRow && row <= bottomRow
      })
      const cellSize = BASE_CELL_SIZE * zoom
      const previewScale = app.canvas.width / app.renderer.width

      // Do not include the editor-only selection overlay in the saved preview.
      drawGrid(false)
      const screenshot = await cropCanvasToBlob(
        app.canvas,
        (leftColumn * cellSize + gridOffsetX) * previewScale,
        (topRow * cellSize + gridOffsetY) * previewScale,
        (rightColumn - leftColumn + 1) * cellSize * previewScale,
        (bottomRow - topRow + 1) * cellSize * previewScale,
      )
      drawGrid()

      return {
        screenshot,
        state: { cornerMarkers, gridOffsetX, gridOffsetY, zoom },
      }
    }

    function resizeCanvas() {
      if (!hasInitialPosition) {
        const cellSize = BASE_CELL_SIZE * zoom
        gridOffsetX = app.screen.width / 2 - cellSize / 2
        gridOffsetY = app.screen.height / 2 - cellSize / 2
        hasInitialPosition = true
      }
      drawGrid()
    }

    function handlePointerDown(event: PointerEvent) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      app.canvas.setPointerCapture(event.pointerId)

      if (activePointers.size === 1) {
        const pointerCell = getCellPosition(event)
        if (moveEnabledRef.current && upperSelectionBound && lowerSelectionBound && (isInsideSelection(pointerCell) || isInsideMoveSilhouette(pointerCell))) {
          isMovingSelection = true
          moveStartCell = pointerCell
          moveStartOffset = { ...moveOffset }
          hasPanned = false
          isPanning = false
          return
        }
        if (selectEnabledRef.current && upperSelectionBound && lowerSelectionBound) {
          const cell = getCellPosition(event)
          if (isSameCell(cell, upperSelectionBound)) {
            draggedSelectionBound = 'upper'
            isPanning = false
            return
          }
          if (isSameCell(cell, lowerSelectionBound)) {
            draggedSelectionBound = 'lower'
            isPanning = false
            return
          }
        }
        isPanning = true
        hasPanned = false
        interactionWasPinch = false
        lastPointerX = event.clientX
        lastPointerY = event.clientY
        return
      }

      if (activePointers.size === 2) beginPinch()
    }

    function handlePointerMove(event: PointerEvent) {
      if (!activePointers.has(event.pointerId)) return
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (activePointers.size >= 2) {
        updatePinch()
        return
      }

      if (isMovingSelection && moveStartCell) {
        const cell = getCellPosition(event)
        const nextOffset = {
          column: moveStartOffset.column + cell.column - moveStartCell.column,
          row: moveStartOffset.row + cell.row - moveStartCell.row,
        }
        if (nextOffset.column !== moveOffset.column || nextOffset.row !== moveOffset.row) {
          moveOffset = nextOffset
          drawGrid()
        }
        return
      }

      if (draggedSelectionBound) {
        const cell = getCellPosition(event)
        const currentBound = draggedSelectionBound === 'upper' ? upperSelectionBound : lowerSelectionBound
        if (!isSameCell(cell, currentBound)) {
          if (draggedSelectionBound === 'upper') upperSelectionBound = cell
          else lowerSelectionBound = cell
          drawGrid()
        }
        return
      }

      if (!isPanning) return

      if (!hasPanned && Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY) < PAN_THRESHOLD) return
      hasPanned = true

      gridOffsetX += event.clientX - lastPointerX
      gridOffsetY += event.clientY - lastPointerY
      lastPointerX = event.clientX
      lastPointerY = event.clientY
      drawGrid()
    }

    function handlePointerUp(event: PointerEvent) {
      const shouldSelectCell = activePointers.size === 1 && !hasPanned && !interactionWasPinch && !draggedSelectionBound
      const shouldRotateCorner = shouldSelectCell
      activePointers.delete(event.pointerId)
      if (app.canvas.hasPointerCapture(event.pointerId)) app.canvas.releasePointerCapture(event.pointerId)

      if (draggedSelectionBound) {
        draggedSelectionBound = null
      } else if (isMovingSelection) {
        isMovingSelection = false
        moveStartCell = null
      } else if (shouldSelectCell && selectEnabledRef.current && !drawEnabledRef.current && !deleteEnabledRef.current) {
        const cell = getCellPosition(event)
        if (!upperSelectionBound) upperSelectionBound = cell
        else if (!lowerSelectionBound) lowerSelectionBound = cell
        drawGrid()
      } else if (shouldRotateCorner && deleteEnabledRef.current) {
        deleteCornerMarker(event)
      } else if (shouldRotateCorner && drawEnabledRef.current) {
        if (selectEnabledRef.current && isInsideSelection(getCellPosition(event))) {
          rotateSelectedCorners()
        } else {
          rotateCornerMarker(event)
        }
      }

      const [remainingPointer] = activePointers.values()
      if (remainingPointer) {
        isPanning = true
        hasPanned = false
        lastPointerX = remainingPointer.x
        lastPointerY = remainingPointer.y
      } else {
        isPanning = false
        interactionWasPinch = false
      }
    }

    function beginPinch() {
      const pointers = [...activePointers.values()]
      const firstPointer = pointers[0]
      const secondPointer = pointers[1]
      if (!firstPointer || !secondPointer) return

      const centerX = (firstPointer.x + secondPointer.x) / 2
      const centerY = (firstPointer.y + secondPointer.y) / 2
      const bounds = app.canvas.getBoundingClientRect()
      const cellSize = BASE_CELL_SIZE * zoom
      const canvasCenterX = centerX - bounds.left
      const canvasCenterY = centerY - bounds.top

      isPanning = false
      interactionWasPinch = true
      pinchStartDistance = Math.hypot(secondPointer.x - firstPointer.x, secondPointer.y - firstPointer.y)
      pinchStartZoom = zoom
      pinchGridX = (canvasCenterX - gridOffsetX) / cellSize
      pinchGridY = (canvasCenterY - gridOffsetY) / cellSize
    }

    function handlePointerCancel(event: PointerEvent) {
      // Cancellation must never place, rotate or delete a cell.
      hasPanned = true
      interactionWasPinch = true
      handlePointerUp(event)
    }

    function updatePinch() {
      const pointers = [...activePointers.values()]
      const firstPointer = pointers[0]
      const secondPointer = pointers[1]
      if (!firstPointer || !secondPointer || pinchStartDistance === 0) return

      const centerX = (firstPointer.x + secondPointer.x) / 2
      const centerY = (firstPointer.y + secondPointer.y) / 2
      const bounds = app.canvas.getBoundingClientRect()
      const currentDistance = Math.hypot(secondPointer.x - firstPointer.x, secondPointer.y - firstPointer.y)

      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom * (currentDistance / pinchStartDistance)))
      const cellSize = BASE_CELL_SIZE * zoom
      gridOffsetX = centerX - bounds.left - pinchGridX * cellSize
      gridOffsetY = centerY - bounds.top - pinchGridY * cellSize
      drawGrid()
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const bounds = app.canvas.getBoundingClientRect()
      const pointerX = event.clientX - bounds.left
      const pointerY = event.clientY - bounds.top
      const previousCellSize = BASE_CELL_SIZE * zoom
      const gridX = (pointerX - gridOffsetX) / previousCellSize
      const gridY = (pointerY - gridOffsetY) / previousCellSize
      const zoomDirection = event.deltaY < 0 ? 1.1 : 0.9

      zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomDirection))
      const nextCellSize = BASE_CELL_SIZE * zoom
      gridOffsetX = pointerX - gridX * nextCellSize
      gridOffsetY = pointerY - gridY * nextCellSize
      drawGrid()
    }

    async function startCanvas() {
      host = new PixiCanvasHost({
        app, container: stableCanvasContainer, canvasClassName: 'size-full touch-none',
        init: { background: CELL_BORDER_COLOR, preserveDrawingBuffer: true },
        onReady: () => {
          initialized = true
          surface = new GridSurface(app, { infinite: true }, {
            width: app.screen.width, height: app.screen.height, cellSize: BASE_CELL_SIZE,
            fit: 'manual', zoom, offsetX: gridOffsetX, offsetY: gridOffsetY,
          }, { cellColor: CELL_FILL_COLOR, borderColor: CELL_BORDER_COLOR, backgroundColor: CELL_BORDER_COLOR, borderSize: 2, borderRadius: BASE_CELL_SIZE * 0.02, gap: 0 })
          surface.layers.pieces.addChild(grid)
          app.stage.addChild(surface.root)
          redrawRef.current = drawGrid
          deleteSelectedCellsRef.current = deleteSelectedCells
          beginPasteRef.current = beginPaste
          commitMoveRef.current = commitMove
          cancelMoveRef.current = cancelMove
          captureSelectedWorldRef.current = captureSelectedWorld
          setSelectModeRef.current = (enabled) => {
            if (enabled) {
              // beginPaste establishes the imported world's full bounds before
              // React enables Select; keep them instead of creating a 2x2 area.
              if (pastedMarkers) {
                drawGrid()
                return
              }
              const cellSize = BASE_CELL_SIZE * zoom
              const centerColumn = Math.floor((app.renderer.width / 2 - gridOffsetX) / cellSize)
              const centerRow = Math.floor((app.renderer.height / 2 - gridOffsetY) / cellSize)
              upperSelectionBound = { column: centerColumn - 1, row: centerRow - 1 }
              lowerSelectionBound = { column: centerColumn, row: centerRow }
            } else {
              upperSelectionBound = null
              lowerSelectionBound = null
              draggedSelectionBound = null
              cancelMove()
            }
            if (initialized) drawGrid()
          }
          captureWorldRef.current = async () => ({
            screenshot: await canvasToBlob(app.canvas),
            state: { cornerMarkers: cellSystem.getMarkers(), gridOffsetX, gridOffsetY, zoom },
          })
          detachInput = attachGridInput(app.canvas, {
            gestures: false,
            cellAt: getCellPosition,
            callbacks: {
              onPointerDown: handlePointerDown,
              onPointerMove: handlePointerMove,
              onPointerUp: handlePointerUp,
              onPointerCancel: handlePointerCancel,
              onWheel: handleWheel,
            },
          })
          updateTimer = window.setInterval(processUpdateTick, SANDBOX_TICK_INTERVAL_MS)
        },
        onResize: resizeCanvas,
      })
      await host.start()
    }

    void startCanvas()

    return () => {
      captureWorldRef.current = null
      captureSelectedWorldRef.current = null
      beginPasteRef.current = null
      deleteSelectedCellsRef.current = null
      commitMoveRef.current = null
      cancelMoveRef.current = null
      setSelectModeRef.current = null
      redrawRef.current = null
      window.clearInterval(updateTimer)
      if (cornerAnimationFrame !== 0) window.cancelAnimationFrame(cornerAnimationFrame)
      if (!host) return
      detachInput?.()
      surface?.destroy()
      host.destroy()
    }
  }, [])

  return <div className="size-full" ref={canvasContainerRef} />
})
