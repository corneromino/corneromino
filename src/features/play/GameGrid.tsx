import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Eraser, Lock, Pencil, RotateCcw, Unlock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DEPTH_BUTTON_COLORS } from '@/components/ui/depth-surface'
import type { CellMarkerColor, GameConfig, GameMode, GameSelectionState, LockedCellGroup, PlacedTetromino } from '@/game/gameConfig'
import { CLASSIC_VERIFICATION_EFFECT } from '@/game/gameConfig'
import { mergeCompletionResults, type GameCompletionResult } from '@/game/completionProgress'
import { isTetrominoShape } from '@/game/tetrominoes'
import { clearGameSelection, loadGameSelection, saveClassicGameDefinition, saveGameSelection, type ClassicGameDefinition } from '@/lib/db'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/toast'
import { chooseLockColor } from '@/game/lockingColor'
import { ClassicPauseDialog } from './ClassicPauseDialog'
import { ClassicRestartDialog } from './ClassicRestartDialog'
import { CorrectGameDialog } from './CorrectGameDialog'
import { GameGridCanvas, type GameGridCanvasHandle, type ScrollingGridViewport } from './GameGridCanvas'
import type { ClassicInfiniteCellExit } from './classicInfiniteCellExit'
import type { VhsCrtEffectConfig } from '@/rendering/pixi/VhsCrtEffect'
import type { InfiniteExitDistortionConfig } from '@/rendering/pixi/InfiniteExitDistortionEffect'
import type { VerificationRequest } from '@/rendering/grid/verificationEffect'
import type { CareerTutorialControlArea } from './careerTutorial'

const DOUBLE_TAP_UNLOCK_MS = 200
const GAME_GRID_REVEAL_DELAY_MS = 1

interface GameGridProps {
  /** Disables only board-cell interaction, leaving tutorial UI targets available. */
  boardInteractive?: boolean
  /** Decorative content positioned behind the board's scrolling canvas. */
  boardBehindAdornment?: ReactNode
  /** Decorative content positioned in front of the board's scrolling canvas. */
  boardForegroundAdornment?: ReactNode
  /** The widest decorative layer divided by board width, used to avoid horizontal clipping. */
  boardAdornmentWidthRatio?: number
  /** Space reserved under the board for its decorative layers, divided by board width. */
  boardBottomAdornmentHeightRatio?: number
  boardId?: string
  boardResetKey?: string
  /** Holds the victory dialog until a Career tutorial is dismissed. */
  deferCompletionDialog?: boolean
  /** Keeps the standard control bar mounted but visually hidden for a tutorial step. */
  hideGameControls?: boolean
  highlightAreas?: readonly { height: number; id: string; left: number; top: number; width: number }[]
  lockButtonId?: string
  verifyButtonId?: string
  config: GameConfig
  /** The immutable original board, persisted only when the player explicitly saves. */
  gameDefinition?: ClassicGameDefinition
  gameId: string
  gameMode: GameMode
  onElapsedSecondsChange: (elapsedSeconds: number) => void
  onLockAvailable?: () => void
  onLocked?: (group: LockedCellGroup, hasUniqueCorners: boolean) => void
  /** Allows a tutorial overlay to yield before the restart confirmation opens. */
  onRestartRequested?: () => void
  /** Reports restart confirmation dialog visibility to a tutorial overlay. */
  onRestartDialogOpenChange?: (open: boolean) => void
  /** Called after the player confirms and completes a board restart. */
  onRestarted?: () => void
  /** Called when the player adds an unlocked board cell to their selection. */
  onSelected?: () => void
  onUnlocked?: (group: LockedCellGroup, hasUniqueCorners: boolean) => void
  onUnlockCountChange?: (unlockCount: number) => void
  onMoveCountChange: (moveCount: number) => void
  onCorrectSolution?: () => void
  /** Builds completion metrics for the completed board. */
  getCompletionResult?: (lockedGroups: readonly LockedCellGroup[], unlockCount: number) => GameCompletionResult
  /** Whether the active game defines a bonus star. */
  hasBonus?: boolean
  /** Called once a successful board verification is complete. */
  onGameCompleted?: (completionResult: GameCompletionResult | undefined) => void
  onVerifyAvailable?: () => void
  onNextGame: () => void
  onPauseOpenChange: (open: boolean) => void
  paused: boolean
  /** Temporarily freezes the board without presenting the pause menu. */
  suspended?: boolean
  persistSelection?: boolean
  pieces: readonly PlacedTetromino[]
  scrolling?: ScrollingGridViewport
  onRestart?: () => void
  pauseDialog?: ReactNode
  /** Stable IDs for named Career tutorial control targets. */
  tutorialControlIds?: Partial<Record<CareerTutorialControlArea, string>>
  onCellExit?: (event: ClassicInfiniteCellExit) => void
  vhsCrt?: VhsCrtEffectConfig
  exitDistortion?: InfiniteExitDistortionConfig,
  disableUnlock?: boolean
  /** Destination for this game type after leaving its pause dialog. */
  exitPath?: string
  /** Uses the streamlined pause menu for authored Career levels. */
  isCareerLevel?: boolean
  /** Delays and animates this grid's initial visual reveal. */
  entranceAnimation?: boolean
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

interface VerificationRun extends VerificationRequest {
  mistakeCount: number
  phase: 'screenshot' | 'animation' | 'result' | 'restoring'
}

export function GameGrid(props: GameGridProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const [showCellIds, setShowCellIds] = useState(false)
  const [hasEntranceDelayElapsed, setHasEntranceDelayElapsed] = useState(() => props.entranceAnimation !== true)
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(() => new Set())
  const [lockedCellGroups, setLockedCellGroups] = useState<LockedCellGroup[]>([])
  const [markers, setMarkers] = useState<Map<string, CellMarkerColor>>(() => new Map())
  const [markerMode, setMarkerMode] = useState(false)
  const [selectedLockedGroupId, setSelectedLockedGroupId] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [selectionLoaded, setSelectionLoaded] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [gameGridScreenshot, setGameGridScreenshot] = useState<Blob | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [completionPending, setCompletionPending] = useState(false)
  const [completionResult, setCompletionResult] = useState<GameCompletionResult | null>(null)
  const [verification, setVerification] = useState<VerificationRun | null>(null)
  const [completionScreenshot, setCompletionScreenshot] = useState<string | null>(null)
  const [restartConfirmationOpen, setRestartConfirmationOpen] = useState(false)
  const [moveCount, setMoveCount] = useState(0)
  const [unlockCount, setUnlockCount] = useState(0)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [previousScrollingPieces, setPreviousScrollingPieces] = useState(props.pieces)
  const gameBoardRef = useRef<HTMLElement>(null)
  const gameCanvasRef = useRef<GameGridCanvasHandle>(null)
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve())
  const savedSelectionRef = useRef<GameSelectionState | null>(null)
  const lockWasAvailableRef = useRef(false)
  const verifyWasAvailableRef = useRef(false)
  const lastLockedTapRef = useRef<{ groupId: string; time: number } | null>(null)
  const verificationIdRef = useRef(0)
  const handleGridNavigation = useCallback(() => { lastLockedTapRef.current = null }, [])
  const autoLock = props.config.lockingMode === 'auto'
  const autoFinalVerification = props.config.finalVerificationMode === 'auto'
  const isEntranceRevealed = props.entranceAnimation !== true || (hasEntranceDelayElapsed && selectionLoaded)
  const isGameplayPaused = props.paused || props.suspended === true || !isEntranceRevealed
  const cellMap = createCellMap(props.pieces)
  const lockedCellMap = createLockedCellMap(lockedCellGroups)
  const canLockSelectedCells = canLockCells(selectedCellKeys)
  const canValidate = !props.scrolling && cellMap.size > 0 && [...cellMap.keys()].every((cellKey) => lockedCellMap.has(cellKey))
  // const verificationMistakeCount = validationResult && !validationResult.isCorrect
    // ? lockedCellGroups.length - validationResult.validLockCount
    // : 0
  const verificationLabel = t('classic.verify')
  const visibleRows = props.scrolling?.visibleRows ?? props.config.rows
  const boardHeightRatio = visibleRows / props.config.columns
  const boardAdornmentWidthRatio = Math.max(1, props.boardAdornmentWidthRatio ?? 1)
  const boardBottomAdornmentHeightRatio = props.boardBottomAdornmentHeightRatio === undefined ? 0 : Math.max(0, props.boardBottomAdornmentHeightRatio)
  const boardStyle = {
    width: `min(${100 / boardAdornmentWidthRatio}%, calc(100cqh / ${boardHeightRatio + boardBottomAdornmentHeightRatio}))`,
  }

  useEffect(() => {
    if (props.entranceAnimation !== true) {
      setHasEntranceDelayElapsed(true)
      return
    }

    setHasEntranceDelayElapsed(false)
    const revealTimer = window.setTimeout(() => setHasEntranceDelayElapsed(true), GAME_GRID_REVEAL_DELAY_MS)
    return () => window.clearTimeout(revealTimer)
  }, [props.entranceAnimation])

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
  }, [isGameplayPaused, props.config.lockingMode, props.gameId, props.gameMode, props.boardResetKey, markerMode])

  function canLockCells(selection: ReadonlySet<string>) {
    return selection.size === 4
      && [...selection].every((key) => cellMap.has(key) && !lockedCellMap.has(key))
      && isTetrominoShape(parseCellKeys(selection))
  }

  function hasAllUniqueCorners(cellKeys: Iterable<string>) {
    const corners = [...cellKeys].map((cellKey) => {
      const piece = cellMap.get(cellKey)
      const [x, y] = cellKey.split(',').map(Number)
      return piece?.cells.find((cell) => cell.x === x && cell.y === y)?.corner
    })
    return corners.length === 4 && corners.every((corner) => corner !== undefined) && new Set(corners).size === 4
  }

  function latestFourCells(selection: ReadonlySet<string>): Set<string> {
    return new Set([...selection].slice(-4))
  }

  function clearSelectedCells() {
    if (verification) return
    lastLockedTapRef.current = null
    setSelectedCellKeys(new Set())
    setSelectedLockedGroupId(null)
    setValidationResult(null)
  }

  function resetGame() {
    lastLockedTapRef.current = null
    gameCanvasRef.current?.resetView()
    setSelectedCellKeys(new Set())
    setLockedCellGroups([])
    setMarkers(new Map())
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setGameGridScreenshot(null)
    setIsCompleted(false)
    setCompletionDialogOpen(false)
    setCompletionPending(false)
    cancelVerification()
    setCompletionScreenshot(null)
    setMoveCount(0)
    props.onMoveCountChange(0)
    setUnlockCount(0)
    props.onUnlockCountChange?.(0)
    setSavedAt(null)
    savedSelectionRef.current = null
  }

  function queuePersistence(task: () => Promise<void>): Promise<void> {
    const queuedTask = persistenceQueueRef.current.catch(() => undefined).then(task)
    persistenceQueueRef.current = queuedTask
    return queuedTask
  }

  function restartGame() {
    cancelVerification()
    if (props.onRestart) {
      props.onRestart()
    } else {
      resetGame()
    }
    props.onPauseOpenChange(false)
    props.onRestarted?.()
  }

  function requestRestart() {
    props.onRestartRequested?.()
    setRestartConfirmationOpen(true)
  }

  function confirmRestart() {
    setRestartConfirmationOpen(false)
    restartGame()
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
    cancelVerification()
    setIsExiting(true)

    try {
      if (saveGame && props.persistSelection !== false) {
        const screenshot = (await captureGameGridScreenshot()) ?? gameGridScreenshot
        const nextSavedAt = Date.now()
        const savedSelection: GameSelectionState = {
          completionResult,
          elapsedSeconds,
          gameGridScreenshot: screenshot,
          isCompleted,
          lockedCellGroups,
          markers: [...markers].map(([cellKey, color]) => ({ cellKey, color })),
          moveCount,
          unlockCount,
          savedAt: nextSavedAt,
          selectedCellKeys: [...selectedCellKeys],
        }
        setGameGridScreenshot(screenshot)
        setSavedAt(nextSavedAt)
        savedSelectionRef.current = savedSelection
        await queuePersistence(async () => {
          if (props.gameDefinition) await saveClassicGameDefinition(props.gameDefinition)
          await saveGameSelection(props.gameMode, props.gameId, savedSelection)
        })
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
      // Replacing the active game route avoids returning to a seedless game
      // history entry, which would otherwise generate another fresh board.
        navigate(props.exitPath ?? '/play/modes', { replace: true })
    }
  }

  function cancelVerification() {
    verificationIdRef.current += 1
    setVerification(null)
  }

  function handleCompletionOpenChange(open: boolean) {
    setCompletionDialogOpen(open)
    if (!open) setIsCompleted(false)
  }

  function openCompletionDialog() {
    if (props.deferCompletionDialog) {
      setCompletionPending(true)
      return
    }
    setCompletionDialogOpen(true)
  }

  function completeGame() {
    const nextCompletionResult = props.getCompletionResult?.(lockedCellGroups, unlockCount)
    if (nextCompletionResult) {
      setCompletionResult((currentResult) => mergeCompletionResults(currentResult, nextCompletionResult))
    }
    props.onGameCompleted?.(nextCompletionResult)
  }

  function handleVerificationComplete(id: number) {
    if (verification?.phase !== 'animation' || verification.id !== id || verificationIdRef.current !== id) return
    if ((props.config.verificationEffect ?? CLASSIC_VERIFICATION_EFFECT) === 'flip' && !(verification.isCorrect && props.onCorrectSolution)) {
      // Keep the colored backs through the result dialog and subsequent redraws.
      verificationIdRef.current += 1
      setVerification({ ...verification, phase: 'result' })
    } else {
      // Consume the run before invoking tutorial callbacks, which may reset the board.
      cancelVerification()
    }
    if (verification.isCorrect) {
      completeGame()
      if (props.onCorrectSolution) props.onCorrectSolution()
      else openCompletionDialog()
    } else {
      toast.show({
        message: t('classic.mistakes', { count: verification.mistakeCount }),
        variant: 'error',
        size: 'large',
        uppercase: true,
      })
    }
  }

  function dismissVerificationResult() {
    if (verification?.phase !== 'result' || isGameplayPaused || isExiting || completionDialogOpen) return
    lastLockedTapRef.current = null
    setVerification({ ...verification, phase: 'restoring' })
  }

  function handleVerificationRestored(id: number) {
    if (verification?.phase !== 'restoring' || verification.id !== id) return
    cancelVerification()
  }

  function toggleCellSelection(cellKey: string, time: number) {
    if (!selectionLoaded || isGameplayPaused || isExiting || isCompleted || verification) return
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
        if (previousTap?.groupId === lockedGroup.id && time >= previousTap.time && time - previousTap.time <= DOUBLE_TAP_UNLOCK_MS && !props.disableUnlock) {
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
    const nextSelectedCells = new Set(selectedCellKeys)
    if (nextSelectedCells.has(cellKey)) nextSelectedCells.delete(cellKey)
    else {
      nextSelectedCells.add(cellKey)
      props.onSelected?.()
    }
    const automaticLockSelection = latestFourCells(nextSelectedCells)
    if (autoLock && canLockCells(automaticLockSelection)) lockCells(automaticLockSelection, nextSelectedCells)
    else setSelectedCellKeys(nextSelectedCells)
  }

  function selectHighlightedCell(event: React.PointerEvent<HTMLDivElement>) {
    if (props.boardInteractive === false || !event.currentTarget.classList.contains('driver-active-element')) return
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
    if (verification || !canLockCells(selection)) return false
    if (props.config.unlockRepeatedCornerLocks === true && !hasAllUniqueCorners(selection)) {
      // Do not leave a repeated-corner shape locked. Keeping its cells selected
      // lets the player immediately correct the attempted group.
      setSelectedCellKeys(new Set(fullSelection))
      setSelectedLockedGroupId(null)
      return false
    }
    lastLockedTapRef.current = null

    const cellKeys = [...selection]
    const color = chooseLockColor(cellKeys, lockedCellGroups)
    const group = { cellKeys, color, id: crypto.randomUUID() }
    const hasUniqueCorners = hasAllUniqueCorners(cellKeys)
    const nextMoveCount = moveCount + 1
    setLockedCellGroups((groups) => [...groups, group])
    setIsCompleted(false)
    setCompletionDialogOpen(false)
    setCompletionScreenshot(null)
    cancelVerification()
    setSelectedCellKeys(new Set([...fullSelection].filter((key) => !selection.has(key))))
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    setMoveCount(nextMoveCount)
    props.onMoveCountChange(nextMoveCount)
    props.onLocked?.(group, hasUniqueCorners)
    return true
  }

  function unlockSelectedCells() {
    if (!selectedLockedGroupId) return
    unlockGroup(selectedLockedGroupId)
  }

  function unlockGroup(groupId: string) {
    if (verification || props.disableUnlock) return
    lastLockedTapRef.current = null
    const group = lockedCellGroups.find((lockedGroup) => lockedGroup.id === groupId)
    if (!group) return
    const hasUniqueCorners = hasAllUniqueCorners(group.cellKeys)

    setLockedCellGroups((groups) => groups.filter((lockedGroup) => lockedGroup.id !== group.id))
    setIsCompleted(false)
    cancelVerification()
    setSelectedCellKeys(new Set())
    setSelectedLockedGroupId(null)
    setValidationResult(null)
    const nextUnlockCount = unlockCount + 1
    setUnlockCount(nextUnlockCount)
    props.onUnlockCountChange?.(nextUnlockCount)
    props.onUnlocked?.(group, hasUniqueCorners)
  }

  function validateLockedCells() {
    lastLockedTapRef.current = null
    if (!canValidate || verification || isGameplayPaused || isExiting || !selectionLoaded) return

    const validGroups = lockedCellGroups.filter((group) => hasAllUniqueCorners(group.cellKeys))
    const validLockCount = validGroups.length

    const isCorrect = validLockCount === lockedCellGroups.length
    setValidationResult({
      isCorrect,
      validLockCount,
    })
    setCompletionDialogOpen(false)
    setIsCompleted(isCorrect && !props.onCorrectSolution)
    setCompletionScreenshot(null)
    if (props.config.completionAnimationEnabled === false) {
      if (isCorrect) {
        completeGame()
        if (props.onCorrectSolution) {
          props.onCorrectSolution()
        } else {
          const canvas = gameCanvasRef.current?.captureBoard()
          setCompletionScreenshot(canvas ? canvas.toDataURL('image/png') : null)
          openCompletionDialog()
        }
      } else {
        toast.show({
          message: t('classic.mistakes', { count: lockedCellGroups.length - validLockCount }),
          variant: 'error',
          size: 'large',
          uppercase: true,
        })
      }
      return
    }
    const correctCellKeys = new Set(validGroups.flatMap((group) => group.cellKeys))
    setVerification({
      id: ++verificationIdRef.current,
      isCorrect,
      incorrectCellKeys: new Set([...cellMap.keys()].filter((key) => !correctCellKeys.has(key))),
      mistakeCount: lockedCellGroups.length - validLockCount,
      // Let the settled board render before either verification color is drawn.
      phase: 'screenshot',
    })
  }

  useEffect(() => {
    if (verification?.phase !== 'screenshot' || isGameplayPaused || isExiting) return
    function capture() {
      if (verificationIdRef.current !== verification!.id) return
      if (verification!.isCorrect && !props.onCorrectSolution) {
        const canvas = gameCanvasRef.current?.captureBoard()
        setCompletionScreenshot(canvas ? canvas.toDataURL('image/png') : null)
      }
      setVerification({ ...verification!, phase: 'animation' })
    }
    const configuredDelay = props.config.completionScreenshotDelayMs ?? 0
    const delay = Number.isFinite(configuredDelay) ? Math.max(0, configuredDelay) : 0
    if (delay === 0) {
      capture()
      return
    }
    const timer = window.setTimeout(capture, delay)
    return () => window.clearTimeout(timer)
  }, [verification, props.config.completionScreenshotDelayMs, props.onCorrectSolution, isGameplayPaused, isExiting])

  useEffect(() => {
    if (autoFinalVerification && canValidate && validationResult === null) validateLockedCells()
  }, [autoFinalVerification, canValidate, lockedCellGroups, validationResult, isGameplayPaused, isExiting, selectionLoaded])

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
    setCompletionPending(false)
    setCompletionResult(null)
    cancelVerification()
    setMoveCount(0)
    props.onMoveCountChange(0)
    setUnlockCount(0)
    props.onUnlockCountChange?.(0)
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
          setCompletionResult(storedSelection.completionResult)
          setElapsedSeconds(storedSelection.elapsedSeconds)
          props.onElapsedSecondsChange(storedSelection.elapsedSeconds)
          setIsCompleted(false)
          cancelVerification()
          setMoveCount(storedSelection.moveCount)
          props.onMoveCountChange(storedSelection.moveCount)
          setUnlockCount(storedSelection.unlockCount)
          props.onUnlockCountChange?.(storedSelection.unlockCount)
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
    if (!completionPending || props.deferCompletionDialog) return
    setCompletionPending(false)
    setCompletionDialogOpen(true)
  }, [completionPending, props.deferCompletionDialog])

  useEffect(() => {
    if (!selectionLoaded || isCompleted || isExiting || isGameplayPaused) return

    const timer = window.setTimeout(() => {
      const nextSeconds = elapsedSeconds + 1
      setElapsedSeconds(nextSeconds)
      props.onElapsedSecondsChange(nextSeconds)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [elapsedSeconds, isCompleted, isExiting, props.onElapsedSecondsChange, isGameplayPaused, selectionLoaded])

  useEffect(() => {
    if (!selectionLoaded || isExiting || props.persistSelection === false) return
    void queuePersistence(() => saveGameSelection(props.gameMode, props.gameId, {
      completionResult,
      elapsedSeconds,
      gameGridScreenshot,
      isCompleted,
      lockedCellGroups,
      markers: [...markers].map(([cellKey, color]) => ({ cellKey, color })),
      moveCount,
      savedAt,
      selectedCellKeys: [...selectedCellKeys],
      unlockCount,
    })).catch(() => {
      // Selection remains available for the current session if IndexedDB is unavailable.
    })
  }, [completionResult, elapsedSeconds, gameGridScreenshot, isCompleted, isExiting, lockedCellGroups, markers, moveCount, props.gameId, props.gameMode, props.persistSelection, savedAt, selectedCellKeys, selectionLoaded, unlockCount])

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col gap-4 px-1', props.entranceAnimation && 'game-grid-entrance')}
      data-revealed={isEntranceRevealed || undefined}
    >
      <div className="flex min-h-0 flex-1 items-start justify-center [container-type:size]">
        <section aria-label="Game board" className="mx-auto max-w-[550px]" id={props.boardId} ref={gameBoardRef} style={boardStyle}>
          <div className="relative w-full" style={{ aspectRatio: `${props.config.columns} / ${visibleRows}` }}>
            {props.boardBehindAdornment}
            <div className={cn('relative z-10 size-full', props.scrolling && 'border-2 border-[#773526] bg-[#773526]')}>
              <GameGridCanvas
                config={props.config}
                interactive={props.boardInteractive !== false && selectionLoaded && !isGameplayPaused && !isExiting && !isCompleted && !verification}
                lockedCellGroups={lockedCellGroups}
                markers={markers}
                onNavigate={handleGridNavigation}
                onCellExit={props.onCellExit}
                vhsCrt={props.vhsCrt}
                exitDistortion={props.exitDistortion}
                onToggle={toggleCellSelection}
                pieces={props.pieces}
                ref={gameCanvasRef}
                selectedCellKeys={selectedCellKeys}
                selectedLockedGroupId={selectedLockedGroupId}
                showCellIds={showCellIds}
                scrolling={props.scrolling}
                verificationRequest={verification && verification.phase !== 'screenshot' ? verification : undefined}
                verificationRestoring={verification?.phase === 'restoring'}
                verificationPaused={isGameplayPaused || isExiting}
                onVerificationComplete={handleVerificationComplete}
                onVerificationRestored={handleVerificationRestored}
              />
            </div>
            {props.boardForegroundAdornment}
            {verification?.phase === 'result' && (
              <button
                aria-label={t('classic.revealBoard')}
                className="absolute inset-0 z-30 size-full touch-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
                disabled={isGameplayPaused || isExiting}
                onClick={dismissVerificationResult}
                type="button"
              />
            )}
            {props.highlightAreas?.map((area) => (
              <div
                aria-hidden="true"
                className="tutorial-board-area absolute"
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
          {boardBottomAdornmentHeightRatio > 0 && <div aria-hidden="true" style={{ aspectRatio: `1 / ${boardBottomAdornmentHeightRatio}` }} />}
        </section>
      </div>
      {!props.config.hideGameControls && <div className={cn('mx-auto flex w-full max-w-[550px] shrink-0 flex-nowrap justify-center gap-1 transition-opacity sm:gap-2', props.hideGameControls && 'pointer-events-none opacity-0')}>
        <Button
          aria-label={t('common.restart')}
          className="text-[var(--canvas-foreground)]"
          disabled={!selectionLoaded || isExiting}
          id={props.tutorialControlIds?.reset}
          onClick={requestRestart}
          size="icon-lg"
          title={t('common.restart')}
          type="button"
        >
          <RotateCcw aria-hidden="true" />
        </Button>
        <Button
          aria-label="Deselect all cells"
          className="text-[var(--canvas-foreground)]"
          disabled={!!verification || (selectedCellKeys.size === 0 && !selectedLockedGroupId)}
          id={props.tutorialControlIds?.clear}
          onClick={clearSelectedCells}
          size="icon-lg"
          title="Deselect all cells"
          type="button"
        >
          <Eraser aria-hidden="true" />
        </Button>
        <Button
          aria-label="Take notes"
          disabled={!!verification}
          id={props.tutorialControlIds?.notes}
          aria-pressed={markerMode}
          className={cn(
            'text-[var(--canvas-foreground)]',
          )}
          color={markerMode ? 'var(--yellow)' : undefined}
          onClick={() => setMarkerMode((active) => !active)}
          size="icon-lg"
          title="Take notes"
          type="button"
        >
          <Pencil aria-hidden="true" />
        </Button>
        {!autoLock && <Button
          aria-label="Lock four selected cells"
          className="text-[var(--mint)]"
          disabled={!!verification || !canLockSelectedCells}
          id={props.tutorialControlIds?.lock ?? props.lockButtonId}
          onClick={lockSelectedCells}
          size="icon-lg"
          title="Lock four selected cells"
          type="button"
        >
          <Lock aria-hidden="true" />
        </Button>}
        {!autoLock && <Button
          aria-label="Unlock selected cells"
          className="text-[var(--canvas-foreground)]"
          color="var(--paper-muted)"
          disabled={!!verification || !selectedLockedGroupId}
          id={props.tutorialControlIds?.unlock}
          onClick={unlockSelectedCells}
          size="icon-lg"
          title="Unlock selected cells"
          type="button"
        >
          <Unlock aria-hidden="true" />
        </Button>}
        {!props.scrolling && <div className="relative shrink-0">
          {/* The badge lives outside the button: .clips its own children. */}
          <Button
            {...(validationResult?.isCorrect ? DEPTH_BUTTON_COLORS.green : validationResult ? DEPTH_BUTTON_COLORS.red : DEPTH_BUTTON_COLORS.blue)}
            aria-label={verificationLabel}
            className={cn(
              'text-[var(--canvas-foreground)]',
            )}
            disabled={!canValidate || !!verification || isGameplayPaused || isExiting}
            id={props.tutorialControlIds?.verify ?? props.verifyButtonId}
            onClick={validateLockedCells}
            size="icon-lg"
            title={verificationLabel}
            type="button"
          >
            <Check aria-hidden="true" />
          </Button>
          {/* {verificationMistakeCount > 0 &&
            <span
              aria-label={t('classic.mistakes', { count: verificationMistakeCount })}
              className="pointer-events-none absolute origin-left -top-3 -right-10 uppercase z-10 grid text-nowrap px-5 place-items-center rounded-full border-2 border-[var(--coral)] bg-white text-[20px] leading-none font-black text-[var(--coral)] shadow-sm"
              data-testid="verification-mistake-badge"
            >
              {verificationMistakeCount}
            </span>
          } */}
        </div>}
      </div>}
      <CorrectGameDialog
        hasBonus={props.hasBonus === true}
        result={completionResult ?? undefined}
        onNext={props.onNextGame}
        onOpenChange={handleCompletionOpenChange}
        open={completionDialogOpen}
        screenshot={completionScreenshot}
      />
      {props.pauseDialog ?? <ClassicPauseDialog gameMode={props.gameMode} isCareerLevel={props.isCareerLevel} isSaving={isExiting} onOpenChange={props.onPauseOpenChange} onQuitWithoutSaving={quitWithoutSavingFromPause} onRestart={requestRestart} onResume={() => props.onPauseOpenChange(false)} onSaveAndQuit={saveAndQuitFromPause} open={props.paused} seed={props.gameId} />}
      <ClassicRestartDialog onOpenChange={(open) => {
        setRestartConfirmationOpen(open)
        props.onRestartDialogOpenChange?.(open)
      }} onRestart={confirmRestart} open={restartConfirmationOpen} />
    </div>
  )
}
