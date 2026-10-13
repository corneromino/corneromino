import { useEffect, useRef, useState } from 'react'
import { Bug, Pause, Play, RotateCcw, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { clearCascadeGameState, loadCascadeGameState, type CascadeGameSaveState } from '@/lib/db'
import type { CascadeCorner, CascadeCornerSpawnMode } from './cascadeGame'
import { CascadeCanvas, type CascadeCanvasHandle } from './CascadeCanvas'

interface CascadeConfig {
  cornerSpawnMode: CascadeCornerSpawnMode
  getFallIntervalMs: (gameState: CascadeGameSaveState) => number
  gridSize: { columns: number; rows: number }
  scoreIncrementAnimationStep: number
  scorePointsPerLockedCorneromino: number
  scorePointsPerLine: number
}

const CASCADE_CONFIG: CascadeConfig = {
  cornerSpawnMode: 'random',
  gridSize: { columns: 9, rows: 18 },
  getFallIntervalMs: (gameState) => {
    const speedMultiplier = 1 + Math.log1p(gameState.destroyedLineCount ?? 0) * 0.25
    return Math.max(250, Math.round(1000 / speedMultiplier))
  },
  scoreIncrementAnimationStep: 1,
  scorePointsPerLockedCorneromino: 10,
  scorePointsPerLine: 100,
}

function AnimatedScore(props: { step: number; targetScore: number }) {
  const [displayedScore, setDisplayedScore] = useState(props.targetScore)

  useEffect(() => {
    if (displayedScore === props.targetScore) return
    const step = Math.max(1, props.step)
    const timer = window.setInterval(() => {
      setDisplayedScore((currentScore) => {
        const difference = props.targetScore - currentScore
        if (difference === 0) {
          window.clearInterval(timer)
          return currentScore
        }

        const nextScore = currentScore + Math.sign(difference) * Math.min(step, Math.abs(difference))
        if (nextScore === props.targetScore) window.clearInterval(timer)
        return nextScore
      })
    }, 4)

    return () => window.clearInterval(timer)
  }, [props.step, props.targetScore])

  return <span className={displayedScore < props.targetScore ? 'cascade-score-shake inline-block' : 'inline-block'}>{displayedScore}</span>
}

function CornerPreview(props: { corner: CascadeCorner }) {
  const cornerClass = [
    'left-[10%] top-[10%]',
    'right-[10%] top-[10%]',
    'bottom-[10%] right-[10%]',
    'bottom-[10%] left-[10%]',
  ][props.corner]

  return (
    <span aria-hidden="true" className="relative size-7 bg-[var(--outline-color)] border-1 border-[var(--paper)]">
      <span className={`absolute size-[52%] bg-[var(--paper)] ${cornerClass}`} />
    </span>
  )
}

export function Cascade() {
  const canvasRef = useRef<CascadeCanvasHandle>(null)
  const preserveGameOnExitRef = useRef(false)
  const navigate = useNavigate()
  const [gameVersion, setGameVersion] = useState(0)
  const [initialState, setInitialState] = useState<CascadeGameSaveState | null | undefined>(undefined)
  const [isPaused, setIsPaused] = useState(false)
  const [stats, setStats] = useState<{ destroyedLineCount: number; lockedCornerominoCount: number; score: number; upcomingCorners: CascadeCorner[] }>({
    destroyedLineCount: 0,
    lockedCornerominoCount: 0,
    score: 0,
    upcomingCorners: [],
  })

  useEffect(() => {
    let active = true
    void loadCascadeGameState().then((state) => {
      if (!active) return
      setInitialState(state)
      setStats({
        destroyedLineCount: state?.destroyedLineCount ?? 0,
        lockedCornerominoCount: state?.lockedCornerominoCount ?? state?.lockedPieces.length ?? state?.lockedPieceColors?.length ?? 0,
        score: state?.score ?? 0,
        upcomingCorners: state?.gameState.upcomingCorners ?? [],
      })
    })
    return () => {
      active = false
    }
  }, [])

  async function copyDebugState() {
    if (!canvasRef.current || !navigator.clipboard) return
    await navigator.clipboard.writeText(canvasRef.current.exportDebugState())
  }

  function pauseGame() {
    canvasRef.current?.pause()
    setIsPaused(true)
  }

  function resumeGame() {
    canvasRef.current?.resume()
    setIsPaused(false)
  }

  function handlePauseDialogChange(open: boolean) {
    if (open) pauseGame()
    else resumeGame()
  }

  function restartGame() {
    void clearCascadeGameState()
    setInitialState(null)
    setIsPaused(false)
    setStats({ destroyedLineCount: 0, lockedCornerominoCount: 0, score: 0, upcomingCorners: [] })
    setGameVersion((version) => version + 1)
  }

  async function saveAndQuit() {
    await canvasRef.current?.save()
    preserveGameOnExitRef.current = true
    navigate('/')
  }

  useEffect(() => {
    return () => {
      window.setTimeout(() => {
        if (!preserveGameOnExitRef.current && !window.location.hash.startsWith('#/cascade')) {
          void clearCascadeGameState()
        }
      }, 0)
    }
  }, [])

  return (
    <main className="poster-page flex h-dvh flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="mx-auto flex w-full max-w-[550px] items-end justify-between gap-4 px-5 pb-5">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[33px] leading-none">Cascade</h1>
        </div>
        <Button
          aria-label="Pause Cascade"
          className="cartoon-press size-10 text-[var(--canvas-foreground)]"
          disabled={initialState === undefined}
          onClick={pauseGame}
          size="icon"
          title="Pause"
          type="button"
        >
          <Pause aria-hidden="true" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-1">
        <section aria-label="Cascade score" className="flex h-10 shrink-0 items-center bg-[var(--outline-color)] px-4 text-[var(--canvas)]">
          <p className="poster-kicker text-[22px]">Score</p>
          <p className="ml-auto text-[22px] leading-none"><AnimatedScore step={CASCADE_CONFIG.scoreIncrementAnimationStep} targetScore={stats.score} /></p>
        </section>
        <div className="flex min-h-0 flex-1 gap-2">
          <section aria-label="Cascade board" className="relative min-h-0 min-w-0 flex-1 border-4 border-[var(--grid-border-color)] bg-[var(--grid-border-color)]">
            {initialState !== undefined && (
              <CascadeCanvas
                cornerSpawnMode={CASCADE_CONFIG.cornerSpawnMode}
                getFallIntervalMs={CASCADE_CONFIG.getFallIntervalMs}
                gridSize={CASCADE_CONFIG.gridSize}
                initialState={initialState}
                key={gameVersion}
                onStatsChange={setStats}
                ref={canvasRef}
                scorePointsPerLine={CASCADE_CONFIG.scorePointsPerLine}
                scorePointsPerLockedCorneromino={CASCADE_CONFIG.scorePointsPerLockedCorneromino}
              />
            )}
            {isPaused && <div aria-hidden="true" className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--outline-color)]"><Pause className="size-10 text-[var(--paper)]" /></div>}
          </section>
          <aside aria-label="Cascade statistics" className="flex w-[25%] shrink-0 flex-col gap-5 rounded-xs bg-[var(--outline-color)] p-1 py-5 text-center text-[var(--canvas)] sm:w-[96px]">
            <div>
              <p className="poster-kicker text-[11px]">Lines</p>
              <p className="mt-2 text-[22px] leading-none">{stats.destroyedLineCount}</p>
            </div>
            <div>
              <p className="poster-kicker text-[11px]">Locked</p>
              <p className="mt-2 text-[22px] leading-none">{stats.lockedCornerominoCount}</p>
            </div>
            <div className="mt-auto pb-2">
              <p className="poster-kicker text-[11px] text-[var(--paper)]">Nexts</p>
              <div className="mt-3 flex flex-col items-center gap-2">
                {stats.upcomingCorners.slice(0, 2).map((corner, index) => (
                  <div className="flex items-center gap-2" key={`${corner}-${index}`}>
                    <span className="text-[11px] text-[var(--paper)]">{index + 1}</span>
                    <CornerPreview corner={corner} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
      <p className="poster-kicker pt-3 text-center text-[11px] text-[var(--muted-text-color)]">Drag ← → to move · Swipe ↓ to drop</p>
      <Dialog onOpenChange={handlePauseDialogChange} open={isPaused}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paused</DialogTitle>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-1 gap-3">
            <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={resumeGame} size="lg" type="button">
              <Play aria-hidden="true" /> Resume
            </Button>
            <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={restartGame} size="lg" type="button">
              <RotateCcw aria-hidden="true" /> Restart
            </Button>
            <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={() => void saveAndQuit()} size="lg" type="button">
              <Save aria-hidden="true" /> Save and quit
            </Button>
            <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={() => void copyDebugState()} size="lg" type="button">
              <Bug aria-hidden="true" /> Report a bug
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
