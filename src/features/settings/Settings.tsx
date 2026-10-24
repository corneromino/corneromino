import { ArrowLeft, Check, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'

export function Settings() {
  const { i18n, t } = useTranslation()
  const language = i18n.resolvedLanguage
  const currentLanguage = language === 'fr' ? t('settings.french') : t('settings.english')

  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden px-5 py-5 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] shrink-0 items-start justify-between gap-3 pb-10">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[40px] leading-none">{t('common.settings')}</h1>
        </div>
        <Button asChild className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title={t('common.backToMainMenu')}>
          <Link aria-label={t('common.backToMainMenu')} to="/"><ArrowLeft aria-hidden="true" /></Link>
        </Button>
      </header>
      <section aria-label={t('common.settings')} className="relative z-10 mx-auto flex w-full max-w-[550px] flex-1 items-start justify-center px-1 pb-1">
        <div className="w-full max-w-[430px]">
          <div className="flex h-[62px] items-center justify-between gap-3">
            <p className="poster-kicker text-[16px] text-[var(--canvas-foreground)]" id="language-label">{t('settings.language')}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-labelledby="language-label language-current" className="cartoon-press h-[48px] shrink-0 px-4 text-[12px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" type="button">
                  <span className="-translate-y-1 inline-flex items-center gap-2">
                    <span id="language-current">{currentLanguage}</span><ChevronDown aria-hidden="true" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[150px]" sideOffset={8}>
                <DropdownMenuItem aria-label={t('settings.english')} onSelect={() => void i18n.changeLanguage('en')}>
                  {language === 'en' && <Check aria-hidden="true" />} {t('settings.english')}
                </DropdownMenuItem>
                <DropdownMenuItem aria-label={t('settings.french')} onSelect={() => void i18n.changeLanguage('fr')}>
                  {language === 'fr' && <Check aria-hidden="true" />} {t('settings.french')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </section>
    </main>
  )
}
