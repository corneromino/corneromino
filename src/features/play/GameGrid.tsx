import { useEffect, useRef, useState } from 'react'
import { Check, Eraser, ListChecks, Lock, LogOut, RotateCcw, Unlock, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { CellMarkerColor, GameConfig, GameMode, GameSelectionState, LockedCellGroup, PlacedTetromino } from '@/game/gameConfig'
import { isTetrominoShape } from '@/game/tetrominoes'
import { clearGameSelection, loadGameSelection, saveGameSelection } from '@/lib/db'
import { cn } from '@/lib/utils'
import { SaveGameDialog } from './SaveGameDialog'
import { GameGridCanvas } from './GameGridCanvas'

interface GameGridProps {
  config: GameConfig
  gameId: string
  gameMode: GameMode
  onElapsedSecondsChange: (elapsedSeconds: number) => void
  onMoveCountChange: (moveCount: number) => void
  pieces: readonly PlacedTetromino[]
}

const LOCKED_CELL_COLORS = [
  'bg-[#55c7df]',
  'bg-[#8270d8]',
  'bg-[#be69d6]',
  'bg-[#de5d9b]',
  'bg-[#e4555c]',
  'bg-[#5fc47a]',
  'bg-[#4db9a7]',
  'bg-[#73a9ee]',
  'bg-[#9d71dc]',
  'bg-[#41EAD4]',
  'bg-[#0B987E]',
] as const

function createCellMap(pieces: readonly PlacedTetromino[]): Map<string, PlacedTetromino> {
  return new Map(pieces.flatMap((piece) => piece.cells.map((cell) => [`${cell.x},${cell.y}`, piece])))
}

function createLockedCellMap(groups: readonly LockedCellGroup[]): Map<string, LockedCellGroup> {
  return new Map(groups.flatMap((group) => group.cellKeys.map((cellKey) => [cellKey, group])))
}

function parseCellKeys(cellKeys: Iterable<string>) {
  return [...cellKeys].map((cellKey) => {
    const [x, y] = cellKey.split(',').map(Number)
    return { x, y }
  })
}

interface ValidationResult {
  isCorrect: boolean
  validLockCount: number
}

export function GameGrid(props: GameGridProps) {
  const navigate = useNavigate()
  const [showCellIds, setShowCellIds] = useState(false)
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(() => new Set())
  const [lockedCellGroups, setLockedCellGroups] = useState<LockedCellGroup[]>([])
  const [markers, setMarkers] = useState<Map<string, CellMarkerColor>>(() => new Map())
  const [markerColor, setMarkerColor] = useState<CellMarkerColor>('black')
  const [markerMenuOpen, setMarkerMenuOpen] = useState(false)
  const [markerMode, setMarkerMode] = useState(false)
  const [selectedLockedGroupId, setSelectedLockedGroupId] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [selectionLoaded, setSelectionLoaded] = useState(false)
  const [exitDialogOpen, setExitDialogOpen] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [gameGridScreenshot, setGameGridScreenshot] = useState<Blob | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [completionVisible, setCompletionVisible] = useState(false)
  const [moveCount, setMoveCount] = useState(0)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const gameBoardRef = useRef<HTMLElement>(null)
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve())
  const savedSelectionRef = useRef<GameSelectionState | null>(null)
  const cellMap = createCellMap(props.pieces)
  const lockedCellMap = createLockedCellMap(lockedCellGroups)
  const canLockSelectedCells = selectedCellKeys.size === 4 && isTetrominoShape(parseCellKeys(selectedCellKeys))
  const canValidate = cellMap.size > 0 && [...cellMap.keys()].every((cellKey) => lockedCellMap.has(cellKey))
  const boardStyle = {
    aspectRatio: `${props.config.columns} / ${props.config.rows}`,
    width: `min(100%, calc((100dvh - 190px) * ${props.config.columns} / ${props.config.rows}))`,
  }
  function clearSelectedCells() {
    setSelectedCellKeys(new Set())
    setSelectedLockedGroupId(null)
    setValidationResult(null)
  }

  function resetGame() {
    setSelectedCellKeys(new Set())
    setLockedCellGroups([])
    setMarkers(new Map())
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setGameGridScreenshot(null)
    setIsCompleted(false)
    setCompletionVisible(false)
    setSavedAt(null)
    savedSelectionRef.current = null
  }

  function queuePersistence(task: () => Promise<void>): Promise<void> {
    const queuedTask = persistenceQueueRef.current.catch(() => undefined).then(task)
    persistenceQueueRef.current = queuedTask
    return queuedTask
  }

  function requestExit() {
    setExitDialogOpen(true)
  }

  async function captureGameGridScreenshot(): Promise<Blob | null> {
    if (!gameBoardRef.current) return null

    const pixiCanvas = gameBoardRef.current.querySelector('canvas')
    if (!pixiCanvas) return null
    return await new Promise((resolve) => pixiCanvas.toBlob(resolve, 'image/png'))
  }

  async function exitGame(saveGame: boolean) {
    setIsExiting(true)

    try {
      if (saveGame) {
        const screenshot = (await captureGameGridScreenshot()) ?? gameGridScreenshot
        const nextSavedAt = Date.now()
        const savedSelection: GameSelectionState = {
          elapsedSeconds,
          gameGridScreenshot: screenshot,
          isCompleted,
          lockedCellGroups,
          markers: [...markers].map(([cellKey, color]) => ({ cellKey, color })),
          moveCount,
          savedAt: nextSavedAt,
          selectedCellKeys: [...selectedCellKeys],
        }
        setGameGridScreenshot(screenshot)
        setSavedAt(nextSavedAt)
        savedSelectionRef.current = savedSelection
        await queuePersistence(() => saveGameSelection(props.gameMode, props.gameId, savedSelection))
      } else if (savedSelectionRef.current) {
        await queuePersistence(() => saveGameSelection(props.gameMode, props.gameId, savedSelectionRef.current!))
      } else {
        await persistenceQueueRef.current.catch(() => undefined)
        const storedSelection = await loadGameSelection(props.gameMode, props.gameId)
        if (storedSelection.savedAt !== null) {
          await saveGameSelection(props.gameMode, props.gameId, storedSelection)
        } else {
          await clearGameSelection(props.gameMode, props.gameId)
        }
      }
    } finally {
      navigate('/play')
    }
  }

  function discardAndExit() {
    void exitGame(false)
  }

  function saveAndExit() {
    void exitGame(true)
  }

  function toggleCellSelection(cellKey: string) {
    if (!cellMap.has(cellKey)) return

    if (markerMode) {
      setMarkers((currentMarkers) => {
        const nextMarkers = new Map(currentMarkers)
        if (nextMarkers.has(cellKey)) {
          nextMarkers.delete(cellKey)
        } else {
          nextMarkers.set(cellKey, markerColor)
        }
        return nextMarkers
      })
      return
    }

    const lockedGroup = lockedCellMap.get(cellKey)
    if (lockedGroup) {
      setSelectedCellKeys(new Set())
      setSelectedLockedGroupId((selectedGroupId) => (selectedGroupId === lockedGroup.id ? null : lockedGroup.id))
      return
    }

    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setSelectedCellKeys((selectedCells) => {
      const nextSelectedCells = new Set(selectedCells)
      if (nextSelectedCells.has(cellKey)) {
        nextSelectedCells.delete(cellKey)
      } else {
        nextSelectedCells.add(cellKey)
      }
      return nextSelectedCells
    })
  }

  function lockSelectedCells() {
    if (!canLockSelectedCells) return

    const cellKeys = [...selectedCellKeys]
    const neighboringColors = new Set<string>()

    for (const cellKey of cellKeys) {
      const [x, y] = cellKey.split(',').map(Number)
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue
          const neighboringGroup = lockedCellMap.get(`${x + offsetX},${y + offsetY}`)
          if (neighboringGroup) neighboringColors.add(neighboringGroup.color)
        }
      }
    }

    const availableColors = LOCKED_CELL_COLORS.filter((color) => !neighboringColors.has(color))
    const colorPool = availableColors.length > 0 ? availableColors : LOCKED_CELL_COLORS
    const color = colorPool[Math.floor(Math.random() * colorPool.length)]
    const nextMoveCount = moveCount + 1
    setLockedCellGroups((groups) => [...groups, { cellKeys, color, id: crypto.randomUUID() }])
    setIsCompleted(false)
    setCompletionVisible(false)
    setSelectedCellKeys(new Set())
    setValidationResult(null)
    setMoveCount(nextMoveCount)
    props.onMoveCountChange(nextMoveCount)
  }

  function unlockSelectedCells() {
    if (!selectedLockedGroupId) return

    const group = lockedCellGroups.find((lockedGroup) => lockedGroup.id === selectedLockedGroupId)
    if (!group) return

    setLockedCellGroups((groups) => groups.filter((lockedGroup) => lockedGroup.id !== group.id))
    setIsCompleted(false)
    setCompletionVisible(false)
    setSelectedCellKeys(new Set(group.cellKeys))
    setSelectedLockedGroupId(null)
    setValidationResult(null)
  }

  function validateLockedCells() {
    if (!canValidate) return

    const validLockCount = lockedCellGroups.filter((group) => {
      const corners = group.cellKeys.map((cellKey) => {
        const piece = cellMap.get(cellKey)
        const [x, y] = cellKey.split(',').map(Number)
        return piece?.cells.find((cell) => cell.x === x && cell.y === y)?.corner
      })
      return corners.length === 4 && corners.every((corner) => corner !== undefined) && new Set(corners).size === 4
    }).length

    const isCorrect = validLockCount === lockedCellGroups.length
    setValidationResult({
      isCorrect,
      validLockCount,
    })
    setIsCompleted(isCorrect)
    setCompletionVisible(isCorrect)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'i' || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      setShowCellIds((visible) => !visible)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    let active = true
    setSelectedCellKeys(new Set())
    setLockedCellGroups([])
    setMarkers(new Map())
    setMarkerMode(false)
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setGameGridScreenshot(null)
    setElapsedSeconds(0)
    props.onElapsedSecondsChange(0)
    setIsCompleted(false)
    setCompletionVisible(false)
    setMoveCount(0)
    props.onMoveCountChange(0)
    setSavedAt(null)
    savedSelectionRef.current = null
    setSelectionLoaded(false)

    void loadGameSelection(props.gameMode, props.gameId)
      .then((storedSelection) => {
        if (active) {
          setLockedCellGroups(storedSelection.lockedCellGroups)
          setMarkers(new Map(storedSelection.markers.map((marker) => [marker.cellKey, marker.color])))
          setSelectedCellKeys(new Set(storedSelection.selectedCellKeys))
          setGameGridScreenshot(storedSelection.gameGridScreenshot)
          setElapsedSeconds(storedSelection.elapsedSeconds)
          props.onElapsedSecondsChange(storedSelection.elapsedSeconds)
          setIsCompleted(storedSelection.isCompleted)
          setCompletionVisible(false)
          setMoveCount(storedSelection.moveCount)
          props.onMoveCountChange(storedSelection.moveCount)
          setSavedAt(storedSelection.savedAt)
          savedSelectionRef.current = storedSelection.savedAt === null ? null : storedSelection
        }
      })
      .catch(() => {
        // Selection remains available for the current session if IndexedDB is unavailable.
      })
      .finally(() => {
        if (active) {
          setSelectionLoaded(true)
        }
      })

    return () => {
      active = false
    }
  }, [props.gameId, props.gameMode])

  useEffect(() => {
    if (!completionVisible) return

    const dismissTimer = window.setTimeout(() => {
      setCompletionVisible(false)
    }, 10_000)

    return () => window.clearTimeout(dismissTimer)
  }, [completionVisible])

  useEffect(() => {
    if (!selectionLoaded || isCompleted || isExiting) return

    const timer = window.setTimeout(() => {
      const nextSeconds = elapsedSeconds + 1
      setElapsedSeconds(nextSeconds)
      props.onElapsedSecondsChange(nextSeconds)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [elapsedSeconds, isCompleted, isExiting, props.onElapsedSecondsChange, selectionLoaded])

  useEffect(() => {
    if (!selectionLoaded || isExiting) return
    void queuePersistence(() => saveGameSelection(props.gameMode, props.gameId, {
      elapsedSeconds,
      gameGridScreenshot,
      isCompleted,
      lockedCellGroups,
      markers: [...markers].map(([cellKey, color]) => ({ cellKey, color })),
      moveCount,
      savedAt,
      selectedCellKeys: [...selectedCellKeys],
    })).catch(() => {
      // Selection remains available for the current session if IndexedDB is unavailable.
    })
  }, [elapsedSeconds, gameGridScreenshot, isCompleted, isExiting, lockedCellGroups, markers, moveCount, props.gameId, props.gameMode, savedAt, selectedCellKeys, selectionLoaded])

  return (
    <div className="space-y-4 px-1">
      {completionVisible && (
        <>
          <div aria-hidden="true" className="completion-dim fixed inset-0 z-20 pointer-events-none bg-[#160b09]" />
          <button aria-label="Dismiss win message" className="fixed inset-0 z-[35] cursor-default border-0 bg-transparent p-0" onClick={() => setCompletionVisible(false)} type="button" />
          <p className="completion-message poster-title pointer-events-none fixed inset-0 z-40 grid place-items-center text-[66px] leading-none text-[#7CFF9F] [-webkit-text-stroke:10px_#030505] [paint-order:stroke_fill]">Win!</p>
        </>
      )}
      <section aria-label="Game board" className="mx-auto max-w-[550px]" ref={gameBoardRef} style={boardStyle}>
        <div className="size-full border-2 border-[#773526] bg-[#773526]">
          <GameGridCanvas
            config={props.config}
            lockedCellGroups={lockedCellGroups}
            markers={markers}
            onToggle={toggleCellSelection}
            pieces={props.pieces}
            selectedCellKeys={selectedCellKeys}
            selectedLockedGroupId={selectedLockedGroupId}
            showCellIds={showCellIds}
          />
        </div>
      </section>
      <div className="mx-auto flex w-full max-w-[550px] flex-nowrap justify-center gap-1 sm:gap-2">
        <Button
          aria-label="Exit game"
          className="cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)]"
          onClick={requestExit}
          size="icon"
          title="Exit game"
          type="button"
        >
          <LogOut aria-hidden="true" />
        </Button>
        <Button
          aria-label="Reset game progress"
          className="cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--coral)]"
          disabled={lockedCellGroups.length === 0 && markers.size === 0 && selectedCellKeys.size === 0 && !selectedLockedGroupId && !savedAt}
          onClick={resetGame}
          size="icon"
          title="Reset game progress"
          type="button"
        >
          <RotateCcw aria-hidden="true" />
        </Button>
        <Button
          aria-label="Deselect all cells"
          className="cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)]"
          disabled={selectedCellKeys.size === 0 && !selectedLockedGroupId}
          onClick={clearSelectedCells}
          size="icon"
          title="Deselect all cells"
          type="button"
        >
          <Eraser aria-hidden="true" />
        </Button>
        <DropdownMenu
          onOpenChange={(open) => {
            if (markerMode && open) {
              setMarkerMode(false)
              setMarkerMenuOpen(false)
              return
            }
            setMarkerMenuOpen(open)
          }}
          open={markerMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Choose marker color"
              aria-pressed={markerMode}
              className={cn(
                'cartoon-press size-[clamp(36px,11vw,44px)]',
                markerMode && '!bg-[var(--yellow)]',
              )}
              size="icon"
              title="Choose marker color"
              type="button"
            >
              <span aria-hidden="true" className={cn('size-4 rounded-full', markerColor === 'white' ? 'bg-[#8d8d8d]' : 'bg-[#15100e]')} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" sideOffset={8}>
            {(['white', 'black'] as const).map((color) => (
              <DropdownMenuItem
                key={color}
                onSelect={() => {
                  setMarkerColor(color)
                  setMarkerMode(true)
                  setMarkerMenuOpen(false)
                }}
              >
                <span className={cn('size-4 rounded-full', color === 'white' ? 'bg-[#8d8d8d]' : 'bg-[#15100e]')} />
                {color === 'white' ? 'Gray' : 'Black'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          aria-label="Lock four selected cells"
          className="cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--mint)]"
          disabled={!canLockSelectedCells}
          onClick={lockSelectedCells}
          size="icon"
          title="Lock four selected cells"
          type="button"
        >
          <Lock aria-hidden="true" />
        </Button>
        <Button
          aria-label="Unlock selected cells"
          className="cartoon-press size-[clamp(36px,11vw,44px)] [--element-color:var(--paper-muted)] text-[var(--canvas-foreground)]"
          disabled={!selectedLockedGroupId}
          onClick={unlockSelectedCells}
          size="icon"
          title="Unlock selected cells"
          type="button"
        >
          <Unlock aria-hidden="true" />
        </Button>
        <Button
          aria-label="Validate locked tetrominoes"
          className={cn(
            'cartoon-press relative size-[clamp(36px,11vw,44px)] !overflow-visible text-[var(--canvas-foreground)]',
            validationResult?.isCorrect && 'text-[var(--mint)]',
            validationResult && !validationResult.isCorrect && 'text-[var(--coral)]',
          )}
          disabled={!canValidate}
          onClick={validateLockedCells}
          size="icon"
          title="Validate locked tetrominoes"
          type="button"
        >
          {!validationResult && <ListChecks aria-hidden="true" />}
          {validationResult?.isCorrect && <Check aria-hidden="true" />}
          {validationResult && !validationResult.isCorrect && (
            <>
              <X aria-hidden="true" />
              <span className="absolute -right-2 -top-2 z-10 grid size-5 place-items-center rounded-full border border-[var(--canvas-foreground)] bg-[var(--yellow)] text-[11px] font-black text-[#030505]">
                {lockedCellGroups.length - validationResult.validLockCount}
              </span>
            </>
          )}
        </Button>
      </div>
      <SaveGameDialog
        isSaving={isExiting}
        onDiscard={discardAndExit}
        onOpenChange={setExitDialogOpen}
        onSave={saveAndExit}
        open={exitDialogOpen}
      />
    </div>
  )
}
