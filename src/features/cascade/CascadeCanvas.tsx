import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { gsap } from 'gsap'
import { ShockwaveFilter } from 'pixi-filters'
import { CASCADE_LOCK_EFFECTS } from './cascadeEffects'
import { saveCascadeGameState, type CascadeGameSaveState } from '@/lib/db'
import { advanceCascadeGame, createCascadeGame, dropCascadePiece, getCascadeLandingRow, isValidCascadeLockSelection, moveCascadePiece, resolveCascadeLockedRows, type CascadeCorner, type CascadeCornerSpawnMode, type CascadeGameState, type CascadeGridSize } from './cascadeGame'

const CELL_FILL_COLOR = 0xffd18a
const CELL_BORDER_COLOR = 0x773526
const CORNER_MARKER_COLOR = 0x713324
const SWIPE_THRESHOLD = 36
const SELECTED_Y_OFFSET = -2
const SELECTED_ROTATION = -0.04
const SELECTED_SCALE = 0.92
const MAX_SELECTED_PIECES = 4
const CELL_MOVE_DURATION_SECONDS = 0.14
const SELECTION_DURATION_SECONDS = 0.14
const LOCKED_CELL_COLORS = [0x55c7df, 0x8270d8, 0xbe69d6, 0xde5d9b, 0xe4555c, 0x5fc47a, 0x4db9a7, 0x73a9ee, 0x9d71dc, 0x41ead4, 0x0b987e]

interface CascadeCanvasProps {
  cornerSpawnMode: CascadeCornerSpawnMode
  fallIntervalMs: number
  gridSize: CascadeGridSize
  initialState: CascadeGameSaveState | null
  onStatsChange: (stats: { destroyedLineCount: number; lockedCornerominoCount: number; upcomingCorners: CascadeCorner[] }) => void
}

export interface CascadeCanvasHandle {
  exportDebugState: () => string
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
  const markerSize = cellSize / 2
  const padding = cellSize * 0.16
  const markerX = corner === 1 || corner === 2 ? cellSize - padding - markerSize : padding
  const markerY = corner === 2 || corner === 3 ? cellSize - padding - markerSize : padding

  if (lockedColor !== undefined) {
    graphics
      .rect(borderWidth / 2, borderWidth / 2, cellSize - borderWidth, cellSize - borderWidth)
      .fill({ color: lockedColor })
    graphics.rect(markerX, markerY, markerSize, markerSize).fill({ color: CORNER_MARKER_COLOR })
    return
  }

  const pieceColor = isSelected ? invertColor(CORNER_MARKER_COLOR) : CORNER_MARKER_COLOR
  const detailColor = isSelected ? invertColor(CELL_FILL_COLOR) : CELL_FILL_COLOR

  graphics.rect(0, 0, cellSize, cellSize).fill({ color: pieceColor })

  const insideBorderInset = borderWidth * 1.5
  graphics
    .rect(insideBorderInset, insideBorderInset, cellSize - insideBorderInset * 2, cellSize - insideBorderInset * 2)
    .stroke({ color: detailColor, width: borderWidth })

  graphics.rect(markerX, markerY, markerSize, markerSize).fill({ color: detailColor })
}

export const CascadeCanvas = forwardRef<CascadeCanvasHandle, CascadeCanvasProps>(function CascadeCanvas(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const exportDebugStateRef = useRef<(() => string) | null>(null)

  useImperativeHandle(ref, () => ({
    exportDebugState: () => {
      if (!exportDebugStateRef.current) throw new Error('Cascade canvas is not ready.')
      return exportDebugStateRef.current()
    },
  }), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const stableContainer: HTMLDivElement = container

    const app = new Application()
    const gridShakeMotion = { time: 0 }
    const boardGraphics = new Graphics()
    const boardCells = new Container()
    const cellGraphics = new Map<string, Graphics>()
    const shakes = new Map<Container, { time: number }>()
    const piecesLayer = new Container()
    piecesLayer.sortableChildren = true
    const renderedPieces = new Map<string, RenderedPiece>()
    const selectedPieceKeys = new Set(props.initialState?.selectedPieceKeys ?? [])
    const lockedPieces = props.initialState?.lockedPieces
      ?? (props.initialState?.lockedPieceColors ?? []).map((piece) => ({ ...piece, groupId: `legacy:${piece.cellKey}` }))
    const lockedPieceColors = new Map(lockedPieces.map((piece) => [piece.cellKey, piece.color]))
    const lockedPieceGroupIds = new Map(lockedPieces.map((piece) => [piece.cellKey, piece.groupId]))
    let destroyedLineCount = props.initialState?.destroyedLineCount ?? 0
    let lockedCornerominoCount = props.initialState?.lockedCornerominoCount ?? lockedPieceColors.size
    const lockWaves = new Set<ShockwaveFilter>()
    let disposed = false
    let initialized = false
    let gameState: CascadeGameState = props.initialState?.gameState ?? createCascadeGame()
    let elapsedSinceFall = props.initialState?.elapsedSinceFall ?? props.fallIntervalMs
    let swipeStart: { x: number; y: number } | null = null
    let horizontalSwipePosition = 0
    let hasMovedHorizontally = false

    function getPieceKey(column: number, row: number): string {
      return `${column},${row}`
    }

    for (const pieceKey of lockedPieceColors.keys()) {
      selectedPieceKeys.delete(pieceKey)
    }

    function persistGameState() {
      const state: CascadeGameSaveState = {
        destroyedLineCount,
        elapsedSinceFall,
        gameState,
        lockedCornerominoCount,
        lockedPieces: [...lockedPieceColors].map(([cellKey, color]) => ({ cellKey, color, groupId: lockedPieceGroupIds.get(cellKey) ?? `legacy:${cellKey}` })),
        selectedPieceKeys: [...selectedPieceKeys],
      }
      void saveCascadeGameState(state)
    }

    exportDebugStateRef.current = () => JSON.stringify({
      config: {
        cornerSpawnMode: props.cornerSpawnMode,
        fallIntervalMs: props.fallIntervalMs,
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
      selectedPieceKeys: [...selectedPieceKeys],
      version: 1,
    }, null, 2)

    function notifyStats() {
      props.onStatsChange({
        destroyedLineCount,
        lockedCornerominoCount,
        upcomingCorners: [...(gameState.upcomingCorners ?? [])],
      })
    }

    function getBoardMetrics(): BoardMetrics {
      const cellSize = Math.min(app.renderer.width / props.gridSize.columns, app.renderer.height / props.gridSize.rows)
      return {
        borderWidth: Math.max(1, cellSize * 0.035),
        cellSize,
        offsetX: (app.renderer.width - cellSize * props.gridSize.columns) / 2,
        offsetY: (app.renderer.height - cellSize * props.gridSize.rows) / 2,
      }
    }

    function drawBoard() {
      const { borderWidth, cellSize, offsetX, offsetY } = getBoardMetrics()
      const landingRow = getCascadeLandingRow(gameState, props.gridSize)
      const landingColumn = gameState.activePiece?.column
      boardGraphics.clear()
      boardGraphics.rect(0, 0, app.renderer.width, app.renderer.height).fill({ color: CELL_BORDER_COLOR })

      for (let row = 0; row < props.gridSize.rows; row += 1) {
        for (let column = 0; column < props.gridSize.columns; column += 1) {
          const x = offsetX + column * cellSize
          const y = offsetY + row * cellSize
          const key = getPieceKey(column, row)
          let cell = cellGraphics.get(key)
          if (!cell) {
            cell = new Graphics()
            cellGraphics.set(key, cell)
            boardCells.addChild(cell)
          }
          cell.clear()
          cell
            .rect(x + borderWidth / 2, y + borderWidth / 2, cellSize - borderWidth, cellSize - borderWidth)
            .fill({ color: column === landingColumn && row === landingRow ? 0xffffff : CELL_FILL_COLOR })
            .stroke({ color: CELL_BORDER_COLOR, width: borderWidth })
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

      renderedPiece.shineMask
        .rect(borderWidth / 2, borderWidth / 2, cellSize - borderWidth, cellSize - borderWidth)
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
      gsap.killTweensOf(renderedPiece.sprite)
      gsap.killTweensOf(renderedPiece.graphic)
      gsap.killTweensOf(renderedPiece.graphic.scale)
      gsap.killTweensOf(renderedPiece.shine)
      renderedPiece.sprite.destroy({ children: true })
    }

    function applyGravityMoves(gravityMoves: ReadonlyArray<{ fromCellKey: string; toCellKey: string }>) {
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
      const width = stableContainer.clientWidth
      const height = stableContainer.clientHeight
      if (width === 0 || height === 0) return
      app.renderer.resize(width, height)
      drawBoard()
      syncPieces(false)
    }

    function update(ticker: { deltaMS: number }) {
      elapsedSinceFall += ticker.deltaMS
      while (elapsedSinceFall >= props.fallIntervalMs) {
        elapsedSinceFall -= props.fallIntervalMs
        setGameState(advanceCascadeGame(gameState, props.gridSize, Math.random, props.cornerSpawnMode))
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowDown') return

      event.preventDefault()
      setGameState(
        event.key === 'ArrowDown'
          ? dropCascadePiece(gameState, props.gridSize)
          : moveCascadePiece(gameState, props.gridSize, event.key === 'ArrowLeft' ? -1 : 1),
      )
    }

    function handlePointerDown(event: PointerEvent) {
      swipeStart = { x: event.clientX, y: event.clientY }
      horizontalSwipePosition = event.clientX
      hasMovedHorizontally = false
      app.canvas.setPointerCapture(event.pointerId)
    }

    function handlePointerMove(event: PointerEvent) {
      if (!swipeStart) return

      const totalDeltaX = event.clientX - swipeStart.x
      const totalDeltaY = event.clientY - swipeStart.y
      if (Math.abs(totalDeltaX) <= Math.abs(totalDeltaY)) return

      const deltaX = event.clientX - horizontalSwipePosition
      const steps = Math.floor(Math.abs(deltaX) / SWIPE_THRESHOLD)
      if (steps === 0) return

      const direction = deltaX < 0 ? -1 : 1
      for (let step = 0; step < steps; step += 1) {
        setGameState(moveCascadePiece(gameState, props.gridSize, direction))
      }
      horizontalSwipePosition += direction * steps * SWIPE_THRESHOLD
      hasMovedHorizontally = true
    }

    function handlePointerUp(event: PointerEvent) {
      if (!swipeStart) return

      const deltaX = event.clientX - swipeStart.x
      const deltaY = event.clientY - swipeStart.y
      swipeStart = null
      if (app.canvas.hasPointerCapture(event.pointerId)) app.canvas.releasePointerCapture(event.pointerId)
      if (!hasMovedHorizontally && deltaY >= SWIPE_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
        setGameState(dropCascadePiece(gameState, props.gridSize))
        return
      }

      if (!hasMovedHorizontally && Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) {
        togglePieceSelection(event)
      }
    }

    function togglePieceSelection(event: PointerEvent) {
      const bounds = app.canvas.getBoundingClientRect()
      const canvasX = (event.clientX - bounds.left) * (app.renderer.width / bounds.width)
      const canvasY = (event.clientY - bounds.top) * (app.renderer.height / bounds.height)
      const { cellSize, offsetX, offsetY } = getBoardMetrics()
      const column = Math.floor((canvasX - offsetX) / cellSize)
      const row = Math.floor((canvasY - offsetY) / cellSize)
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
      destroyedLineCount += new Set(resolution.clearedCellKeys.map((cellKey) => cellKey.split(',')[1])).size
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

    function playGridShake() {
      const config = CASCADE_LOCK_EFFECTS.gridShake
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
        const piece = renderedPieces.get(key)
        if (piece) targets.push(piece.shakeLayer)
        for (const target of targets) {
          const previous = shakes.get(target)
          if (previous) gsap.killTweensOf(previous)
          target.position.set(0, 0)
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
              target.position.set(Math.sin(phase) * amplitude * fade, Math.sin(phase * 1.3) * amplitude * fade * 0.6)
            },
            onComplete: () => {
              target.position.set(0, 0)
              shakes.delete(target)
            },
          })
        }
      }
    }

    function handlePointerCancel(event: PointerEvent) {
      swipeStart = null
      if (app.canvas.hasPointerCapture(event.pointerId)) app.canvas.releasePointerCapture(event.pointerId)
    }

    const resizeObserver = new ResizeObserver(resize)

    async function start() {
      await app.init({
        antialias: true,
        autoDensity: true,
        background: CELL_BORDER_COLOR,
        height: Math.max(1, stableContainer.clientHeight),
        resolution: window.devicePixelRatio,
        width: Math.max(1, stableContainer.clientWidth),
      })
      initialized = true
      if (disposed) {
        app.destroy(true)
        return
      }

      app.stage.addChild(boardGraphics, boardCells, piecesLayer)
      stableContainer.appendChild(app.canvas)
      app.canvas.className = 'size-full touch-none'
      resizeObserver.observe(stableContainer)
      app.ticker.add(update)
      window.addEventListener('keydown', handleKeyDown)
      app.canvas.addEventListener('pointerdown', handlePointerDown)
      app.canvas.addEventListener('pointermove', handlePointerMove)
      app.canvas.addEventListener('pointerup', handlePointerUp)
      app.canvas.addEventListener('pointercancel', handlePointerCancel)
      resize()
      notifyStats()
    }

    void start()

    return () => {
      disposed = true
      exportDebugStateRef.current = null
      resizeObserver.disconnect()
      window.removeEventListener('keydown', handleKeyDown)
      if (initialized) {
        gsap.killTweensOf(gridShakeMotion)
        for (const motion of shakes.values()) gsap.killTweensOf(motion)
        shakes.clear()
        for (const wave of lockWaves) {
          gsap.killTweensOf(wave)
          wave.destroy()
        }
        lockWaves.clear()
        app.stage.filters = []
        app.ticker.remove(update)
        app.canvas.removeEventListener('pointerdown', handlePointerDown)
        app.canvas.removeEventListener('pointermove', handlePointerMove)
        app.canvas.removeEventListener('pointerup', handlePointerUp)
        app.canvas.removeEventListener('pointercancel', handlePointerCancel)
        for (const renderedPiece of renderedPieces.values()) {
          gsap.killTweensOf(renderedPiece.sprite)
          gsap.killTweensOf(renderedPiece.graphic)
          gsap.killTweensOf(renderedPiece.graphic.scale)
          gsap.killTweensOf(renderedPiece.shine)
        }
        app.destroy(true)
      }
    }
  }, [props.cornerSpawnMode, props.fallIntervalMs, props.gridSize.columns, props.gridSize.rows])

  return <div className="size-full" ref={containerRef} />
})
