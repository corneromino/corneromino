import { useEffect, useRef, useState } from 'react'
import { Copy, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clearCascadeGameState, loadCascadeGameState, type CascadeGameSaveState } from '@/lib/db'
import type { CascadeCorner, CascadeCornerSpawnMode } from './cascadeGame'
import { CascadeCanvas, type CascadeCanvasHandle } from './CascadeCanvas'

interface CascadeConfig {
  cornerSpawnMode: CascadeCornerSpawnMode
  gridSize: { columns: number; rows: number }
  initialFallIntervalMs: number
}

const CASCADE_CONFIG: CascadeConfig = {
  cornerSpawnMode: 'random',
  gridSize: { columns: 9, rows: 18 },
  initialFallIntervalMs: 1000,
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
  const [gameVersion, setGameVersion] = useState(0)
  const [initialState, setInitialState] = useState<CascadeGameSaveState | null | undefined>(undefined)
  const [stats, setStats] = useState<{ destroyedLineCount: number; lockedCornerominoCount: number; upcomingCorners: CascadeCorner[] }>({
    destroyedLineCount: 0,
    lockedCornerominoCount: 0,
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

  useEffect(() => {
    return () => {
      window.setTimeout(() => {
        if (!window.location.hash.startsWith('#/cascade')) {
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
        <div className="flex gap-2">
          <Button
            aria-label="Copy Cascade debug state"
            className="cartoon-press size-10 text-[var(--canvas-foreground)]"
            onClick={() => void copyDebugState()}
            size="icon"
            title="Copy debug state"
            type="button"
          >
            <Copy aria-hidden="true" />
          </Button>
          <Button
            aria-label="Restart cascade"
            className="cartoon-press size-10 text-[var(--canvas-foreground)]"
            onClick={() => {
              void clearCascadeGameState()
              setInitialState(null)
              setStats({ destroyedLineCount: 0, lockedCornerominoCount: 0, upcomingCorners: [] })
              setGameVersion((version) => version + 1)
            }}
            size="icon"
            title="Restart cascade"
            type="button"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-2 px-1">
        <section aria-label="Cascade board" className="relative min-h-0 min-w-0 flex-1 border-4 border-[var(--grid-border-color)] bg-[var(--grid-border-color)]">
          {initialState !== undefined && (
            <CascadeCanvas
              cornerSpawnMode={CASCADE_CONFIG.cornerSpawnMode}
              fallIntervalMs={CASCADE_CONFIG.initialFallIntervalMs}
              gridSize={CASCADE_CONFIG.gridSize}
              initialState={initialState}
              key={gameVersion}
              onStatsChange={setStats}
              ref={canvasRef}
            />
          )}
        </section>
        <aside aria-label="Cascade statistics" className="flex w-[25%] shrink-0 flex-col gap-5 p-1 py-5 rounded-xs bg-(--outline-color) text-center text-[var(--canvas)] sm:w-[96px]">
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
      <p className="poster-kicker pt-3 text-center text-[11px] text-[var(--muted-text-color)]">Drag ← → to move · Swipe ↓ to drop</p>
    </main>
  )
}
