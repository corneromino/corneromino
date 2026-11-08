import { useEffect, useState } from 'react'
import { Pause } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { createRandomSeed, createSeededRandom } from '@/game/random'
import { GAME_CONFIGS, isGameMode, type ClassicGameMode } from '@/game/gameConfig'
import { clearGameSelection, loadClassicGameDefinition, type ClassicGameDefinition } from '@/lib/db'
import { generateTetrominoPlacementsV2 } from '@/game/placementV2'
import { getCareerGameId, getCareerLevel, getCareerLevelPath, getNextCareerLevel, type ResolvedCareerLevel } from './careerLevels'
import { GameGrid } from './GameGrid'
import { ClassicShapesDialog } from './ClassicShapesDialog'

function formatElapsedTime(elapsedSeconds: number) {
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
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
  const [gameDefinition, setGameDefinition] = useState<ClassicGameDefinition | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const seed = props.careerLevel ? getCareerGameId(props.careerLevel.data) : props.requestedSeed || generatedSeed
  const modeConfig = GAME_CONFIGS[props.gameMode]
  const gameTitle = props.careerLevel ? t('career.level', { number: props.careerLevel.number }) : gameDefinition?.source === 'custom' && gameDefinition.customName ? gameDefinition.customName : t(modeConfig.title)

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
    let active = true
    setGenerationError(null)
    setElapsedSeconds(0)
    setMoveCount(0)
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
              variant="ghost"
            >?</Button>
          </div>
          <Button
            aria-label={`${t('common.pause')} ${t('classic.title')}`}
            className="size-10 shrink-0 text-[var(--canvas-foreground)]"
            onClick={() => setPauseOpen(true)}
            size="icon"
            title={t('common.pause')}
            type="button">
            <Pause aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="poster-kicker flex items-center gap-3 text-[11px] text-[var(--muted-text-color)]">
            <p>{gameTitle}</p>
            <span aria-hidden="true">/</span>
            <p>{moveCount} moves</p>
          </div>
          <p className="poster-kicker shrink-0 text-[11px] text-[var(--muted-text-color)]">{formatElapsedTime(elapsedSeconds)}</p>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1">
        {gameDefinition &&
          <GameGrid
            config={gameDefinition.config}
            exitPath={props.careerLevel ? '/' : undefined}
            gameDefinition={gameDefinition}
            gameId={seed}
            gameMode={props.gameMode}
            key={`${props.gameMode}:${seed}:${gameDefinition.version}`}
            onElapsedSecondsChange={setElapsedSeconds}
            onMoveCountChange={setMoveCount}
            onNextGame={nextGame}
            onPauseOpenChange={setPauseOpen}
            paused={pauseOpen}
            pieces={gameDefinition.pieces}
            suspended={shapesOpen}
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
