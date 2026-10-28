import { useEffect, useState } from 'react'
import { ArrowLeft, Play, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppNavigationButton } from '@/components/ui/app-navigation-button'
import { Button } from '@/components/ui/button'
import { loadCascadeBestScore, loadCascadeGameState } from '@/lib/db'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'
import { PixelTrophyIcon } from './PixelTrophyIcon'

export function CascadeMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [hasSavedGame, setHasSavedGame] = useState<boolean | null>(null)
  const [bestScore, setBestScore] = useState(0)
  const [currentScore, setCurrentScore] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.all([loadCascadeGameState(), loadCascadeBestScore()]).then(([state, score]) => {
      if (!active) return
      setHasSavedGame(state !== null)
      setCurrentScore(state?.score ?? 0)
      setBestScore(score)
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
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[40px] leading-none">{t('cascade.title')}</h1>
        </div>
        <AppNavigationButton aria-label={t('common.backToMainMenu')} className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title={t('common.backToMainMenu')} to="/"><ArrowLeft aria-hidden="true" /></AppNavigationButton>
      </header>
      <section className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col gap-4 overflow-hidden px-1 pb-1">
        <Button
          className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          onClick={() => navigate('/cascade/game/new', { state: { returnToCascadeMenu: true } })}
          size="lg"
          type="button"
        >
          <Plus aria-hidden="true" /> {t('cascade.newGame')}
        </Button>
        <div className="relative shrink-0">
          <Button
            className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            disabled={hasSavedGame !== true}
            onClick={() => navigate('/cascade/game/continue', { state: { returnToCascadeMenu: true } })}
            size="lg"
            type="button"
          >
            <Play aria-hidden="true" /> {hasSavedGame === null ? t('cascade.loading') : t('common.continue')}
          </Button>
          {hasSavedGame && <span className="pointer-events-none absolute z-10 -right-1 -bottom-4 rotate-3 whitespace-nowrap text-[40px] leading-none font-black tracking-normal text-[var(--outline-color)] normal-case [text-shadow:4px_4px_0_var(--paper)]">{currentScore}</span>}
        </div>
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
