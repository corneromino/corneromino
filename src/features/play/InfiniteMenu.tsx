import { useEffect, useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { DepthButton, PAPER_DEPTH_SHADOW_COLOR } from '@/components/ui/depth-surface'
import { loadInfiniteBestScore } from '@/lib/db'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'
import { PixelTrophyIcon } from '@/features/cascade/PixelTrophyIcon'

/** Launch menu for the Infinite mini game. */
export function InfiniteMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [bestScore, setBestScore] = useState(0)

  useEffect(() => {
    let active = true
    void loadInfiniteBestScore().then((score) => {
      if (active) setBestScore(score)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden px-5 py-5 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] shrink-0 items-start justify-between gap-3 pb-10">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">{t('mainMenu.title')}</p>
          <h1 className="poster-title mt-2 text-[40px] leading-none">{t('classic.infinite')}</h1>
        </div>
        <AppNavigationButton aria-label={t('common.backToMiniGames')} className="size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title={t('common.backToMiniGames')} to="/mini-games"><ArrowLeft aria-hidden="true" /></AppNavigationButton>
      </header>
      <section className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col gap-4 overflow-hidden px-1 pb-1">
        <DepthButton
          className="w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          onClick={() => navigate('/play/infinite')}
          type="button"
          shadowColor={PAPER_DEPTH_SHADOW_COLOR}
          radius={20}
          borderWidth={4}
          yPadding={20}
        >
          <Plus aria-hidden="true" /> {t('common.newGame')}
        </DepthButton>
        <div className="flex flex-1 items-center justify-center [@media(max-height:420px)]:hidden">
          <div className="flex flex-col items-center p-2 text-[var(--outline-color)]">
            <PixelTrophyIcon />
            <p className="-mt-1 rotate-3 text-6xl leading-none font-black [text-shadow:4px_4px_0_var(--paper)]">{bestScore}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
