import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Application, Container, Graphics, Rectangle, Sprite, Text, TextStyle } from 'pixi.js'
import { GridSurface } from '@/rendering/grid/GridSurface'
import { getLockRippleCenter } from '@/rendering/grid/lockRipple'
import { getExpandedCanvasOffset } from './gridCanvasAlignment'
import { GridLockedShine } from '@/rendering/grid/GridLockedShine'
import { GridVerificationWave } from '@/rendering/grid/GridVerificationWave'
import { GridVerificationFlip } from '@/rendering/grid/GridVerificationFlip'
import type { VerificationRequest } from '@/rendering/grid/verificationEffect'
import { getCellShakeOffset } from '@/rendering/grid/cellShake'
import { PixiCanvasHost } from '@/rendering/pixi/PixiCanvasHost'
import { CanvasStartupError } from '@/rendering/pixi/CanvasStartupError'
import { VhsCrtEffect, type VhsCrtEffectConfig } from '@/rendering/pixi/VhsCrtEffect'
import { InfiniteExitDistortionEffect, type InfiniteExitDistortionConfig } from '@/rendering/pixi/InfiniteExitDistortionEffect'
import { GAME_COLORS } from '@/rendering/colors'
import { attachGridInput, type GridCellEvent } from '@/rendering/grid/gridInput'
import { constrainGridView, createGridNavigation, type GridView } from '@/rendering/grid/gridNavigation'
import { drawCellBody, drawCornerMarker, getCornerMarkerPosition } from '@/rendering/grid/drawMarkedCell'
import { drawGridFrame } from '@/rendering/grid/drawGridFrame'
import { getGridCornerSquircleRadius, getGridSquircleRadius } from '@/rendering/grid/gridSquircle'
import { CELL_CORNERS, CLASSIC_VERIFICATION_EFFECT, SELECTED_CELL_SCALE, VERIFICATION_FLIP_BATCH_SIZE, VERIFICATION_FLIP_DURATION_MS } from '@/game/gameConfig'
import { ShockwaveFilter } from 'pixi-filters'
import { gsap } from 'gsap'
import type { CellMarkerColor, GameConfig, LockedCellGroup, PlacedTetromino } from '@/game/gameConfig'
import { CASCADE_LOCK_EFFECTS } from '@/features/cascade/cascadeEffects'
import { collectExitedInfiniteCells, pruneReportedInfiniteCells, type ClassicInfiniteCellExit } from './classicInfiniteCellExit'

export interface ScrollingGridViewport {
  firstRow: number
  visibleRows: number
  getOffsetRows: () => number
  advance: (deltaMs: number) => void
}

interface GameGridCanvasProps {
  config: GameConfig
  /** Opacity of board cells that do not belong to a shape, from 0 to 1. Defaults to 1. */
  emptyCellOpacity?: number
  /** Opacity of borders around cells that do not belong to a shape, from 0 to 1. Defaults to 1. */
  emptyCellBorderOpacity?: number
  interactive?: boolean
  /** Allow a navigable board to draw across the viewport behind the game UI. */
  expandViewport?: boolean
  /** Fade the expanded viewport at its vertical edges. Defaults to true. */
  edgeFadeEnabled?: boolean
  lockedCellGroups: readonly LockedCellGroup[]
  markers: ReadonlyMap<string, CellMarkerColor>
  onToggle: (cellKey: string, timeStamp: number) => void
  onLongPress?: (cellKey: string) => void
  onNavigate?: () => void
  /** Fires after the first board frame is rendered, or the canvas fails to start. */
  onReady?: () => void
  pieces: readonly PlacedTetromino[]
  /** Unconfirmed authored cells. These deliberately have no corner marker. */
  temporaryCellKeys?: readonly string[]
  selectedCellKeys: ReadonlySet<string>
  selectedLockedGroupId: string | null
  /** Create mode uses colors to distinguish authored shapes; gameplay does not. */
  showAuthoredPieceColors?: boolean
  showCellIds: boolean
  /** Whether corner markers are shown on shape cells. Defaults to true. */
  showCornerMarkers?: boolean
  scrolling?: ScrollingGridViewport
  onCellExit?: (event: ClassicInfiniteCellExit) => void
  vhsCrt?: VhsCrtEffectConfig
  exitDistortion?: InfiniteExitDistortionConfig
  verificationRequest?: VerificationRequest
  /** Reverse a retained Flip result back to its original board faces. */
  verificationRestoring?: boolean
  verificationPaused?: boolean
  onVerificationComplete?: (id: number) => void
  onVerificationRestored?: (id: number) => void
}

export interface GameGridCanvasHandle {
  /** Gameplay previews omit editor-only authored colors and unfinished cells. */
  captureBoard: (options?: { gameplayPreview?: boolean }) => HTMLCanvasElement | null
  clientToCell: (point: { clientX: number; clientY: number }) => { column: number; row: number } | null
  resetView: () => void
}

const BOARD_COLOR = GAME_COLORS.cellBorder
const CELL_COLOR = GAME_COLORS.cellFill
const OUTLINE_COLOR = GAME_COLORS.cornerMarker
const TEXT_COLOR = GAME_COLORS.ink
/** Retains the existing 1.5px border at a 50px cell while scaling dense boards down. */
const CELL_BORDER_RATIO = 0.04
/** Note-outline stroke thickness as a fraction of the smaller cell dimension. */
const NOTE_OUTLINE_THICKNESS_RATIO = 0.1
/** Outer radius of the note ring; kept independent from the shallow cell radius. */
const NOTE_OUTLINE_CORNER_RADIUS_RATIO = 0.1
/** Pulses per second for noted cells. Set to 0 for a static white outline. */
const NOTE_OUTLINE_BEAT_FREQUENCY_HZ = 1.5
/** Smallest scale reached by a pulsing note outline. */
const NOTE_OUTLINE_MIN_SCALE = 0.9
/** Largest scale reached by a pulsing note outline. */
const NOTE_OUTLINE_MAX_SCALE = 1
/** Opacity of white note outlines. */
const NOTE_OUTLINE_OPACITY = 0.9
const NOTE_OUTLINE_COLOR = 0xffffff
/** Dense boards can zoom until a cell reaches this comfortable interaction size. */
const NAVIGATION_TARGET_CELL_SIZE_PX = 160
const MINIMUM_MAX_ZOOM = 4

function drawNoteOutline(graphics: Graphics, width: number, height: number) {
  const thickness = Math.max(1, Math.min(width, height) * NOTE_OUTLINE_THICKNESS_RATIO)
  const outerRadius = Math.max(thickness, Math.min(width, height) * NOTE_OUTLINE_CORNER_RADIUS_RATIO)
  const innerRadius = Math.max(0, outerRadius - thickness)
  // Filling a ring instead of stroking a shallow rounded rectangle avoids the
  // overlapping stroke geometry that caused spikes at the inner corners.
  graphics.roundRect(0, 0, width, height, outerRadius).fill(NOTE_OUTLINE_COLOR)
  graphics.roundRect(thickness, thickness, width - thickness * 2, height - thickness * 2, innerRadius).cut()
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

function createPieceMap(pieces: readonly PlacedTetromino[]): Map<string, PlacedTetromino> {
  return new Map(pieces.flatMap((piece) => piece.cells.map((cell) => [cellKey(cell.x, cell.y), piece])))
}

function createLockedCellMap(groups: readonly LockedCellGroup[]): Map<string, LockedCellGroup> {
  return new Map(groups.flatMap((group) => group.cellKeys.map((key) => [key, group])))
}

function lockedColorToNumber(color: string): number {
  const match = color.match(/#([\da-f]{6})/i)
  return match ? Number.parseInt(match[1]!, 16) : CELL_COLOR
}

function getEmptyCellOpacity(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}

export const GameGridCanvas = forwardRef<GameGridCanvasHandle, GameGridCanvasProps>(function GameGridCanvas(props, ref) {
  const [startupFailed, setStartupFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const boardBoundsRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const boardRef = useRef<Container | null>(null)
  const drawRef = useRef<() => void>(() => undefined)
  const previousLockedCellKeysRef = useRef<Set<string>>(new Set())
  const previousSelectedKeysRef = useRef<Set<string>>(new Set())
  const propsRef = useRef(props)
  const navigationRef = useRef<ReturnType<typeof createGridNavigation> | null>(null)
  const captureRef = useRef<GameGridCanvasHandle['captureBoard']>(() => null)
  const clientToCellRef = useRef<GameGridCanvasHandle['clientToCell']>(() => null)
  const resetViewRef = useRef<() => void>(() => undefined)
  propsRef.current = props
  const expanded = props.expandViewport === true && !props.scrolling && props.config.navigationEnabled !== false
  const longPressEnabled = props.onLongPress !== undefined

  useImperativeHandle(ref, () => ({
    captureBoard: (options) => captureRef.current(options),
    clientToCell: (point) => clientToCellRef.current(point),
    resetView: () => resetViewRef.current(),
  }), [])

  useEffect(() => {
    if (props.interactive === false) navigationRef.current?.reset()
  }, [props.interactive])

  useEffect(() => {
    drawRef.current()
  }, [props.config, props.emptyCellBorderOpacity, props.emptyCellOpacity, props.exitDistortion, props.lockedCellGroups, props.markers, props.pieces, props.selectedCellKeys, props.selectedLockedGroupId, props.showAuthoredPieceColors, props.showCellIds, props.showCornerMarkers, props.scrolling, props.temporaryCellKeys, props.vhsCrt, props.verificationRequest])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const stableContainer: HTMLDivElement = container
    const boardBounds = boardBoundsRef.current!
    setStartupFailed(false)

    const app = new Application()
    const board = new Container()
    const lockedShine = new GridLockedShine(board)
    let surface: GridSurface | undefined
    let host: PixiCanvasHost | undefined
    let detachInput: (() => void) | undefined
    board.sortableChildren = true
    let disposed = false
    let reportedReady = false
    let cellShakeLayers = new Map<string, Container>()
    let emptyCellSprites = new Map<Container, Sprite>()
    let noteOutlines: Graphics[] = []
    const gridShakeMotion = { time: 0, x: 0, y: 0 }
    const lockWaves = new Map<ShockwaveFilter, { x: number; y: number }[]>()
    let surfaceOrigin = { x: 0, y: 0 }
    let vhsCrtEffect: VhsCrtEffect | undefined
    let previousVhsCrtConfig: VhsCrtEffectConfig | undefined
    let exitDistortionEffect: InfiniteExitDistortionEffect | undefined
    let previousExitDistortionConfig: InfiniteExitDistortionConfig | undefined
    const cellShakeMotions = new Set<{ time: number }>()
    const reportedExitedCellKeys = new Set<string>()
    let view: GridView = { zoom: 1, offsetX: 0, offsetY: 0 }
    let previousSize = { width: 0, height: 0, cellSize: 0 }
    let verificationAnimation: GridVerificationWave | GridVerificationFlip | undefined
    let verificationPhase: 'animating' | 'finished' | 'notified' | 'restoring' = 'animating'
    let verificationId: number | undefined
    let capturingGameplayPreview = false

    function boardSize() {
      return {
        height: Math.max(1, expanded ? boardBounds.clientHeight : app.screen.height),
        width: Math.max(1, expanded ? boardBounds.clientWidth : app.screen.width),
      }
    }

    function boardOrigin() {
      if (!expanded) return { x: 0, y: 0 }
      const boardRect = boardBounds.getBoundingClientRect()
      const canvasRect = app.canvas.getBoundingClientRect()
      return {
        x: (boardRect.left - canvasRect.left) * app.screen.width / canvasRect.width,
        y: (boardRect.top - canvasRect.top) * app.screen.height / canvasRect.height,
      }
    }

    function boardPoint(event: { clientX: number; clientY: number }) {
      const rect = app.canvas.getBoundingClientRect()
      const origin = boardOrigin()
      return {
        x: (event.clientX - rect.left) * app.screen.width / rect.width - origin.x,
        y: (event.clientY - rect.top) * app.screen.height / rect.height - origin.y,
      }
    }

    function maximumZoom() {
      const { columns, rows } = propsRef.current.config
      const { width, height } = boardSize()
      const fittedCellSize = Math.min(width / columns, height / rows)
      return Math.max(MINIMUM_MAX_ZOOM, NAVIGATION_TARGET_CELL_SIZE_PX / fittedCellSize)
    }

    function pointerToCell(event: { clientX: number; clientY: number }) {
      const point = boardPoint(event)
      return surface!.screenToCell(point.x, point.y)
    }

    function updateViewport() {
      if (!surface) return
      const { columns, rows } = propsRef.current.config
      const { width, height } = boardSize()
      surfaceOrigin = boardOrigin()
      updateSurfacePosition()
      const scrolling = propsRef.current.scrolling
      // Keep post-processing tied to the screen, not the long recycled world.
      app.stage.filterArea = scrolling || vhsCrtEffect || lockWaves.size ? app.screen : undefined
      const cellSize = scrolling ? width / columns : Math.min(width / columns, height / rows)
      view = scrolling
        ? { zoom: 1, offsetX: 0, offsetY: scrolling.getOffsetRows() * cellSize }
        : constrainGridView(view, { width, height }, { width: columns * cellSize, height: rows * cellSize })
      surface.update({ width, height, cellSize, fit: 'manual', ...view }, {
        cellColor: CELL_COLOR, borderColor: BOARD_COLOR, backgroundColor: BOARD_COLOR,
        backdropFollowsGrid: !scrolling,
        borderSize: cellSize * CELL_BORDER_RATIO, borderRadius: getGridSquircleRadius(cellSize), gap: 0,
        emptyCellBorderOpacity: getEmptyCellOpacity(propsRef.current.emptyCellBorderOpacity),
        emptyCellOpacity: getEmptyCellOpacity(propsRef.current.emptyCellOpacity),
      })
      updateSurfacePosition()
      // Empty cells temporarily use individual sprites while a nearby lock
      // shake is active. Keep those sprites on the replacement zoom texture
      // before Pixi renders again; GridSurface releases the old one on update.
      for (const tile of emptyCellSprites.values()) tile.texture = surface.texture
      board.position.set(view.offsetX, view.offsetY)
      board.scale.set(view.zoom)
      lockedShine.setBounds(columns * cellSize, (scrolling?.visibleRows ?? rows) * cellSize, cellSize)
      renderShine()
    }

    function renderShine() {
      // Flip hides the original locked-cell artwork, including its shine, but
      // the shared sweep must keep advancing beneath the colored backs. That
      // makes it reappear at its real in-flight position after the reverse flip.
      lockedShine.render(performance.now(), 0, propsRef.current.scrolling ? -view.offsetY : 0)
    }

    function updateSurfacePosition() {
      if (!surface) return
      surface.root.position.set(surfaceOrigin.x + gridShakeMotion.x, surfaceOrigin.y + gridShakeMotion.y)
      for (const [wave, cells] of lockWaves) {
        wave.center = getLockRippleCenter(surface.metrics, surface.root.position, cells)
      }
    }

    function updateStageFilters() {
      // Shockwave centers are canvas-relative, so keep its filter frame fixed
      // even when a zoomed board extends past the visible canvas.
      app.stage.filterArea = propsRef.current.scrolling || vhsCrtEffect || lockWaves.size ? app.screen : undefined
      app.stage.filters = [...lockWaves.keys(), ...(exitDistortionEffect ? [exitDistortionEffect.filter] : []), ...(vhsCrtEffect?.filters ?? [])]
    }

    function syncExitDistortionEffect() {
      const config = propsRef.current.exitDistortion
      const visibleRows = propsRef.current.scrolling?.visibleRows
      if (config !== undefined && config === previousExitDistortionConfig && exitDistortionEffect) {
        if (visibleRows !== undefined) exitDistortionEffect.configure(config, visibleRows)
        return
      }
      previousExitDistortionConfig = config
      if (config?.enabled && visibleRows !== undefined) {
        const activeConfig = config
        if (exitDistortionEffect) exitDistortionEffect.configure(activeConfig, visibleRows)
        else exitDistortionEffect = new InfiniteExitDistortionEffect(activeConfig, visibleRows)
      } else {
        exitDistortionEffect?.destroy()
        exitDistortionEffect = undefined
      }
      updateStageFilters()
    }

    function syncVhsCrtEffect() {
      const config = propsRef.current.vhsCrt
      if (config === previousVhsCrtConfig) return
      previousVhsCrtConfig = config
      if (config?.enabled) {
        if (vhsCrtEffect) vhsCrtEffect.configure(config)
        else vhsCrtEffect = new VhsCrtEffect(config)
      } else {
        app.stage.filters = [...lockWaves.keys()]
        vhsCrtEffect?.destroy()
        vhsCrtEffect = undefined
      }
      updateStageFilters()
    }

    function stopViewportEffects() {
      gsap.killTweensOf(gridShakeMotion)
      gridShakeMotion.x = 0
      gridShakeMotion.y = 0
      updateSurfacePosition()
      // Detach filters before destroying their GPU resources. Zoom/pan can
      // interrupt a ripple mid-frame, when leaving a destroyed filter on the
      // stage causes Pixi to access a null texture source.
      app.stage.filters = []
      for (const wave of lockWaves.keys()) {
        gsap.killTweensOf(wave)
        wave.destroy()
      }
      lockWaves.clear()
      updateStageFilters()
    }

    function resize() {
      const { width, height } = boardSize()
      const cellSize = Math.min(width / propsRef.current.config.columns, height / propsRef.current.config.rows)
      if (previousSize.cellSize > 0) {
        // Keep the same board location at the viewport center on orientation/size changes.
        const scale = cellSize / previousSize.cellSize
        view.offsetX = width / 2 - (previousSize.width / 2 - view.offsetX) * scale
        view.offsetY = height / 2 - (previousSize.height / 2 - view.offsetY) * scale
      }
      previousSize = { width, height, cellSize }
      navigationRef.current?.reset()
      stopViewportEffects()
      draw()
      if (!reportedReady && surface) {
        app.render()
        reportedReady = true
        propsRef.current.onReady?.()
      }
    }

    function stopCellAnimations() {
      for (const motion of cellShakeMotions) gsap.killTweensOf(motion)
      cellShakeMotions.clear()
      for (const child of board.children) {
        gsap.killTweensOf(child)
        gsap.killTweensOf(child.scale)
      }
    }

    function draw() {
      if (disposed || !appRef.current || !boardRef.current) return
      const current = propsRef.current
      syncExitDistortionEffect()
      syncVhsCrtEffect()
      if (current.scrolling) pruneReportedInfiniteCells(reportedExitedCellKeys, current.pieces)
      updateViewport()
      // Draw in fitted-board coordinates; navigation only transforms the container.
        const cellWidth = surface!.metrics.cellWidth / view.zoom
        const cellHeight = surface!.metrics.cellHeight / view.zoom
        const cellSize = Math.min(cellWidth, cellHeight)
      const pieceMap = createPieceMap(current.pieces)
      const temporaryCellKeys = new Set(capturingGameplayPreview ? [] : current.temporaryCellKeys)
      const lockedCellMap = createLockedCellMap(current.lockedCellGroups)
      const nextLockedCellKeys = new Set(lockedCellMap.keys())
      const isBoardFullyLocked = !current.scrolling && pieceMap.size > 0 && [...pieceMap.keys()].every((key) => lockedCellMap.has(key))
      const nextSelectedKeys = new Set<string>()
      const newlyLockedCellKeys: string[] = []

      verificationAnimation?.clearCells()
      stopCellAnimations()
      lockedShine.clearCells()
      for (const child of board.removeChildren()) {
        child.destroy({ children: true })
      }
      cellShakeLayers = new Map()
        emptyCellSprites = new Map()
        noteOutlines = []

        // The classic frame belongs to the transformed board so it pans and
        // zooms with the cells instead of remaining fixed in the DOM.
        if (!current.scrolling) {
          const cellBorderSize = cellSize * CELL_BORDER_RATIO
          const boardWidth = current.config.columns * cellWidth
          const boardHeight = current.config.rows * cellHeight
          const boardOutline = new Graphics()
          drawGridFrame(boardOutline, boardWidth, boardHeight, cellBorderSize, getGridSquircleRadius(cellWidth, cellHeight), BOARD_COLOR)
          boardOutline.alpha = getEmptyCellOpacity(current.emptyCellBorderOpacity)
          // Cover the outer half of edge-cell faces.
          boardOutline.zIndex = 0.5
          board.addChild(boardOutline)
        }

        const firstRow = current.scrolling?.firstRow ?? 0
      for (let y = firstRow; y < firstRow + current.config.rows; y += 1) {
        for (let x = 0; x < current.config.columns; x += 1) {
          const key = cellKey(x, y)
          const piece = pieceMap.get(key)
          const temporary = temporaryCellKeys.has(key)
          const cell = piece?.cells.find((item) => item.x === x && item.y === y)
          const lockedGroup = lockedCellMap.get(key)
          const selected = current.selectedCellKeys.has(key) || lockedGroup?.id === current.selectedLockedGroupId
          if (selected) nextSelectedKeys.add(key)
          const isNewlyLocked = lockedGroup !== undefined && !previousLockedCellKeysRef.current.has(key)
          if (isNewlyLocked) newlyLockedCellKeys.push(key)
          const isNewlySelected = selected && !previousSelectedKeysRef.current.has(key)
          const isNewlyDeselected = !selected && previousSelectedKeysRef.current.has(key)
          const cellContainer = new Container()
          const shakeLayer = new Container()
          cellContainer.addChild(shakeLayer)
          cellShakeLayers.set(key, shakeLayer)
          cellContainer.zIndex = selected ? 1 : 0
          cellContainer.position.set(x * cellWidth, y * cellHeight)

          if (!cell && !temporary && !lockedGroup && !selected && !current.markers.has(key)) {
            // The repeated texture draws empty cells. A hidden tile is used
            // only when a nearby lock effect shakes this individual cell.
            const tile = new Sprite(surface!.texture)
            tile.width = cellWidth
            tile.height = cellHeight
            tile.visible = false
            shakeLayer.addChild(tile)
            emptyCellSprites.set(shakeLayer, tile)
            board.addChild(cellContainer)
            continue
          }

          if (selected) {
            cellContainer.pivot.set(cellWidth / 2, cellHeight / 2)
            const centerX = x * cellWidth + cellWidth / 2
            const centerY = y * cellHeight + cellHeight / 2
            cellContainer.position.set(centerX, centerY)
            if (!isNewlySelected) cellContainer.scale.set(SELECTED_CELL_SCALE)
          } else if (isNewlyLocked) {
            cellContainer.pivot.set(cellWidth / 2, cellHeight / 2)
            cellContainer.position.set(x * cellWidth + cellWidth / 2, y * cellHeight + cellHeight / 2)
            cellContainer.scale.set(0.75)
          } else if (isNewlyDeselected) {
            const centerX = x * cellWidth + cellWidth / 2
            const centerY = y * cellHeight + cellHeight / 2
            cellContainer.pivot.set(cellWidth / 2, cellHeight / 2)
            cellContainer.position.set(centerX, centerY)
            cellContainer.scale.set(SELECTED_CELL_SCALE)
          }

          const borderSize = cellSize * CELL_BORDER_RATIO
          const radius = getGridSquircleRadius(cellWidth, cellHeight)
          const returningToBoard = isNewlyDeselected && !isNewlyLocked
          let selectionBacking: Graphics | undefined
          if (selected || returningToBoard) {
            selectionBacking = new Graphics()
            selectionBacking.roundRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight, radius).fill(BOARD_COLOR)
            selectionBacking.zIndex = selected ? 0.9 : 0
            board.addChild(selectionBacking)
          }
          const fillColor = selected ? BOARD_COLOR : lockedGroup ? lockedColorToNumber(lockedGroup.color) : temporary ? OUTLINE_COLOR : !capturingGameplayPreview && current.showAuthoredPieceColors && piece?.color ? lockedColorToNumber(piece.color) : CELL_COLOR
          const cellGraphic = new Graphics();
          drawCellBody(cellGraphic, 0, 0, cellWidth, cellHeight, {
            fillColor,
            borderColor: selected ? fillColor : BOARD_COLOR,
            borderSize: selected || returningToBoard ? 0 : borderSize,
            borderRadius: radius
          });
          shakeLayer.addChild(cellGraphic);
          let returningBorder: Graphics | undefined
          if (returningToBoard) {
            returningBorder = new Graphics()
            returningBorder.roundRect(0, 0, cellWidth, cellHeight, radius).fill(BOARD_COLOR)
            returningBorder.roundRect(borderSize, borderSize, cellWidth - borderSize * 2, cellHeight - borderSize * 2, Math.max(0, radius - borderSize)).cut()
            returningBorder.alpha = 0
            shakeLayer.addChild(returningBorder)
          }

          if (lockedGroup && !selected) {
            lockedShine.setCell(shakeLayer, cellWidth, cellHeight, borderSize)
          }

          if (current.showCellIds && piece) {
            const label = new Text({
              text: `#${piece.id}`,
              style: new TextStyle({ fill: TEXT_COLOR, fontFamily: 'Pixform', fontSize: Math.max(8, cellSize * 0.27), fontWeight: '700' }),
            })
            label.anchor.set(0.5)
            label.position.set(cellWidth / 2, cellHeight / 2)
            shakeLayer.addChild(label)
          }

            if (cell && current.showCornerMarkers !== false) {
              const markerSize = cellWidth * 0.45
              const offsetX = cellWidth * 0.12
              const offsetY = cellHeight * 0.12
            const style = { color: selected ? CELL_COLOR : OUTLINE_COLOR, size: markerSize, paddingX: offsetX, paddingY: offsetY, radius: getGridCornerSquircleRadius(markerSize) }
            const position = getCornerMarkerPosition(CELL_CORNERS.indexOf(cell.corner), cellWidth, cellHeight, style)
            const markerGraphic = new Graphics()
            drawCornerMarker(markerGraphic, position.x, position.y, style)
            shakeLayer.addChild(markerGraphic)
          }

          if (current.markers.has(key)) {
            const noteGraphic = new Graphics()
            drawNoteOutline(noteGraphic, cellWidth, cellHeight)
            noteGraphic.pivot.set(cellWidth / 2, cellHeight / 2)
            noteGraphic.position.set(cellWidth / 2, cellHeight / 2)
            shakeLayer.addChild(noteGraphic)
            noteOutlines.push(noteGraphic)
          }

          board.addChild(cellContainer)

          if (isNewlyLocked) {
            gsap.to(cellContainer.scale, { duration: 0.28, ease: 'back.out(2)', x: 1, y: 1 })
          } else if (isNewlySelected) {
            gsap.to(cellContainer.scale, { duration: 0.15, ease: 'power2.out', x: SELECTED_CELL_SCALE, y: SELECTED_CELL_SCALE })
          } else if (isNewlyDeselected) {
            gsap.to(cellContainer.scale, {
              duration: 0.15, ease: 'power2.inOut', x: 1, y: 1,
              onUpdate: () => {
                if (returningBorder) returningBorder.alpha = SELECTED_CELL_SCALE === 1 ? 1 : Math.max(0, Math.min(1, (cellContainer.scale.x - SELECTED_CELL_SCALE) / (1 - SELECTED_CELL_SCALE)))
              },
              onComplete: () => { if (selectionBacking) selectionBacking.visible = false },
            })
          }
        }
      }
      previousLockedCellKeysRef.current = nextLockedCellKeys
      previousSelectedKeysRef.current = nextSelectedKeys
      // The final lock usually leads directly into verification, so its normal
      // ripple/shake is opt-in (the tutorial deliberately keeps it).
      if (newlyLockedCellKeys.length > 0 && (!isBoardFullyLocked || current.config.finalLockAnimationEnabled === true) && !current.verificationRequest) {
        playLockShake(newlyLockedCellKeys, cellSize)
        playGridShake(cellSize)
        playLockRipple(newlyLockedCellKeys, cellSize)
      }
      if (current.verificationRequest?.id !== verificationId) {
        verificationAnimation?.destroy()
        verificationAnimation = undefined
        verificationPhase = 'animating'
        verificationId = current.verificationRequest?.id
        if (current.verificationRequest) {
          stopViewportEffects()
          if ((current.config.verificationEffect ?? CLASSIC_VERIFICATION_EFFECT) === 'flip') {
            verificationAnimation = new GridVerificationFlip(current.verificationRequest, surface!.background, {
              durationMs: current.config.verificationFlipDurationMs ?? VERIFICATION_FLIP_DURATION_MS,
              batchSize: current.config.verificationFlipBatchSize ?? VERIFICATION_FLIP_BATCH_SIZE,
            })
          } else {
            verificationAnimation = new GridVerificationWave(current.verificationRequest, current.config.columns, CASCADE_LOCK_EFFECTS.completionShake)
            surface!.worldLayers.overlay.addChild(verificationAnimation.overlay)
          }
        }
      }
      if (current.verificationRestoring && verificationAnimation instanceof GridVerificationFlip && verificationPhase === 'notified') {
        verificationAnimation.reverse()
        verificationPhase = 'restoring'
      }
      // Refresh the front artwork before the flip captures and transforms it.
      lockedShine.render(performance.now(), 0, current.scrolling ? -view.offsetY : 0)
      if (verificationAnimation instanceof GridVerificationFlip) {
        verificationAnimation.setCells(cellShakeLayers, cellWidth, cellHeight, CELL_BORDER_RATIO, emptyCellSprites)
      } else {
        verificationAnimation?.setCells(cellShakeLayers.keys(), cellWidth, cellHeight, CELL_BORDER_RATIO)
      }
      renderShine()
    }

    function playGridShake(cellSize: number) {
      const config = CASCADE_LOCK_EFFECTS.gridShake
      gsap.killTweensOf(gridShakeMotion)
      // Shake the board inside the fixed filter frame, moving ripple centers with it.
      gridShakeMotion.x = 0
      gridShakeMotion.y = 0
      updateSurfacePosition()
      if (!config.enabled || config.durationSeconds <= 0) return

      gridShakeMotion.time = 0
      const amplitude = cellSize * view.zoom * config.amplitudeCells
      gsap.to(gridShakeMotion, {
        duration: config.durationSeconds,
        ease: 'none',
        time: config.durationSeconds,
        onUpdate: () => {
          const fade = (1 - gridShakeMotion.time / config.durationSeconds) ** 2
          const phase = gridShakeMotion.time * config.frequencyHz * Math.PI * 2
          gridShakeMotion.x = Math.sin(phase) * amplitude * fade
          gridShakeMotion.y = Math.sin(phase * 1.3) * amplitude * fade * 0.6
          updateSurfacePosition()
        },
        onComplete: () => {
          gridShakeMotion.x = 0
          gridShakeMotion.y = 0
          updateSurfacePosition()
        },
      })
    }

    function playLockShake(lockedCellKeys: readonly string[], cellSize: number) {
      const config = CASCADE_LOCK_EFFECTS.shake
      if (!config.enabled || config.radiusCells <= 0 || config.durationSeconds <= 0) return
      const lockedCells = lockedCellKeys.map((key) => key.split(',').map(Number))

      for (const [key, layer] of cellShakeLayers) {
        const [column, row] = key.split(',').map(Number)
        const distance = Math.min(...lockedCells.map(([lockedColumn, lockedRow]) => Math.hypot(column - lockedColumn!, row - lockedRow!)))
        if (distance === 0 || distance > config.radiusCells) continue
        const emptyTile = emptyCellSprites.get(layer)
        if (emptyTile) emptyTile.visible = true
        const motion = { time: 0 }
        cellShakeMotions.add(motion)
        gsap.killTweensOf(layer.position)
        layer.position.set(0, 0)
        const amplitude = cellSize * config.amplitudeCells * (1 - distance / (config.radiusCells + 1))
        gsap.to(motion, {
          delay: distance / Math.max(0.01, config.propagationCellsPerSecond),
          duration: config.durationSeconds,
          ease: 'none',
          time: config.durationSeconds,
          onUpdate: () => {
            const offset = getCellShakeOffset(motion.time, config.durationSeconds, amplitude, config.frequencyHz)
            layer.position.set(offset.x, offset.y)
          },
          onComplete: () => {
            layer.position.set(0, 0)
            if (emptyTile) emptyTile.visible = false
            cellShakeMotions.delete(motion)
          },
        })
      }
    }

    function playLockRipple(lockedCellKeys: readonly string[], cellSize: number) {
      const config = CASCADE_LOCK_EFFECTS.ripple
      if (!config.enabled) return
      const cells = lockedCellKeys.map((key) => {
        const [x, y] = key.split(',').map(Number)
        return { x: x!, y: y! }
      })
      const wave = new ShockwaveFilter({
        amplitude: cellSize * view.zoom * config.amplitudeCells,
        brightness: config.brightness,
        center: getLockRippleCenter(surface!.metrics, surface!.root.position, cells),
        radius: cellSize * view.zoom * config.radiusCells,
        speed: cellSize * view.zoom * config.speedCellsPerSecond,
        wavelength: cellSize * view.zoom * config.wavelengthCells,
      })
      // Filters default to a 1x render texture, which visibly downscales a
      // high-density board until the ripple is removed.
      wave.resolution = 'inherit'
      lockWaves.set(wave, cells)
      updateStageFilters()
      gsap.to(wave, {
        amplitude: 0,
        brightness: 1,
        duration: config.durationSeconds,
        ease: 'none',
        time: config.durationSeconds,
        onComplete: () => {
          lockWaves.delete(wave)
          updateStageFilters()
          wave.destroy()
        },
      })
    }

    function update() {
      if (verificationAnimation && verificationPhase !== 'notified' && !propsRef.current.verificationPaused && !document.hidden) {
        if (verificationPhase === 'restoring') {
          if (verificationAnimation.advance(app.ticker.deltaMS)) {
            const restoredId = verificationId!
            verificationAnimation.destroy()
            verificationAnimation = undefined
            propsRef.current.onVerificationRestored?.(restoredId)
          }
        } else if (verificationPhase === 'finished') {
          const completedId = verificationId!
          verificationPhase = 'notified'
          // Flip retains its backs until the owner clears the request on a board press.
          if (verificationAnimation instanceof GridVerificationWave) {
            verificationAnimation.destroy()
            verificationAnimation = undefined
          }
          propsRef.current.onVerificationComplete?.(completedId)
        } else if (verificationAnimation.advance(app.ticker.deltaMS)) {
          // Render the final frame before notifying the owner and opening its dialog.
          verificationPhase = 'finished'
        }
      }
      const noteOutlineScale = NOTE_OUTLINE_BEAT_FREQUENCY_HZ > 0
        ? NOTE_OUTLINE_MIN_SCALE + (NOTE_OUTLINE_MAX_SCALE - NOTE_OUTLINE_MIN_SCALE) * (0.5 + 0.5 * Math.sin(performance.now() / 1000 * NOTE_OUTLINE_BEAT_FREQUENCY_HZ * Math.PI * 2))
        : NOTE_OUTLINE_MAX_SCALE
      for (const outline of noteOutlines) {
        outline.alpha = NOTE_OUTLINE_OPACITY
        outline.scale.set(noteOutlineScale)
      }
      vhsCrtEffect?.advance(app.ticker.deltaMS, propsRef.current.interactive === false || document.hidden)
      const scrolling = propsRef.current.scrolling
      if (scrolling && surface) {
        if (propsRef.current.interactive !== false && !document.hidden) scrolling.advance(app.ticker.deltaMS)
        view.offsetY = scrolling.getOffsetRows() * surface.metrics.cellHeight
        surface.setOffset(0, view.offsetY)
        board.position.set(0, view.offsetY)
        if (lockWaves.size) updateSurfacePosition()
        const current = propsRef.current
        const exitedCells = collectExitedInfiniteCells({
          lockedCellGroups: current.lockedCellGroups,
          offsetRows: scrolling.getOffsetRows(),
          pieces: current.pieces,
          reportedCellKeys: reportedExitedCellKeys,
          selectedCellKeys: current.selectedCellKeys,
          selectedLockedGroupId: current.selectedLockedGroupId,
          visibleRows: scrolling.visibleRows,
        })
        for (const event of exitedCells) current.onCellExit?.(event)
      }
      renderShine()
    }

    function handleCellTap({ column: x, row: y, originalEvent }: GridCellEvent) {
      if (!surface!.contains(x, y) || x < 0 || x >= propsRef.current.config.columns) return
      propsRef.current.onToggle(cellKey(x, y), originalEvent.timeStamp)
    }

    drawRef.current = draw

    async function start() {
      host = new PixiCanvasHost({
        // Input styling belongs to the React host so it follows interactive
        // changes, including when a saved board finishes loading.
        app, container: stableContainer, canvasClassName: 'size-full',
        init: { backgroundAlpha: 0, preserveDrawingBuffer: true },
        onDestroy: destroy,
        onError: () => {
          setStartupFailed(true)
          propsRef.current.onReady?.()
        },
        onReady: () => {
          app.canvas.style.touchAction = 'inherit'
          appRef.current = app
          boardRef.current = board
          surface = new GridSurface(app, propsRef.current.scrolling ? { infinite: true } : { infinite: false, columns: propsRef.current.config.columns, rows: propsRef.current.config.rows }, {
            ...boardSize(),
            cellSize: Math.min(boardSize().width / propsRef.current.config.columns, boardSize().height / propsRef.current.config.rows), fit: 'stretch',
          }, { cellColor: CELL_COLOR, borderColor: BOARD_COLOR, backgroundColor: BOARD_COLOR, borderSize: Math.min(boardSize().width / propsRef.current.config.columns, boardSize().height / propsRef.current.config.rows) * CELL_BORDER_RATIO, borderRadius: getGridSquircleRadius(Math.min(boardSize().width / propsRef.current.config.columns, boardSize().height / propsRef.current.config.rows)), gap: 0 })
          surface.layers.pieces.addChild(board)
          app.stage.addChild(surface.root)
          clientToCellRef.current = pointerToCell
          resetViewRef.current = () => {
            navigationRef.current?.reset()
            stopViewportEffects()
            view = { zoom: 1, offsetX: 0, offsetY: 0 }
            updateViewport()
          }
          captureRef.current = (options) => {
            const savedView = view
            capturingGameplayPreview = options?.gameplayPreview === true
            verificationAnimation?.hide()
            try {
              view = { zoom: 1, offsetX: 0, offsetY: 0 }
              draw()
              const { height, width } = boardSize()
              // Extract in board-local coordinates rather than screen coordinates.
              surface!.root.position.set(0, 0)
              return app.renderer.extract.canvas({ target: surface!.root, frame: new Rectangle(0, 0, width, height) }) as HTMLCanvasElement
            } finally {
              capturingGameplayPreview = false
              view = savedView
              draw()
              verificationAnimation?.render()
            }
          }
          const navigation = propsRef.current.scrolling || propsRef.current.config.navigationEnabled === false ? null : createGridNavigation(app.canvas, {
            minZoom: 1, maxZoom: maximumZoom,
            getView: () => view,
            getSize: boardSize,
            getPoint: boardPoint,
            setView: (next) => { view = next; updateViewport() },
            onNavigate: () => { stopViewportEffects(); propsRef.current.onNavigate?.() },
            onTap: (originalEvent) => handleCellTap({ ...pointerToCell(originalEvent), originalEvent }),
          })
          navigationRef.current = navigation
          detachInput = attachGridInput(app.canvas, {
            enabled: () => propsRef.current.interactive !== false,
            gestures: navigation === null,
            cellAt: pointerToCell,
            callbacks: {
              ...(navigation?.callbacks ?? { onCellTap: handleCellTap }),
              ...(longPressEnabled ? { onCellLongPress: ({ column, row }: GridCellEvent) => {
                if (surface!.contains(column, row) && column >= 0 && column < propsRef.current.config.columns) {
                  propsRef.current.onLongPress?.(cellKey(column, row))
                }
              } } : {}),
            },
          })
          app.ticker.add(update)
        },
        onResize: resize,
      })
      await host.start()
    }

    function destroy() {
      disposed = true
      captureRef.current = () => null
      clientToCellRef.current = () => null
      resetViewRef.current = () => undefined
      appRef.current = null
      boardRef.current = null
      drawRef.current = () => undefined
      detachInput?.()
      navigationRef.current?.reset()
      navigationRef.current = null
      app.ticker?.remove(update)
      verificationAnimation?.destroy()
      stopCellAnimations()
      stopViewportEffects()
      app.stage.filters = []
      vhsCrtEffect?.destroy()
      exitDistortionEffect?.destroy()
      lockedShine.destroy()
      surface?.destroy()
      if (!board.destroyed) board.destroy({ children: true })
    }

    // Align to the page's local viewport so its own entrance transition cannot
    // shift the board outside the canvas while the grid is sliding into place.
    function alignCanvas() {
      if (!expanded) return
      const rect = boardBounds.getBoundingClientRect()
      const transform = entrance ? getComputedStyle(entrance).transform : 'none'
      const matrix = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform) : null
      const pageRect = boardBounds.closest('.app-page')?.getBoundingClientRect()
      const offset = getExpandedCanvasOffset(rect, { x: matrix?.m41 ?? 0, y: matrix?.m42 ?? 0 }, pageRect)
      stableContainer.style.left = `${offset.left}px`
      stableContainer.style.top = `${offset.top}px`
      if (appRef.current) resize()
    }
    const boardObserver = expanded ? new ResizeObserver(alignCanvas) : undefined
    boardObserver?.observe(boardBounds)
    const entrance = expanded ? boardBounds.closest('.game-grid-entrance') : null
    entrance?.addEventListener('animationend', alignCanvas)
    if (expanded) window.addEventListener('resize', alignCanvas)
    alignCanvas()
    void start()
    return () => {
      boardObserver?.disconnect()
      entrance?.removeEventListener('animationend', alignCanvas)
      window.removeEventListener('resize', alignCanvas)
      host?.destroy()
    }
  }, [props.config.columns, props.config.rows, props.config.navigationEnabled, expanded, longPressEnabled])

  return <div className={expanded ? 'relative size-full' : 'relative size-full overflow-hidden'} ref={boardBoundsRef}>
    <div className={`${props.interactive === false ? 'pointer-events-none' : 'touch-none'} absolute ${expanded ? 'game-grid-expanded-viewport h-[var(--app-height)] w-screen' : 'inset-0 overflow-hidden'}`} data-edge-fade={props.edgeFadeEnabled !== false ? 'true' : undefined} ref={containerRef}>
      {startupFailed && <CanvasStartupError />}
    </div>
  </div>
})
