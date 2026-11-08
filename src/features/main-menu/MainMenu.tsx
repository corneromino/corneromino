import { useRef } from 'react'
import { Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { APP_VERSION } from '@/lib/appVersion'
import cascadeGraphic from '@/assets/cascade-graphic.svg'
import vsGraphic from '@/assets/vs-graphic.svg'
import { TetrominoBackground } from './TetrominoBackground'
import { MainMenuTitle } from './MainMenuTitle'
// import { TitleTetromino } from './TitleTetrominoCell'
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
          variant="ghost"
        >
          ?
        </AppNavigationButton>
        <AppNavigationButton aria-label={t('common.settings')} className="size-10 text-[var(--canvas-foreground)]" size="icon" title={t('common.settings')} to="/settings"><Settings aria-hidden="true" /></AppNavigationButton>
      </div>
      <div className="menu-scroll">
        <section className={cn('menu-content mx-auto flex min-h-full w-full max-w-[430px] flex-col items-center justify-between pt-12 pb-5')}>
          <div className="flex w-full flex-col items-center">
            {/* <TitleTetromino pointerAreaRef={menuRef} /> */}
            <MainMenuTitle />
          </div>
          <div className="flex w-full flex-col items-center gap-3">
            {/* <AppNavigationButton
              className="w-full gap-10 text-[25px] font-black text-[var(--canvas-foreground)] uppercase"
              size="lg"
              yPadding={40}
              to="/play/levels"
              radius={20}
            >
              <span>{t('mainMenu.classic')}</span>
              <img alt="" aria-hidden="true" className="classic-menu-graphic -rotate-12 scale-125" src={classicGraphic} />
            </AppNavigationButton> */}
            <AppNavigationButton
              className="w-full gap-10 text-[25px] font-black text-[var(--canvas-foreground)] uppercase"
              yPadding={40}
              size="lg"
              radius={20}
              to="/vs"
            >
              <span>{t('mainMenu.versus')}</span>
              <img alt="" aria-hidden="true" className="vs-menu-graphic -rotate-12 scale-125" src={vsGraphic} />
            </AppNavigationButton>
            <AppNavigationButton
              className="w-full gap-10 text-[25px] font-black text-[var(--canvas-foreground)] uppercase"
              yPadding={30}
              radius={20}
              to="/mini-games"
            >
              <span>{t('mainMenu.miniGames')}</span>
              <img alt="" aria-hidden="true" className="size-16 -rotate-12 scale-200 -translate-y-5 object-contain" src={cascadeGraphic} />
            </AppNavigationButton>
          </div>
        </section>
      </div>
      <p aria-label={t('mainMenu.version', { version: APP_VERSION })} className="pointer-events-none absolute inset-x-0 bottom-2 z-10 text-center text-[10px] font-bold tracking-[0.12em] text-[var(--canvas-foreground)] opacity-35">
        v{APP_VERSION}
      </p>
    </main>
  )
}
