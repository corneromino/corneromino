import { useEffect, useRef, useState } from 'react'
import { Pause } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { createTutorialDriver } from '@/components/tutorial/createTutorialDriver'
import { createRandomSeed, createSeededRandom } from '@/game/random'
import { GAME_CONFIGS, isGameMode, type ClassicGameMode } from '@/game/gameConfig'
import { clearGameSelection, completeCareerLevel, loadClassicGameDefinition, type ClassicGameDefinition } from '@/lib/db'
import { generateTetrominoPlacementsV2 } from '@/game/placementV2'
import { getCareerGameId, getCareerLevel, getCareerLevelPath, getNextCareerLevel, type ResolvedCareerLevel } from './careerLevels'
import { GameGrid } from './GameGrid'
import { ClassicShapesDialog } from './ClassicShapesDialog'
import { getCareerTutorialTargetId, type CareerTutorialAction, type CareerTutorialStep } from './careerTutorial'
import { cn } from '@/lib/utils'

function formatElapsedTime(elapsedSeconds: number) {
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

const EMPTY_CAREER_TUTORIAL_STEPS: readonly CareerTutorialStep[] = []
const ATTEMPT_MOVE_COLOR = '#5fc47a'
const ATTEMPT_UNLOCK_COLOR = '#e4555c'

interface AttemptProgressBarProps {
  ariaLabel: string
  moveCount: number
  requiredLockCount: number
  unlockCount: number
}

function AttemptProgressBar({ ariaLabel, moveCount, requiredLockCount, unlockCount }: AttemptProgressBarProps) {
  const total = Math.max(1, requiredLockCount + unlockCount * 2, moveCount + unlockCount)
  const moveWidth = Math.min(100, moveCount / total * 100)
  const unlockWidth = Math.min(100 - moveWidth, unlockCount / total * 100)
  return (
    <div
      aria-label={ariaLabel}
      className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--outline-color)] border-3 border-(--outline-color)"
      role="img"
    >
      <span className="absolute inset-y-0 left-0 transition-[width] duration-200" style={{ backgroundColor: ATTEMPT_MOVE_COLOR, width: `${moveWidth}%` }} />
      <span className="absolute inset-y-0 right-0 transition-[width] duration-200" style={{ backgroundColor: ATTEMPT_UNLOCK_COLOR, width: `${unlockWidth}%` }} />
    </div>
  )
}

interface GameSessionProps {
  careerLevel?: ResolvedCareerLevel
  gameMode: ClassicGameMode
  requestedSeed: string | null
}

function GameSession(props: GameSessionProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [generatedSeed] = useState(createRandomSeed)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [unlockCount, setUnlockCount] = useState(0)
  const [gameDefinition, setGameDefinition] = useState<ClassicGameDefinition | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const careerTutorial = props.careerLevel?.tutorial
  const tutorialSteps = careerTutorial?.steps ?? EMPTY_CAREER_TUTORIAL_STEPS
  const [tutorialSelectionReady, setTutorialSelectionReady] = useState(() => careerTutorial === undefined)
  const [tutorialOpen, setTutorialOpen] = useState(() => tutorialSteps.length > 0)
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0)
  const [tutorialSuspended, setTutorialSuspended] = useState(false)
  const tutorialRef = useRef<ReturnType<typeof createTutorialDriver> | null>(null)
  const tutorialStepIndexRef = useRef(0)
  const seed = props.careerLevel ? getCareerGameId(props.careerLevel.data) : props.requestedSeed || generatedSeed
  const modeConfig = GAME_CONFIGS[props.gameMode]
  const gameTitle = props.careerLevel ? t('career.level', { number: props.careerLevel.number }) : gameDefinition?.source === 'custom' && gameDefinition.customName ? gameDefinition.customName : t(modeConfig.title)
  const requiredLockCount = gameDefinition?.config.tetrominoCount ?? modeConfig.tetrominoCount
  const attemptAriaLabel = `${t('classic.moves', { count: moveCount })} / ${t('classic.unlocks', { count: unlockCount })}`
  const activeTutorialStep = tutorialOpen ? tutorialSteps[tutorialStepIndex] : undefined
  const tutorialBoardInteractive = activeTutorialStep?.boardInteractive !== false
  const tutorialShowsUI = activeTutorialStep?.showUI !== false
  const tutorialHighlightAreas = tutorialSteps.flatMap((step, index) => step.area === 'board'
    ? [{ height: step.rows, id: getCareerTutorialTargetId(step.area, index), left: step.x, top: step.y, width: step.columns }]
    : [])
  const tutorialControlIds = careerTutorial ? {
    clear: getCareerTutorialTargetId('clear'),
    lock: getCareerTutorialTargetId('lock'),
    notes: getCareerTutorialTargetId('notes'),
    reset: getCareerTutorialTargetId('reset'),
    unlock: getCareerTutorialTargetId('unlock'),
    verify: getCareerTutorialTargetId('verify'),
  } : undefined

  function setActiveTutorialStepIndex(index: number) {
    tutorialStepIndexRef.current = index
    setTutorialStepIndex(index)
  }

  function advanceTutorial(action: CareerTutorialAction) {
    const step = tutorialSteps[tutorialStepIndex]
    if (!tutorialOpen || !step?.advanceOn?.includes(action)) return

    const nextStepIndex = tutorialStepIndex + 1
    if (nextStepIndex >= tutorialSteps.length) {
      tutorialRef.current?.destroy()
      tutorialRef.current = null
      setTutorialOpen(false)
      return
    }

    // Render the next step's UI before Driver resolves its next target.
    setActiveTutorialStepIndex(nextStepIndex)
    if (tutorialSuspended) {
      setTutorialSuspended(false)
      return
    }
    requestAnimationFrame(() => tutorialRef.current?.moveTo(nextStepIndex))
  }

  function suspendTutorialForRestart() {
    const step = tutorialSteps[tutorialStepIndex]
    if (!tutorialOpen || (!step?.advanceOn?.includes('reset') && step?.area !== 'reset')) return
    tutorialRef.current?.destroy()
    tutorialRef.current = null
    setTutorialSuspended(true)
  }

  function handleRestartDialogOpenChange(open: boolean) {
    if (!open && tutorialSuspended) setTutorialSuspended(false)
  }

  function handleTutorialRestarted() {
    const step = tutorialSteps[tutorialStepIndex]
    if (step?.advanceOn?.includes('reset')) {
      advanceTutorial('reset')
    } else if (tutorialSuspended) {
      setTutorialSuspended(false)
    }
  }

  function nextGame() {
    if (props.careerLevel) {
      const nextLevel = getNextCareerLevel(props.careerLevel)
      navigate(nextLevel ? getCareerLevelPath(nextLevel) : '/')
      return
    }
    navigate(`/play?mode=${props.gameMode}&seed=${encodeURIComponent(createRandomSeed())}`)
  }

  useEffect(() => {
    if (!props.requestedSeed && !props.careerLevel) {
      void clearGameSelection(props.gameMode, generatedSeed)
      navigate(`/play?mode=${props.gameMode}&seed=${encodeURIComponent(generatedSeed)}`, { replace: true, state: location.state })
    }
  }, [generatedSeed, location.state, navigate, props.careerLevel, props.gameMode, props.requestedSeed])

  useEffect(() => {
    if (!careerTutorial) {
      setTutorialSelectionReady(true)
      return
    }

    let active = true
    setTutorialSelectionReady(false)
    void (async () => {
      try {
        await clearGameSelection(props.gameMode, seed)
      } catch {
        // GameGrid still starts from a fresh in-memory selection below.
      } finally {
        if (active) setTutorialSelectionReady(true)
      }
    })()
    return () => {
      active = false
    }
  }, [careerTutorial, props.gameMode, seed])

  useEffect(() => {
    let active = true
    setGenerationError(null)
    setElapsedSeconds(0)
    setMoveCount(0)
    setUnlockCount(0)
    setGameDefinition(null)

    const definition = props.careerLevel
      ? Promise.resolve({ ...props.careerLevel.data, seed })
      : loadClassicGameDefinition(props.gameMode, seed)
    void definition
      .catch(() => null)
      .then(async (savedDefinition) => {
        if (savedDefinition) return savedDefinition
        const pieces = await generateTetrominoPlacementsV2(modeConfig, {
          random: createSeededRandom(`${props.gameMode}:${seed}`),
          yieldEvery: 250,
        })
        return {
          config: { ...modeConfig },
          gameMode: props.gameMode,
          pieces,
          seed,
          version: 1,
        } satisfies ClassicGameDefinition
      })
      .then((definition) => {
        if (active) setGameDefinition(definition)
      })
      .catch((error: unknown) => {
        if (active) {
          setGenerationError(error instanceof Error ? error.message : 'Could not generate this game.')
        }
      })

    return () => {
      active = false
    }
  }, [modeConfig, props.careerLevel, props.gameMode, seed])

  useEffect(() => {
    if (!gameDefinition || !tutorialSelectionReady || !tutorialOpen || tutorialSuspended || tutorialSteps.length === 0) return
    const tutorial = createTutorialDriver(tutorialSteps.map((step, index) => ({
      element: `#${getCareerTutorialTargetId(step.area, index)}`,
      nextLocked: step.advanceOn !== undefined && step.advanceOn.length > 0,
      onHighlightStarted: () => setActiveTutorialStepIndex(index),
      popover: { description: step.content, side: 'bottom' },
    })), {
      labels: {
        close: t('common.close'),
        next: t('common.next'),
        previous: t('common.previous'),
      },
      onClose: () => setTutorialOpen(false),
    })
    tutorialRef.current = tutorial
    tutorial.drive(tutorialStepIndexRef.current)
    return () => {
      if (tutorialRef.current === tutorial) tutorialRef.current = null
      tutorial.destroy()
    }
  }, [gameDefinition, t, tutorialOpen, tutorialSelectionReady, tutorialSteps, tutorialSuspended])

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className={cn('relative z-10 mx-auto flex w-full max-w-[550px] flex-col gap-3 px-5 pb-6 transition-opacity', !tutorialShowsUI && 'pointer-events-none opacity-0')}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="poster-title text-[33px] leading-none">{gameTitle}</h1>
            <Button
              aria-label={t('classic.shapesTitle')}
              className="h-auto min-w-0 border-0 bg-transparent p-0 text-[24px] leading-none text-[var(--canvas-foreground)] opacity-40 font-black shadow-none hover:opacity-70 focus-visible:opacity-100"
              onClick={() => setShapesOpen(true)}
              size="icon"
              title={t('classic.shapesTitle')}
              type="button"
              variant="ghost"
            >?</Button>
          </div>
          <Button
            aria-label={`${t('common.pause')} ${gameTitle}`}
            className="size-10 shrink-0 text-[var(--canvas-foreground)]"
            onClick={() => setPauseOpen(true)}
            size="icon"
            title={t('common.pause')}
            type="button">
            <Pause aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <AttemptProgressBar ariaLabel={attemptAriaLabel} moveCount={moveCount} requiredLockCount={requiredLockCount} unlockCount={unlockCount} />
          <p className="poster-kicker shrink-0 text-[11px] text-[var(--muted-text-color)]">{formatElapsedTime(elapsedSeconds)}</p>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1">
        {gameDefinition && tutorialSelectionReady &&
          <GameGrid
            boardInteractive={tutorialBoardInteractive}
            config={gameDefinition.config}
            deferCompletionDialog={tutorialOpen}
            exitPath={props.careerLevel ? '/' : undefined}
            gameDefinition={gameDefinition}
            gameId={seed}
            gameMode={props.gameMode}
            hideGameControls={!tutorialShowsUI}
            highlightAreas={tutorialHighlightAreas}
            isCareerLevel={!!props.careerLevel}
            key={`${props.gameMode}:${seed}:${gameDefinition.version}`}
            onElapsedSecondsChange={setElapsedSeconds}
            onGameCompleted={props.careerLevel ? () => {
              void completeCareerLevel(props.careerLevel!.data.seed, unlockCount === 0 ? 2 : 1)
              advanceTutorial('complete')
            } : undefined}
            onLocked={() => advanceTutorial('lock')}
            onMoveCountChange={setMoveCount}
            onNextGame={nextGame}
            onPauseOpenChange={setPauseOpen}
            onRestartDialogOpenChange={handleRestartDialogOpenChange}
            onRestartRequested={suspendTutorialForRestart}
            onRestarted={handleTutorialRestarted}
            onSelected={() => advanceTutorial('select')}
            onUnlocked={() => advanceTutorial('unlock')}
            onUnlockCountChange={setUnlockCount}
            paused={pauseOpen}
            persistSelection={careerTutorial ? false : undefined}
            pieces={gameDefinition.pieces}
            suspended={shapesOpen}
            tutorialControlIds={tutorialControlIds}
          />}
        {!gameDefinition && !generationError &&
          <p className="px-5 text-center text-[11px] font-bold uppercase">{t('classic.generating')}</p>
        }
        {generationError &&
          <p className="px-5 text-center text-[11px] font-bold text-[var(--coral)]" role="alert">{generationError}</p>
        }
      </div>
      <ClassicShapesDialog onOpenChange={setShapesOpen} open={shapesOpen} />
    </main>
  )
}

export function Play() {
  const [searchParams] = useSearchParams()
  const gameMode = searchParams.get('mode')
  const requestedSeed = searchParams.get('seed')
  const careerSeed = searchParams.get('career')
  const careerLevel = careerSeed === null ? null : getCareerLevel(careerSeed)

  if (careerSeed !== null && !careerLevel) return <Navigate replace to="/play/levels" />
  if (careerLevel) return <GameSession careerLevel={careerLevel} gameMode={careerLevel.data.gameMode} key={`career:${careerLevel.data.seed}`} requestedSeed={getCareerGameId(careerLevel.data)} />

  if (!isGameMode(gameMode)) return <Navigate replace to="/play/levels" />

  return <GameSession gameMode={gameMode} key={`${gameMode}:${requestedSeed ?? 'new'}`} requestedSeed={requestedSeed} />
}
