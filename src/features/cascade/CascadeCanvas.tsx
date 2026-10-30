import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Application, Container, Graphics, Sprite } from 'pixi.js'
import { GridSurface } from '@/rendering/grid/GridSurface'
import { PixiCanvasHost } from '@/rendering/pixi/PixiCanvasHost'
import { GAME_COLORS, LOCKED_CELL_COLORS } from '@/rendering/colors'
import { attachGridInput } from '@/rendering/grid/gridInput'
import { drawCorneromino as drawSharedCorneromino } from '@/rendering/grid/drawCorneromino'
import { gsap } from 'gsap'
import { ShockwaveFilter } from 'pixi-filters'
import { CASCADE_LOCK_EFFECTS } from './cascadeEffects'
import { getCascadeKeyboardFocus, type CascadeFocusPosition } from './cascadeKeyboardFocus'
import { saveCascadeGameState, type CascadeGameSaveState } from '@/lib/db'
import { advanceCascadeGame, createCascadeGame, dropCascadePiece, getCascadeLandingRow, isValidCascadeLockSelection, moveCascadePiece, resolveCascadeLockedRows, type CascadeCorner, type CascadeCornerSpawnMode, type CascadeGameState, type CascadeGridSize } from './cascadeGame'

const CELL_FILL_COLOR = GAME_COLORS.cellFill
const CELL_BORDER_COLOR = GAME_COLORS.cellBorder
const CORNER_MARKER_COLOR = GAME_COLORS.cornerMarker
const SWIPE_THRESHOLD = 36
const SELECTED_Y_OFFSET = -2
const SELECTED_ROTATION = -0.04
const SELECTED_SCALE = 0.92
const MAX_SELECTED_PIECES = 4
const CELL_MOVE_DURATION_SECONDS = 0.14
const HORIZONTAL_SQUASH_DURATION_SECONDS = 0.05
const HORIZONTAL_SQUASH_SCALE_X = 1.5
const HORIZONTAL_SQUASH_SCALE_Y = 0.8
const SELECTION_DURATION_SECONDS = 0.14

interface CascadeCanvasProps {
  cornerDifficulty: number
  maxConsecutiveSameCorner: number
  cornerSpawnMode: CascadeCornerSpawnMode
  getFallIntervalMs: (gameState: CascadeGameSaveState) => number
  gridSize: CascadeGridSize
  initialState: CascadeGameSaveState | null
  onStatsChange: (stats: { destroyedLineCount: number; lockedCornerominoCount: number; score: number; upcomingCorners: CascadeCorner[] }) => void
  scorePointsPerLockedCorneromino: number
  scorePointsPerLine: number
}

export interface CascadeCanvasHandle {
  exportDebugState: () => string
  pause: () => void
  resume: () => void
  save: () => Promise<void>
}

interface BoardMetrics {
  borderWidth: number
  cellSize: number
  offsetX: number
  offsetY: number
}

interface RenderedPiece {
  cellSize: number
  column: number
  corner: CascadeCorner
  graphic: Graphics
  isSelected: boolean
  lockedColor: number | undefined
  row: number
  shine: Graphics
  shineMask: Graphics
  sprite: Container
  shakeLayer: Container
}

function invertColor(color: number): number {
  return color ^ 0xffffff
}

function drawCorneromino(graphics: Graphics, corner: CascadeCorner, cellSize: number, borderWidth: number, isSelected: boolean, lockedColor: number | undefined) {
  const pieceColor = isSelected ? invertColor(CORNER_MARKER_COLOR) : CORNER_MARKER_COLOR
  const detailColor = isSelected ? invertColor(CELL_FILL_COLOR) : CELL_FILL_COLOR
  drawSharedCorneromino(graphics, corner, cellSize, cellSize, {
    fillColor: lockedColor ?? pieceColor,
    borderColor: lockedColor !== undefined ? CELL_BORDER_COLOR : pieceColor,
    borderSize: lockedColor !== undefined ? borderWidth * 1.5 : 0,
    borderRadius: 0,
    outline: lockedColor === undefined ? { color: detailColor, width: borderWidth, inset: borderWidth * 1.5 } : undefined,
  }, {
    color: lockedColor !== undefined ? CORNER_MARKER_COLOR : detailColor,
    size: cellSize / 2, paddingX: cellSize * 0.16, paddingY: cellSize * 0.16, radius: 0,
  })
}

export const CascadeCanvas = forwardRef<CascadeCanvasHandle, CascadeCanvasProps>(function CascadeCanvas(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const exportDebugStateRef = useRef<(() => string) | null>(null)
  const pauseRef = useRef<(() => void) | null>(null)
  const resumeRef = useRef<(() => void) | null>(null)
  const saveRef = useRef<(() => Promise<void>) | null>(null)

  useImperativeHandle(ref, () => ({
    exportDebugState: () => {
      if (!exportDebugStateRef.current) throw new Error('Cascade canvas is not ready.')
      return exportDebugStateRef.current()
    },
    pause: () => pauseRef.current?.(),
    resume: () => resumeRef.current?.(),
    save: async () => {
      if (!saveRef.current) throw new Error('Cascade canvas is not ready.')
      await saveRef.current()
    },
  }), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const stableContainer: HTMLDivElement = container

    const app = new Application()
    let host: PixiCanvasHost | undefined
    const gridShakeMotion = { time: 0 }
    const boardGraphics = new Graphics()
    const boardCells = new Container()
    const cellGraphics = new Map<string, Sprite>()
    let surface: GridSurface | undefined
    const shakes = new Map<Container, { time: number }>()
    const piecesLayer = new Container()
    const keyboardFocusGraphic = new Graphics()
    keyboardFocusGraphic.eventMode = 'none'
    keyboardFocusGraphic.visible = false
    piecesLayer.sortableChildren = true
    const renderedPieces = new Map<string, RenderedPiece>()
    const selectedPieceKeys = new Set(props.initialState?.selectedPieceKeys ?? [])
    const lockedPieces = props.initialState?.lockedPieces
      ?? (props.initialState?.lockedPieceColors ?? []).map((piece) => ({ ...piece, groupId: `legacy:${piece.cellKey}` }))
    const lockedPieceColors = new Map(lockedPieces.map((piece) => [piece.cellKey, piece.color]))
    const lockedPieceGroupIds = new Map(lockedPieces.map((piece) => [piece.cellKey, piece.groupId]))
    let destroyedLineCount = props.initialState?.destroyedLineCount ?? 0
    let lockedCornerominoCount = props.initialState?.lockedCornerominoCount ?? lockedPieceColors.size
    let score = props.initialState?.score ?? 0
    const lockWaves = new Set<ShockwaveFilter>()
    let disposed = false
    let gameState: CascadeGameState = props.initialState?.gameState ?? createCascadeGame()
    let elapsedSinceFall = props.initialState?.elapsedSinceFall ?? 0
    let fallIntervalMs = 0
    let isPaused = false
    let isKeyboardFocusMode = false
    let keyboardFocus: CascadeFocusPosition | null = null
    let detachInput: (() => void) | undefined

    function getPieceKey(column: number, row: number): string {
      return `${column},${row}`
    }

    for (const pieceKey of lockedPieceColors.keys()) {
      selectedPieceKeys.delete(pieceKey)
    }

    function getCurrentSaveState(): CascadeGameSaveState {
      return {
        destroyedLineCount,
        elapsedSinceFall,
        gameState,
        lockedCornerominoCount,
        lockedPieces: [...lockedPieceColors].map(([cellKey, color]) => ({ cellKey, color, groupId: lockedPieceGroupIds.get(cellKey) ?? `legacy:${cellKey}` })),
        score,
        selectedPieceKeys: [...selectedPieceKeys],
      }
    }

    fallIntervalMs = props.getFallIntervalMs(getCurrentSaveState())
    if (props.initialState?.elapsedSinceFall === undefined) elapsedSinceFall = fallIntervalMs

    function persistGameState() {
      const state = getCurrentSaveState()
      void saveCascadeGameState(state)
    }

    function pauseGame() {
      isPaused = true
      endKeyboardFocus()
      persistGameState()
    }

    function resumeGame() {
      isPaused = false
    }

    async function saveGame() {
      await saveCascadeGameState(getCurrentSaveState())
    }

    pauseRef.current = pauseGame
    resumeRef.current = resumeGame
    saveRef.current = saveGame

    exportDebugStateRef.current = () => JSON.stringify({
      config: {
        cornerSpawnMode: props.cornerSpawnMode,
        cornerDifficulty: props.cornerDifficulty,
        maxConsecutiveSameCorner: props.maxConsecutiveSameCorner,
        fallIntervalMs,
        gridSize: props.gridSize,
      },
      destroyedLineCount,
      elapsedSinceFall,
      gameState,
      lockedPieces: [...lockedPieceColors].map(([cellKey, color]) => ({
        cellKey,
        color: `#${color.toString(16).padStart(6, '0')}`,
        groupId: lockedPieceGroupIds.get(cellKey) ?? `legacy:${cellKey}`,
      })),
      lockedCornerominoCount,
      score,
      selectedPieceKeys: [...selectedPieceKeys],
      version: 1,
    }, null, 2)

    function notifyStats() {
      props.onStatsChange({
        destroyedLineCount,
        lockedCornerominoCount,
        score,
        upcomingCorners: [...(gameState.upcomingCorners ?? [])],
      })
    }

    function getBoardMetrics(): BoardMetrics {
      const { cellWidth: cellSize, offsetX, offsetY } = surface!.metrics
      return {
        borderWidth: Math.max(1, cellSize * 0.035),
        cellSize,
        offsetX,
        offsetY,
      }
    }

    function drawBoard() {
      surface!.update({ width: app.screen.width, height: app.screen.height, cellSize: 56, fit: 'contain' })
      const { borderWidth, cellSize, offsetX, offsetY } = getBoardMetrics()
      const landingRow = getCascadeLandingRow(gameState, props.gridSize)
      const landingColumn = gameState.activePiece?.column
      boardGraphics.clear()
      if (landingColumn !== undefined && landingRow !== null) {
        boardGraphics.rect(offsetX + landingColumn * cellSize + borderWidth, offsetY + landingRow * cellSize + borderWidth, cellSize - borderWidth * 2, cellSize - borderWidth * 2).fill(0xffffff)
      }

      for (let row = 0; row < props.gridSize.rows; row += 1) {
        for (let column = 0; column < props.gridSize.columns; column += 1) {
          const x = offsetX + column * cellSize
          const y = offsetY + row * cellSize
          const key = getPieceKey(column, row)
          let cell = cellGraphics.get(key)
          if (!cell) {
            cell = new Sprite(surface!.texture)
            cellGraphics.set(key, cell)
            boardCells.addChild(cell)
          }
          cell.texture = surface!.texture
          cell.position.set(x, y)
          cell.width = cellSize
          cell.height = cellSize
          cell.visible = shakes.has(cell)
        }
      }
    }

    function configureLockedShine(renderedPiece: RenderedPiece, cellSize: number, borderWidth: number, isLocked: boolean) {
      gsap.killTweensOf(renderedPiece.shine)
      renderedPiece.shine.clear()
      renderedPiece.shineMask.clear()
      renderedPiece.shine.visible = isLocked
      renderedPiece.shine.mask = isLocked ? renderedPiece.shineMask : null
      if (!isLocked) return

      const lockedCellInset = borderWidth * 1.5
      renderedPiece.shineMask
        .rect(lockedCellInset, lockedCellInset, cellSize - lockedCellInset * 2, cellSize - lockedCellInset * 2)
        .fill({ color: 0xffffff })
      const stripeHeight = cellSize * 3
      renderedPiece.shine
        .rect(0, -stripeHeight / 2, cellSize * 0.08, stripeHeight).fill({ alpha: 0.12, color: 0xffffff })
        .rect(cellSize * 0.08, -stripeHeight / 2, cellSize * 0.06, stripeHeight).fill({ alpha: 0.72, color: 0xffffff })
        .rect(cellSize * 0.14, -stripeHeight / 2, cellSize * 0.08, stripeHeight).fill({ alpha: 0.12, color: 0xffffff })
      renderedPiece.shine.rotation = -0.35
      gsap.set(renderedPiece.shine, { x: -cellSize * 1.5, y: cellSize / 2 })
      gsap.to(renderedPiece.shine, {
        duration: 4,
        ease: 'none',
        repeat: -1,
        x: cellSize * 2,
      })
    }

    function syncPieces(animate: boolean) {
      const { borderWidth, cellSize, offsetX, offsetY } = getBoardMetrics()
      const pieces = gameState.activePiece ? [...gameState.settledPieces, gameState.activePiece] : gameState.settledPieces

      if (!gameState.activePiece) {
        const activeRenderedPiece = renderedPieces.get('active')
        const newlySettledPiece = gameState.settledPieces.at(-1)
        if (activeRenderedPiece && newlySettledPiece) {
          renderedPieces.delete('active')
          renderedPieces.set(getPieceKey(newlySettledPiece.column, newlySettledPiece.row), activeRenderedPiece)
        }
      }

      for (const piece of pieces) {
        const pieceKey = getPieceKey(piece.column, piece.row)
        const renderKey = gameState.activePiece === piece ? 'active' : pieceKey
        const isSelected = selectedPieceKeys.has(pieceKey)
        const lockedColor = lockedPieceColors.get(pieceKey)
        const targetX = offsetX + piece.column * cellSize
        const targetY = offsetY + piece.row * cellSize
        let renderedPiece = renderedPieces.get(renderKey)
        const isNewPiece = !renderedPiece

        if (!renderedPiece) {
          const sprite = new Container()
          const graphic = new Graphics()
          const shine = new Graphics()
          const shineMask = new Graphics()
          const shakeLayer = new Container()
          shakeLayer.addChild(graphic, shineMask, shine)
          sprite.addChild(shakeLayer)
          piecesLayer.addChild(sprite)
          renderedPiece = {
            cellSize,
            column: piece.column,
            corner: piece.corner,
            graphic,
            isSelected,
            lockedColor,
            row: piece.row,
            shine,
            shineMask,
            sprite,
            shakeLayer,
          }
          renderedPieces.set(renderKey, renderedPiece)
        }

        renderedPiece.sprite.zIndex = isSelected ? 1 : 0

        const needsRedraw = isNewPiece || renderedPiece.cellSize !== cellSize || renderedPiece.corner !== piece.corner || renderedPiece.isSelected !== isSelected || renderedPiece.lockedColor !== lockedColor
        const needsMovement = renderedPiece.column !== piece.column || renderedPiece.row !== piece.row
        if (needsRedraw) {
          renderedPiece.graphic.clear()
          drawCorneromino(renderedPiece.graphic, piece.corner, cellSize, borderWidth, isSelected, lockedColor)
          renderedPiece.graphic.pivot.set(cellSize / 2, cellSize / 2)
          configureLockedShine(renderedPiece, cellSize, borderWidth, lockedColor !== undefined)
        }

        if (!animate || isNewPiece || (!needsMovement && renderedPiece.cellSize !== cellSize)) {
          gsap.set(renderedPiece.sprite, { x: targetX, y: targetY })
        } else if (needsMovement) {
          gsap.to(renderedPiece.sprite, {
            duration: CELL_MOVE_DURATION_SECONDS,
            ease: 'power2.out',
            overwrite: 'auto',
            x: targetX,
            y: targetY,
          })
          if (renderKey === 'active' && renderedPiece.column !== piece.column) {
            const baseScale = isSelected ? SELECTED_SCALE : 1
            gsap.timeline({ overwrite: 'auto' })
              .to(renderedPiece.graphic.scale, {
                duration: HORIZONTAL_SQUASH_DURATION_SECONDS,
                ease: 'power2.out',
                x: baseScale * HORIZONTAL_SQUASH_SCALE_X,
                y: baseScale * HORIZONTAL_SQUASH_SCALE_Y,
              })
              .to(renderedPiece.graphic.scale, {
                duration: HORIZONTAL_SQUASH_DURATION_SECONDS * 1.5,
                ease: 'back.out(2)',
                x: baseScale,
                y: baseScale,
              })
          }
        }

        const targetGraphicY = cellSize / 2 + (isSelected ? SELECTED_Y_OFFSET : 0)
        const targetRotation = isSelected ? SELECTED_ROTATION : 0
        const targetScale = isSelected ? SELECTED_SCALE : 1
        if (!animate || isNewPiece || (!renderedPiece.isSelected && !isSelected && renderedPiece.cellSize !== cellSize)) {
          gsap.set(renderedPiece.graphic, { rotation: targetRotation, x: cellSize / 2, y: targetGraphicY })
          gsap.set(renderedPiece.graphic.scale, { x: targetScale, y: targetScale })
        } else if (renderedPiece.isSelected !== isSelected || renderedPiece.cellSize !== cellSize) {
          gsap.to(renderedPiece.graphic, {
            duration: SELECTION_DURATION_SECONDS,
            ease: isSelected ? 'back.out(1.7)' : 'power2.out',
            overwrite: 'auto',
            rotation: targetRotation,
            x: cellSize / 2,
            y: targetGraphicY,
          })
          gsap.to(renderedPiece.graphic.scale, {
            duration: SELECTION_DURATION_SECONDS,
            ease: isSelected ? 'back.out(1.7)' : 'power2.out',
            overwrite: 'auto',
            x: targetScale,
            y: targetScale,
          })
        }

        renderedPiece.cellSize = cellSize
        renderedPiece.column = piece.column
        renderedPiece.corner = piece.corner
        renderedPiece.isSelected = isSelected
        renderedPiece.lockedColor = lockedColor
        renderedPiece.row = piece.row
      }
      syncKeyboardFocus()
    }

    function endKeyboardFocus() {
      isKeyboardFocusMode = false
      keyboardFocusGraphic.visible = false
    }

    function syncKeyboardFocus() {
      if (!isKeyboardFocusMode) return
      keyboardFocus = getCascadeKeyboardFocus(gameState.settledPieces, lockedPieceColors, keyboardFocus)
      keyboardFocusGraphic.visible = keyboardFocus !== null
      keyboardFocusGraphic.clear()
      if (!keyboardFocus) return
      const { cellSize } = getBoardMetrics()
      const inset = cellSize * 0.1
      const width = Math.max(2, cellSize * 0.05)
      keyboardFocusGraphic
        .rect(inset, inset, cellSize - inset * 2, cellSize - inset * 2)
        .stroke({ color: GAME_COLORS.ink, width: width * 2 })
        .rect(inset, inset, cellSize - inset * 2, cellSize - inset * 2)
        .stroke({ color: 0xffffff, width })
      positionKeyboardFocus()
    }

    function positionKeyboardFocus() {
      if (!isKeyboardFocusMode || !keyboardFocus) return
      const rendered = renderedPieces.get(getPieceKey(keyboardFocus.column, keyboardFocus.row))
      if (rendered) keyboardFocusGraphic.position.copyFrom(rendered.sprite.position)
    }

    function setGameState(nextGameState: CascadeGameState, animate = true) {
      if (nextGameState === gameState) return
      gameState = nextGameState
      drawBoard()
      syncPieces(animate)
      persistGameState()
      notifyStats()
    }

    function removeRenderedPiece(pieceKey: string) {
      const renderedPiece = renderedPieces.get(pieceKey)
      if (!renderedPiece) return

      renderedPieces.delete(pieceKey)
      const shake = shakes.get(renderedPiece.shakeLayer)
      if (shake) {
        // Shake tweens animate a separate motion object whose callback writes
        // to this layer. Stop it before destroying the layer, otherwise a
        // later GSAP update tries to access the destroyed Pixi position.
        gsap.killTweensOf(shake)
        shakes.delete(renderedPiece.shakeLayer)
      }
      gsap.killTweensOf(renderedPiece.sprite)
      gsap.killTweensOf(renderedPiece.graphic)
      gsap.killTweensOf(renderedPiece.graphic.scale)
      gsap.killTweensOf(renderedPiece.shine)
      renderedPiece.sprite.destroy({ children: true })
    }

    function applyGravityMoves(gravityMoves: ReadonlyArray<{ fromCellKey: string; toCellKey: string }>) {
      const focusedKey = keyboardFocus && getPieceKey(keyboardFocus.column, keyboardFocus.row)
      const focusedMove = gravityMoves.find((move) => move.fromCellKey === focusedKey)
      if (focusedMove) {
        const [column, row] = focusedMove.toCellKey.split(',').map(Number)
        keyboardFocus = { column, row }
      }
      const movingPieces = gravityMoves.flatMap((move) => {
        const renderedPiece = renderedPieces.get(move.fromCellKey)
        return renderedPiece ? [{ ...move, renderedPiece }] : []
      })
      for (const move of movingPieces) {
        renderedPieces.delete(move.fromCellKey)
      }
      for (const move of movingPieces) {
        renderedPieces.set(move.toCellKey, move.renderedPiece)
      }
    }

    function resize() {
      drawBoard()
      syncPieces(false)
    }

    function update(ticker: { deltaMS: number }) {
      if (isPaused) return
      elapsedSinceFall += ticker.deltaMS
      while (elapsedSinceFall >= fallIntervalMs) {
        elapsedSinceFall -= fallIntervalMs
        setGameState(advanceCascadeGame(gameState, props.gridSize, Math.random, props.cornerSpawnMode, props.cornerDifficulty, props.maxConsecutiveSameCorner))
      }
      positionKeyboardFocus()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isPaused) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (event.altKey || event.ctrlKey || event.metaKey) return

      if (event.key === 'Shift' || event.shiftKey) {
        isKeyboardFocusMode = true
        syncKeyboardFocus()
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          keyboardFocus = getCascadeKeyboardFocus(gameState.settledPieces, lockedPieceColors, keyboardFocus, event.key)
          syncKeyboardFocus()
        } else if (event.code === 'Space') {
          event.preventDefault()
          if (!event.repeat && keyboardFocus) togglePieceSelectionAt(keyboardFocus.column, keyboardFocus.row)
        }
        return
      }
      endKeyboardFocus()
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowDown') return

      event.preventDefault()
      if (event.key === 'ArrowDown') {
        dropActivePiece()
      } else {
        setGameState(moveCascadePiece(gameState, props.gridSize, event.key === 'ArrowLeft' ? -1 : 1))
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (!event.shiftKey) endKeyboardFocus()
    }

    function handleVisibilityChange() {
      if (document.hidden) endKeyboardFocus()
    }

    function moveFromSwipe(direction: -1 | 1, steps: number) {
      for (let step = 0; step < steps; step += 1) {
        setGameState(moveCascadePiece(gameState, props.gridSize, direction))
      }
    }

    function togglePieceSelectionAt(column: number, row: number) {
      const pieceKey = getPieceKey(column, row)

      if (lockedPieceColors.has(pieceKey) || !gameState.settledPieces.some((piece) => getPieceKey(piece.column, piece.row) === pieceKey)) return
      if (selectedPieceKeys.has(pieceKey)) {
        selectedPieceKeys.delete(pieceKey)
      } else if (selectedPieceKeys.size < MAX_SELECTED_PIECES) {
        selectedPieceKeys.add(pieceKey)
      }
      lockSelectionIfValid()
      syncPieces(true)
      persistGameState()
    }

    function dropActivePiece() {
      const activePiece = gameState.activePiece
      const landingRow = getCascadeLandingRow(gameState, props.gridSize)
      if (!activePiece || landingRow === null) return

      setGameState(dropCascadePiece(gameState, props.gridSize))
      const landedPiece = { ...activePiece, row: landingRow }
      gsap.delayedCall(CELL_MOVE_DURATION_SECONDS, () => {
        if (disposed) return
        playDropShake(landedPiece)
        playGridShake(CASCADE_LOCK_EFFECTS.gridShakeDrop)
      })
    }

    function lockSelectionIfValid() {
      if (selectedPieceKeys.size !== MAX_SELECTED_PIECES) return

      const selectedPieces = gameState.settledPieces.filter((piece) => selectedPieceKeys.has(getPieceKey(piece.column, piece.row)))
      if (!isValidCascadeLockSelection(selectedPieces)) return

      const neighboringColors = new Set<number>()
      for (const piece of selectedPieces) {
        for (const { columnOffset, rowOffset } of [
          { columnOffset: -1, rowOffset: 0 },
          { columnOffset: 1, rowOffset: 0 },
          { columnOffset: 0, rowOffset: -1 },
          { columnOffset: 0, rowOffset: 1 },
        ]) {
          const neighboringColor = lockedPieceColors.get(getPieceKey(piece.column + columnOffset, piece.row + rowOffset))
          if (neighboringColor !== undefined) neighboringColors.add(neighboringColor)
        }
      }
      const availableColors = LOCKED_CELL_COLORS.filter((color) => !neighboringColors.has(color))
      const colorPool = availableColors.length > 0 ? availableColors : LOCKED_CELL_COLORS
      const lockedColor = colorPool[Math.floor(Math.random() * colorPool.length)]
      const lockGroupId = crypto.randomUUID()
      for (const pieceKey of selectedPieceKeys) {
        lockedPieceColors.set(pieceKey, lockedColor)
        lockedPieceGroupIds.set(pieceKey, lockGroupId)
      }
      score += props.scorePointsPerLockedCorneromino
      selectedPieceKeys.clear()
      const resolution = resolveCascadeLockedRows(
        gameState,
        props.gridSize,
        [...lockedPieceGroupIds].map(([cellKey, groupId]) => ({ cellKey, groupId })),
      )
      for (const cellKey of resolution.clearedCellKeys) {
        lockedPieceColors.delete(cellKey)
        lockedPieceGroupIds.delete(cellKey)
        removeRenderedPiece(cellKey)
      }
      for (const lockedCell of resolution.lockedCells) {
        lockedPieceGroupIds.set(lockedCell.cellKey, lockedCell.groupId)
      }
      const movedLockedPieces = resolution.gravityMoves.flatMap((move) => {
        const color = lockedPieceColors.get(move.fromCellKey)
        const groupId = lockedPieceGroupIds.get(move.fromCellKey)
        return color !== undefined && groupId !== undefined ? [{ ...move, color, groupId }] : []
      })
      for (const piece of movedLockedPieces) {
        lockedPieceColors.delete(piece.fromCellKey)
        lockedPieceGroupIds.delete(piece.fromCellKey)
      }
      for (const piece of movedLockedPieces) {
        lockedPieceColors.set(piece.toCellKey, piece.color)
        lockedPieceGroupIds.set(piece.toCellKey, piece.groupId)
      }
      applyGravityMoves(resolution.gravityMoves)
      gameState = resolution.state
      const clearedLineCount = new Set(resolution.clearedCellKeys.map((cellKey) => cellKey.split(',')[1])).size
      for (let line = 0; line < clearedLineCount; line += 1) {
        destroyedLineCount += 1
        score += props.scorePointsPerLine
        fallIntervalMs = props.getFallIntervalMs(getCurrentSaveState())
      }
      lockedCornerominoCount = lockedPieceColors.size
      notifyStats()
      playLockShake(selectedPieces)
      playGridShake()
      const ripple = CASCADE_LOCK_EFFECTS.ripple
      if (!ripple.enabled) return
      const { cellSize, offsetX, offsetY } = getBoardMetrics()
      const centerX = selectedPieces.reduce((sum, piece) => sum + piece.column + 0.5, 0) / selectedPieces.length
      const centerY = selectedPieces.reduce((sum, piece) => sum + piece.row + 0.5, 0) / selectedPieces.length
      const wave = new ShockwaveFilter({
        center: { x: offsetX + centerX * cellSize, y: offsetY + centerY * cellSize },
        amplitude: cellSize * ripple.amplitudeCells,
        wavelength: cellSize * ripple.wavelengthCells,
        speed: cellSize * ripple.speedCellsPerSecond,
        radius: cellSize * ripple.radiusCells,
        brightness: ripple.brightness,
      })
      wave.resolution = 'inherit'
      lockWaves.add(wave)
      app.stage.filters = [...lockWaves]
      gsap.to(wave, {
        time: ripple.durationSeconds,
        amplitude: 0,
        brightness: 1,
        duration: ripple.durationSeconds,
        ease: 'none',
        onComplete: () => {
          lockWaves.delete(wave)
          app.stage.filters = [...lockWaves]
          wave.destroy()
        },
      })
    }

    function playGridShake(config = CASCADE_LOCK_EFFECTS.gridShake) {
      gsap.killTweensOf(gridShakeMotion)
      app.stage.position.set(0, 0)
      if (!config.enabled || config.durationSeconds <= 0) return

      gridShakeMotion.time = 0
      const amplitude = getBoardMetrics().cellSize * config.amplitudeCells
      gsap.to(gridShakeMotion, {
        time: config.durationSeconds,
        duration: config.durationSeconds,
        ease: 'none',
        onUpdate: () => {
          const fade = (1 - gridShakeMotion.time / config.durationSeconds) ** 2
          const phase = gridShakeMotion.time * config.frequencyHz * Math.PI * 2
          app.stage.position.set(
            Math.sin(phase) * amplitude * fade,
            Math.sin(phase * 1.3) * amplitude * fade * 0.6,
          )
        },
        onComplete: () => { app.stage.position.set(0, 0) },
      })
    }

    function playLockShake(lockedPieces: CascadeGameState['settledPieces']) {
      const config = CASCADE_LOCK_EFFECTS.shake
      if (!config.enabled || config.radiusCells <= 0 || config.durationSeconds <= 0) return
      const { cellSize } = getBoardMetrics()
      for (const [key, cell] of cellGraphics) {
        const [column, row] = key.split(',').map(Number)
        const distance = Math.min(...lockedPieces.map((piece) => Math.hypot(piece.column - column, piece.row - row)))
        if (distance === 0 || distance > config.radiusCells) continue
        const targets: Container[] = [cell]
        cell.visible = true
        const piece = renderedPieces.get(key)
        if (piece) targets.push(piece.shakeLayer)
        for (const target of targets) {
          const previous = shakes.get(target)
          if (previous) gsap.killTweensOf(previous)
          const baseX = target === cell ? getBoardMetrics().offsetX + column * cellSize : 0
          const baseY = target === cell ? getBoardMetrics().offsetY + row * cellSize : 0
          target.position.set(baseX, baseY)
          const motion = { time: 0 }
          shakes.set(target, motion)
          const amplitude = cellSize * config.amplitudeCells * (1 - distance / (config.radiusCells + 1))
          gsap.to(motion, {
            time: config.durationSeconds,
            duration: config.durationSeconds,
            delay: distance / Math.max(0.01, config.propagationCellsPerSecond),
            ease: 'none',
            onUpdate: () => {
              const fade = (1 - motion.time / config.durationSeconds) ** 2
              const phase = motion.time * config.frequencyHz * Math.PI * 2
              target.position.set(baseX + Math.sin(phase) * amplitude * fade, baseY + Math.sin(phase * 1.3) * amplitude * fade * 0.6)
            },
            onComplete: () => {
              target.position.set(baseX, baseY)
              if (target === cell) cell.visible = false
              shakes.delete(target)
            },
          })
        }
      }
    }

    function playDropShake(landedPiece: CascadeGameState['settledPieces'][number]) {
      const config = CASCADE_LOCK_EFFECTS.shakeDrop
      if (!config.enabled || config.durationSeconds <= 0) return
      const piece = renderedPieces.get(getPieceKey(landedPiece.column, landedPiece.row))
      if (!piece) return

      const target = piece.shakeLayer
      const previous = shakes.get(target)
      if (previous) gsap.killTweensOf(previous)
      target.position.set(0, 0)
      const motion = { time: 0 }
      shakes.set(target, motion)
      const amplitude = getBoardMetrics().cellSize * config.amplitudeCells
      gsap.to(motion, {
        time: config.durationSeconds,
        duration: config.durationSeconds,
        ease: 'none',
        onUpdate: () => {
          const fade = (1 - motion.time / config.durationSeconds) ** 2
          const phase = motion.time * config.frequencyHz * Math.PI * 2
          target.position.set(Math.sin(phase) * amplitude * fade, Math.sin(phase * 1.3) * amplitude * fade * 0.6)
        },
        onComplete: () => {
          target.position.set(0, 0)
          shakes.delete(target)
        },
      })
    }

    function cleanupCanvas() {
      exportDebugStateRef.current = null
      pauseRef.current = null
      resumeRef.current = null
      saveRef.current = null
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', endKeyboardFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      gsap.killTweensOf(gridShakeMotion)
      for (const motion of shakes.values()) gsap.killTweensOf(motion)
      shakes.clear()
      for (const wave of lockWaves) {
        gsap.killTweensOf(wave)
        wave.destroy()
      }
      lockWaves.clear()
      app.stage.filters = []
      app.ticker?.remove(update)
      detachInput?.()
      detachInput = undefined
      for (const renderedPiece of renderedPieces.values()) {
        gsap.killTweensOf(renderedPiece.sprite)
        gsap.killTweensOf(renderedPiece.graphic)
        gsap.killTweensOf(renderedPiece.graphic.scale)
        gsap.killTweensOf(renderedPiece.shine)
      }
      surface?.destroy()
      surface = undefined
    }

    async function start() {
      try {
        host = new PixiCanvasHost({
          app, container: stableContainer, canvasClassName: 'size-full touch-none', init: { background: CELL_BORDER_COLOR },
          onBeforeDestroy: cleanupCanvas,
          onReady: () => {
            surface = new GridSurface(app, { infinite: false, ...props.gridSize }, {
              width: app.screen.width, height: app.screen.height, cellSize: 56, fit: 'contain',
            }, { cellColor: CELL_FILL_COLOR, borderColor: CELL_BORDER_COLOR, backgroundColor: CELL_BORDER_COLOR, borderSize: 56 * 0.035, borderRadius: 0, gap: 0 })
            surface.layers.underPieces.addChild(boardGraphics, boardCells)
            surface.layers.pieces.addChild(piecesLayer)
            surface.layers.overlay.addChild(keyboardFocusGraphic)
            app.stage.addChild(surface.root)
            app.canvas.tabIndex = 0
            app.canvas.setAttribute('aria-label', 'Cascade board. Hold Shift and use arrow keys to focus unlocked pieces. Press Space while holding Shift to select. Release Shift to move and drop the falling piece.')
            app.ticker.add(update)
            window.addEventListener('keydown', handleKeyDown)
            window.addEventListener('keyup', handleKeyUp)
            window.addEventListener('blur', endKeyboardFocus)
            document.addEventListener('visibilitychange', handleVisibilityChange)
            detachInput = attachGridInput(app.canvas, {
              enabled: () => !isPaused,
              cellAt: (event) => surface!.pointerToCell(event),
              threshold: SWIPE_THRESHOLD,
              horizontalSteps: true,
              callbacks: {
                onPointerDown: () => app.canvas.focus({ preventScroll: true }),
                onCellTap: ({ column, row }) => togglePieceSelectionAt(column, row),
                onSwipeLeft: ({ steps }) => moveFromSwipe(-1, steps),
                onSwipeRight: ({ steps }) => moveFromSwipe(1, steps),
                onSwipeDown: dropActivePiece,
              },
            })
          },
          onResize: resize,
        })
        if (await host.start()) notifyStats()
      } catch (error) {
        if (!disposed) console.error('Could not initialize the Cascade canvas.', error)
      }
    }

    void start()

    return () => {
      disposed = true
      host?.destroy()
    }
  }, [props.cornerDifficulty, props.cornerSpawnMode, props.getFallIntervalMs, props.gridSize.columns, props.gridSize.rows, props.maxConsecutiveSameCorner, props.scorePointsPerLine, props.scorePointsPerLockedCorneromino])

  return <div className="size-full" ref={containerRef} />
})
