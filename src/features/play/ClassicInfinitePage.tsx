import { useEffect, useMemo, useState } from 'react'
import { LogOut, Pause, Play, RotateCcw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createRandomSeed } from '@/game/random'
import { GameGrid } from './GameGrid'
import { ClassicCornerominosDialog } from './ClassicCornerominosDialog'
import { CLASSIC_INFINITE_CONFIG, ClassicInfiniteStream, createInfiniteSectionGenerator, type ClassicInfiniteSection } from './classicInfiniteStream'
import type { ClassicInfiniteCellExit } from './classicInfiniteCellExit'
// import { CLASSIC_INFINITE_VHS_CRT } from './classicInfiniteEffects'

const BOARD_CONFIG = { ...CLASSIC_INFINITE_CONFIG, rows: CLASSIC_INFINITE_CONFIG.rows * 2 }
const PAUSE_BUTTON_CLASS = 'cartoon-press h-[42px] w-full text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase'

function InfiniteSession({ onCellExit, onRestart }: { onCellExit?: (event: ClassicInfiniteCellExit) => void; onRestart: () => void }) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [seed] = useState(createRandomSeed)
  const [paused, setPaused] = useState(false)
  const [cornerominosOpen, setCornerominosOpen] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [generationFailed, setGenerationFailed] = useState(false)
  const [session, setSession] = useState<{ stream: ClassicInfiniteStream; sections: readonly ClassicInfiniteSection[] } | null>(null)

  useEffect(() => {
    let active = true
    const stream = new ClassicInfiniteStream(
      CLASSIC_INFINITE_CONFIG,
      createInfiniteSectionGenerator(CLASSIC_INFINITE_CONFIG, seed),
      (sections) => { if (active) setSession({ stream, sections }) },
      () => { if (active) setGenerationFailed(true) },
    )
    void stream.start().then(() => {
      if (active) setSession({ stream, sections: stream.sections })
    }).catch(() => {
      if (active) setGenerationFailed(true)
    })
    return () => {
      active = false
      stream.destroy()
    }
  }, [seed])

  const pieces = useMemo(() => session?.sections.flatMap((section) => section.pieces) ?? [], [session])
  const scrolling = useMemo(() => session ? {
    firstRow: session.sections[1].firstRow,
    visibleRows: CLASSIC_INFINITE_CONFIG.visibleRows,
    getOffsetRows: session.stream.getOffsetRows,
    advance: session.stream.advance,
  } : undefined, [session])

  function resume() { setPaused(false) }
  function pause() { setPaused(true) }
  function quit() {
    if (location.state?.returnToClassicMenu === true) navigate(-1)
    else navigate('/play', { replace: true })
  }

  const pauseDialog = (
    <Dialog onOpenChange={setPaused} open={paused}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{t('classic.paused')}</DialogTitle></DialogHeader>
        <DialogFooter className="grid-cols-1">
          <Button className={PAUSE_BUTTON_CLASS} onClick={resume} size="lg" type="button"><Play aria-hidden="true" /> {t('common.resume')}</Button>
          <Button className={PAUSE_BUTTON_CLASS} onClick={onRestart} size="lg" type="button"><RotateCcw aria-hidden="true" /> {t('common.restart')}</Button>
          <Button className={PAUSE_BUTTON_CLASS} onClick={quit} size="lg" type="button"><LogOut aria-hidden="true" /> {t('common.quit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden py-5 text-[var(--canvas-foreground)]">
      <header className="mx-auto flex w-full max-w-[550px] shrink-0 flex-col gap-3 px-5 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="poster-title text-[33px] leading-none">{t('classic.title')}</h1>
            <Button aria-label="8 Cornerominos" className="h-auto min-w-0 border-0 bg-transparent p-0 text-[24px] leading-none text-[var(--canvas-foreground)] opacity-80 font-black shadow-none hover:opacity-70 focus-visible:opacity-100" onClick={() => setCornerominosOpen(true)} size="icon" title="8 Cornerominos" type="button">?</Button>
          </div>
          <Button aria-label={t('common.pause')} className="cartoon-press size-10 shrink-0 text-[var(--canvas-foreground)]" onClick={pause} size="icon" title={t('common.pause')} type="button"><Pause aria-hidden="true" /></Button>
        </div>
        <div className="poster-kicker flex items-center justify-between gap-4 text-[11px] text-[var(--muted-text-color)]">
          <p>{t('classic.infinite')} / {t('classic.moves', { count: moveCount })}</p>
          <p>{Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}</p>
        </div>
      </header>
      {generationFailed && (
        <div className="mx-auto mb-3 flex max-w-[550px] items-center gap-3 px-5">
          <p className="text-[11px] text-[var(--coral)]" role="alert">{t('classic.infiniteGenerationFailed')}</p>
          <Button className="cartoon-press" onClick={onRestart} type="button">{t('common.restart')}</Button>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {session && scrolling ? <GameGrid
          config={BOARD_CONFIG}
          gameId={seed}
          gameMode="infinite"
          onElapsedSecondsChange={setElapsedSeconds}
          onCellExit={onCellExit}
          onMoveCountChange={setMoveCount}
          onNextGame={onRestart}
          onPauseOpenChange={setPaused}
          onRestart={onRestart}
          paused={paused || generationFailed}
          pauseDialog={pauseDialog}
          persistSelection={false}
          pieces={pieces}
          scrolling={scrolling}
          suspended={cornerominosOpen}
          // vhsCrt={CLASSIC_INFINITE_VHS_CRT}
        /> : <>
          {!generationFailed && <p className="px-5 text-center text-[11px] font-bold uppercase">{t('classic.generating')}</p>}
          {pauseDialog}
        </>}
      </div>
      <ClassicCornerominosDialog onOpenChange={setCornerominosOpen} open={cornerominosOpen} />
    </main>
  )
}

export function ClassicInfinitePage({ onCellExit }: { onCellExit?: (event: ClassicInfiniteCellExit) => void }) {
  const [run, setRun] = useState(0)
  function restart() { setRun((current) => current + 1) }
  return <InfiniteSession key={run} onCellExit={onCellExit} onRestart={restart} />
}
