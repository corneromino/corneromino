import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Eraser, Lock, Pencil, RotateCcw, Unlock } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { CellMarkerColor, GameConfig, GameMode, GameSelectionState, LockedCellGroup, PlacedTetromino } from '@/game/gameConfig'
import { isTetrominoShape } from '@/game/tetrominoes'
import { clearGameSelection, loadGameSelection, saveGameSelection } from '@/lib/db'
import { cn } from '@/lib/utils'
import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'
import { CorrectGameDialog } from './CorrectGameDialog'
import { ClassicPauseDialog } from './ClassicPauseDialog'
import { ClassicMistakesDialog } from './ClassicMistakesDialog'
import { GameGridCanvas, type GameGridCanvasHandle, type ScrollingGridViewport } from './GameGridCanvas'
import type { ClassicInfiniteCellExit } from './classicInfiniteCellExit'
import type { VhsCrtEffectConfig } from '@/rendering/pixi/VhsCrtEffect'

const DOUBLE_TAP_UNLOCK_MS = 200

interface GameGridProps {
  boardId?: string
  boardResetKey?: string
  highlightAreas?: readonly { height: number; id: string; left: number; top: number; width: number }[]
  lockButtonId?: string
  verifyButtonId?: string
  config: GameConfig
  gameId: string
  gameMode: GameMode
  onElapsedSecondsChange: (elapsedSeconds: number) => void
  onLockAvailable?: () => void
  onLocked?: () => void
  onMoveCountChange: (moveCount: number) => void
  onCorrectSolution?: () => void
  onVerifyAvailable?: () => void
  onNextGame: () => void
  onPauseOpenChange: (open: boolean) => void
  paused: boolean
  persistSelection?: boolean
  pieces: readonly PlacedTetromino[]
  scrolling?: ScrollingGridViewport
  onRestart?: () => void
  pauseDialog?: ReactNode
  onCellExit?: (event: ClassicInfiniteCellExit) => void
  vhsCrt?: VhsCrtEffectConfig
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
  const [markerMode, setMarkerMode] = useState(false)
  const [selectedLockedGroupId, setSelectedLockedGroupId] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [mistakeDialogOpen, setMistakeDialogOpen] = useState(false)
  const [selectionLoaded, setSelectionLoaded] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [gameGridScreenshot, setGameGridScreenshot] = useState<Blob | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [completionDialogPending, setCompletionDialogPending] = useState(false)
  const [completionScreenshotPending, setCompletionScreenshotPending] = useState(false)
  const [completionScreenshot, setCompletionScreenshot] = useState<string | null>(null)
  const [moveCount, setMoveCount] = useState(0)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [previousScrollingPieces, setPreviousScrollingPieces] = useState(props.pieces)
  const gameBoardRef = useRef<HTMLElement>(null)
  const gameCanvasRef = useRef<GameGridCanvasHandle>(null)
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve())
  const savedSelectionRef = useRef<GameSelectionState | null>(null)
  const lockWasAvailableRef = useRef(false)
  const verifyWasAvailableRef = useRef(false)
  const lastLockedTapRef = useRef<{ groupId: string; time: number } | null>(null)
  const handleGridNavigation = useCallback(() => { lastLockedTapRef.current = null }, [])
  const autoLock = props.config.lockingMode === 'auto'
  const autoFinalVerification = props.config.finalVerificationMode === 'auto'
  const cellMap = createCellMap(props.pieces)
  const lockedCellMap = createLockedCellMap(lockedCellGroups)
  const canLockSelectedCells = canLockCells(selectedCellKeys)
  const canValidate = !props.scrolling && cellMap.size > 0 && [...cellMap.keys()].every((cellKey) => lockedCellMap.has(cellKey))
  const verificationErrorCount = validationResult && !validationResult.isCorrect
    ? lockedCellGroups.length - validationResult.validLockCount
    : 0
  const verificationLabel = t('classic.verify')
  const visibleRows = props.scrolling?.visibleRows ?? props.config.rows
  const boardStyle = {
    aspectRatio: `${props.config.columns} / ${visibleRows}`,
    width: `min(100%, calc(100cqh * ${props.config.columns} / ${visibleRows}))`,
  }

  // Prune a recycled section before its replacement reaches the canvas. Cells
  // and group fragments still on screen retain their selection, locks and notes.
  if (props.scrolling && props.pieces !== previousScrollingPieces) {
    const retainedGroups = lockedCellGroups.map((group) => ({
      ...group, cellKeys: group.cellKeys.filter((key) => cellMap.has(key)),
    })).filter((group) => group.cellKeys.length > 0)
    setPreviousScrollingPieces(props.pieces)
    setSelectedCellKeys(new Set([...selectedCellKeys].filter((key) => cellMap.has(key))))
    setMarkers(new Map([...markers].filter(([key]) => cellMap.has(key))))
    setLockedCellGroups(retainedGroups)
    if (!retainedGroups.some((group) => group.id === selectedLockedGroupId)) setSelectedLockedGroupId(null)
  }

  useEffect(() => {
    if (canLockSelectedCells && !lockWasAvailableRef.current) props.onLockAvailable?.()
    lockWasAvailableRef.current = canLockSelectedCells
  }, [canLockSelectedCells, props.onLockAvailable])

  useEffect(() => {
    if (!autoFinalVerification && canValidate && !verifyWasAvailableRef.current) props.onVerifyAvailable?.()
    verifyWasAvailableRef.current = canValidate
  }, [autoFinalVerification, canValidate, props.onVerifyAvailable])

  useEffect(() => {
    lastLockedTapRef.current = null
  }, [props.paused, props.config.lockingMode, props.gameId, props.gameMode, props.boardResetKey, markerMode])

  function canLockCells(selection: ReadonlySet<string>) {
    return selection.size === 4
      && [...selection].every((key) => cellMap.has(key) && !lockedCellMap.has(key))
      && isTetrominoShape(parseCellKeys(selection))
  }

  function latestFourCells(selection: ReadonlySet<string>): Set<string> {
    return new Set([...selection].slice(-4))
  }

  function clearSelectedCells() {
    lastLockedTapRef.current = null
    setSelectedCellKeys(new Set())
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setMistakeDialogOpen(false)
  }

  function resetGame() {
    lastLockedTapRef.current = null
    gameCanvasRef.current?.resetView()
    setSelectedCellKeys(new Set())
    setLockedCellGroups([])
    setMarkers(new Map())
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setMistakeDialogOpen(false)
    setGameGridScreenshot(null)
    setIsCompleted(false)
    setCompletionDialogOpen(false)
    setCompletionDialogPending(false)
    setCompletionScreenshotPending(false)
    setCompletionScreenshot(null)
    setSavedAt(null)
    savedSelectionRef.current = null
  }

  function queuePersistence(task: () => Promise<void>): Promise<void> {
    const queuedTask = persistenceQueueRef.current.catch(() => undefined).then(task)
    persistenceQueueRef.current = queuedTask
    return queuedTask
  }

  function restartFromPause() {
    if (props.onRestart) {
      props.onRestart()
      return
    }
    resetGame()
    props.onPauseOpenChange(false)
  }

  function quitWithoutSavingFromPause() {
    props.onPauseOpenChange(false)
    void exitGame(false)
  }

  function saveAndQuitFromPause() {
    props.onPauseOpenChange(false)
    void exitGame(true)
  }

  async function captureGameGridScreenshot(): Promise<Blob | null> {
    const pixiCanvas = gameCanvasRef.current?.captureBoard()
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

  function handleCompletionOpenChange(open: boolean) {
    setCompletionDialogPending(false)
    setCompletionScreenshotPending(false)
    setCompletionDialogOpen(open)
  }

  function toggleCellSelection(cellKey: string, time: number) {
    if (!selectionLoaded || props.paused || isExiting || isCompleted) return
    if (!cellMap.has(cellKey)) {
      lastLockedTapRef.current = null
      return
    }

    if (markerMode) {
      lastLockedTapRef.current = null
      setMarkers((currentMarkers) => {
        const nextMarkers = new Map(currentMarkers)
        if (nextMarkers.has(cellKey)) {
          nextMarkers.delete(cellKey)
        } else {
          nextMarkers.set(cellKey, 'black')
        }
        return nextMarkers
      })
      return
    }

    const lockedGroup = lockedCellMap.get(cellKey)
    if (lockedGroup) {
      if (autoLock) {
        const previousTap = lastLockedTapRef.current
        if (previousTap?.groupId === lockedGroup.id && time >= previousTap.time && time - previousTap.time <= DOUBLE_TAP_UNLOCK_MS) {
          unlockGroup(lockedGroup.id)
          return
        }
        lastLockedTapRef.current = { groupId: lockedGroup.id, time }
      }
      setSelectedCellKeys(new Set())
      setSelectedLockedGroupId((selectedGroupId) => (selectedGroupId === lockedGroup.id ? null : lockedGroup.id))
      return
    }

    // An unlocked-cell tap (including the fourth selection) cannot start an unlock gesture.
    lastLockedTapRef.current = null
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setMistakeDialogOpen(false)
    const nextSelectedCells = new Set(selectedCellKeys)
    if (nextSelectedCells.has(cellKey)) nextSelectedCells.delete(cellKey)
    else nextSelectedCells.add(cellKey)
    const automaticLockSelection = latestFourCells(nextSelectedCells)
    if (autoLock && canLockCells(automaticLockSelection)) lockCells(automaticLockSelection, nextSelectedCells)
    else setSelectedCellKeys(nextSelectedCells)
  }

  function selectHighlightedCell(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.classList.contains('driver-active-element')) return
    const canvas = gameBoardRef.current?.querySelector('canvas')
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const column = Math.floor((event.clientX - bounds.left) / bounds.width * props.config.columns)
    const row = Math.floor((event.clientY - bounds.top) / bounds.height * props.config.rows)
    if (column < 0 || column >= props.config.columns || row < 0 || row >= props.config.rows) return
    toggleCellSelection(`${column},${row}`, event.timeStamp)
  }

  function lockSelectedCells() {
    lockCells(selectedCellKeys)
  }

  function lockCells(selection: ReadonlySet<string>, fullSelection: ReadonlySet<string> = selection) {
    if (!canLockCells(selection)) return
    lastLockedTapRef.current = null

    const cellKeys = [...selection]
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
    setCompletionDialogOpen(false)
    setCompletionDialogPending(false)
    setCompletionScreenshotPending(false)
    setCompletionScreenshot(null)
    setSelectedCellKeys(new Set([...fullSelection].filter((key) => !selection.has(key))))
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setMistakeDialogOpen(false)
    setMoveCount(nextMoveCount)
    props.onMoveCountChange(nextMoveCount)
    props.onLocked?.()
  }

  function unlockSelectedCells() {
    if (!selectedLockedGroupId) return
    unlockGroup(selectedLockedGroupId)
  }

  function unlockGroup(groupId: string) {
    lastLockedTapRef.current = null
    const group = lockedCellGroups.find((lockedGroup) => lockedGroup.id === groupId)
    if (!group) return

    setLockedCellGroups((groups) => groups.filter((lockedGroup) => lockedGroup.id !== group.id))
    setIsCompleted(false)
    setCompletionDialogOpen(false)
    setCompletionDialogPending(false)
    setCompletionScreenshotPending(false)
    setCompletionScreenshot(null)
    setSelectedCellKeys(new Set())
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setMistakeDialogOpen(false)
  }

  function validateLockedCells() {
    lastLockedTapRef.current = null
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
    setMistakeDialogOpen(!isCorrect)
    if (isCorrect && props.onCorrectSolution) {
      props.onCorrectSolution()
      return
    }
    setIsCompleted(isCorrect)
    setCompletionScreenshot(null)
    setCompletionScreenshotPending(isCorrect)
  }

  useEffect(() => {
    if (!completionScreenshotPending) return
    const delay = Math.max(0, props.config.completionScreenshotDelayMs ?? 0)
    const timer = window.setTimeout(() => {
      // Capture after the final lock animation has settled and before the dialog delay begins.
      const canvas = gameCanvasRef.current?.captureBoard()
      setCompletionScreenshot(canvas ? canvas.toDataURL('image/png') : null)
      setCompletionScreenshotPending(false)
      setCompletionDialogPending(true)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [completionScreenshotPending, props.config.completionScreenshotDelayMs])

  useEffect(() => {
    if (!completionDialogPending) return
    const delay = Math.max(0, props.config.completionDialogDelayMs ?? 0)
    const timer = window.setTimeout(() => {
      setCompletionDialogOpen(true)
      setCompletionDialogPending(false)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [completionDialogPending, props.config.completionDialogDelayMs])

  useEffect(() => {
    if (autoFinalVerification && canValidate && validationResult === null) validateLockedCells()
  }, [autoFinalVerification, canValidate, lockedCellGroups, validationResult])

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
    if (props.boardResetKey !== undefined) resetGame()
  }, [props.boardResetKey])

  useEffect(() => {
    let active = true
    gameCanvasRef.current?.resetView()
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
    setCompletionDialogOpen(false)
    setCompletionDialogPending(false)
    setCompletionScreenshotPending(false)
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
          setCompletionDialogOpen(false)
          setCompletionDialogPending(false)
          setCompletionScreenshotPending(false)
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
          <div className="relative size-full border-2 border-[#773526] bg-[#773526]">
            <GameGridCanvas
              config={props.config}
              interactive={selectionLoaded && !props.paused && !isExiting && !completionScreenshot}
              lockedCellGroups={lockedCellGroups}
              markers={markers}
              onNavigate={handleGridNavigation}
              onCellExit={props.onCellExit}
              vhsCrt={props.vhsCrt}
              onToggle={toggleCellSelection}
              pieces={props.pieces}
              ref={gameCanvasRef}
              selectedCellKeys={selectedCellKeys}
              selectedLockedGroupId={selectedLockedGroupId}
              showCellIds={showCellIds}
              scrolling={props.scrolling}
            />
            {props.highlightAreas?.map((area) => (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute"
                id={area.id}
                key={area.id}
                onPointerUp={selectHighlightedCell}
                style={{
                  height: `${area.height / props.config.rows * 100}%`,
                  left: `${area.left / props.config.columns * 100}%`,
                  top: `${area.top / props.config.rows * 100}%`,
                  width: `${area.width / props.config.columns * 100}%`,
                }}
              />
            ))}
          </div>
        </section>
      </div>
      {!props.config.hideGameControls && <div className="mx-auto flex w-full max-w-[550px] shrink-0 flex-nowrap justify-center gap-1 sm:gap-2">
        <Button
          aria-label={t('common.restart')}
          className="cartoon-press text-[var(--canvas-foreground)]"
          disabled={!selectionLoaded || isExiting}
          onClick={restartFromPause}
          size="icon-lg"
          title={t('common.restart')}
          type="button"
        >
          <RotateCcw aria-hidden="true" />
        </Button>
        <Button
          aria-label="Deselect all cells"
          className="cartoon-press text-[var(--canvas-foreground)]"
          disabled={selectedCellKeys.size === 0 && !selectedLockedGroupId}
          onClick={clearSelectedCells}
          size="icon-lg"
          title="Deselect all cells"
          type="button"
        >
          <Eraser aria-hidden="true" />
        </Button>
        <Button
          aria-label="Take notes"
          aria-pressed={markerMode}
          className={cn(
            'cartoon-press text-[var(--canvas-foreground)]',
            markerMode && '!bg-[var(--yellow)]',
          )}
          onClick={() => setMarkerMode((active) => !active)}
          size="icon-lg"
          title="Take notes"
          type="button"
        >
          <Pencil aria-hidden="true" />
        </Button>
        {!autoLock && <Button
          aria-label="Lock four selected cells"
          className="cartoon-press text-[var(--mint)]"
          disabled={!canLockSelectedCells}
          id={props.lockButtonId}
          onClick={lockSelectedCells}
          size="icon-lg"
          title="Lock four selected cells"
          type="button"
        >
          <Lock aria-hidden="true" />
        </Button>}
        {!autoLock && <Button
          aria-label="Unlock selected cells"
          className="cartoon-press [--element-color:var(--paper-muted)] text-[var(--canvas-foreground)]"
          disabled={!selectedLockedGroupId}
          onClick={unlockSelectedCells}
          size="icon-lg"
          title="Unlock selected cells"
          type="button"
        >
          <Unlock aria-hidden="true" />
        </Button>}
        {!props.scrolling && <Button
          aria-label={verificationLabel}
          className={cn(
            'cartoon-press relative text-[var(--canvas-foreground)]',
            validationResult?.isCorrect ? 'cartoon-press--green' : validationResult ? 'cartoon-press--red' : 'cartoon-press--blue',
          )}
          disabled={!canValidate}
          id={props.verifyButtonId}
          onClick={validateLockedCells}
          size="icon-lg"
          title={verificationLabel}
          type="button"
        >
          <Check aria-hidden="true" />
        </Button>}
      </div>}
      <CorrectGameDialog
        onNext={props.onNextGame}
        onOpenChange={handleCompletionOpenChange}
        open={completionDialogOpen}
        screenshot={completionScreenshot}
      />
      <ClassicMistakesDialog mistakeCount={verificationErrorCount} onOpenChange={setMistakeDialogOpen} open={mistakeDialogOpen} />
      {props.pauseDialog ?? <ClassicPauseDialog gameMode={props.gameMode} isSaving={isExiting} onOpenChange={props.onPauseOpenChange} onQuitWithoutSaving={quitWithoutSavingFromPause} onRestart={restartFromPause} onResume={() => props.onPauseOpenChange(false)} onSaveAndQuit={saveAndQuitFromPause} open={props.paused} seed={props.gameId} />}
    </div>
  )
}
