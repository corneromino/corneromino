import { useEffect, useState } from 'react'
import { ArrowLeft, Copy, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isGameMode } from '@/game/gameConfig'
import { deleteSavedGame, type SavedGame, loadSavedGames } from '@/lib/db'

function formatSeed(seed: string): string {
  return seed.length > 14 ? `${seed.slice(0, 7)}…${seed.slice(-5)}` : seed
}

function formatSavedAt(savedAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(savedAt)
}

function SavedGameCard(props: { game: SavedGame; onDelete: (game: SavedGame) => void }) {
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const gamePath = `/play?mode=${props.game.gameMode}&seed=${encodeURIComponent(props.game.gameId)}`

  function deleteGame() {
    setDeleteDialogOpen(false)
    props.onDelete(props.game)
  }

  function copySeed() {
    void navigator.clipboard.writeText(`${props.game.gameMode}:${props.game.gameId}`)
  }

  useEffect(() => {
    const nextScreenshotUrl = URL.createObjectURL(props.game.screenshot)
    setScreenshotUrl(nextScreenshotUrl)

    return () => {
      URL.revokeObjectURL(nextScreenshotUrl)
    }
  }, [props.game.screenshot])

  return (
    <article className="saved-game-card flex gap-3 p-2 text-[var(--canvas-foreground)]">
      <Link
        aria-label={`Continue ${props.game.gameMode} game saved ${formatSavedAt(props.game.savedAt)}`}
        className="shrink-0 self-start"
        to={gamePath}
      >
        {screenshotUrl && <img alt="Saved game board" className="h-auto w-28 shrink-0 self-start" src={screenshotUrl} />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        <Link className="block" to={gamePath}>
          <div>
            <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">{formatSavedAt(props.game.savedAt)}</p>
            <h2 className="mt-1 text-[22px] font-black uppercase">{props.game.gameMode}</h2>
          </div>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <Link className="min-w-0 flex-1" title={props.game.gameId} to={gamePath}>
            <p className="poster-kicker truncate text-[11px] text-[var(--muted-text-color)]">
            {formatSeed(props.game.gameId)}
            </p>
          </Link>
           <Button
              aria-label={`Copy seed for ${props.game.gameMode} saved game`}
              className="cartoon-press size-9 shrink-0 text-[var(--canvas-foreground)]"
              onClick={copySeed}
              size="icon"
              title="Copy seed"
              type="button"
            >
              <Copy aria-hidden="true" />
            </Button>
            <Button
              aria-label={`Delete ${props.game.gameMode} saved game`}
              className="cartoon-press size-9 shrink-0 text-[var(--coral)]"
              onClick={() => setDeleteDialogOpen(true)}
            size="icon"
            title="Delete saved game"
            type="button"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete game</DialogTitle>
            <DialogDescription>Delete this saved game? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button className="cartoon-press h-[42px] !bg-[var(--coral)] text-[11px] font-black tracking-[0.1em] !text-[var(--paper)] uppercase" onClick={deleteGame} size="lg" type="button">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

export function SavedGames() {
  const navigate = useNavigate()
  const [loadDialogOpen, setLoadDialogOpen] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [seedToLoad, setSeedToLoad] = useState('')
  const [savedGames, setSavedGames] = useState<SavedGame[]>([])
  const [loading, setLoading] = useState(true)

  function loadGame() {
    const [gameMode, ...seedParts] = seedToLoad.trim().split(':')
    const seed = seedParts.join(':').trim()
    if (!isGameMode(gameMode) || !seed) {
      setLoadError('Enter a game-mode:seed value.')
      return
    }

    setLoadDialogOpen(false)
    navigate(`/play?mode=${gameMode}&seed=${encodeURIComponent(seed)}`)
  }

  async function deleteGame(game: SavedGame) {
    await deleteSavedGame(game.gameMode, game.gameId)
    setSavedGames((games) => games.filter((savedGame) => savedGame.gameId !== game.gameId || savedGame.gameMode !== game.gameMode))
  }

  useEffect(() => {
    let active = true

    void loadSavedGames()
      .then((games) => {
        if (active) setSavedGames(games)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="poster-page app-page relative flex overflow-hidden px-5 py-8 text-[var(--canvas-foreground)]">
      <section className="relative z-10 mx-auto flex min-h-0 w-full max-w-[720px] flex-col">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
            <h1 className="poster-title mt-2 whitespace-nowrap text-[33px] leading-none">Saved games</h1>
          </div>
          <Button asChild className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title="Back to modes">
            <Link aria-label="Back to modes" to="/play"><ArrowLeft aria-hidden="true" /></Link>
          </Button>
        </div>

        <Button className="cartoon-press mt-6 h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={() => setLoadDialogOpen(true)} size="sm" type="button">
          Load game
        </Button>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {loading && <p className="poster-kicker mt-2 text-center text-[11px] text-[var(--muted-text-color)]">Loading saved games…</p>}
          {!loading && savedGames.length === 0 && (
            <p className="poster-kicker mt-2 text-center text-[11px] text-[var(--muted-text-color)]">No saved games yet</p>
          )}
          {!loading && savedGames.length > 0 && (
            <div className="grid gap-4 pb-1 sm:grid-cols-2">
              {savedGames.map((game) => <SavedGameCard game={game} key={`${game.gameMode}:${game.gameId}`} onDelete={deleteGame} />)}
            </div>
          )}
          </div>
        <Dialog onOpenChange={setLoadDialogOpen} open={loadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Load game</DialogTitle>
              <DialogDescription>Enter a copied game-mode:seed value.</DialogDescription>
            </DialogHeader>
            <label className="poster-kicker mt-5 block text-[11px] text-[var(--muted-text-color)]">
              Game mode and seed
              <input
                autoFocus
                className="mt-2 h-[42px] w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 text-[11px] text-[var(--canvas-foreground)] outline-none focus:border-[var(--canvas-foreground)]"
                onChange={(event) => {
                  setSeedToLoad(event.target.value)
                  setLoadError('')
                }}
                placeholder="easy:your-seed"
                type="text"
                value={seedToLoad}
              />
            </label>
            {loadError && <p className="mt-3 text-[11px] text-[var(--coral)]" role="alert">{loadError}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={!seedToLoad.trim()} onClick={loadGame} size="lg" type="button">
                Load
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </main>
  )
}
