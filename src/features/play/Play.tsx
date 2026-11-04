import { useEffect, useState } from 'react'
import { Pause } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { createRandomSeed, createSeededRandom } from '@/game/random'
import { GAME_CONFIGS, isGameMode, type ClassicGameMode, type PlacedTetromino } from '@/game/gameConfig'
import { clearGameSelection } from '@/lib/db'
import { generateTetrominoPlacementsV2 } from '@/game/placementV2'
import { GameGrid } from './GameGrid'
import { ClassicShapesDialog } from './ClassicShapesDialog'

function formatElapsedTime(elapsedSeconds: number) {
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

interface GameSessionProps {
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
  const [pieces, setPieces] = useState<PlacedTetromino[] | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const seed = props.requestedSeed || generatedSeed
  const config = GAME_CONFIGS[props.gameMode]

  function nextGame() {
    navigate(`/play?mode=${props.gameMode}&seed=${encodeURIComponent(createRandomSeed())}`)
  }

  useEffect(() => {
    if (!props.requestedSeed) {
      void clearGameSelection(props.gameMode, generatedSeed)
      navigate(`/play?mode=${props.gameMode}&seed=${encodeURIComponent(generatedSeed)}`, { replace: true, state: location.state })
    }
  }, [generatedSeed, location.state, navigate, props.gameMode, props.requestedSeed])

  useEffect(() => {
    let active = true
    setGenerationError(null)
    setElapsedSeconds(0)
    setMoveCount(0)
    setPieces(null)

    void generateTetrominoPlacementsV2(config, {
      random: createSeededRandom(`${props.gameMode}:${seed}`),
      yieldEvery: 250,
    })
      .then((generatedPieces) => {
        if (active) {
          setPieces(generatedPieces)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setGenerationError(error instanceof Error ? error.message : 'Could not generate this game.')
        }
      })

    return () => {
      active = false
    }
  }, [config, props.gameMode, seed])

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] flex-col gap-3 px-5 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="poster-title text-[33px] leading-none">{t('classic.title')}</h1>
            <Button
              aria-label={t('classic.shapesTitle')}
              className="h-auto min-w-0 border-0 bg-transparent p-0 text-[24px] leading-none text-[var(--canvas-foreground)] opacity-40 font-black shadow-none hover:opacity-70 focus-visible:opacity-100"
              onClick={() => setShapesOpen(true)}
              size="icon"
              title={t('classic.shapesTitle')}
              type="button"
            >?</Button>
          </div>
          <Button
            aria-label={`${t('common.pause')} ${t('classic.title')}`}
            className="cartoon-press size-10 shrink-0 text-[var(--canvas-foreground)]"
            onClick={() => setPauseOpen(true)}
            size="icon"
            title={t('common.pause')}
            type="button">
            <Pause aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="poster-kicker flex items-center gap-3 text-[11px] text-[var(--muted-text-color)]">
            <p>{t(config.title)}</p>
            <span aria-hidden="true">/</span>
            <p>{moveCount} moves</p>
          </div>
          <p className="poster-kicker shrink-0 text-[11px] text-[var(--muted-text-color)]">{formatElapsedTime(elapsedSeconds)}</p>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1">
        {pieces &&
          <GameGrid
            config={config}
            gameId={seed}
            gameMode={props.gameMode}
            key={`${props.gameMode}:${seed}`}
            onElapsedSecondsChange={setElapsedSeconds}
            onMoveCountChange={setMoveCount}
            onNextGame={nextGame}
            onPauseOpenChange={setPauseOpen}
            paused={pauseOpen}
            pieces={pieces}
            suspended={shapesOpen}
          />}
        {!pieces && !generationError &&
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

  if (!isGameMode(gameMode)) return <Navigate replace to="/play/levels" />

  return <GameSession gameMode={gameMode} key={`${gameMode}:${requestedSeed ?? 'new'}`} requestedSeed={requestedSeed} />
}
