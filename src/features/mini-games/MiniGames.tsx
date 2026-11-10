import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import cascadeGraphic from '@/assets/cascade-graphic.svg'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'

/** Placeholder menu for the collection of smaller games. */
export function MiniGames() {
  const { t } = useTranslation()

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden px-5 py-5 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] shrink-0 items-start justify-between gap-3 pb-10">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">{t('mainMenu.title')}</p>
          <h1 className="poster-title mt-2 text-[40px] leading-none">{t('miniGames.title')}</h1>
        </div>
        <AppNavigationButton aria-label={t('common.backToMainMenu')} className="size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title={t('common.backToMainMenu')} to="/"><ArrowLeft aria-hidden="true" /></AppNavigationButton>
      </header>
      <section className="relative z-10 mx-auto flex w-full max-w-[550px] flex-col gap-3 px-1">
        <AppNavigationButton
          className="w-full gap-10 text-[25px] font-black text-[var(--canvas-foreground)] uppercase"
          yPadding={40}
          radius={20}
          borderWidth={4}
          to={"/cascade"}
        >
          <span>{t('mainMenu.cascade')}</span>
          <img alt="" aria-hidden="true" className="size-16 -rotate-12 scale-170 object-contain" src={cascadeGraphic} />
        </AppNavigationButton>
      </section>
    </main>
  )
}
