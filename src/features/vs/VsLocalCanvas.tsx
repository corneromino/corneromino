import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Text } from 'pixi.js'
import { gsap } from 'gsap'
import { ShockwaveFilter } from 'pixi-filters'
import { GAME_COLORS } from '@/rendering/colors'
import { drawCellBody, drawCornerMarker, getCornerMarkerPosition } from '@/rendering/grid/drawCorneromino'
import { GridSurface } from '@/rendering/grid/GridSurface'
import { attachGridInput } from '@/rendering/grid/gridInput'
import { PixiCanvasHost } from '@/rendering/pixi/PixiCanvasHost'
import { getVsNextTurnPreviewCells, getVsTargetedCells, VS_PLAYERS, type VsLocalGameState, type VsPlayerId } from './vsLocalGame'
import { getVsLockedShapeBridges } from './vsLockedShapeBridges'
import { CASCADE_LOCK_EFFECTS } from '@/features/cascade/cascadeEffects'
import { VS_LOCAL_DEFAULT_BOARD_SIZE } from './vsLocalConfig'
import { getVsBaseCellColor, isVsCheckerboardCell, VS_CHECKERBOARD_CELL_COLOR } from './vsCheckerboard'

const TARGET_DOT_RADIUS_RATIO = 0.15
const TARGET_DOT_ALPHA = 0.5
const NEXT_OPPONENT_PREVIEW_ALPHA = 0.32
const CELL_BORDER_SIZE = 1.5
const COORDINATE_FONT_SIZE = 24
const SELECTED_CELL_COLOR = 0x5fc47a

interface CoordinateLabel {
  kind: 'column' | 'row'
  index: number
  text: Text
  backgroundColor?: number
}

interface VsLocalCanvasProps {
  game: VsLocalGameState
  onCellTap: (column: number, row: number) => void
}

function drawPlacement(graphics: Graphics, surface: GridSurface, column: number, row: number, corner: number, pending: boolean, lockedBy?: VsPlayerId, selectedColor?: number) {
  const screenPosition = surface.cellToScreen(column, row)
  const { cellHeight, cellWidth } = surface.metrics
  const { x, y } = screenPosition
  const width = cellWidth
  const height = cellHeight
  const cellSize = Math.min(width, height)
  drawCellBody(graphics, x, y, width, height, {
    fillColor: selectedColor ?? (pending ? GAME_COLORS.cornerMarker : lockedBy === undefined ? getVsBaseCellColor(column, row) : VS_PLAYERS[lockedBy].lockedColor),
    borderColor: GAME_COLORS.cellBorder,
    borderSize: CELL_BORDER_SIZE,
    // Match Normal mode: a cell radius is 2% of its size.
    borderRadius: cellSize * 0.02,
  })
  const marker = {
    size: width * 0.45,
    paddingX: Math.max(3, width * 0.12),
    paddingY: Math.max(3, height * 0.12),
    radius: width * 0.45 * 0.1,
  }
  const position = getCornerMarkerPosition(corner, width, height, marker)
  drawCornerMarker(graphics, x + position.x, y + position.y, { ...marker, color: pending ? GAME_COLORS.cellFill : GAME_COLORS.cornerMarker })
}

export function VsLocalCanvas(props: VsLocalCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef(props.game)
  const onCellTapRef = useRef(props.onCellTap)
  const drawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    gameRef.current = props.game
    drawRef.current?.()
  }, [props.game])

  useEffect(() => {
    onCellTapRef.current = props.onCellTap
  }, [props.onCellTap])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let disposed = false

    const app = new Application()
    const pieces = new Graphics()
    const checkerboard = new Graphics()
    const lockImpactLayer = new Container()
    const coordinateLabels: CoordinateLabel[] = []
    let surface: GridSurface | undefined
    let detachInput: (() => void) | undefined
    let previousGame: VsLocalGameState | undefined
    let previousLockedCellKeys = new Set<string>()
    const lockWaves = new Set<ShockwaveFilter>()
    const gridShakeMotion = { time: 0 }
    const impactMotions = new Set<{ time: number }>()
    const boardSize = gameRef.current.boardSize ?? VS_LOCAL_DEFAULT_BOARD_SIZE

    function drawCheckerboard() {
      if (!surface) return
      checkerboard.clear()
      const { cellHeight, cellWidth } = surface.metrics
      const border = CELL_BORDER_SIZE
      const radius = Math.max(0, Math.min(cellWidth, cellHeight) * 0.02 - border)
      for (let row = 0; row < boardSize; row += 1) {
        for (let column = 0; column < boardSize; column += 1) {
          if (!isVsCheckerboardCell(column, row)) continue
          const { x, y } = surface.cellToScreen(column, row)
          checkerboard.roundRect(x + border, y + border, cellWidth - border * 2, cellHeight - border * 2, radius).fill(VS_CHECKERBOARD_CELL_COLOR)
        }
      }
    }

    function drawCoordinates() {
      if (!surface) return
      const game = gameRef.current
      // Player 1 sits above the board. Coordinates stay fixed while the axis
      // labels rotate and move to the player-facing edge.
      const facingTop = game.activePlayer === 0
      const { cellWidth, cellHeight } = surface.metrics
      const cellSize = Math.min(cellWidth, cellHeight)
      const inset = Math.min(4, Math.max(2, cellSize * 0.1))
      const fontSize = Math.min(10, Math.max(6, cellSize * 0.19))
      const placements = new Map(game.placedCornerominoes.map((cell) => [`${cell.column},${cell.row}`, cell]))

      for (const label of coordinateLabels) {
        const column = label.kind === 'column' ? label.index : facingTop ? boardSize - 1 : 0
        const row = label.kind === 'row' ? label.index : facingTop ? 0 : boardSize - 1
        const { x, y } = surface.cellToScreen(column, row)
        const upperLeft = label.kind === 'row' ? !facingTop : facingTop
        label.text.position.set(
          x + (upperLeft ? inset : cellWidth - inset),
          y + (upperLeft ? inset : cellHeight - inset),
        )
        label.text.rotation = facingTop ? Math.PI : 0
        label.text.scale.set(fontSize / COORDINATE_FONT_SIZE)

        const pending = game.pendingPlacement?.column === column && game.pendingPlacement.row === row
        const owner = placements.get(`${column},${row}`)?.lockedBy
        const backgroundColor = pending ? GAME_COLORS.cornerMarker : owner === undefined ? getVsBaseCellColor(column, row) : VS_PLAYERS[owner].lockedColor
        if (label.backgroundColor !== backgroundColor) {
          label.backgroundColor = backgroundColor
          label.text.style.fill = pending ? GAME_COLORS.cellFill : GAME_COLORS.ink
          // A fine, cell-coloured outline keeps the small labels readable even
          // when a corner marker passes underneath them.
          label.text.style.stroke = { color: backgroundColor, width: 2.5 }
        }
      }
    }

    function clearLockEffects() {
      gsap.killTweensOf(gridShakeMotion)
      app.stage.position.set(0, 0)
      for (const motion of impactMotions) gsap.killTweensOf(motion)
      impactMotions.clear()
      for (const child of lockImpactLayer.removeChildren()) child.destroy()
      for (const wave of lockWaves) {
        gsap.killTweensOf(wave)
        wave.destroy()
      }
      lockWaves.clear()
      app.stage.filters = []
    }

    function playGridShake() {
      const config = CASCADE_LOCK_EFFECTS.gridShake
      if (!config.enabled || config.durationSeconds <= 0 || !surface) return
      gsap.killTweensOf(gridShakeMotion)
      app.stage.position.set(0, 0)
      gridShakeMotion.time = 0
      const amplitude = Math.min(surface.metrics.cellWidth, surface.metrics.cellHeight) * config.amplitudeCells
      gsap.to(gridShakeMotion, {
        duration: config.durationSeconds,
        ease: 'none',
        time: config.durationSeconds,
        onUpdate: () => {
          const fade = (1 - gridShakeMotion.time / config.durationSeconds) ** 2
          const phase = gridShakeMotion.time * config.frequencyHz * Math.PI * 2
          app.stage.position.set(Math.sin(phase) * amplitude * fade, Math.sin(phase * 1.3) * amplitude * fade * 0.6)
        },
        onComplete: () => app.stage.position.set(0, 0),
      })
    }

    function playLockRipple(lockedCellKeys: readonly string[]) {
      const config = CASCADE_LOCK_EFFECTS.ripple
      if (!config.enabled || !surface || lockedCellKeys.length === 0) return
      const { cellHeight, cellWidth, offsetX, offsetY } = surface.metrics
      const cells = lockedCellKeys.map((key) => key.split(',').map(Number))
      const center = cells.reduce((total, [column, row]) => ({
        x: total.x + offsetX + (column! + 0.5) * cellWidth,
        y: total.y + offsetY + (row! + 0.5) * cellHeight,
      }), { x: 0, y: 0 })
      const cellSize = Math.min(cellWidth, cellHeight)
      const wave = new ShockwaveFilter({
        amplitude: cellSize * config.amplitudeCells,
        brightness: config.brightness,
        center: { x: center.x / cells.length, y: center.y / cells.length },
        radius: cellSize * config.radiusCells,
        speed: cellSize * config.speedCellsPerSecond,
        wavelength: cellSize * config.wavelengthCells,
      })
      wave.resolution = 'inherit'
      lockWaves.add(wave)
      app.stage.filters = [...lockWaves]
      gsap.to(wave, {
        amplitude: 0,
        brightness: 1,
        duration: config.durationSeconds,
        ease: 'none',
        time: config.durationSeconds,
        onComplete: () => {
          lockWaves.delete(wave)
          app.stage.filters = [...lockWaves]
          wave.destroy()
        },
      })
    }

    function playLockedCellImpacts(lockedCellKeys: readonly string[]) {
      const config = CASCADE_LOCK_EFFECTS.shakeDrop
      if (!config.enabled || config.durationSeconds <= 0 || !surface) return
      const placements = new Map(gameRef.current.placedCornerominoes.map((placement) => [`${placement.column},${placement.row}`, placement]))
      const amplitude = Math.min(surface.metrics.cellWidth, surface.metrics.cellHeight) * config.amplitudeCells
      for (const key of lockedCellKeys) {
        const placement = placements.get(key)
        if (!placement) continue
        const impact = new Graphics()
        drawPlacement(impact, surface, placement.column, placement.row, placement.corner, false, placement.lockedBy)
        lockImpactLayer.addChild(impact)
        const motion = { time: 0 }
        impactMotions.add(motion)
        gsap.to(motion, {
          duration: config.durationSeconds,
          ease: 'none',
          time: config.durationSeconds,
          onUpdate: () => {
            const fade = (1 - motion.time / config.durationSeconds) ** 2
            const phase = motion.time * config.frequencyHz * Math.PI * 2
            impact.position.set(Math.sin(phase) * amplitude * fade, Math.sin(phase * 1.3) * amplitude * fade * 0.6)
          },
          onComplete: () => {
            impactMotions.delete(motion)
            impact.destroy()
          },
        })
      }
    }

    const draw = () => {
      if (!surface) return
      const game = gameRef.current
      const confirmedMove = previousGame
        && game.history.positions !== previousGame.history.positions
        && game.history.index === previousGame.history.index + 1
        && game.placedCornerominoes.length === previousGame.placedCornerominoes.length + 1
      if (previousGame && game.history !== previousGame.history && !confirmedMove) clearLockEffects()
      pieces.clear()
      const previewCells = getVsNextTurnPreviewCells(gameRef.current)
      for (const cell of previewCells) {
        const { x, y } = surface.cellToScreen(cell.column, cell.row)
        const { cellHeight, cellWidth } = surface.metrics
        const inset = 1.5
        const radius = Math.min(cellWidth, cellHeight) * 0.02
        pieces.roundRect(x + inset, y + inset, cellWidth - inset * 2, cellHeight - inset * 2, Math.max(0, radius - inset)).fill({ color: GAME_COLORS.cornerMarker, alpha: NEXT_OPPONENT_PREVIEW_ALPHA })
      }
      for (const cell of getVsTargetedCells(gameRef.current)) {
        const { x, y } = surface.cellToScreen(cell.column, cell.row)
        const { cellHeight, cellWidth } = surface.metrics
        pieces.circle(x + cellWidth / 2, y + cellHeight / 2, Math.min(cellWidth, cellHeight) * TARGET_DOT_RADIUS_RATIO).fill({ color: GAME_COLORS.cornerMarker, alpha: TARGET_DOT_ALPHA })
      }
      const selectedCellKeys = new Set(game.selectedCellKeys)
      for (const placement of gameRef.current.placedCornerominoes) {
        const selected = selectedCellKeys.has(`${placement.column},${placement.row}`)
        drawPlacement(pieces, surface, placement.column, placement.row, placement.corner, false, placement.lockedBy, selected ? SELECTED_CELL_COLOR : undefined)
      }
      // Draw joins after all bodies so neighbouring cell borders cannot cover them.
      for (const bridge of getVsLockedShapeBridges(gameRef.current.lockedCornerominoes, surface.metrics, CELL_BORDER_SIZE)) {
        pieces.rect(bridge.x, bridge.y, bridge.width, bridge.height).fill(VS_PLAYERS[bridge.player].lockedColor)
      }
      const pending = gameRef.current.pendingPlacement
      if (pending) drawPlacement(pieces, surface, pending.column, pending.row, pending.corner, true)
      drawCoordinates()
      const lockedCellKeys = new Set(gameRef.current.placedCornerominoes
        .filter((placement) => placement.lockedBy !== undefined)
        .map((placement) => `${placement.column},${placement.row}`))
      const newlyLockedCellKeys = [...lockedCellKeys].filter((key) => !previousLockedCellKeys.has(key))
      if (confirmedMove && newlyLockedCellKeys.length > 0) {
        playGridShake()
        playLockRipple(newlyLockedCellKeys)
        playLockedCellImpacts(newlyLockedCellKeys)
      }
      previousLockedCellKeys = lockedCellKeys
      previousGame = game
    }
    drawRef.current = draw

    function cleanupCanvas() {
      drawRef.current = null
      detachInput?.()
      detachInput = undefined
      clearLockEffects()
      surface?.destroy()
      surface = undefined
    }

    const host = new PixiCanvasHost({
      app,
      container,
      canvasClassName: 'size-full touch-manipulation',
      init: { background: GAME_COLORS.cellBorder },
      onBeforeDestroy: cleanupCanvas,
      onReady: () => {
        const cellSize = Math.min(app.screen.width / boardSize, app.screen.height / boardSize)
        surface = new GridSurface(app, { infinite: false, columns: boardSize, rows: boardSize }, {
          width: app.screen.width,
          height: app.screen.height,
          cellSize,
          fit: 'contain',
        }, {
          cellColor: GAME_COLORS.cellFill,
          borderColor: GAME_COLORS.cellBorder,
          backgroundColor: GAME_COLORS.cellBorder,
          borderSize: CELL_BORDER_SIZE,
          borderRadius: cellSize * 0.02,
          gap: 0,
        })
        surface.layers.underPieces.addChild(checkerboard)
        surface.layers.pieces.addChild(pieces)
        surface.layers.effects.addChild(lockImpactLayer)
        // One in-cell number per row and letter per column, reused on redraw.
        for (const kind of ['row', 'column'] as const) {
          for (let index = 0; index < boardSize; index += 1) {
            const text = new Text({
              text: kind === 'column' ? String.fromCharCode(65 + index) : String(index),
              resolution: Math.max(2, app.renderer.resolution),
              style: { fontFamily: 'Pixform', fontSize: COORDINATE_FONT_SIZE, fontWeight: '700', fill: GAME_COLORS.ink },
            })
            const upperLeft = kind === 'row'
            text.anchor.set(upperLeft ? 0 : 1, upperLeft ? 0 : 1)
            text.alpha = 0.52
            text.eventMode = 'none'
            coordinateLabels.push({ kind, index, text })
            surface.layers.overlay.addChild(text)
          }
        }
        app.stage.addChild(surface.root)
        drawCheckerboard()
        detachInput = attachGridInput(app.canvas, {
          cellAt: (event) => surface!.pointerToCell(event),
          callbacks: { onCellTap: ({ column, row }) => onCellTapRef.current(column, row) },
        })
        draw()
      },
      onResize: (pixiApp) => {
        const cellSize = Math.min(pixiApp.screen.width / boardSize, pixiApp.screen.height / boardSize)
        surface?.update({ width: pixiApp.screen.width, height: pixiApp.screen.height, cellSize, fit: 'contain' }, {
          cellColor: GAME_COLORS.cellFill,
          borderColor: GAME_COLORS.cellBorder,
          backgroundColor: GAME_COLORS.cellBorder,
          borderSize: CELL_BORDER_SIZE,
          borderRadius: cellSize * 0.02,
          gap: 0,
        })
        drawCheckerboard()
        draw()
      },
    })

    void host.start().catch((error: unknown) => {
      if (!disposed) console.error('Could not initialize the local VS canvas.', error)
    })
    return () => {
      disposed = true
      host.destroy()
    }
  }, [])

  return <div className="size-full" ref={containerRef} />
}
