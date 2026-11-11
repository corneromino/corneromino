import type { PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { DepthButton, DEPTH_BUTTON_COLORS } from '@/components/ui/depth-surface'
import { GAME_CONFIGS } from '@/game/gameConfig'
import { ClassicMenuLayout } from './ClassicMenuLayout'

const MODE_BUTTON_CLASS = 'mode-menu-button w-full text-[13px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase'
const MODE_ENTRIES = Object.entries(GAME_CONFIGS)

export function ClassicModesMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  function navigateToCreate() {
    navigate('/play/create', { state: { returnToClassicMenu: true } })
  }

  function openCreate(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'touch') return
    event.preventDefault()
    navigateToCreate()
  }

  return (
    <ClassicMenuLayout menu="modes">
      <section className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col px-1 pb-1">
        <div aria-label={t('classic.title')} className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain">
          {MODE_ENTRIES.map(([mode, config]) => (
            <AppNavigationButton className={MODE_BUTTON_CLASS} key={mode} navigationOptions={{ state: { returnToClassicMenu: true } }} size="lg" to={`/play?mode=${mode}`}>
              {t(config.title)}
            </AppNavigationButton>
          ))}
        </div>
        <div className="flex w-full shrink-0 gap-3 pt-3">
          <AppNavigationButton borderColor="var(--canvas-foreground)" className="mode-menu-button flex-1 text-[11px] font-black tracking-[0.2em] text-[var(--paper)] uppercase" color="var(--coral)" hoverColor="#b73a2c" size="lg" to="/saved">
            {t('classic.saved')}
          </AppNavigationButton>
          <DepthButton
            {...DEPTH_BUTTON_COLORS.blue}
            borderColor="var(--canvas-foreground)"
            className="mode-menu-button h-10 flex-1 rounded-md px-6 text-[11px] font-black tracking-[0.2em] text-black uppercase"
            onClick={navigateToCreate}
            onPointerUp={openCreate}
          >
            {t('classic.create')}
          </DepthButton>
        </div>
      </section>
    </ClassicMenuLayout>
  )
}
