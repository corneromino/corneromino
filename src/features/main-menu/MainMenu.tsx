import { useRef } from 'react'
import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { APP_VERSION } from '@/lib/appVersion'
import cascadeGraphic from '@/assets/cascade-graphic.svg'
import classicGraphic from '@/assets/classic-graphic.svg'
import vsGraphic from '@/assets/vs-graphic.svg'
import { TetrominoBackground } from './TetrominoBackground'
import { TitleTetromino } from './TitleTetrominoCell'
import { cn } from '@/lib/utils'

export function MainMenu() {
  const menuRef = useRef<HTMLElement>(null)
  const { t } = useTranslation()

  return (
    <main className="poster-page app-page relative overflow-hidden px-5 text-[var(--canvas-foreground)]" ref={menuRef}>
      <TetrominoBackground />
      <div className="absolute top-5 right-5 left-5 z-20 flex items-start justify-between">
        <AppNavigationButton
          aria-label={t('tutorial.open')}
          className="h-auto min-w-0 border-0 bg-transparent p-0 text-[24px] leading-none text-[var(--canvas-foreground)] opacity-80 font-black shadow-none hover:opacity-70 focus-visible:opacity-100"
          navigationOptions={{ state: { returnToMainMenu: true } }}
          size="icon"
          title={t('tutorial.open')}
          to="/play/tutorial"
        >
          ?
        </AppNavigationButton>
        <AppNavigationButton aria-label={t('common.settings')} className="cartoon-press size-10 text-[var(--canvas-foreground)]" size="icon" title={t('common.settings')} to="/settings"><Settings aria-hidden="true" /></AppNavigationButton>
      </div>
      <div className="menu-scroll">
        <section className={cn("menu-content mx-auto flex w-full max-w-[430px] flex-col items-center")}>
          <TitleTetromino pointerAreaRef={menuRef} />
          <h1 className="poster-title main-menu-title max-w-full leading-none">
            {t('mainMenu.title')}
          </h1>
          <AppNavigationButton
            className="cartoon-press classic-menu-button w-full gap-10 text-[25px] font-black text-[var(--canvas-foreground)] uppercase"
            size="lg"
            to="/play"
          >
            <span>{t('mainMenu.classic')}</span>
            <img alt="" aria-hidden="true" className="classic-menu-graphic -rotate-12 scale-125" src={classicGraphic} />
          </AppNavigationButton>
          <AppNavigationButton
            className="cartoon-press cascade-menu-button w-full gap-10 text-[25px] font-black text-[var(--canvas-foreground)] uppercase"
            size="lg"
            to="/cascade"
          >
            <span>{t('mainMenu.cascade')}</span>
            <img alt="" aria-hidden="true" className="cascade-menu-graphic -rotate-12 scale-125" src={cascadeGraphic} />
          </AppNavigationButton>
          <AppNavigationButton
            className="cartoon-press vs-menu-button w-full gap-10 text-[25px] font-black text-[var(--canvas-foreground)] uppercase"
            size="lg"
            to="/vs"
          >
            <span>{t('mainMenu.versus')}</span>
            <img alt="" aria-hidden="true" className="vs-menu-graphic -rotate-12 scale-125" src={vsGraphic} />
          </AppNavigationButton>
        </section>
      </div>
      <p aria-label={t('mainMenu.version', { version: APP_VERSION })} className="pointer-events-none absolute inset-x-0 bottom-2 z-10 text-center text-[10px] font-bold tracking-[0.12em] text-[var(--canvas-foreground)] opacity-35">
        v{APP_VERSION}
      </p>
    </main>
  )
}
