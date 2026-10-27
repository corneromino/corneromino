import { useEffect, useState } from 'react'
import { ArrowLeft, Copy, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GAME_CONFIGS, isGameMode } from '@/game/gameConfig'
import { deleteSavedGame, type SavedGame, loadSavedGames } from '@/lib/db'

function formatSeed(seed: string): string {
  return seed.length > 14 ? `${seed.slice(0, 7)}…${seed.slice(-5)}` : seed
}

function formatSavedAt(savedAt: number, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(savedAt)
}

function SavedGameCard(props: { game: SavedGame; onDelete: (game: SavedGame) => void }) {
  const { i18n, t } = useTranslation()
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const gamePath = `/play?mode=${props.game.gameMode}&seed=${encodeURIComponent(props.game.gameId)}`
  const gameMode = t(GAME_CONFIGS[props.game.gameMode].title)
  const savedAt = formatSavedAt(props.game.savedAt, i18n.resolvedLanguage ?? i18n.language)

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
        aria-label={t('savedGames.continueSavedGame', { date: savedAt, mode: gameMode })}
        className="shrink-0 self-start"
        to={gamePath}
      >
        {screenshotUrl && <img alt={t('savedGames.savedBoard')} className="h-auto w-28 shrink-0 self-start" src={screenshotUrl} />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
        <Link className="block" to={gamePath}>
          <div>
            <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">{savedAt}</p>
            <h2 className="mt-1 text-[22px] font-black uppercase">{gameMode}</h2>
          </div>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <Link className="min-w-0 flex-1" title={props.game.gameId} to={gamePath}>
            <p className="poster-kicker truncate text-[11px] text-[var(--muted-text-color)]">
            {formatSeed(props.game.gameId)}
            </p>
          </Link>
           <Button
              aria-label={t('savedGames.copySeedForGame', { mode: gameMode })}
              className="cartoon-press size-9 shrink-0 text-[var(--canvas-foreground)]"
              onClick={copySeed}
              size="icon"
              title={t('savedGames.copySeed')}
              type="button"
            >
              <Copy aria-hidden="true" />
            </Button>
            <Button
              aria-label={t('savedGames.deleteSavedGame', { mode: gameMode })}
              className="cartoon-press size-9 shrink-0 text-[var(--coral)]"
              onClick={() => setDeleteDialogOpen(true)}
            size="icon"
            title={t('savedGames.deleteSavedGame', { mode: gameMode })}
            type="button"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('savedGames.deleteGame')}</DialogTitle>
            <DialogDescription>{t('savedGames.deletePrompt')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button className="cartoon-press h-[42px] !bg-[var(--coral)] text-[11px] font-black tracking-[0.1em] !text-[var(--paper)] uppercase" onClick={deleteGame} size="lg" type="button">
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

export function SavedGames() {
  const { t } = useTranslation()
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
      setLoadError(t('savedGames.invalidSeed'))
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
            <h1 className="poster-title mt-2 whitespace-nowrap text-[33px] leading-none">{t('savedGames.title')}</h1>
          </div>
          <Button asChild className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title={t('savedGames.backToClassic')}>
            <Link aria-label={t('savedGames.backToClassic')} to="/play"><ArrowLeft aria-hidden="true" /></Link>
          </Button>
        </div>

        <Button className="cartoon-press mt-6 h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={() => setLoadDialogOpen(true)} size="sm" type="button">
          {t('savedGames.loadGame')}
        </Button>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {loading && <p className="poster-kicker mt-2 text-center text-[11px] text-[var(--muted-text-color)]">{t('savedGames.loading')}</p>}
          {!loading && savedGames.length === 0 && (
            <p className="poster-kicker mt-2 text-center text-[11px] text-[var(--muted-text-color)]">{t('savedGames.empty')}</p>
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
              <DialogTitle>{t('savedGames.loadGame')}</DialogTitle>
              <DialogDescription>{t('savedGames.loadPrompt')}</DialogDescription>
            </DialogHeader>
            <label className="poster-kicker mt-5 block text-[11px] text-[var(--muted-text-color)]">
              {t('savedGames.gameModeAndSeed')}
              <input
                autoFocus
                className="mt-2 h-[42px] w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 text-[11px] text-[var(--canvas-foreground)] outline-none focus:border-[var(--canvas-foreground)]"
                onChange={(event) => {
                  setSeedToLoad(event.target.value)
                  setLoadError('')
                }}
                placeholder={t('savedGames.seedPlaceholder')}
                type="text"
                value={seedToLoad}
              />
            </label>
            {loadError && <p className="mt-3 text-[11px] text-[var(--coral)]" role="alert">{loadError}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={!seedToLoad.trim()} onClick={loadGame} size="lg" type="button">
                {t('common.load')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </main>
  )
}
