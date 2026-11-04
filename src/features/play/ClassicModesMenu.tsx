import { useTranslation } from 'react-i18next'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { GAME_CONFIGS } from '@/game/gameConfig'
import { ClassicMenuLayout } from './ClassicMenuLayout'

const MODE_BUTTON_CLASS = 'cartoon-press mode-menu-button w-full text-[13px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase'
const MODE_ENTRIES = Object.entries(GAME_CONFIGS)

export function ClassicModesMenu() {
  const { t } = useTranslation()
  return (
    <ClassicMenuLayout menu="modes">
      <section className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col px-1 pb-1">
        <div aria-label={t('classic.title')} className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain">
          {MODE_ENTRIES.map(([mode, config]) => (
            <AppNavigationButton className={MODE_BUTTON_CLASS} key={mode} navigationOptions={{ state: { returnToClassicMenu: true } }} size="lg" to={`/play?mode=${mode}`}>
              {t(config.title)}
            </AppNavigationButton>
          ))}
          <AppNavigationButton className={MODE_BUTTON_CLASS} navigationOptions={{ state: { returnToClassicMenu: true } }} size="lg" to="/play/infinite">{t('classic.infinite')}</AppNavigationButton>
        </div>
        <div className="flex w-full shrink-0 flex-col pt-3">
          <AppNavigationButton className="cartoon-press mode-menu-button w-full !border-[var(--canvas-foreground)] !bg-[var(--coral)] text-[11px] font-black tracking-[0.2em] !text-[var(--paper)] uppercase hover:!bg-[#b73a2c]" size="lg" to="/saved">
            {t('classic.saved')}
          </AppNavigationButton>
        </div>
      </section>
    </ClassicMenuLayout>
  )
}
