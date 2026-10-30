import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Application, Container, Graphics, Rectangle, Sprite, Text, TextStyle } from 'pixi.js'
import { GridSurface } from '@/rendering/grid/GridSurface'
import { GridVerificationWave, type VerificationWaveRequest } from '@/rendering/grid/GridVerificationWave'
import { getCellShakeOffset } from '@/rendering/grid/cellShake'
import { PixiCanvasHost } from '@/rendering/pixi/PixiCanvasHost'
import { CanvasStartupError } from '@/rendering/pixi/CanvasStartupError'
import { VhsCrtEffect, type VhsCrtEffectConfig } from '@/rendering/pixi/VhsCrtEffect'
import { InfiniteExitDistortionEffect, type InfiniteExitDistortionConfig } from '@/rendering/pixi/InfiniteExitDistortionEffect'
import { GAME_COLORS } from '@/rendering/colors'
import { attachGridInput, type GridCellEvent } from '@/rendering/grid/gridInput'
import { constrainGridView, createGridNavigation, type GridView } from '@/rendering/grid/gridNavigation'
import { drawCellBody, drawCornerMarker, getCornerMarkerPosition } from '@/rendering/grid/drawCorneromino'
import { CELL_CORNERS } from '@/game/gameConfig'
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
  interactive?: boolean
  lockedCellGroups: readonly LockedCellGroup[]
  markers: ReadonlyMap<string, CellMarkerColor>
  onToggle: (cellKey: string, timeStamp: number) => void
  onNavigate?: () => void
  pieces: readonly PlacedTetromino[]
  selectedCellKeys: ReadonlySet<string>
  selectedLockedGroupId: string | null
  showCellIds: boolean
  scrolling?: ScrollingGridViewport
  onCellExit?: (event: ClassicInfiniteCellExit) => void
  vhsCrt?: VhsCrtEffectConfig
  exitDistortion?: InfiniteExitDistortionConfig
  verificationWave?: VerificationWaveRequest
  verificationPaused?: boolean
  onVerificationComplete?: (id: number) => void
}

export interface GameGridCanvasHandle {
  captureBoard: () => HTMLCanvasElement | null
  resetView: () => void
}

const BOARD_COLOR = GAME_COLORS.cellBorder
const CELL_COLOR = GAME_COLORS.cellFill
const OUTLINE_COLOR = GAME_COLORS.cornerMarker
const TEXT_COLOR = GAME_COLORS.ink
/** Retains the existing 1.5px border at a 50px cell while scaling dense boards down. */
const CELL_BORDER_RATIO = 0.04
const MARKER_COLORS: Record<CellMarkerColor, number> = { black: GAME_COLORS.ink, white: GAME_COLORS.markerWhite }

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

export const GameGridCanvas = forwardRef<GameGridCanvasHandle, GameGridCanvasProps>(function GameGridCanvas(props, ref) {
  const [startupFailed, setStartupFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const boardRef = useRef<Container | null>(null)
  const drawRef = useRef<() => void>(() => undefined)
  const previousLockedCellKeysRef = useRef<Set<string>>(new Set())
  const previousSelectedKeysRef = useRef<Set<string>>(new Set())
  const propsRef = useRef(props)
  const navigationRef = useRef<ReturnType<typeof createGridNavigation> | null>(null)
  const captureRef = useRef<GameGridCanvasHandle['captureBoard']>(() => null)
  const resetViewRef = useRef<() => void>(() => undefined)
  propsRef.current = props

  useImperativeHandle(ref, () => ({ captureBoard: () => captureRef.current(), resetView: () => resetViewRef.current() }), [])

  useEffect(() => {
    if (props.interactive === false) navigationRef.current?.reset()
  }, [props.interactive])

  useEffect(() => {
    drawRef.current()
  }, [props.config, props.exitDistortion, props.lockedCellGroups, props.markers, props.pieces, props.selectedCellKeys, props.selectedLockedGroupId, props.showCellIds, props.scrolling, props.vhsCrt, props.verificationWave])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const stableContainer: HTMLDivElement = container
    setStartupFailed(false)

    const app = new Application()
    const board = new Container()
    let surface: GridSurface | undefined
    let host: PixiCanvasHost | undefined
    let detachInput: (() => void) | undefined
    board.sortableChildren = true
    let disposed = false
    let shineLayers: Array<{ layer: Container; size: number }> = []
    let cellShakeLayers = new Map<string, Container>()
    let emptyCellSprites = new Map<Container, Sprite>()
    const gridShakeMotion = { time: 0 }
    const lockWaves = new Set<ShockwaveFilter>()
    let vhsCrtEffect: VhsCrtEffect | undefined
    let previousVhsCrtConfig: VhsCrtEffectConfig | undefined
    let exitDistortionEffect: InfiniteExitDistortionEffect | undefined
    let previousExitDistortionConfig: InfiniteExitDistortionConfig | undefined
    const cellShakeMotions = new Set<{ time: number }>()
    const reportedExitedCellKeys = new Set<string>()
    let view: GridView = { zoom: 1, offsetX: 0, offsetY: 0 }
    let previousSize = { width: 0, height: 0, cellSize: 0 }
    let verificationWave: GridVerificationWave | undefined
    let verificationId: number | undefined

    function updateViewport() {
      if (!surface) return
      const { columns, rows } = propsRef.current.config
      const { width, height } = app.screen
      const scrolling = propsRef.current.scrolling
      // Keep post-processing tied to the screen, not the long recycled world.
      app.stage.filterArea = scrolling || vhsCrtEffect ? app.screen : undefined
      const cellSize = scrolling ? width / columns : Math.min(width / columns, height / rows)
      view = scrolling
        ? { zoom: 1, offsetX: 0, offsetY: scrolling.getOffsetRows() * cellSize }
        : constrainGridView(view, { width, height }, { width: columns * cellSize, height: rows * cellSize })
      surface.update({ width, height, cellSize, fit: 'manual', ...view }, {
        cellColor: CELL_COLOR, borderColor: BOARD_COLOR, backgroundColor: BOARD_COLOR,
        borderSize: cellSize * CELL_BORDER_RATIO, borderRadius: cellSize * 0.02, gap: 0,
      })
      // Empty cells temporarily use individual sprites while a nearby lock
      // shake is active. Keep those sprites on the replacement zoom texture
      // before Pixi renders again; GridSurface releases the old one on update.
      for (const tile of emptyCellSprites.values()) tile.texture = surface.texture
      board.position.set(view.offsetX, view.offsetY)
      board.scale.set(view.zoom)
    }

    function updateStageFilters() {
      app.stage.filters = [...lockWaves, ...(exitDistortionEffect ? [exitDistortionEffect.filter] : []), ...(vhsCrtEffect?.filters ?? [])]
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
        app.stage.filters = [...lockWaves]
        vhsCrtEffect?.destroy()
        vhsCrtEffect = undefined
      }
      updateStageFilters()
    }

    function stopViewportEffects() {
      gsap.killTweensOf(gridShakeMotion)
      app.stage.position.set(0, 0)
      // Detach filters before destroying their GPU resources. Zoom/pan can
      // interrupt a ripple mid-frame, when leaving a destroyed filter on the
      // stage causes Pixi to access a null texture source.
      app.stage.filters = []
      for (const wave of lockWaves) {
        gsap.killTweensOf(wave)
        wave.destroy()
      }
      lockWaves.clear()
      updateStageFilters()
    }

    function resize() {
      const { width, height } = app.screen
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
      const lockedCellMap = createLockedCellMap(current.lockedCellGroups)
      const nextLockedCellKeys = new Set(lockedCellMap.keys())
      const isBoardFullyLocked = !current.scrolling && pieceMap.size > 0 && [...pieceMap.keys()].every((key) => lockedCellMap.has(key))
      const nextSelectedKeys = new Set<string>()
      const newlyLockedCellKeys: string[] = []

      verificationWave?.clearCells()
      stopCellAnimations()
      for (const child of board.removeChildren()) {
        child.destroy({ children: true })
      }
      shineLayers = []
      cellShakeLayers = new Map()
      emptyCellSprites = new Map()

      const firstRow = current.scrolling?.firstRow ?? 0
      for (let y = firstRow; y < firstRow + current.config.rows; y += 1) {
        for (let x = 0; x < current.config.columns; x += 1) {
          const key = cellKey(x, y)
          const piece = pieceMap.get(key)
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

          if (!cell && !lockedGroup && !selected && !current.markers.has(key)) {
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
            const selectedY = centerY - cellHeight * 0.2
            if (isNewlySelected) {
              cellContainer.position.set(centerX, centerY)
            } else {
              cellContainer.position.set(centerX, selectedY)
              cellContainer.rotation = Math.PI / 90
              cellContainer.scale.set(0.9)
            }
          } else if (isNewlyLocked) {
            cellContainer.pivot.set(cellWidth / 2, cellHeight / 2)
            cellContainer.position.set(x * cellWidth + cellWidth / 2, y * cellHeight + cellHeight / 2)
            cellContainer.scale.set(0.75)
          } else if (isNewlyDeselected) {
            const centerX = x * cellWidth + cellWidth / 2
            const centerY = y * cellHeight + cellHeight / 2
            cellContainer.pivot.set(cellWidth / 2, cellHeight / 2)
            cellContainer.position.set(centerX, centerY - cellHeight * 0.2)
            cellContainer.rotation = Math.PI / 90
            cellContainer.scale.set(0.9)
          }

          const borderSize = cellSize * CELL_BORDER_RATIO
          const radius = cellSize * 0.02
          const outerColor = selected ? CELL_COLOR : BOARD_COLOR
          const fillColor = selected ? BOARD_COLOR : lockedGroup ? lockedColorToNumber(lockedGroup.color) : CELL_COLOR
          const cellGraphic = new Graphics();
          drawCellBody(cellGraphic, 0, 0, cellWidth, cellHeight, {
            fillColor,
            borderColor: outerColor,
            borderSize,
            borderRadius: radius
          });
          shakeLayer.addChild(cellGraphic);

          if (lockedGroup && !selected) {
            const shineMask = new Graphics()
              .roundRect(borderSize, borderSize, cellWidth - borderSize * 2, cellHeight - borderSize * 2, Math.max(0, radius - borderSize))
              .fill({ color: 0xffffff })
            const shine = new Container()
            shine.mask = shineMask
            shine.addChild(new Graphics()
              .rect(0, -cellHeight, cellWidth * 0.08, cellHeight * 3).fill({ color: 0xffffff, alpha: 0.12 })
              .rect(cellWidth * 0.08, -cellHeight, cellWidth * 0.06, cellHeight * 3).fill({ color: 0xffffff, alpha: 0.72 })
              .rect(cellWidth * 0.14, -cellHeight, cellWidth * 0.08, cellHeight * 3).fill({ color: 0xffffff, alpha: 0.12 }))
            shine.rotation = -0.35
            shakeLayer.addChild(shine, shineMask)
            shineLayers.push({ layer: shine, size: cellSize })
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

            if (cell) {
              const markerSize = cellWidth * 0.45
              const offsetX = cellWidth * 0.12
              const offsetY = cellHeight * 0.12
            const style = { color: selected ? CELL_COLOR : OUTLINE_COLOR, size: markerSize, paddingX: offsetX, paddingY: offsetY, radius: markerSize * 0.1 }
            const position = getCornerMarkerPosition(CELL_CORNERS.indexOf(cell.corner), cellWidth, cellHeight, style)
            const markerGraphic = new Graphics()
            drawCornerMarker(markerGraphic, position.x, position.y, style)
            shakeLayer.addChild(markerGraphic)
          }

          const marker = current.markers.get(key)
          if (marker) shakeLayer.addChild(new Graphics().circle(cellWidth / 2, cellHeight / 2, cellSize * 0.15).fill({ color: MARKER_COLORS[marker] }))

          board.addChild(cellContainer)

          if (isNewlyLocked) {
            gsap.to(cellContainer.scale, { duration: 0.28, ease: 'back.out(2)', x: 1, y: 1 })
          } else if (isNewlySelected) {
            gsap.to(cellContainer, {
              duration: 0.15,
              ease: 'power2.out',
              rotation: Math.PI / 90,
              y: y * cellHeight + cellHeight / 2 - cellHeight * 0.2,
            })
            gsap.to(cellContainer.scale, { duration: 0.15, ease: 'power2.out', x: 0.9, y: 0.9 })
          } else if (isNewlyDeselected) {
            gsap.to(cellContainer, {
              duration: 0.15,
              ease: 'power2.inOut',
              rotation: 0,
              y: y * cellHeight + cellHeight / 2,
            })
            gsap.to(cellContainer.scale, { duration: 0.15, ease: 'power2.inOut', x: 1, y: 1 })
          }
        }
      }
      previousLockedCellKeysRef.current = nextLockedCellKeys
      previousSelectedKeysRef.current = nextSelectedKeys
      // The final lock usually leads directly into verification, so its normal
      // ripple/shake is opt-in (the tutorial deliberately keeps it).
      if (newlyLockedCellKeys.length > 0 && (!isBoardFullyLocked || current.config.finalLockAnimationEnabled === true) && !current.verificationWave) {
        playLockShake(newlyLockedCellKeys, cellSize)
        playGridShake(cellSize)
        playLockRipple(newlyLockedCellKeys, cellWidth, cellHeight, cellSize)
      }
      if (current.verificationWave?.id !== verificationId) {
        verificationWave?.destroy()
        verificationWave = undefined
        verificationId = current.verificationWave?.id
        if (current.verificationWave) {
          stopViewportEffects()
          verificationWave = new GridVerificationWave(current.verificationWave, current.config.columns, CASCADE_LOCK_EFFECTS.completionShake)
        }
      }
      verificationWave?.setCells(cellShakeLayers, cellWidth, cellHeight, CELL_BORDER_RATIO)
    }

    function playGridShake(cellSize: number) {
      const config = CASCADE_LOCK_EFFECTS.gridShake
      gsap.killTweensOf(gridShakeMotion)
      app.stage.position.set(0, 0)
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
          app.stage.position.set(Math.sin(phase) * amplitude * fade, Math.sin(phase * 1.3) * amplitude * fade * 0.6)
        },
        onComplete: () => app.stage.position.set(0, 0),
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

    function playLockRipple(lockedCellKeys: readonly string[], cellWidth: number, cellHeight: number, cellSize: number) {
      const config = CASCADE_LOCK_EFFECTS.ripple
      if (!config.enabled) return
      const cells = lockedCellKeys.map((key) => key.split(',').map(Number))
      const center = cells.reduce((total, [column, row]) => ({
        x: total.x + (column! + 0.5) * cellWidth,
        y: total.y + (row! + 0.5) * cellHeight,
      }), { x: 0, y: 0 })
      const wave = new ShockwaveFilter({
        amplitude: cellSize * view.zoom * config.amplitudeCells,
        brightness: config.brightness,
        center: { x: view.offsetX + center.x / cells.length * view.zoom, y: view.offsetY + center.y / cells.length * view.zoom },
        radius: cellSize * view.zoom * config.radiusCells,
        speed: cellSize * view.zoom * config.speedCellsPerSecond,
        wavelength: cellSize * view.zoom * config.wavelengthCells,
      })
      // Filters default to a 1x render texture, which visibly downscales a
      // high-density board until the ripple is removed.
      wave.resolution = 'inherit'
      lockWaves.add(wave)
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
      if (verificationWave && !propsRef.current.verificationPaused && !document.hidden && verificationWave.advance(app.ticker.deltaMS)) {
        const completedId = verificationId!
        verificationWave.destroy()
        verificationWave = undefined
        propsRef.current.onVerificationComplete?.(completedId)
      }
      vhsCrtEffect?.advance(app.ticker.deltaMS, propsRef.current.interactive === false || document.hidden)
      const scrolling = propsRef.current.scrolling
      if (scrolling && surface) {
        if (propsRef.current.interactive !== false && !document.hidden) scrolling.advance(app.ticker.deltaMS)
        view.offsetY = scrolling.getOffsetRows() * surface.metrics.cellHeight
        surface.setOffset(0, view.offsetY)
        board.position.set(0, view.offsetY)
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
      const time = performance.now() / 4000
      for (const { layer, size } of shineLayers) {
        layer.position.set(-size * 1.5 + (time % 1) * size * 3.5, size / 2)
      }
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
        init: { background: BOARD_COLOR, preserveDrawingBuffer: true },
        onDestroy: destroy,
        onError: () => setStartupFailed(true),
        onReady: () => {
          app.canvas.style.touchAction = 'inherit'
          appRef.current = app
          boardRef.current = board
          surface = new GridSurface(app, propsRef.current.scrolling ? { infinite: true } : { infinite: false, columns: propsRef.current.config.columns, rows: propsRef.current.config.rows }, {
            width: app.screen.width, height: app.screen.height,
            cellSize: Math.min(app.screen.width / propsRef.current.config.columns, app.screen.height / propsRef.current.config.rows), fit: 'stretch',
          }, { cellColor: CELL_COLOR, borderColor: BOARD_COLOR, backgroundColor: BOARD_COLOR, borderSize: Math.min(app.screen.width / propsRef.current.config.columns, app.screen.height / propsRef.current.config.rows) * CELL_BORDER_RATIO, borderRadius: Math.min(app.screen.width / propsRef.current.config.columns, app.screen.height / propsRef.current.config.rows) * 0.02, gap: 0 })
          surface.layers.pieces.addChild(board)
          app.stage.addChild(surface.root)
          resetViewRef.current = () => {
            navigationRef.current?.reset()
            stopViewportEffects()
            view = { zoom: 1, offsetX: 0, offsetY: 0 }
            updateViewport()
          }
          captureRef.current = () => {
            const savedView = view
            verificationWave?.hide()
            try {
              view = { zoom: 1, offsetX: 0, offsetY: 0 }
              updateViewport()
              return app.renderer.extract.canvas({ target: surface!.root, frame: new Rectangle(0, 0, app.screen.width, app.screen.height) }) as HTMLCanvasElement
            } finally {
              view = savedView
              updateViewport()
              verificationWave?.render()
            }
          }
          const navigation = propsRef.current.scrolling || propsRef.current.config.navigationEnabled === false ? null : createGridNavigation(app.canvas, {
            minZoom: 1, maxZoom: 4,
            getView: () => view,
            getSize: () => app.screen,
            setView: (next) => { view = next; updateViewport() },
            onNavigate: () => { stopViewportEffects(); propsRef.current.onNavigate?.() },
            onTap: (originalEvent) => handleCellTap({ ...surface!.pointerToCell(originalEvent), originalEvent }),
          })
          navigationRef.current = navigation
          detachInput = attachGridInput(app.canvas, {
            enabled: () => propsRef.current.interactive !== false,
            gestures: navigation === null,
            cellAt: (event) => surface!.pointerToCell(event),
            callbacks: navigation?.callbacks ?? { onCellTap: handleCellTap },
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
      resetViewRef.current = () => undefined
      appRef.current = null
      boardRef.current = null
      drawRef.current = () => undefined
      detachInput?.()
      navigationRef.current?.reset()
      navigationRef.current = null
      app.ticker?.remove(update)
      verificationWave?.destroy()
      stopCellAnimations()
      stopViewportEffects()
      app.stage.filters = []
      vhsCrtEffect?.destroy()
      exitDistortionEffect?.destroy()
      surface?.destroy()
      if (!board.destroyed) board.destroy({ children: true })
    }

    void start()
    return () => host?.destroy()
  }, [props.config.columns, props.config.rows, props.config.navigationEnabled])

  return <div className={props.interactive === false ? 'pointer-events-none size-full overflow-hidden' : 'size-full overflow-hidden touch-none'} ref={containerRef}>{startupFailed && <CanvasStartupError />}</div>
})
