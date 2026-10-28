import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteSandboxWorld, loadSandboxWorlds, saveSandboxWorld, type SavedSandboxWorld } from '@/lib/db'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'

function formatSavedAt(savedAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(savedAt)
}

export function SandboxWorldCard(props: {
  world: SavedSandboxWorld
  onDelete?: (world: SavedSandboxWorld) => void
  onRename?: (world: SavedSandboxWorld) => void
  onSelect?: (world: SavedSandboxWorld) => void
}) {
  const [screenshotUrl, setScreenshotUrl] = useState('')

  useEffect(() => {
    const nextScreenshotUrl = URL.createObjectURL(props.world.screenshot)
    setScreenshotUrl(nextScreenshotUrl)

    return () => URL.revokeObjectURL(nextScreenshotUrl)
  }, [props.world.screenshot])

  return (
    <article className="saved-game-card flex gap-3 p-2 text-[var(--canvas-foreground)]">
      {props.onSelect ? (
        <button className="flex min-w-0 flex-1 gap-3 text-left" onClick={() => props.onSelect?.(props.world)} type="button">
          {screenshotUrl &&
            <img
              alt={`Saved sandbox world: ${props.world.name}`}
              className="h-auto w-28 shrink-0 self-start border-[#773526] border-4"
              src={screenshotUrl}
            />
          }
          <div className="min-w-0 py-1">
            <h2 className="max-w-full overflow-x-auto whitespace-nowrap text-[25px] font-black">{props.world.name}</h2>
            <p className="poster-kicker mt-2 text-[13px] text-[var(--muted-text-color)]">{formatSavedAt(props.world.savedAt)}</p>
          </div>
        </button>
      ) : (
        <>
          <AppNavigationButton className="h-auto min-w-0 flex-1 items-start justify-start gap-3 p-0 text-left whitespace-normal" to={`/sandbox/${props.world.id}`}>
            {screenshotUrl &&
              <img
                alt={`Saved sandbox world: ${props.world.name}`}
                className="h-auto w-28 shrink-0 self-start border-[#773526] border-4"
                src={screenshotUrl}
              />
            }
            <div className="min-w-0 py-1">
              <h2 className="max-w-full overflow-x-auto whitespace-nowrap text-[25px] font-black">{props.world.name}</h2>
              <p className="poster-kicker mt-2 text-[13px] text-[var(--muted-text-color)]">{formatSavedAt(props.world.savedAt)}</p>
            </div>
          </AppNavigationButton>
          {(props.onRename || props.onDelete) && (
            <div className="flex shrink-0 flex-col justify-end gap-2">
              {props.onRename && <Button
                aria-label={`Rename ${props.world.name}`}
                className="cartoon-press size-9 text-[var(--canvas-foreground)]"
                onClick={() => props.onRename?.(props.world)}
                size="icon"
                title="Rename world"
                type="button"
              >
                <Pencil aria-hidden="true" />
              </Button>}
              {props.onDelete && <Button
                aria-label={`Delete ${props.world.name}`}
                className="cartoon-press size-9 text-[var(--coral)]"
                onClick={() => props.onDelete?.(props.world)}
                size="icon"
                title="Delete world"
                type="button"
              >
                <Trash2 aria-hidden="true" />
              </Button>}
            </div>
          )}
        </>
      )}
    </article>
  )
}

export function Sandbox() {
  const [savedWorlds, setSavedWorlds] = useState<SavedSandboxWorld[]>([])
  const [loading, setLoading] = useState(true)
  const [renameError, setRenameError] = useState('')
  const [renamingWorld, setRenamingWorld] = useState<SavedSandboxWorld | null>(null)
  const [worldName, setWorldName] = useState('')

  async function deleteWorld(world: SavedSandboxWorld) {
    await deleteSandboxWorld(world.id)
    setSavedWorlds((worlds) => worlds.filter((savedWorld) => savedWorld.id !== world.id))
  }

  function beginRename(world: SavedSandboxWorld) {
    setRenamingWorld(world)
    setWorldName(world.name)
    setRenameError('')
  }

  async function renameWorld() {
    if (!renamingWorld) return
    const name = worldName.trim()
    if (!name) return
    if (savedWorlds.some((world) => world.id !== renamingWorld.id && world.name === name)) {
      setRenameError('A world with this name already exists.')
      return
    }

    const renamedWorld = { ...renamingWorld, name }
    await saveSandboxWorld(renamedWorld)
    setSavedWorlds((worlds) => worlds.map((world) => world.id === renamedWorld.id ? renamedWorld : world))
    setRenamingWorld(null)
  }

  useEffect(() => {
    let active = true

    void loadSandboxWorlds()
      .then((worlds) => {
        if (active) setSavedWorlds(worlds)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] items-center justify-between gap-3 px-5 pb-6">
        <div className="min-w-0">
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[40px] leading-none">Sandbox</h1>
        </div>
        <AppNavigationButton aria-label="Back to main menu" className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title="Back to main menu" to="/"><ArrowLeft aria-hidden="true" /></AppNavigationButton>
      </header>
      <section aria-label="Sandbox worlds" className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col px-5">
        <AppNavigationButton className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase" size="lg" to="/sandbox/new">New</AppNavigationButton>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {loading && <p className="poster-kicker text-center text-[11px] text-[var(--muted-text-color)]">Loading worlds…</p>}
          {!loading && savedWorlds.length > 0 && (
            <div className="grid gap-4 pb-1">
              {savedWorlds.map((world) => <SandboxWorldCard key={world.id} onDelete={deleteWorld} onRename={beginRename} world={world} />)}
            </div>
          )}
        </div>
      </section>
      <Dialog onOpenChange={(open) => {
        if (!open) setRenamingWorld(null)
      }} open={renamingWorld !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename world</DialogTitle>
            <DialogDescription>Choose a unique name for this sandbox world.</DialogDescription>
          </DialogHeader>
          <label className="poster-kicker mt-5 block text-[11px] text-[var(--muted-text-color)]">
            World name
            <input
              autoFocus
              className="mt-2 h-[42px] w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 text-[11px] text-[var(--canvas-foreground)] outline-none focus:border-[var(--canvas-foreground)]"
              onChange={(event) => {
                setWorldName(event.target.value)
                setRenameError('')
              }}
              type="text"
              value={worldName}
            />
          </label>
          {renameError && <p className="mt-3 text-[11px] text-[var(--coral)]" role="alert">{renameError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={!worldName.trim()} onClick={() => void renameWorld()} size="lg" type="button">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
