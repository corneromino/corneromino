import { useEffect, useState } from 'react'
import { ArrowLeft, Play, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { loadCascadeBestScore, loadCascadeGameState } from '@/lib/db'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'

function PixelTrophy() {
  return (
    <svg aria-hidden="true" className="size-20 [filter:drop-shadow(4px_4px_0_var(--paper))]" fill="currentColor" shapeRendering="crispEdges" viewBox="0 0 16 16">
      <path d="M4 1h8v2h2v5h-3v2H9v2h2v3H5v-3h2v-2H5V8H2V3h2V1Zm-1 4v2h2V4H3Zm8-1v3h2V5h-2Z" />
    </svg>
  )
}

export function CascadeMenu() {
  const navigate = useNavigate()
  const [hasSavedGame, setHasSavedGame] = useState<boolean | null>(null)
  const [bestScore, setBestScore] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.all([loadCascadeGameState(), loadCascadeBestScore()]).then(([state, score]) => {
      if (!active) return
      setHasSavedGame(state !== null)
      setBestScore(score)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="poster-page relative flex h-dvh flex-col overflow-hidden px-5 py-5 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] items-start justify-between gap-3 pb-10">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[33px] leading-none">Cascade</h1>
        </div>
        <Button asChild className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title="Back to main menu">
          <Link aria-label="Back to main menu" to="/"><ArrowLeft aria-hidden="true" /></Link>
        </Button>
      </header>
      <section className="relative z-10 mx-auto flex w-full max-w-[550px] flex-col gap-4">
        <Button
          className="cartoon-press h-[64px] w-full text-[11px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          onClick={() => navigate('/cascade/game/new')}
          size="lg"
          type="button"
        >
          <Plus aria-hidden="true" /> New game
        </Button>
        <Button
          className="cartoon-press h-[64px] w-full text-[11px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          disabled={hasSavedGame !== true}
          onClick={() => navigate('/cascade/game/continue')}
          size="lg"
          type="button"
        >
          <Play aria-hidden="true" /> {hasSavedGame === null ? 'Loading…' : 'Continue'}
        </Button>
        <div className="flex flex-col items-center p-2 text-[var(--outline-color)]">
          <PixelTrophy />
          <p className="-mt-1 rotate-3 text-6xl leading-none font-black [text-shadow:4px_4px_0_var(--paper)]">{bestScore}</p>
        </div>
      </section>
    </main>
  )
}
