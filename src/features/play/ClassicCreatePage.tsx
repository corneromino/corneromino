import { LogOut, Pause, Play, Save, Settings } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DepthButton } from '@/components/ui/depth-surface'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createRandomSeed } from '@/game/random'
import { GAME_CONFIGS, type CellMarkerColor, type GameConfig, type GameSelectionState, type LockedCellGroup, type PlacedTetromino } from '@/game/gameConfig'
import { saveClassicGameDefinition, saveGameSelection, type ClassicGameDefinition } from '@/lib/db'
import { GameGridCanvas, type GameGridCanvasHandle } from './GameGridCanvas'

export const CLASSIC_CREATE_CONFIG: GameConfig = {
  columns: 5,
  hideGameControls: true,
  lockingMode: 'manual',
  navigationEnabled: true,
  rows: 5,
  spread: 0,
  tetrominoCount: 0,
}

const EMPTY_PIECES: readonly PlacedTetromino[] = []
const EMPTY_LOCKED_CELL_GROUPS: readonly LockedCellGroup[] = []
const EMPTY_MARKERS = new Map<string, CellMarkerColor>()
const EMPTY_SELECTED_CELL_KEYS = new Set<string>()
const ignoreToggle = () => undefined
const DIMENSION_INPUT_CLASS = 'mt-2 py-[11px] w-full border border-[var(--outline-color)] bg-[var(--paper-muted)] px-3 text-[15px] text-[var(--canvas-foreground)] outline-none focus:border-[var(--canvas-foreground)]'

/** Visual foundation for creating a custom Classic board. Placement tools come later. */
export function ClassicCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const gameCanvasRef = useRef<GameGridCanvasHandle>(null)
  const [dimensions, setDimensions] = useState({ columns: CLASSIC_CREATE_CONFIG.columns, rows: CLASSIC_CREATE_CONFIG.rows })
  const [draftDimensions, setDraftDimensions] = useState(() => ({ columns: String(CLASSIC_CREATE_CONFIG.columns), rows: String(CLASSIC_CREATE_CONFIG.rows) }))
  const [dimensionsOpen, setDimensionsOpen] = useState(false)
  const [dimensionError, setDimensionError] = useState('')
  const [pauseOpen, setPauseOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const config = useMemo(() => ({ ...CLASSIC_CREATE_CONFIG, ...dimensions }), [dimensions])

  function openDimensionsDialog() {
    setDraftDimensions({ columns: String(dimensions.columns), rows: String(dimensions.rows) })
    setDimensionError('')
    setDimensionsOpen(true)
  }

  function handleDimensionsOpenChange(open: boolean) {
    setDimensionsOpen(open)
    if (!open) setDimensionError('')
  }

  function applyDimensions() {
    const columns = Number(draftDimensions.columns)
    const rows = Number(draftDimensions.rows)
    if (!Number.isSafeInteger(columns) || columns < 1 || !Number.isSafeInteger(rows) || rows < 1) {
      setDimensionError(t('classic.invalidBoardSize'))
      return
    }
    setDimensions({ columns, rows })
    setDimensionsOpen(false)
  }

  function quitWithoutSaving() {
    navigate('/play/modes', { replace: true })
  }

  async function saveAndQuit() {
    setIsSaving(true)
    setSaveError('')
    try {
      const gameId = `custom-${createRandomSeed()}`
      const screenshot = (await new Promise<Blob | null>((resolve) => gameCanvasRef.current?.captureBoard()?.toBlob(resolve, 'image/png') ?? resolve(null)))
        ?? new Blob([], { type: 'image/png' })
      const definition: ClassicGameDefinition = {
        // A custom board changes its dimensions and contents, not the shared
        // Classic visual/verification behavior players expect in a game.
        config: {
          ...GAME_CONFIGS.c003,
          columns: config.columns,
          hideGameControls: false,
          navigationEnabled: true,
          rows: config.rows,
          tetrominoCount: 0,
        },
        gameMode: 'c003',
        pieces: EMPTY_PIECES,
        seed: gameId,
        source: 'custom',
        version: 1,
      }
      const selection: GameSelectionState = {
        elapsedSeconds: 0,
        gameGridScreenshot: screenshot,
        isCompleted: false,
        lockedCellGroups: [],
        markers: [],
        moveCount: 0,
        savedAt: Date.now(),
        selectedCellKeys: [],
      }
      await saveClassicGameDefinition(definition)
      await saveGameSelection('c003', gameId, selection)
      navigate('/play/modes', { replace: true })
    } catch {
      setSaveError(t('classic.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] items-center justify-between gap-4 px-5 pb-6">
        <div>
          <h1 className="poster-title text-[33px] leading-none">{t('classic.title')}</h1>
          <p className="poster-kicker mt-2 text-[11px] text-[var(--muted-text-color)]">{t('classic.create')}</p>
        </div>
        <DepthButton aria-label={`${t('common.pause')} ${t('classic.title')}`} className="size-10 shrink-0 text-[var(--canvas-foreground)]" onClick={() => setPauseOpen(true)} title={t('common.pause')}>
          <Pause aria-hidden="true" />
        </DepthButton>
      </header>
      <div className="relative z-10 min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col px-1">
          <div className="flex min-h-0 flex-1 items-start justify-center [container-type:size]">
            <section aria-label={t('classic.createBoard')} className="relative mx-auto max-w-[550px]" style={{ aspectRatio: `${config.columns} / ${config.rows}`, width: `min(100%, calc(100cqh * ${config.columns} / ${config.rows}))` }}>
              <div className="relative size-full">
                <GameGridCanvas
                  config={config}
                  interactive
                  lockedCellGroups={EMPTY_LOCKED_CELL_GROUPS}
                  markers={EMPTY_MARKERS}
                  onToggle={ignoreToggle}
                  pieces={EMPTY_PIECES}
                  selectedCellKeys={EMPTY_SELECTED_CELL_KEYS}
                  selectedLockedGroupId={null}
                  showCellIds={false}
                  ref={gameCanvasRef}
                />
              </div>
            </section>
          </div>
          <DepthButton aria-label={t('classic.configureBoardSize')} className="mx-auto mt-4 size-10 shrink-0 text-[var(--canvas-foreground)]" onClick={openDimensionsDialog} title={t('classic.configureBoardSize')}>
            <Settings aria-hidden="true" />
          </DepthButton>
        </div>
      </div>
      <Dialog onOpenChange={handleDimensionsOpenChange} open={dimensionsOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('common.settings')}</DialogTitle></DialogHeader>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="poster-kicker block text-[11px] text-[var(--muted-text-color)]">
              {t('classic.rows')}
              <input
                autoFocus
                className={DIMENSION_INPUT_CLASS}
                min="1"
                onChange={(event) => {
                  setDraftDimensions((current) => ({ ...current, rows: event.target.value }))
                  setDimensionError('')
                }}
                step="1"
                type="number"
                value={draftDimensions.rows}
              />
            </label>
            <label className="poster-kicker block text-[11px] text-[var(--muted-text-color)]">
              {t('classic.columns')}
              <input
                className={DIMENSION_INPUT_CLASS}
                min="1"
                onChange={(event) => {
                  setDraftDimensions((current) => ({ ...current, columns: event.target.value }))
                  setDimensionError('')
                }}
                step="1"
                type="number"
                value={draftDimensions.columns}
              />
            </label>
          </div>
          {dimensionError && <p className="mt-3 text-[11px] text-[var(--coral)]" role="alert">{dimensionError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <DepthButton className="h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase">
                {t('common.cancel')}
              </DepthButton>
            </DialogClose>
            <DepthButton className="h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" onClick={applyDimensions}>
              {t('classic.applyBoardSize')}
            </DepthButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={setPauseOpen} open={pauseOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t('classic.paused')}</DialogTitle></DialogHeader>
          <DialogFooter className="grid-cols-1">
            <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={() => setPauseOpen(false)} size="lg" type="button">
              <Play aria-hidden="true" /> {t('common.resume')}
            </Button>
            <div className="mt-3 grid gap-2">
              <DialogDescription className="text-center text-[18px]">{t('classic.savePrompt')}</DialogDescription>
              <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={() => void saveAndQuit()} size="lg" type="button">
                <Save aria-hidden="true" /> {t('common.saveAndQuit')}
              </Button>
              <Button className="w-full text-[15px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" disabled={isSaving} onClick={quitWithoutSaving} size="lg" type="button">
                <LogOut aria-hidden="true" /> {t('common.quitWithoutSaving')}
              </Button>
            </div>
          </DialogFooter>
          {saveError && <p className="mt-3 text-center text-[11px] text-[var(--coral)]" role="alert">{saveError}</p>}
        </DialogContent>
      </Dialog>
    </main>
  )
}
