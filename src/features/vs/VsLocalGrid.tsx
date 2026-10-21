import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Pause } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { clearVsLocalGameState, loadVsLocalGameState, saveVsLocalGameState } from '@/lib/db'
import { VsLocalCanvas } from './VsLocalCanvas'
import { VsMoveList } from './VsMoveList'
import { VsVictoryDialog } from './VsVictoryDialog'
import { VS_LOCAL_CONFIG } from './vsLocalConfig'
import { canPlayVsTurn, createVsLocalGame, finishVsTurn, getVsPlayerScores, goToVsHistory, selectVsCell, VS_PLAYERS, type VsGameResult, type VsLocalGameState, type VsPlayerId } from './vsLocalGame'

interface PlayerBandProps {
  active: boolean
  canFinishTurn: boolean
  facingOpponent?: boolean
  points: number
  onFinishTurn: () => void
  player: VsPlayerId
  pointDifference: number
  result: VsGameResult | null
}

function PlayerBand({ active, canFinishTurn, facingOpponent = false, onFinishTurn, player, pointDifference, points, result }: PlayerBandProps) {
  const playerStyle = VS_PLAYERS[player]
  return (
    <section
      aria-label={`${playerStyle.label}, ${result ? result.winner === player ? 'winner' : result.winner === null ? 'draw' : 'match finished' : active ? 'playing' : 'waiting'}`}
      className={cn(
        'flex h-[66px] shrink-0 items-center border-4 px-3 transition-shadow',
        active && 'ring-2 ring-[var(--paper)] ring-inset',
        facingOpponent && 'rotate-180',
      )}
      style={{ backgroundColor: playerStyle.bannerBackground, borderColor: active ? playerStyle.bannerBorder : 'transparent' }}
    >
      <div className="shrink-0 pr-3">
        <p className="poster-kicker text-[18px] leading-none text-[var(--paper)]">{playerStyle.label}</p>
        {result?.winner === player && <p className="poster-kicker mt-1 text-[10px] leading-none text-[var(--paper)]">Winner</p>}
        {result?.winner === null && <p className="poster-kicker mt-1 text-[10px] leading-none text-[var(--paper)]">Draw</p>}
      </div>
      <p
        aria-label={`${points} points`}
        className="flex h-8 flex-1 items-center justify-between px-3 text-[18px] leading-none text-[var(--paper)]"
        style={{ backgroundColor: playerStyle.bannerScoreBackground }}
      >
        <span>{points}</span>
        {pointDifference !== 0 && <span>{pointDifference > 0 ? `+${pointDifference}` : pointDifference}</span>}
      </p>
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
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve())
  const location = useLocation()
  const navigate = useNavigate()
  const startNew = typeof location.state === 'object' && location.state !== null && 'startNew' in location.state && location.state.startNew === true

  useEffect(() => {
    let active = true
    if (startNew) {
      void clearVsLocalGameState()
        .catch(() => undefined)
        .then(() => {
          if (!active) return
          setGame(createVsLocalGame())
          setVictoryDialogDismissed(false)
          // Remove the one-shot navigation state so a browser reload resumes this match.
          navigate('/vs/local', { replace: true })
        })
      return () => {
        active = false
      }
    }
    void loadVsLocalGameState()
      .then((savedGame) => {
        if (active) setGame(savedGame ?? createVsLocalGame())
      })
      .catch(() => {
        if (active) setGame(createVsLocalGame())
      })
    return () => {
      active = false
    }
  }, [navigate, startNew])

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
  const combinationWinCount = game?.combinationWinCount ?? VS_LOCAL_CONFIG.combinationWinCount
  const consecutiveTurnWinCount = game?.consecutiveTurnWinCount ?? VS_LOCAL_CONFIG.consecutiveTurnWinCount
  const trapResolution = game?.trapResolution ?? VS_LOCAL_CONFIG.trapResolution
  const allowHistoryRewrite = game?.allowHistoryRewrite ?? VS_LOCAL_CONFIG.allowHistoryRewrite
  const historyIndex = game?.history.index ?? 0
  const lastHistoryIndex = (game?.history.positions.length ?? 1) - 1
  const viewingPast = historyIndex < lastHistoryIndex
  const canFinishTurn = game !== null && canPlayVsTurn(game) && game.pendingPlacement !== null

  function handleVictoryOpenChange(open: boolean) {
    setVictoryDialogDismissed(!open)
  }

  function startNewMatch() {
    setGame(createVsLocalGame(Math.random, { allowHistoryRewrite, combinationWinCount, consecutiveTurnWinCount, trapResolution }))
    setVictoryDialogDismissed(false)
  }

  async function quitMatch() {
    // Finish any earlier autosave before deleting the match, so it cannot be
    // written back after the player has quit.
    await persistenceQueueRef.current.catch(() => undefined)
    await clearVsLocalGameState().catch(() => undefined)
    navigate('/vs')
  }

  return (
    <main className="poster-page flex h-dvh flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
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
            <Button aria-label="Pause Local VS" className="cartoon-press size-10 text-[var(--canvas-foreground)]" disabled={!game} onClick={() => setPauseOpen(true)} size="icon" title="Pause" type="button">
              <Pause aria-hidden="true" />
            </Button>
          </div>
          {viewingPast && !allowHistoryRewrite && <p className="text-[10px] leading-none text-[var(--muted-text-color)]">View only</p>}
        </div>
        {game && <VsMoveList history={game.history} onSelect={selectHistoryMove} />}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-1">
        <PlayerBand active={result === null && game?.activePlayer === 0} canFinishTurn={canFinishTurn} facingOpponent onFinishTurn={endTurn} player={0} pointDifference={playerOnePoints - playerTwoPoints} points={playerOnePoints} result={result} />
        <section aria-label="Local VS board" className="min-h-0 flex-1 border-4 border-[var(--grid-border-color)] bg-[var(--grid-border-color)]">
          {game && <VsLocalCanvas game={game} onCellTap={selectCell} />}
        </section>
        <PlayerBand active={result === null && game?.activePlayer === 1} canFinishTurn={canFinishTurn} onFinishTurn={endTurn} player={1} pointDifference={playerTwoPoints - playerOnePoints} points={playerTwoPoints} result={result} />
      </div>
      {result && <VsVictoryDialog onNewGame={startNewMatch} onOpenChange={handleVictoryOpenChange} open={!victoryDialogDismissed} result={result} />}
      <Dialog onOpenChange={setPauseOpen} open={pauseOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Paused</DialogTitle>
          </DialogHeader>
          <DialogFooter className="grid-cols-1">
            <Button className="cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={() => void quitMatch()} size="lg" type="button">
              Quit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
