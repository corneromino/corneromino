import { useEffect, useRef, useState } from 'react'
import { Pause } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { clearCascadeGameState, loadCascadeGameState, recordCascadeBestScore, type CascadeGameSaveState } from '@/lib/db'
import type { CascadeCorner, CascadeCornerSpawnMode } from './cascadeGame'
import { CascadeCanvas, type CascadeCanvasHandle } from './CascadeCanvas'
import { CascadePauseDialog } from './CascadePauseDialog'
import { PixelLinesIcon } from './PixelLinesIcon'
import { PixelLockIcon } from './PixelLockIcon'
import { PixelNextIcon } from './PixelNextIcon'

interface CascadeConfig {
  cornerDifficulty: number
  maxConsecutiveSameCorner: number
  cornerSpawnMode: CascadeCornerSpawnMode
  getFallIntervalMs: (gameState: CascadeGameSaveState) => number
  gridSize: { columns: number; rows: number }
  scoreContinueIncrementAnimationStep: number
  scoreIncrementAnimationStep: number
  scorePointsPerLockedCorneromino: number
  scorePointsPerLine: number
}

const CASCADE_CONFIG: CascadeConfig = {
  // Balanced mode: 0 = shuffled four-corner bags, 1 = fully random.
  cornerDifficulty: 0.20,
  maxConsecutiveSameCorner: 2,
  cornerSpawnMode: 'balanced',
  gridSize: { columns: 7, rows: 14 },
  getFallIntervalMs: (gameState) => {
    const speedMultiplier = 1 + Math.log1p(gameState.destroyedLineCount ?? 0) * 0.1
    return Math.max(250, Math.round(1000 / speedMultiplier))
  },
  scoreContinueIncrementAnimationStep: 100,
  scoreIncrementAnimationStep: 3,
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

export function Cascade(props: { startNew?: boolean }) {
  const { t } = useTranslation()
  const canvasRef = useRef<CascadeCanvasHandle>(null)
  const preserveGameOnExitRef = useRef(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [gameVersion, setGameVersion] = useState(0)
  const [initialState, setInitialState] = useState<CascadeGameSaveState | null | undefined>(undefined)
  const [isPaused, setIsPaused] = useState(false)
  const [scoreAnimationStep, setScoreAnimationStep] = useState(CASCADE_CONFIG.scoreIncrementAnimationStep)
  const [stats, setStats] = useState<{ destroyedLineCount: number; lockedCornerominoCount: number; score: number; upcomingCorners: CascadeCorner[] }>({
    destroyedLineCount: 0,
    lockedCornerominoCount: 0,
    score: 0,
    upcomingCorners: [],
  })

  useEffect(() => {
    let active = true
    if (props.startNew) {
      void clearCascadeGameState().then(() => {
        if (!active) return
        setInitialState(null)
        setStats({ destroyedLineCount: 0, lockedCornerominoCount: 0, score: 0, upcomingCorners: [] })
        setScoreAnimationStep(CASCADE_CONFIG.scoreIncrementAnimationStep)
      })
      return () => {
        active = false
      }
    }
    void loadCascadeGameState().then((state) => {
      if (!active) return
      setInitialState(state)
      setStats({
        destroyedLineCount: state?.destroyedLineCount ?? 0,
        lockedCornerominoCount: state?.lockedCornerominoCount ?? state?.lockedPieces.length ?? state?.lockedPieceColors?.length ?? 0,
        score: state?.score ?? 0,
        upcomingCorners: state?.gameState.upcomingCorners ?? [],
      })
      setScoreAnimationStep(state?.score
        ? CASCADE_CONFIG.scoreContinueIncrementAnimationStep
        : CASCADE_CONFIG.scoreIncrementAnimationStep)
    })
    return () => {
      active = false
    }
  }, [props.startNew])

  useEffect(() => {
    void recordCascadeBestScore(stats.score)
  }, [stats.score])

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
    setScoreAnimationStep(CASCADE_CONFIG.scoreIncrementAnimationStep)
    setGameVersion((version) => version + 1)
  }

  async function saveAndQuit() {
    await canvasRef.current?.save()
    preserveGameOnExitRef.current = true
    // Return through the existing menu entry so browser/mobile Back leaves
    // Cascade instead of reopening this saved game.
    if (location.state && typeof location.state === 'object' && 'returnToCascadeMenu' in location.state && location.state.returnToCascadeMenu === true) {
      navigate(-1)
      return
    }
    navigate('/cascade', { replace: true })
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
    <main className="poster-page app-page flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="mx-auto flex w-full max-w-[550px] items-end justify-between gap-4 px-5 pb-5">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[33px] leading-none">{t('cascade.title')}</h1>
        </div>
        <Button
          aria-label={`${t('common.pause')} ${t('cascade.title')}`}
          className="cartoon-press size-10 text-[var(--canvas-foreground)]"
          disabled={initialState === undefined}
          onClick={pauseGame}
          size="icon"
          title={t('common.pause')}
          type="button"
        >
          <Pause aria-hidden="true" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-1">
        <section aria-label={`${t('cascade.title')} ${t('cascade.score')}`} className="flex h-10 shrink-0 items-center bg-[var(--outline-color)] px-4 text-[var(--canvas)]">
          <p className="poster-kicker text-[22px]">{t('cascade.score')}</p>
          <p className="ml-auto text-[22px] leading-none"><AnimatedScore step={scoreAnimationStep} targetScore={stats.score} /></p>
        </section>
        <div className="flex min-h-0 flex-1 gap-2">
          <section aria-label="Cascade board" className="relative min-h-0 min-w-0 flex-1 border-4 border-[var(--grid-border-color)] bg-[var(--grid-border-color)]">
            {initialState !== undefined && (
              <CascadeCanvas
                cornerDifficulty={CASCADE_CONFIG.cornerDifficulty}
                maxConsecutiveSameCorner={CASCADE_CONFIG.maxConsecutiveSameCorner}
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
          <aside aria-label="Cascade statistics" className="flex min-h-0 shrink-0 flex-col gap-5 overflow-y-auto overscroll-y-contain rounded-xs bg-[var(--outline-color)] p-1 py-5 text-center text-[var(--canvas)] sm:w-[96px]">
            <div>
              <p><span className="sr-only">{t('cascade.lines')}</span><PixelLinesIcon /></p>
              <p className="mt-2 text-[22px] leading-none">{stats.destroyedLineCount}</p>
            </div>
            <div>
              <p><span className="sr-only">{t('cascade.locked')}</span><PixelLockIcon /></p>
              <p className="mt-2 text-[22px] leading-none">{stats.lockedCornerominoCount}</p>
            </div>
            <div className="mt-auto pb-2">
              <PixelNextIcon />
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
      <p className="poster-kicker px-2 pt-3 text-center text-[11px] text-[var(--muted-text-color)]">
        <span>{t('cascade.dragInstructions')}</span>
        {/* <span className="hidden [@media(pointer:fine)]:inline">{t('cascade.keyboardInstructions')}</span> */}
      </p>
      <CascadePauseDialog onCopyDebugState={() => void copyDebugState()} onOpenChange={handlePauseDialogChange} onRestart={restartGame} onResume={resumeGame} onSaveAndQuit={() => void saveAndQuit()} open={isPaused} />
    </main>
  )
}
