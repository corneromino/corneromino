import { useEffect, useRef, useState } from 'react'
import { Eraser, Lock, Unlock } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { CellMarkerColor, GameConfig, GameMode, GameSelectionState, LockedCellGroup, PlacedTetromino } from '@/game/gameConfig'
import { isTetrominoShape } from '@/game/tetrominoes'
import { clearGameSelection, loadGameSelection, saveGameSelection } from '@/lib/db'
import { cn } from '@/lib/utils'
import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'
import { CorrectGameDialog } from './CorrectGameDialog'
import { ClassicPauseDialog } from './ClassicPauseDialog'
import { SaveGameDialog } from './SaveGameDialog'
import { GameGridCanvas } from './GameGridCanvas'

interface GameGridProps {
  boardId?: string
  config: GameConfig
  gameId: string
  gameMode: GameMode
  onElapsedSecondsChange: (elapsedSeconds: number) => void
  onMoveCountChange: (moveCount: number) => void
  onNextGame: () => void
  onPauseOpenChange: (open: boolean) => void
  paused: boolean
  persistSelection?: boolean
  pieces: readonly PlacedTetromino[]
}

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
  const { t } = useTranslation()
  const location = useLocation()
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
  const [completionScreenshot, setCompletionScreenshot] = useState<string | null>(null)
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
    width: `min(100%, calc(100cqh * ${props.config.columns} / ${props.config.rows}))`,
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
    setCompletionScreenshot(null)
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

  function restartFromPause() {
    resetGame()
    props.onPauseOpenChange(false)
  }

  function quitFromPause() {
    props.onPauseOpenChange(false)
    requestExit()
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
      if (saveGame && props.persistSelection !== false) {
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
      // Return through the menu entry so browser/mobile Back leaves Classic
      // instead of reopening this saved puzzle.
      if (location.state && typeof location.state === 'object' && 'returnToClassicMenu' in location.state && location.state.returnToClassicMenu === true) {
        navigate(-1)
      } else {
        navigate('/play', { replace: true })
      }
    }
  }

  function discardAndExit() {
    void exitGame(false)
  }

  function saveAndExit() {
    void exitGame(true)
  }

  function handleCompletionOpenChange(open: boolean) {
    if (!open) setCompletionScreenshot(null)
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
          if (neighboringGroup) neighboringColors.add(neighboringGroup.color.toLowerCase())
        }
      }
    }

    const availableColors = LOCKED_CELL_COLOR_HEX.filter((color) => !neighboringColors.has(color))
    const colorPool = availableColors.length > 0 ? availableColors : LOCKED_CELL_COLOR_HEX
    const color = colorPool[Math.floor(Math.random() * colorPool.length)]
    const nextMoveCount = moveCount + 1
    setLockedCellGroups((groups) => [...groups, { cellKeys, color, id: crypto.randomUUID() }])
    setIsCompleted(false)
    setCompletionScreenshot(null)
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
    setCompletionScreenshot(null)
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
    // Capture the rendered board before opening the dialog over it.
    const canvas = gameBoardRef.current?.querySelector('canvas')
    setCompletionScreenshot(isCorrect && canvas ? canvas.toDataURL('image/png') : null)
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
    setCompletionScreenshot(null)
    setMoveCount(0)
    props.onMoveCountChange(0)
    setSavedAt(null)
    savedSelectionRef.current = null
    setSelectionLoaded(false)

    if (props.persistSelection === false) {
      setSelectionLoaded(true)
      return () => {
        active = false
      }
    }

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
          setCompletionScreenshot(null)
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
  }, [props.gameId, props.gameMode, props.persistSelection])

  useEffect(() => {
    if (!selectionLoaded || isCompleted || isExiting || props.paused) return

    const timer = window.setTimeout(() => {
      const nextSeconds = elapsedSeconds + 1
      setElapsedSeconds(nextSeconds)
      props.onElapsedSecondsChange(nextSeconds)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [elapsedSeconds, isCompleted, isExiting, props.onElapsedSecondsChange, props.paused, selectionLoaded])

  useEffect(() => {
    if (!selectionLoaded || isExiting || props.persistSelection === false) return
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
  }, [elapsedSeconds, gameGridScreenshot, isCompleted, isExiting, lockedCellGroups, markers, moveCount, props.gameId, props.gameMode, props.persistSelection, savedAt, selectedCellKeys, selectionLoaded])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-1">
      <div className="flex min-h-0 flex-1 items-start justify-center [container-type:size]">
        <section aria-label="Game board" className="mx-auto max-w-[550px]" id={props.boardId} ref={gameBoardRef} style={boardStyle}>
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
      </div>
      <div className="mx-auto flex w-full max-w-[550px] shrink-0 flex-nowrap justify-center gap-1 sm:gap-2">
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
          aria-label={t('classic.verify')}
          className={cn(
            'cartoon-press relative h-[clamp(36px,11vw,44px)] !overflow-visible px-2 text-[15px] font-black tracking-[0.08em] text-[var(--canvas-foreground)] uppercase',
            validationResult?.isCorrect ? 'cartoon-press--green' : validationResult ? 'cartoon-press--red' : 'cartoon-press--blue',
          )}
          disabled={!canValidate}
          onClick={validateLockedCells}
          title={t('classic.verify')}
          type="button"
        >
          {validationResult && !validationResult.isCorrect && (
            <span className="absolute -right-2 -top-2 z-10 grid size-5 place-items-center rounded-full border border-[var(--canvas-foreground)] bg-[var(--yellow)] text-[11px] font-black text-[#030505]">
              {lockedCellGroups.length - validationResult.validLockCount}
            </span>
          )}
          <span className="-translate-y-1">{t('classic.verify')}</span>
        </Button>
      </div>
      <CorrectGameDialog
        onNext={props.onNextGame}
        onOpenChange={handleCompletionOpenChange}
        screenshot={completionScreenshot}
      />
      <ClassicPauseDialog onOpenChange={props.onPauseOpenChange} onQuit={quitFromPause} onRestart={restartFromPause} onResume={() => props.onPauseOpenChange(false)} open={props.paused} />
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
