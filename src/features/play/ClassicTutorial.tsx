import { useEffect, useState } from 'react'
import { Pause } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { createTutorialDriver } from '@/components/tutorial/createTutorialDriver'
import type { GameConfig, PlacedTetromino } from '@/game/gameConfig'
import { GameGrid } from './GameGrid'

const TUTORIAL_CONFIG: GameConfig = {
  columns: 5,
  rows: 5,
  spread: 0,
  tetrominoCount: 0,
}

const TUTORIAL_PIECES: readonly PlacedTetromino[] = []

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [pauseOpen, setPauseOpen] = useState(false)

  useEffect(() => {
    const tutorial = createTutorialDriver([{
      element: '#classic-tutorial-board',
      popover: {
        description: 'Walcome to Corneromino !',
        side: 'bottom',
      },
    }], {
      onClose: () => {
        if (returnToClassicGame) navigate(-1)
        else navigate('/play', { replace: true })
      },
    })
    tutorial.drive()
    return () => tutorial.destroy()
  }, [navigate, returnToClassicGame])

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] flex-col gap-3 px-5 pb-6">
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
          config={TUTORIAL_CONFIG}
          gameId="classic-tutorial"
          gameMode="super-easy"
          onElapsedSecondsChange={setElapsedSeconds}
          onMoveCountChange={setMoveCount}
          onNextGame={() => undefined}
          onPauseOpenChange={setPauseOpen}
          paused={pauseOpen}
          persistSelection={false}
          pieces={TUTORIAL_PIECES}
        />
      </div>
    </main>
  )
}
