import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { createRandomSeed, createSeededRandom } from '@/game/placement'
import { GAME_CONFIGS, isGameMode, type GameMode, type PlacedTetromino } from '@/game/gameConfig'
import { clearGameSelection } from '@/lib/db'
import { generateTetrominoPlacementsV2 } from '@/game/placementV2'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'
import { GameGrid } from './GameGrid'

const MODE_BUTTON_CLASS = 'cartoon-press h-[62px] w-full text-[11px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase'
const MODE_ENTRIES = Object.entries(GAME_CONFIGS)

function formatElapsedTime(elapsedSeconds: number) {
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

interface GameSessionProps {
  gameMode: GameMode
  requestedSeed: string | null
}

function GameModeMenu() {
  return (
    <main className="poster-page relative grid min-h-dvh place-items-center overflow-hidden px-5 py-8 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <section className="relative z-10 flex w-full max-w-[430px] flex-col items-center gap-4 text-center">
        <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
        <h1 className="poster-title mb-3 text-[44px] leading-none min-[375px]:text-[55px]">Select mode</h1>
        {MODE_ENTRIES.map(([mode, config]) => (
          <Button asChild className={MODE_BUTTON_CLASS} key={mode} size="lg">
            <Link to={`/play?mode=${mode}`}>{config.title}</Link>
          </Button>
        ))}
        <Button asChild className="cartoon-press h-[62px] w-full !border-[var(--canvas-foreground)] !bg-[var(--coral)] text-[11px] font-black tracking-[0.2em] !text-[var(--paper)] uppercase hover:!bg-[#b73a2c]" size="lg">
          <Link to="/saved">Saved</Link>
        </Button>
        <Button asChild className="cartoon-press mt-3 h-[42px] w-full [--element-color:var(--paper-muted)] text-[11px] font-black tracking-[0.16em] text-[var(--canvas-foreground)] uppercase" size="sm">
          <Link to="/">Back</Link>
        </Button>
      </section>
    </main>
  )
}

function GameSession(props: GameSessionProps) {
  const navigate = useNavigate()
  const [generatedSeed] = useState(createRandomSeed)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [pieces, setPieces] = useState<PlacedTetromino[] | null>(null)
  const seed = props.requestedSeed || generatedSeed
  const config = GAME_CONFIGS[props.gameMode]

  function nextGame() {
    navigate(`/play?mode=${props.gameMode}&seed=${encodeURIComponent(createRandomSeed())}`)
  }

  useEffect(() => {
    if (!props.requestedSeed) {
      void clearGameSelection(props.gameMode, generatedSeed)
      navigate(`/play?mode=${props.gameMode}&seed=${encodeURIComponent(generatedSeed)}`, { replace: true })
    }
  }, [generatedSeed, navigate, props.gameMode, props.requestedSeed])

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
    <main className="poster-page relative flex h-dvh flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] items-end justify-between gap-4 px-5 pb-6">
        <div className="min-w-0">
          <h1 className="poster-title text-[33px] leading-none">Corneromino</h1>
          <div className="poster-kicker mt-3 flex items-center gap-3 text-[11px] text-[var(--muted-text-color)]">
            <p>{props.gameMode}</p>
            <span aria-hidden="true">/</span>
            <p>{moveCount} moves</p>
          </div>
        </div>
        <p className="poster-kicker shrink-0 text-[11px] text-[var(--muted-text-color)]">{formatElapsedTime(elapsedSeconds)}</p>
      </header>

      <div className="relative z-10 min-h-0 flex-1">
        {pieces && <GameGrid config={config} gameId={seed} gameMode={props.gameMode} key={`${props.gameMode}:${seed}`} onElapsedSecondsChange={setElapsedSeconds} onMoveCountChange={setMoveCount} onNextGame={nextGame} pieces={pieces} />}
        {!pieces && !generationError && <p className="px-5 text-center text-[11px] font-bold uppercase">Generating game…</p>}
        {generationError && <p className="px-5 text-center text-[11px] font-bold text-[var(--coral)]" role="alert">{generationError}</p>}
      </div>
    </main>
  )
}

export function Play() {
  const [searchParams] = useSearchParams()
  const gameMode = searchParams.get('mode')
  const requestedSeed = searchParams.get('seed')

  if (!isGameMode(gameMode)) {
    return <GameModeMenu />
  }

  return <GameSession gameMode={gameMode} key={`${gameMode}:${requestedSeed ?? 'new'}`} requestedSeed={requestedSeed} />
}
