import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import { ShockwaveFilter } from 'pixi-filters'
import { gsap } from 'gsap'
import type { CellMarkerColor, GameConfig, LockedCellGroup, PlacedTetromino } from '@/game/gameConfig'
import { CASCADE_LOCK_EFFECTS } from '@/features/cascade/cascadeEffects'

interface GameGridCanvasProps {
  config: GameConfig
  lockedCellGroups: readonly LockedCellGroup[]
  markers: ReadonlyMap<string, CellMarkerColor>
  onToggle: (cellKey: string) => void
  pieces: readonly PlacedTetromino[]
  selectedCellKeys: ReadonlySet<string>
  selectedLockedGroupId: string | null
  showCellIds: boolean
}

const BOARD_COLOR = 0x773526
const CELL_COLOR = 0xffd18a
const OUTLINE_COLOR = 0x713324
const TEXT_COLOR = 0x15100e
const MARKER_COLORS: Record<CellMarkerColor, number> = { black: 0x15100e, white: 0x8d8d8d }

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

export function GameGridCanvas(props: GameGridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const boardRef = useRef<Container | null>(null)
  const drawRef = useRef<() => void>(() => undefined)
  const previousLockedCellKeysRef = useRef<Set<string>>(new Set())
  const previousSelectedKeysRef = useRef<Set<string>>(new Set())
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    drawRef.current()
  }, [props.config, props.lockedCellGroups, props.markers, props.pieces, props.selectedCellKeys, props.selectedLockedGroupId, props.showCellIds])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const stableContainer: HTMLDivElement = container

    const app = new Application()
    const board = new Container()
    board.sortableChildren = true
    const resizeObserver = new ResizeObserver(() => {
      if (!appRef.current) return
      app.renderer.resize(Math.max(1, stableContainer.clientWidth), Math.max(1, stableContainer.clientHeight))
      drawRef.current()
    })
    let disposed = false
    let initialized = false
    let shineLayers: Array<{ layer: Container; size: number }> = []
    let cellShakeLayers = new Map<string, Container>()
    const gridShakeMotion = { time: 0 }
    const lockWaves = new Set<ShockwaveFilter>()

    function draw() {
      if (disposed || !appRef.current || !boardRef.current) return
      const current = propsRef.current
      const width = app.renderer.width
      const height = app.renderer.height
      const cellWidth = width / current.config.columns
      const cellHeight = height / current.config.rows
      const cellSize = Math.min(cellWidth, cellHeight)
      const pieceMap = createPieceMap(current.pieces)
      const lockedCellMap = createLockedCellMap(current.lockedCellGroups)
      const nextLockedCellKeys = new Set(lockedCellMap.keys())
      const nextSelectedKeys = new Set<string>()
      const newlyLockedCellKeys: string[] = []

      for (const child of board.removeChildren()) {
        gsap.killTweensOf(child)
        if (child instanceof Container) gsap.killTweensOf(child.scale)
        child.destroy({ children: true })
      }
      shineLayers = []
      cellShakeLayers = new Map()

      const background = new Graphics().rect(0, 0, width, height).fill({ color: BOARD_COLOR })
      board.addChild(background)

      for (let y = 0; y < current.config.rows; y += 1) {
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

          const borderSize = 1.5
          const radius = cellSize * 0.02
          const outerColor = selected ? CELL_COLOR : BOARD_COLOR
          const fillColor = selected ? BOARD_COLOR : lockedGroup ? lockedColorToNumber(lockedGroup.color) : CELL_COLOR
          const cellGraphic = new Graphics()
            .roundRect(0, 0, cellWidth, cellHeight, radius)
            .fill({ color: outerColor })
            .roundRect(borderSize, borderSize, cellWidth - borderSize * 2, cellHeight - borderSize * 2, Math.max(0, radius - borderSize))
            .fill({ color: fillColor })
          shakeLayer.addChild(cellGraphic)

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

          const marker = current.markers.get(key)
          if (marker) shakeLayer.addChild(new Graphics().circle(cellWidth / 2, cellHeight / 2, cellSize * 0.15).fill({ color: MARKER_COLORS[marker] }))

          if (cell) {
            const markerSize = cellWidth * 0.45
            const offsetX = Math.max(3, cellWidth * 0.12)
            const offsetY = Math.max(3, cellHeight * 0.12)
            const markerX = cell.corner === 'top-right' || cell.corner === 'bottom-right' ? cellWidth - offsetX - markerSize : offsetX
            const markerY = cell.corner === 'bottom-left' || cell.corner === 'bottom-right' ? cellHeight - offsetY - markerSize : offsetY
            shakeLayer.addChild(new Graphics()
              .roundRect(markerX, markerY, markerSize, markerSize, markerSize * 0.1)
              .fill({ color: selected ? CELL_COLOR : OUTLINE_COLOR }))
          }

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
      if (newlyLockedCellKeys.length > 0) {
        playLockShake(newlyLockedCellKeys, cellSize)
        playGridShake(cellSize)
        playLockRipple(newlyLockedCellKeys, cellWidth, cellHeight, cellSize)
      }
    }

    function playGridShake(cellSize: number) {
      const config = CASCADE_LOCK_EFFECTS.gridShake
      gsap.killTweensOf(gridShakeMotion)
      app.stage.position.set(0, 0)
      if (!config.enabled || config.durationSeconds <= 0) return

      gridShakeMotion.time = 0
      const amplitude = cellSize * config.amplitudeCells
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
        const motion = { time: 0 }
        gsap.killTweensOf(layer.position)
        layer.position.set(0, 0)
        const amplitude = cellSize * config.amplitudeCells * (1 - distance / (config.radiusCells + 1))
        gsap.to(motion, {
          delay: distance / Math.max(0.01, config.propagationCellsPerSecond),
          duration: config.durationSeconds,
          ease: 'none',
          time: config.durationSeconds,
          onUpdate: () => {
            const fade = (1 - motion.time / config.durationSeconds) ** 2
            const phase = motion.time * config.frequencyHz * Math.PI * 2
            layer.position.set(Math.sin(phase) * amplitude * fade, Math.sin(phase * 1.3) * amplitude * fade * 0.6)
          },
          onComplete: () => layer.position.set(0, 0),
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

    function update() {
      const time = performance.now() / 4000
      for (const { layer, size } of shineLayers) {
        layer.position.set(-size * 1.5 + (time % 1) * size * 3.5, size / 2)
      }
    }

    function handlePointerUp(event: PointerEvent) {
      const bounds = app.canvas.getBoundingClientRect()
      const x = Math.floor((event.clientX - bounds.left) * app.renderer.width / bounds.width / (app.renderer.width / propsRef.current.config.columns))
      const y = Math.floor((event.clientY - bounds.top) * app.renderer.height / bounds.height / (app.renderer.height / propsRef.current.config.rows))
      if (x < 0 || y < 0 || x >= propsRef.current.config.columns || y >= propsRef.current.config.rows) return
      propsRef.current.onToggle(cellKey(x, y))
    }

    drawRef.current = draw

    async function start() {
      await app.init({
        antialias: true,
        autoDensity: true,
        background: BOARD_COLOR,
        height: Math.max(1, stableContainer.clientHeight),
        preserveDrawingBuffer: true,
        resolution: window.devicePixelRatio,
        width: Math.max(1, stableContainer.clientWidth),
      })
      if (disposed) {
        app.destroy(true)
        return
      }
      initialized = true
      appRef.current = app
      boardRef.current = board
      app.stage.addChild(board)
      stableContainer.appendChild(app.canvas)
      app.canvas.className = 'size-full touch-manipulation'
      app.canvas.addEventListener('pointerup', handlePointerUp)
      app.ticker.add(update)
      resizeObserver.observe(stableContainer)
      draw()
    }

    void start()
    return () => {
      disposed = true
      resizeObserver.disconnect()
      if (initialized) {
        app.canvas.removeEventListener('pointerup', handlePointerUp)
        app.ticker.remove(update)
        app.destroy(true)
      }
      appRef.current = null
      boardRef.current = null
      drawRef.current = () => undefined
    }
  }, [props.config.columns, props.config.rows])

  return <div className="size-full touch-manipulation" ref={containerRef} />
}
