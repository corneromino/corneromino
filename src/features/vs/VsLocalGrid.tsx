import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, Pause } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loadVsLocalGameState, saveVsLocalGameState } from '@/lib/db'
import { VsLocalCanvas } from './VsLocalCanvas'
import { VsMoveList } from './VsMoveList'
import { VsPauseDialog } from './VsPauseDialog'
import { VsVictoryDialog } from './VsVictoryDialog'
import { isVsLocalBoardSize, VS_LOCAL_CONFIG, VS_LOCAL_DEFAULT_BOARD_SIZE, type VsLocalBoardSize } from './vsLocalConfig'
import { exportVsDebugState } from './vsDebugState'
import { canPlayVsTurn, createVsLocalGame, finishVsTurn, getVsPlayerScores, goToVsHistory, resumeVsLocalGame, selectVsCell, toggleVsMoveDirection, VS_PLAYERS, type VsGameResult, type VsLocalGameState, type VsPlayerId } from './vsLocalGame'

interface PlayerBandProps {
  active: boolean
  canFinishTurn: boolean
  facingOpponent?: boolean
  points: number
  onFinishTurn: () => void
  onToggleMoveDirection: () => void
  player: VsPlayerId
  pointDifference: number
  result: VsGameResult | null
}

function PlayerBand({ active, canFinishTurn, facingOpponent = false, onFinishTurn, onToggleMoveDirection, player, pointDifference, points, result }: PlayerBandProps) {
  const playerStyle = VS_PLAYERS[player]
  const canToggleMoveDirection = active && canFinishTurn

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canToggleMoveDirection || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onToggleMoveDirection()
  }
  return (
    <section
      aria-label={`${playerStyle.label}, ${result ? result.winner === player ? 'winner' : result.winner === null ? 'draw' : 'match finished' : active ? 'playing' : 'waiting'}`}
      className={cn(
        'flex h-[66px] shrink-0 items-center rounded-md border-8 px-3 transition-shadow',
        facingOpponent && 'rotate-180',
      )}
      style={{ backgroundColor: playerStyle.bannerBackground, borderColor: active ? '#FFF' : 'transparent' }}
    >
      <div aria-label="Toggle orthogonal or diagonal move direction" className={cn('flex min-w-0 flex-1 items-center', canToggleMoveDirection && 'cursor-pointer')} onClick={canToggleMoveDirection ? onToggleMoveDirection : undefined} onKeyDown={handleCardKeyDown} role={canToggleMoveDirection ? 'button' : undefined} tabIndex={canToggleMoveDirection ? 0 : undefined} title={canToggleMoveDirection ? 'Toggle orthogonal or diagonal move direction' : undefined}>
        <div className="shrink-0 pr-3">
          <p className="poster-kicker text-[18px] leading-none text-[var(--paper)]">{playerStyle.label}</p>
          {result?.winner === player && <p className="poster-kicker mt-1 text-[10px] leading-none text-[var(--paper)]">Winner</p>}
          {result?.winner === null && <p className="poster-kicker mt-1 text-[10px] leading-none text-[var(--paper)]">Draw</p>}
        </div>
        <p aria-label={`${points} points`} className="flex h-8 flex-1 items-center rounded-md justify-between px-3 text-[18px] leading-none text-[var(--paper)]" style={{ backgroundColor: playerStyle.bannerScoreBackground }}>
          <span>{points}</span>
          {pointDifference !== 0 && <span>{pointDifference > 0 ? `+${pointDifference}` : pointDifference}</span>}
        </p>
      </div>
      <Button
        aria-label="Finish turn"
        className="cartoon-press cartoon-press--green ml-3 size-10 text-[var(--canvas-foreground)] disabled:opacity-50"
        disabled={!active || !canFinishTurn}
        onClick={onFinishTurn}
        size="icon"
        title="Finish turn"
        type="button"
      >
        <Check aria-hidden="true" />
      </Button>
    </section>
  )
}

export function VsLocalGrid() {
  const [game, setGame] = useState<VsLocalGameState | null>(null)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [victoryDialogDismissed, setVictoryDialogDismissed] = useState(false)
  const [debugCopy, setDebugCopy] = useState<{ status: 'copying' | 'copied' | 'error'; text: string } | null>(null)
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve())
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedBoardSize = Number(searchParams.get('boardSize'))
  const boardSize: VsLocalBoardSize = isVsLocalBoardSize(requestedBoardSize) ? requestedBoardSize : VS_LOCAL_DEFAULT_BOARD_SIZE
  const startNewMatchFromSetup = location.state !== null && typeof location.state === 'object' && 'startNewVsMatch' in location.state && location.state.startNewVsMatch === true

  useEffect(() => {
    let active = true
    if (startNewMatchFromSetup) {
      setGame(createVsLocalGame(Math.random, { boardSize }))
      return () => {
        active = false
      }
    }

    void loadVsLocalGameState()
      .then((savedGame) => {
        if (active) setGame(resumeVsLocalGame(savedGame))
      })
      .catch(() => {
        if (active) setGame(createVsLocalGame())
      })
    return () => {
      active = false
    }
  }, [boardSize, startNewMatchFromSetup])

  useEffect(() => {
    if (!game) return
    persistenceQueueRef.current = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => saveVsLocalGameState(game))
  }, [game])

  const selectCell = useCallback((column: number, row: number) => {
    setGame((current) => current && selectVsCell(current, column, row))
  }, [])
  const endTurn = useCallback(() => {
    setGame((current) => current && finishVsTurn(current))
    setVictoryDialogDismissed(false)
  }, [])
  const toggleMoveDirection = useCallback(() => {
    setGame((current) => current && toggleVsMoveDirection(current))
  }, [])
  const previousMove = useCallback(() => {
    setGame((current) => current && goToVsHistory(current, current.history.index - 1))
    setVictoryDialogDismissed(true)
  }, [])
  const nextMove = useCallback(() => {
    setGame((current) => current && goToVsHistory(current, current.history.index + 1))
    setVictoryDialogDismissed(true)
  }, [])
  const selectHistoryMove = useCallback((index: number) => {
    setGame((current) => current && goToVsHistory(current, index))
    setVictoryDialogDismissed(true)
  }, [])
  const [playerOnePoints, playerTwoPoints] = getVsPlayerScores(game?.placedCornerominoes ?? [])
  const result = game?.result ?? null
  const allowHistoryRewrite = game?.allowHistoryRewrite ?? VS_LOCAL_CONFIG.allowHistoryRewrite
  const historyIndex = game?.history.index ?? 0
  const lastHistoryIndex = (game?.history.positions.length ?? 1) - 1
  const viewingPast = historyIndex < lastHistoryIndex
  const canFinishTurn = game !== null && canPlayVsTurn(game) && game.pendingPlacement !== null

  function handleVictoryOpenChange(open: boolean) {
    setVictoryDialogDismissed(!open)
  }

  function handlePauseOpenChange(open: boolean) {
    setPauseOpen(open)
    setDebugCopy(null)
  }

  async function copyDebugState() {
    if (!game) return
    const viewport = window.visualViewport
    const text = exportVsDebugState(game, {
      ui: { pauseOpen, victoryDialogDismissed },
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        buildMode: import.meta.env.MODE,
        scripts: Array.from(document.scripts, (script) => script.src).filter(Boolean),
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
        visualViewport: viewport ? {
          width: viewport.width, height: viewport.height, offsetLeft: viewport.offsetLeft, offsetTop: viewport.offsetTop, scale: viewport.scale,
        } : null,
      },
    })
    setDebugCopy({ status: 'copying', text })
    try {
      // Keep the clipboard call in the user gesture; awaiting storage first can lose permission on mobile.
      await navigator.clipboard.writeText(text)
      setDebugCopy({ status: 'copied', text })
    } catch {
      setDebugCopy({ status: 'error', text })
    }
  }

  function selectDebugReport(event: FocusEvent<HTMLTextAreaElement>) {
    event.currentTarget.select()
  }

  function startNewMatch() {
    setGame(createVsLocalGame(Math.random, { boardSize: game?.boardSize ?? boardSize }))
    setPauseOpen(false)
    setVictoryDialogDismissed(false)
  }

  async function quitMatch() {
    // Finish the queued autosave before leaving so this exact match resumes.
    await persistenceQueueRef.current.catch(() => undefined)
    // Return through the existing VS menu entry so browser/mobile Back then
    // leaves VS instead of reopening this saved match.
    if (location.state && typeof location.state === 'object' && 'returnToVsMenu' in location.state && location.state.returnToVsMenu === true) {
      navigate(-1)
      return
    }
    // Direct and bookmarked Local VS URLs have no menu entry to return to.
    navigate('/vs', { replace: true })
  }

  return (
    <main className="poster-page app-page flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="mx-auto flex w-full max-w-[550px] shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-2 px-5 pb-3">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[33px] leading-none">VS</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button aria-label="Previous move" className="cartoon-press size-10 text-[var(--canvas-foreground)] disabled:opacity-50" disabled={!game || historyIndex === 0} onClick={previousMove} size="icon" title="Previous move" type="button">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button aria-label="Next move" className="cartoon-press size-10 text-[var(--canvas-foreground)] disabled:opacity-50" disabled={!game || !viewingPast} onClick={nextMove} size="icon" title="Next move" type="button">
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button aria-label="Pause Local VS" className="cartoon-press size-10 text-[var(--canvas-foreground)]" disabled={!game} onClick={() => handlePauseOpenChange(true)} size="icon" title="Pause" type="button">
              <Pause aria-hidden="true" />
            </Button>
          </div>
          {viewingPast && !allowHistoryRewrite && <p className="text-[10px] leading-none text-[var(--muted-text-color)]">View only</p>}
        </div>
        {game && <VsMoveList history={game.history} onSelect={selectHistoryMove} />}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-1">
          <PlayerBand active={result === null && game?.activePlayer === 0} canFinishTurn={canFinishTurn} facingOpponent onFinishTurn={endTurn} onToggleMoveDirection={toggleMoveDirection} player={0} pointDifference={playerOnePoints - playerTwoPoints} points={playerOnePoints} result={result} />
        <section aria-label="Local VS board" className="min-h-0 flex-1 border-4 border-[var(--grid-border-color)] bg-[var(--grid-border-color)]">
          {game && <VsLocalCanvas game={game} key={game.boardSize ?? VS_LOCAL_DEFAULT_BOARD_SIZE} onCellTap={selectCell} />}
        </section>
          <PlayerBand active={result === null && game?.activePlayer === 1} canFinishTurn={canFinishTurn} onFinishTurn={endTurn} onToggleMoveDirection={toggleMoveDirection} player={1} pointDifference={playerTwoPoints - playerOnePoints} points={playerTwoPoints} result={result} />
      </div>
      {result && <VsVictoryDialog onNewGame={startNewMatch} onOpenChange={handleVictoryOpenChange} open={!victoryDialogDismissed} result={result} />}
      <VsPauseDialog canReportBug={game !== null} debugCopy={debugCopy} onCopyDebugState={() => void copyDebugState()} onOpenChange={handlePauseOpenChange} onRestart={startNewMatch} onResume={() => handlePauseOpenChange(false)} onSaveAndQuit={() => void quitMatch()} onSelectDebugReport={selectDebugReport} open={pauseOpen} />
    </main>
  )
}
