import { useEffect, useRef, useState } from 'react'
import { Pause } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { createTutorialDriver } from '@/components/tutorial/createTutorialDriver'
import type { GameConfig, PlacedTetromino } from '@/game/gameConfig'
import { GameGrid } from './GameGrid'
import { cn } from '@/lib/utils'

const TUTORIAL_CONFIG: GameConfig = {
  completionAnimationEnabled: false,
  finalLockAnimationEnabled: true,
  hideGameControls: true,
  navigationEnabled: false,
  lockingMode: 'auto',
  finalVerificationMode: 'auto',
  columns: 5,
  rows: 5,
  spread: 0,
  tetrominoCount: 0,
}

const TUTORIAL_ALL_CORNEROMINOS_CONFIG: GameConfig = {
  completionAnimationEnabled: false,
  finalLockAnimationEnabled: true,
  hideGameControls: true,
  navigationEnabled: false,
  lockingMode: 'auto',
  finalVerificationMode: 'auto',
  columns: 10,
  rows: 10,
  spread: 0,
  tetrominoCount: 0,
}

const TUTORIAL_T_ROTATIONS_CONFIG: GameConfig = {
  completionAnimationEnabled: false,
  finalLockAnimationEnabled: true,
  hideGameControls: true,
  navigationEnabled: false,
  lockingMode: 'auto',
  finalVerificationMode: 'auto',
  columns: 6,
  rows: 6,
  spread: 0,
  tetrominoCount: 0,
}

interface TutorialScenario {
  pieces: readonly PlacedTetromino[],
  config : GameConfig
}

const TUTORIAL_SCENARIOS = {
  'corners': {
    config: TUTORIAL_CONFIG,
    pieces: [{
      id: 1,
      kind: 'O',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 3, y: 1 },
        { cellId: 'b', corner: 'bottom-right', x: 3, y: 3 },
        { cellId: 'c', corner: 'bottom-left', x: 1, y: 3 },
        { cellId: 'd', corner: 'top-left', x: 1, y: 1 },
      ],
    }],
  },
  'shape-example': {
    config: TUTORIAL_CONFIG,
    pieces: [{
      id: 1,
      kind: 'L',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 1, y: 1 },
        { cellId: 'b', corner: 'bottom-right', x: 1, y: 2 },
        { cellId: 'c', corner: 'bottom-left', x: 1, y: 3 },
        { cellId: 'd', corner: 'top-left', x: 2, y: 3 },
      ],
    }],
  },
  't-rotations': {
    config: TUTORIAL_T_ROTATIONS_CONFIG,
    pieces: [{
      id: 1,
      kind: 'T',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 1, y: 0 },
        { cellId: 'b', corner: 'bottom-right', x: 0, y: 1 },
        { cellId: 'c', corner: 'bottom-left', x: 1, y: 1 },
        { cellId: 'd', corner: 'top-left', x: 2, y: 1 },
      ],
    }, {
      id: 2,
      kind: 'T',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 4, y: 0 },
        { cellId: 'b', corner: 'bottom-right', x: 4, y: 1 },
        { cellId: 'c', corner: 'bottom-left', x: 5, y: 1 },
        { cellId: 'd', corner: 'top-left', x: 4, y: 2 },
      ],
    }, {
      id: 3,
      kind: 'T',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 0, y: 4 },
        { cellId: 'b', corner: 'bottom-right', x: 1, y: 4 },
        { cellId: 'c', corner: 'bottom-left', x: 2, y: 4 },
        { cellId: 'd', corner: 'top-left', x: 1, y: 5 },
      ],
    }, {
      id: 4,
      kind: 'T',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 5, y: 3 },
        { cellId: 'b', corner: 'bottom-right', x: 4, y: 4 },
        { cellId: 'c', corner: 'bottom-left', x: 5, y: 4 },
        { cellId: 'd', corner: 'top-left', x: 5, y: 5 },
      ],
    }],
  },
  'all-corneromino': {
    config: TUTORIAL_ALL_CORNEROMINOS_CONFIG,
    pieces: [{
      id: 1,
      kind: 'diagonal',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 0, y: 0 },
        { cellId: 'b', corner: 'bottom-right', x: 1, y: 1 },
        { cellId: 'c', corner: 'bottom-left', x: 2, y: 2 },
        { cellId: 'd', corner: 'top-left', x: 3, y: 3 },
      ],
    }, {
      id: 2,
      kind: 'I',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 5, y: 0 },
        { cellId: 'b', corner: 'bottom-right', x: 5, y: 1 },
        { cellId: 'c', corner: 'bottom-left', x: 5, y: 2 },
        { cellId: 'd', corner: 'top-left', x: 5, y: 3 },
      ],
    }, {
      id: 3,
      kind: 'S',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 8, y: 0 },
        { cellId: 'b', corner: 'bottom-right', x: 9, y: 0 },
        { cellId: 'c', corner: 'bottom-left', x: 7, y: 1 },
        { cellId: 'd', corner: 'top-left', x: 8, y: 1 },
      ],
    }, {
      id: 4,
      kind: 'L',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 2, y: 5 },
        { cellId: 'b', corner: 'bottom-right', x: 1, y: 5 },
        { cellId: 'c', corner: 'bottom-left', x: 0, y: 5 },
        { cellId: 'd', corner: 'top-left', x: 0, y: 6 },
      ],
    }, {
      id: 5,
      kind: 'J',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 6, y: 6 },
        { cellId: 'b', corner: 'bottom-right', x: 5, y: 6 },
        { cellId: 'c', corner: 'bottom-left', x: 4, y: 6 },
        { cellId: 'd', corner: 'top-left', x: 4, y: 5 },
      ],
    }, {
      id: 6,
      kind: 'O',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 0, y: 8 },
        { cellId: 'b', corner: 'bottom-right', x: 1, y: 8 },
        { cellId: 'c', corner: 'bottom-left', x: 0, y: 9 },
        { cellId: 'd', corner: 'top-left', x: 1, y: 9 },
      ],
    }, {
      id: 7,
      kind: 'Z',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 3, y: 8 },
        { cellId: 'b', corner: 'bottom-right', x: 4, y: 8 },
        { cellId: 'c', corner: 'bottom-left', x: 4, y: 9 },
        { cellId: 'd', corner: 'top-left', x: 5, y: 9 },
      ],
    }, {
      id: 8,
      kind: 'T',
      cells: [
        { cellId: 'a', corner: 'top-right', x: 8, y: 8 },
        { cellId: 'b', corner: 'bottom-right', x: 7, y: 9 },
        { cellId: 'c', corner: 'bottom-left', x: 8, y: 9 },
        { cellId: 'd', corner: 'top-left', x: 9, y: 9 },
      ],
    }],
  },
} satisfies Record<string, TutorialScenario>

type TutorialScenarioKey = keyof typeof TUTORIAL_SCENARIOS

const TUTORIAL_HIGHLIGHT_AREAS: readonly { height: number; id: string; left: number; top: number; width: number }[] = [
  { id: 'classic-tutorial-corners', left: 1, top: 1, width: 3, height: 3 },
  { id: 'classic-tutorial-top-right', left: 3, top: 1, width: 1, height: 1 },
  { id: 'classic-tutorial-bottom-right', left: 3, top: 3, width: 1, height: 1},
  { id: 'classic-tutorial-bottom-left', left: 1, top: 3, width: 1, height: 1 },
  { id: 'classic-tutorial-top-left', left: 1, top: 1, width: 1, height: 1 },
  { id: 'classic-tutorial-shape-example', left: 1, top: 1, width: 2, height: 3 },
  // { id: 'classic-tutorial-all-cornerominos', left: 0, top: 0, width: 5, height: 5 },
]

function formatElapsedTime(elapsedSeconds: number) {
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function ClassicTutorial() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const returnToClassicGame = location.state !== null && typeof location.state === 'object' && 'returnToClassicGame' in location.state && location.state.returnToClassicGame === true
  const returnToMainMenu = location.state !== null && typeof location.state === 'object' && 'returnToMainMenu' in location.state && location.state.returnToMainMenu === true
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [tutorialScenario, setTutorialScenario] = useState<TutorialScenarioKey>('corners')
  const tutorialRef = useRef<ReturnType<typeof createTutorialDriver> | null>(null)

  function handleCorrectSolution() {
    if (tutorialScenario === 'shape-example') {
      setTutorialScenario('t-rotations')
      tutorialRef.current?.moveNext()
    } else if (tutorialScenario === 't-rotations') {
      setTutorialScenario('all-corneromino')
      tutorialRef.current?.moveNext()
    } else if (tutorialScenario === 'all-corneromino') {
      tutorialRef.current?.moveNext()
    }
  }

  useEffect(() => {
    const tutorial = createTutorialDriver([{
      element: '#classic-tutorial-corners',
      onHighlightStarted: () => setTutorialScenario('corners'),
      popover: {
        description: t('tutorial.classicSteps.corners'),
        side: 'bottom',
      },
    }, {
      element: '#classic-tutorial-top-right',
      onHighlightStarted: () => setTutorialScenario('corners'),
      popover: { description: t('tutorial.classicSteps.topRight'), side: 'bottom' },
    }, {
      element: '#classic-tutorial-bottom-right',
      onHighlightStarted: () => setTutorialScenario('corners'),
      popover: { description: t('tutorial.classicSteps.bottomRight'), side: 'bottom' },
    }, {
      element: '#classic-tutorial-bottom-left',
      onHighlightStarted: () => setTutorialScenario('corners'),
      popover: { description: t('tutorial.classicSteps.bottomLeft'), side: 'bottom' },
    }, {
      element: '#classic-tutorial-top-left',
      onHighlightStarted: () => setTutorialScenario('corners'),
      popover: { description: t('tutorial.classicSteps.topLeft'), side: 'bottom' },
    }, {
      element: '#classic-tutorial-shape-example',
      nextLocked: true,
      onHighlightStarted: () => setTutorialScenario('shape-example'),
      popover: {
        description: t('tutorial.classicSteps.shapeExample'),
        side: 'bottom',
      }
    }, {
      element: '#classic-tutorial-shape-example',
      onHighlightStarted: () => setTutorialScenario('shape-example'),
      popover: {
        description: t('tutorial.classicSteps.shapeExampleCompleted'),
        side: "bottom"
      }
    }, {
      element: '#classic-tutorial-board',
      nextLocked: true,
      onHighlightStarted: () => setTutorialScenario('t-rotations'),
      popover: { description: t('tutorial.classicSteps.tRotations'), side: 'bottom' },
    }, {
      element: '#classic-tutorial-board',
      onHighlightStarted: () => setTutorialScenario('t-rotations'),
      popover: { description: t('tutorial.classicSteps.tRotationsCompleted'), side: 'bottom' },
    }, {
      element: '#classic-tutorial-board',
      nextLocked: true,
      onHighlightStarted: () => setTutorialScenario('all-corneromino'),
      popover: { description: t('tutorial.classicSteps.allCornerominos'), side: 'bottom' },
    }, {
      element: '#classic-tutorial-board',
      onHighlightStarted: () => setTutorialScenario('all-corneromino'),
      popover: { description: t('tutorial.classicSteps.completed'), side: 'bottom' },
    }], {
      labels: {
        close: t('common.close'),
        next: t('common.next'),
        previous: t('common.previous'),
      },
      onClose: () => {
        if (returnToClassicGame) navigate(-1)
        else if (returnToMainMenu) navigate('/', { replace: true })
        else navigate('/play', { replace: true })
      },
    })
    tutorialRef.current = tutorial
    tutorial.drive()
    return () => {
      if (tutorialRef.current === tutorial) tutorialRef.current = null
      tutorial.destroy()
    }
  }, [navigate, returnToClassicGame, returnToMainMenu, t])

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className={cn(
        "relative z-10 mx-auto flex w-full max-w-[550px] flex-col gap-3 px-5 pb-6",
        TUTORIAL_SCENARIOS[tutorialScenario].config.hideGameControls && "opacity-0"
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="poster-title text-[33px] leading-none">{t('classic.title')}</h1>
            <span aria-hidden="true" className="mt-0.5 text-[24px] leading-none text-[var(--canvas-foreground)] opacity-40">?</span>
          </div>
          <Button aria-label={`${t('common.pause')} ${t('classic.title')}`} className="cartoon-press size-10 shrink-0 text-[var(--canvas-foreground)]" onClick={() => setPauseOpen(true)} size="icon" title={t('common.pause')} type="button">
            <Pause aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="poster-kicker flex items-center gap-3 text-[11px] text-[var(--muted-text-color)]">
            <p>Tutorial</p>
            <span aria-hidden="true">/</span>
            <p>{moveCount} moves</p>
          </div>
          <p className="poster-kicker shrink-0 text-[11px] text-[var(--muted-text-color)]">{formatElapsedTime(elapsedSeconds)}</p>
        </div>
      </header>
      <div className="relative z-10 min-h-0 flex-1">
        <GameGrid
          boardId="classic-tutorial-board"
          boardResetKey={tutorialScenario}
          config={TUTORIAL_SCENARIOS[tutorialScenario].config}
          gameId="classic-tutorial"
          gameMode="super-easy"
          highlightAreas={TUTORIAL_HIGHLIGHT_AREAS}
          onCorrectSolution={handleCorrectSolution}
          onElapsedSecondsChange={setElapsedSeconds}
          onMoveCountChange={setMoveCount}
          onNextGame={() => undefined}
          onPauseOpenChange={setPauseOpen}
          paused={pauseOpen}
          persistSelection={false}
          pieces={TUTORIAL_SCENARIOS[tutorialScenario].pieces}
        />
      </div>
    </main>
  )
}
