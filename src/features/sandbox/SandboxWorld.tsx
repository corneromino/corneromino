import { useEffect, useRef, useState } from 'react'
import { Copy, FolderOpen, LogOut, MousePointer2, Move, PenLine, Save, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { loadSandboxWorld, loadSandboxWorlds, saveSandboxWorld, type SavedSandboxWorld } from '@/lib/db'
import { SandboxWorldCard } from './Sandbox'
import { SandboxCanvas, type SandboxCanvasHandle } from './SandboxCanvas'

export function SandboxWorld() {
  const { worldId } = useParams()
  const canvasRef = useRef<SandboxCanvasHandle>(null)
  const [deleteEnabled, setDeleteEnabled] = useState(false)
  const [drawEnabled, setDrawEnabled] = useState(false)
  const [selectEnabled, setSelectEnabled] = useState(false)
  const [moveEnabled, setMoveEnabled] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSelection, setSaveSelection] = useState(false)
  const [overwriteWorld, setOverwriteWorld] = useState<SavedSandboxWorld | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importWorlds, setImportWorlds] = useState<SavedSandboxWorld[]>([])
  const [loadingImportWorlds, setLoadingImportWorlds] = useState(false)
  const [savedWorldId, setSavedWorldId] = useState<string | null>(null)
  const [worldName, setWorldName] = useState('')
  const [loadedWorld, setLoadedWorld] = useState<SavedSandboxWorld | null>(null)
  const [loadingWorld, setLoadingWorld] = useState(Boolean(worldId))

  useEffect(() => {
    let active = true

    if (!worldId) {
      setLoadedWorld(null)
      setLoadingWorld(false)
      setSavedWorldId(null)
      setWorldName('')
      return () => {
        active = false
      }
    }

    setLoadingWorld(true)
    setLoadedWorld(null)
    void loadSandboxWorld(worldId)
      .then((world) => {
        if (!active || !world) return
        setLoadedWorld(world)
        setSavedWorldId(world.id)
        setWorldName(world.name)
      })
      .finally(() => {
        if (active) setLoadingWorld(false)
      })

    return () => {
      active = false
    }
  }, [worldId])

  async function saveWorld(overwriteWorldId?: string) {
    const name = worldName.trim()
    if (!name || !canvasRef.current) return

    setIsSaving(true)
    setSaveError('')
    try {
      if (!overwriteWorldId) {
        const currentWorldId = saveSelection ? null : savedWorldId
        const matchingWorld = (await loadSandboxWorlds()).find((world) => (
          world.id !== currentWorldId && world.name === name
        ))
        if (matchingWorld) {
          setOverwriteWorld(matchingWorld)
          return
        }
      }
      const { screenshot, state } = saveSelection
        ? await canvasRef.current.captureSelectedWorld()
        : await canvasRef.current.captureWorld()
      const nextWorldId = overwriteWorldId ?? (saveSelection ? crypto.randomUUID() : savedWorldId ?? crypto.randomUUID())
      await saveSandboxWorld({
        id: nextWorldId,
        name,
        savedAt: Date.now(),
        screenshot,
        state,
      })
      if (!saveSelection) setSavedWorldId(nextWorldId)
      setOverwriteWorld(null)
      setSaveDialogOpen(false)
    } catch {
      setSaveError('Could not save this world.')
    } finally {
      setIsSaving(false)
    }
  }

  function openSaveDialog() {
    setSaveSelection(selectEnabled)
    setOverwriteWorld(null)
    if (selectEnabled) setWorldName('')
    setSaveDialogOpen(true)
  }

  function openImportDialog() {
    setLoadingImportWorlds(true)
    setImportDialogOpen(true)
    void loadSandboxWorlds()
      .then(setImportWorlds)
      .finally(() => setLoadingImportWorlds(false))
  }

  function chooseWorldToPaste(world: SavedSandboxWorld) {
    canvasRef.current?.beginPaste(world.state)
    setImportDialogOpen(false)
    setDrawEnabled(false)
    setDeleteEnabled(false)
    setSelectEnabled(true)
    setMoveEnabled(true)
  }

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] items-end justify-between gap-3 px-5 pb-6">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[33px] leading-none">Sandbox</h1>
        </div>
        <div className="flex shrink-0 gap-1 sm:gap-2">
          <Button
            aria-label="Toggle draw mode"
            aria-pressed={drawEnabled}
            className={`cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)] ${drawEnabled ? '!bg-[var(--yellow)]' : ''}`}
            onClick={() => {
              setDrawEnabled((enabled) => !enabled)
              setDeleteEnabled(false)
              setMoveEnabled(false)
            }}
            size="icon"
            title="Toggle draw mode"
            type="button"
          >
            <PenLine aria-hidden="true" />
          </Button>
          <Button
            aria-label="Toggle delete mode"
            aria-pressed={deleteEnabled}
            className={`cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--coral)] ${deleteEnabled ? '!bg-[var(--coral)] !text-[var(--paper)]' : ''}`}
            onClick={() => {
              if (selectEnabled) {
                canvasRef.current?.deleteSelectedCells()
                return
              }
              setDeleteEnabled((enabled) => !enabled)
              setDrawEnabled(false)
              setSelectEnabled(false)
              setMoveEnabled(false)
            }}
            size="icon"
            title="Toggle delete mode"
            type="button"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </header>
      <section aria-label="Sandbox canvas" className="relative z-10 min-h-0 flex-1 bg-[#773526] border-[#773526] border-4 mx-1">
        {loadingWorld && <p className="poster-kicker p-5 text-center text-[11px] text-[var(--paper)]">Loading world…</p>}
        {!loadingWorld && (!worldId || loadedWorld) && (
          <SandboxCanvas
            deleteEnabled={deleteEnabled}
            drawEnabled={drawEnabled}
            initialState={loadedWorld?.state ?? null}
            key={worldId ?? 'new'}
            ref={canvasRef}
            moveEnabled={moveEnabled}
            selectEnabled={selectEnabled}
          />
        )}
        {!loadingWorld && worldId && !loadedWorld && <p className="poster-kicker p-5 text-center text-[11px] text-[var(--paper)]">World not found</p>}
      </section>
      <div className="relative z-10 mx-auto flex w-full max-w-[550px] flex-nowrap justify-center gap-1 px-1 pt-4 sm:gap-2">
        <Button asChild className="cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)]" size="icon" title="Exit sandbox">
          <Link aria-label="Exit sandbox" to="/sandbox"><LogOut aria-hidden="true" /></Link>
        </Button>
        <Button
          aria-label="Save sandbox world"
          className="cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)]"
          onClick={openSaveDialog}
          size="icon"
          title="Save sandbox world"
          type="button"
        >
          <Save aria-hidden="true" />
        </Button>
        <Button
          aria-label="Load sandbox world"
          className="cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)]"
          onClick={openImportDialog}
          size="icon"
          title="Load sandbox world"
          type="button"
        >
          <FolderOpen aria-hidden="true" />
        </Button>
        <Button
          aria-label="Toggle select mode"
          aria-pressed={selectEnabled}
          className={`cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)] ${selectEnabled ? '!bg-[#a8a8a8]' : ''}`}
          onClick={() => {
            setSelectEnabled((enabled) => !enabled)
            setDrawEnabled(false)
            setDeleteEnabled(false)
            setMoveEnabled(false)
          }}
          size="icon"
          title="Toggle select mode"
          type="button"
        >
          <MousePointer2 aria-hidden="true" />
        </Button>
        <Button
          aria-label={moveEnabled ? 'Confirm move' : 'Toggle move mode'}
          aria-pressed={moveEnabled}
          className={`cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)] ${moveEnabled ? '!bg-[#a8a8a8]' : ''}`}
          disabled={!selectEnabled}
          onClick={() => {
            if (moveEnabled) {
              canvasRef.current?.commitMove()
              setMoveEnabled(false)
            } else {
              setMoveEnabled(true)
            }
          }}
          size="icon"
          title={moveEnabled ? 'Confirm move' : 'Toggle move mode'}
          type="button"
        >
          <Move aria-hidden="true" />
        </Button>
        <Button
          aria-label="Copy moved selection"
          className="cartoon-press size-[clamp(36px,11vw,44px)] text-[var(--canvas-foreground)]"
          disabled={!moveEnabled}
          onClick={() => {
            canvasRef.current?.commitMove(true)
            setMoveEnabled(false)
          }}
          size="icon"
          title="Copy moved selection"
          type="button"
        >
          <Copy aria-hidden="true" />
        </Button>
      </div>
      <Dialog onOpenChange={setSaveDialogOpen} open={saveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{overwriteWorld ? 'Overwrite world?' : 'Save world'}</DialogTitle>
            <DialogDescription>
              {overwriteWorld
                ? `A world named “${overwriteWorld.name}” already exists. Overwriting it cannot be undone.`
                : saveSelection ? 'Name this new world saved from the selected cells.' : 'Name this sandbox world and save the current canvas view.'}
            </DialogDescription>
          </DialogHeader>
          {!overwriteWorld && <label className="poster-kicker mt-5 block text-[11px] text-[var(--muted-text-color)]">
            World name
            <input
              autoFocus
              className="mt-2 h-[42px] w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 text-[11px] text-[var(--canvas-foreground)] outline-none focus:border-[var(--canvas-foreground)]"
              disabled={isSaving}
              onChange={(event) => {
                setWorldName(event.target.value)
                setSaveError('')
              }}
              placeholder="Enter world name"
              type="text"
              value={worldName}
            />
          </label>}
          {saveError && <p className="mt-3 text-[11px] text-[var(--coral)]" role="alert">{saveError}</p>}
          <DialogFooter>
            {overwriteWorld ? (
              <>
                <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={() => setOverwriteWorld(null)} size="lg" type="button">
                  Back
                </Button>
                <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--coral)] uppercase" disabled={isSaving} onClick={() => void saveWorld(overwriteWorld.id)} size="lg" type="button">
                  Overwrite
                </Button>
              </>
            ) : (
              <>
                <DialogClose asChild>
                  <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} size="lg" type="button">
                    Cancel
                  </Button>
                </DialogClose>
                <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving || !worldName.trim()} onClick={() => void saveWorld()} size="lg" type="button">
                  Save
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={setImportDialogOpen} open={importDialogOpen}>
        <DialogContent className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Paste saved world</DialogTitle>
            <DialogDescription>Choose a world to position and paste into this one.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto pr-1">
            {loadingImportWorlds && <p className="poster-kicker py-4 text-center text-[11px] text-[var(--muted-text-color)]">Loading worlds…</p>}
            {!loadingImportWorlds && importWorlds.length === 0 && <p className="poster-kicker py-4 text-center text-[11px] text-[var(--muted-text-color)]">No saved worlds yet.</p>}
            {!loadingImportWorlds && importWorlds.length > 0 && (
              <div className="grid gap-4 py-4">
                {importWorlds.map((world) => <SandboxWorldCard key={world.id} onSelect={chooseWorldToPaste} world={world} />)}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
