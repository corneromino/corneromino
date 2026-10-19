import { useEffect, useRef } from 'react'
import { Application, Graphics } from 'pixi.js'
import { GAME_COLORS } from '@/rendering/colors'
import { drawCellBody, drawCornerMarker, getCornerMarkerPosition } from '@/rendering/grid/drawCorneromino'
import { GridSurface } from '@/rendering/grid/GridSurface'
import { attachGridInput } from '@/rendering/grid/gridInput'
import { PixiCanvasHost } from '@/rendering/pixi/PixiCanvasHost'
import { getVsNextTurnPreviewCells, getVsTargetedCells, VS_PLAYERS, type VsLocalGameState, type VsPlayerId } from './vsLocalGame'

const TARGET_DOT_RADIUS_RATIO = 0.18
const TARGET_DOT_ALPHA = 0.5

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
    borderSize: 1.5,
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
    let surface: GridSurface | undefined
    let detachInput: (() => void) | undefined
    const draw = () => {
      if (!surface) return
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
      const pending = gameRef.current.pendingPlacement
      if (pending) drawPlacement(pieces, surface, pending.column, pending.row, pending.corner, true)
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
          borderSize: 1.5,
          borderRadius: cellSize * 0.02,
          gap: 0,
        })
        surface.layers.pieces.addChild(pieces)
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
          borderSize: 1.5,
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
      surface?.destroy()
      host.destroy()
    }
  }, [])

  return <div className="size-full" ref={containerRef} />
}
