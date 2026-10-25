import { ArrowLeft, Users, Wifi } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'
import { VsLocalSetupDialog } from './VsLocalSetupDialog'
import type { VsLocalBoardSize } from './vsLocalConfig'

export function VsMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [localSetupOpen, setLocalSetupOpen] = useState(false)

  function startLocalMatch(boardSize: VsLocalBoardSize) {
    navigate(`/vs/local?boardSize=${boardSize}`, { state: { returnToVsMenu: true, startNewVsMatch: true } })
  }

  function continueLocalMatch() {
    navigate('/vs/local', { state: { returnToVsMenu: true } })
  }

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden px-5 py-5 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] shrink-0 items-start justify-between gap-3 pb-10">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[40px] leading-none">VS</h1>
        </div>
        <Button asChild className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title={t('common.backToMainMenu')}>
          <Link aria-label={t('common.backToMainMenu')} to="/"><ArrowLeft aria-hidden="true" /></Link>
        </Button>
      </header>
      <section aria-label="VS game type" className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-1 pb-1">
        <Button className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase" onClick={() => setLocalSetupOpen(true)} size="lg" type="button">
          <Users aria-hidden="true" /> {t('versus.local')}
        </Button>
        <Button className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase" disabled size="lg" type="button">
          <Wifi aria-hidden="true" /> {t('versus.online')}
        </Button>
      </section>
      <VsLocalSetupDialog onContinue={continueLocalMatch} onOpenChange={setLocalSetupOpen} onStart={startLocalMatch} open={localSetupOpen} />
    </main>
  )
}
