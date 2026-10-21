import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
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

const TARGET_DOT_RADIUS_RATIO = 0.25
const TARGET_DOT_ALPHA = 0.5
const CELL_BORDER_SIZE = 1.5

interface VsLocalCanvasProps {
  game: VsLocalGameState
  onCellTap: (column: number, row: number) => void
}

function drawPlacement(graphics: Graphics, surface: GridSurface, column: number, row: number, corner: number, pending: boolean, lockedBy?: VsPlayerId) {
  const { x, y } = surface.cellToScreen(column, row)
  const { cellHeight, cellWidth } = surface.metrics
  const cellSize = Math.min(cellWidth, cellHeight)
  drawCellBody(graphics, x, y, cellWidth, cellHeight, {
    fillColor: pending ? GAME_COLORS.cornerMarker : lockedBy === undefined ? GAME_COLORS.cellFill : VS_PLAYERS[lockedBy].lockedColor,
    borderColor: GAME_COLORS.cellBorder,
    borderSize: CELL_BORDER_SIZE,
    // Match Normal mode: a cell radius is 2% of its size.
    borderRadius: cellSize * 0.02,
  })
  const marker = {
    size: cellWidth * 0.45,
    paddingX: Math.max(3, cellWidth * 0.12),
    paddingY: Math.max(3, cellHeight * 0.12),
    radius: cellWidth * 0.45 * 0.1,
  }
  const position = getCornerMarkerPosition(corner, cellWidth, cellHeight, marker)
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

    const app = new Application()
    const pieces = new Graphics()
    const lockImpactLayer = new Container()
    let surface: GridSurface | undefined
    let detachInput: (() => void) | undefined
    let previousGame: VsLocalGameState | undefined
    let previousLockedCellKeys = new Set<string>()
    const lockWaves = new Set<ShockwaveFilter>()
    const gridShakeMotion = { time: 0 }
    const impactMotions = new Set<{ time: number }>()

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
        pieces.roundRect(x + inset, y + inset, cellWidth - inset * 2, cellHeight - inset * 2, Math.max(0, radius - inset)).fill({ color: GAME_COLORS.cornerMarker, alpha: 0.18 })
      }
      for (const cell of getVsTargetedCells(gameRef.current)) {
        const { x, y } = surface.cellToScreen(cell.column, cell.row)
        const { cellHeight, cellWidth } = surface.metrics
        pieces.circle(x + cellWidth / 2, y + cellHeight / 2, Math.min(cellWidth, cellHeight) * TARGET_DOT_RADIUS_RATIO).fill({ color: GAME_COLORS.cornerMarker, alpha: TARGET_DOT_ALPHA })
      }
      for (const placement of gameRef.current.placedCornerominoes) {
        drawPlacement(pieces, surface, placement.column, placement.row, placement.corner, false, placement.lockedBy)
      }
      // Draw joins after all bodies so neighbouring cell borders cannot cover them.
      for (const bridge of getVsLockedShapeBridges(gameRef.current.lockedCornerominoes, surface.metrics, CELL_BORDER_SIZE)) {
        pieces.rect(bridge.x, bridge.y, bridge.width, bridge.height).fill(VS_PLAYERS[bridge.player].lockedColor)
      }
      const pending = gameRef.current.pendingPlacement
      if (pending) drawPlacement(pieces, surface, pending.column, pending.row, pending.corner, true)
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

    const host = new PixiCanvasHost({
      app,
      container,
      canvasClassName: 'size-full touch-manipulation',
      init: { background: GAME_COLORS.cellBorder },
      onReady: () => {
        const cellSize = Math.min(app.screen.width / 10, app.screen.height / 10)
        surface = new GridSurface(app, { infinite: false, columns: 10, rows: 10 }, {
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
        surface.layers.pieces.addChild(pieces)
        surface.layers.effects.addChild(lockImpactLayer)
        app.stage.addChild(surface.root)
        detachInput = attachGridInput(app.canvas, {
          cellAt: (event) => surface!.pointerToCell(event),
          callbacks: { onCellTap: ({ column, row }) => onCellTapRef.current(column, row) },
        })
        draw()
      },
      onResize: (pixiApp) => {
        const cellSize = Math.min(pixiApp.screen.width / 10, pixiApp.screen.height / 10)
        surface?.update({ width: pixiApp.screen.width, height: pixiApp.screen.height, cellSize, fit: 'contain' }, {
          cellColor: GAME_COLORS.cellFill,
          borderColor: GAME_COLORS.cellBorder,
          backgroundColor: GAME_COLORS.cellBorder,
          borderSize: CELL_BORDER_SIZE,
          borderRadius: cellSize * 0.02,
          gap: 0,
        })
        draw()
      },
    })

    void host.start()
    return () => {
      drawRef.current = null
      detachInput?.()
      clearLockEffects()
      surface?.destroy()
      host.destroy()
    }
  }, [])

  return <div className="size-full" ref={containerRef} />
}
