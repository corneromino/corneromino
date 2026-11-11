import { ArrowLeft, Users, Wifi } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { DepthButton, PAPER_DEPTH_SHADOW_COLOR } from '@/components/ui/depth-surface'
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
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">{t('mainMenu.title')}</p>
          <h1 className="poster-title mt-2 text-[40px] leading-none">VS</h1>
        </div>
        <AppNavigationButton aria-label={t('common.backToMainMenu')} className="size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title={t('common.backToMainMenu')} to="/"><ArrowLeft aria-hidden="true" /></AppNavigationButton>
      </header>
      <section aria-label={t('versus.gameType')} className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-1 pb-1">
        <DepthButton
          className="w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          onClick={() => setLocalSetupOpen(true)}
          shadowColor={PAPER_DEPTH_SHADOW_COLOR}
          type="button"
          radius={20}
          borderWidth={4}
          yPadding={20}
        >
          <Users aria-hidden="true" /> {t('versus.local')}
        </DepthButton>
        <DepthButton
          className="w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          disabled
          shadowColor={PAPER_DEPTH_SHADOW_COLOR}
          type="button"
          radius={20}
          borderWidth={4}
          yPadding={20}
        >
          <Wifi aria-hidden="true" /> {t('versus.online')}
        </DepthButton>
      </section>
      <VsLocalSetupDialog onContinue={continueLocalMatch} onOpenChange={setLocalSetupOpen} onStart={startLocalMatch} open={localSetupOpen} />
    </main>
  )
}
