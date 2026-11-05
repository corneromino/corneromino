import { useState, type ReactNode } from 'react'
import { ArrowLeft, List, Route } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { Button } from '@/components/ui/button'
// import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'
import { ClassicShapesDialog } from './ClassicShapesDialog'

interface ClassicMenuLayoutProps {
  children: ReactNode
  menu: 'career' | 'modes'
}

export function ClassicMenuLayout({ children, menu }: ClassicMenuLayoutProps) {
  const { t } = useTranslation()
  const [shapesOpen, setShapesOpen] = useState(false)
  const isCareer = menu === 'career'
  const switchTo = isCareer ? '/play/modes' : '/play/levels'
  const switchLabel = t(isCareer ? 'classic.openModes' : 'classic.openCareer')

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden px-5 py-5 text-[var(--canvas-foreground)]">
      {/* <TetrominoBackground /> */}
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] shrink-0 items-start justify-between gap-3 pb-10">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">{t('mainMenu.title')}</p>
          <div className="flex items-center gap-2">
            <h1 className="poster-title mt-2 text-[40px] leading-none max-[380px]:text-[30px]">{t('classic.title')}</h1>
            <Button
              aria-label={t('classic.shapesTitle')}
              className="bg-transparent text-[24px] leading-none text-[var(--canvas-foreground)] opacity-40 font-black shadow-none hover:opacity-70 focus-visible:opacity-100"
              onClick={() => setShapesOpen(true)}
              size="icon"
              title={t('classic.shapesTitle')}
              type="button"
              variant="ghost"
            >?</Button>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <AppNavigationButton aria-label={switchLabel} className="size-[42px] text-[var(--canvas-foreground)]" size="icon" title={switchLabel} to={switchTo}>
            {isCareer ? <List aria-hidden="true" /> : <Route aria-hidden="true" />}
          </AppNavigationButton>
          <AppNavigationButton aria-label={t('common.backToMainMenu')} className="size-[42px] text-[var(--canvas-foreground)]" size="icon" title={t('common.backToMainMenu')} to="/"><ArrowLeft aria-hidden="true" /></AppNavigationButton>
        </div>
      </header>
      {children}
      <ClassicShapesDialog onOpenChange={setShapesOpen} open={shapesOpen} />
    </main>
  )
}
