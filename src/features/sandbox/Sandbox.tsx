import { useEffect, useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { deleteSandboxWorld, loadSandboxWorlds, type SavedSandboxWorld } from '@/lib/db'
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
            <h2 className="text-[22px] font-black uppercase">{props.world.name}</h2>
            <p className="poster-kicker mt-2 text-[11px] text-[var(--muted-text-color)]">{formatSavedAt(props.world.savedAt)}</p>
          </div>
        </button>
      ) : (
        <Link className="flex min-w-0 flex-1 gap-3" to={`/sandbox/${props.world.id}`}>
          {screenshotUrl &&
            <img
              alt={`Saved sandbox world: ${props.world.name}`}
              className="h-auto w-28 shrink-0 self-start border-[#773526] border-4"
              src={screenshotUrl}
            />
          }
          <div className="min-w-0 py-1">
            <h2 className="text-[22px] font-black uppercase">{props.world.name}</h2>
            <p className="poster-kicker mt-2 text-[11px] text-[var(--muted-text-color)]">{formatSavedAt(props.world.savedAt)}</p>
          </div>
        </Link>
      )}
      {props.onDelete && <Button
        aria-label={`Delete ${props.world.name}`}
        className="cartoon-press size-9 shrink-0 self-end text-[var(--coral)]"
        onClick={() => props.onDelete?.(props.world)}
        size="icon"
        title="Delete world"
        type="button"
      >
        <Trash2 aria-hidden="true" />
      </Button>}
    </article>
  )
}

export function Sandbox() {
  const [savedWorlds, setSavedWorlds] = useState<SavedSandboxWorld[]>([])
  const [loading, setLoading] = useState(true)

  async function deleteWorld(world: SavedSandboxWorld) {
    await deleteSandboxWorld(world.id)
    setSavedWorlds((worlds) => worlds.filter((savedWorld) => savedWorld.id !== world.id))
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
    <main className="poster-page relative flex h-dvh flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] items-center justify-between gap-3 px-5 pb-6">
        <div className="min-w-0">
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[33px] leading-none">Sandbox</h1>
        </div>
        <Button asChild className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title="Back to main menu">
          <Link aria-label="Back to main menu" to="/"><ArrowLeft aria-hidden="true" /></Link>
        </Button>
      </header>
      <section aria-label="Sandbox worlds" className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col px-5">
        <Button asChild className="cartoon-press h-[62px] w-full text-[11px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase" size="lg">
          <Link to="/sandbox/new">New</Link>
        </Button>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {loading && <p className="poster-kicker text-center text-[11px] text-[var(--muted-text-color)]">Loading worlds…</p>}
          {!loading && savedWorlds.length > 0 && (
            <div className="grid gap-4 pb-1">
              {savedWorlds.map((world) => <SandboxWorldCard key={world.id} onDelete={deleteWorld} world={world} />)}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
