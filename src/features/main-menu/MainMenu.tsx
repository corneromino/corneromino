import { useRef } from 'react'
import { Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { APP_VERSION } from '@/lib/appVersion'
import cascadeGraphic from '@/assets/cascade-graphic.svg'
import classicGraphic from '@/assets/classic-graphic.svg'
import vsGraphic from '@/assets/vs-graphic.svg'
import { TetrominoBackground } from './TetrominoBackground'
import { TitleTetromino } from './TitleTetrominoCell'

export function MainMenu() {
  const menuRef = useRef<HTMLElement>(null)
  const { t } = useTranslation()

  return (
    <main className="poster-page app-page relative overflow-hidden px-5 text-[var(--canvas-foreground)]" ref={menuRef}>
      <TetrominoBackground />
      <Button asChild className="cartoon-press !absolute top-5 right-5 z-20 size-10 text-[var(--canvas-foreground)]" size="icon" title={t('common.settings')}>
        <Link aria-label={t('common.settings')} to="/settings"><Settings aria-hidden="true" /></Link>
      </Button>
      <div className="menu-scroll">
        <section className="menu-content mx-auto flex w-full max-w-[430px] flex-col items-center text-center">
          <TitleTetromino pointerAreaRef={menuRef} />
          <h1 className="poster-title main-menu-title max-w-full leading-none">
            {t('mainMenu.title')}
          </h1>
          <Button
            asChild
            className="cartoon-press classic-menu-button w-full text-[18px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            size="lg"
          >
            <Link to="/play" className='gap-10'>
              <span>{t('mainMenu.classic')}</span>
              <img alt="" aria-hidden="true" className="classic-menu-graphic -rotate-12 scale-125" src={classicGraphic} />
            </Link>
          </Button>
          <Button
            asChild
            className="cartoon-press cascade-menu-button w-full text-[18px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            size="lg"
            >
            <Link to="/cascade" className='gap-10'>
              <span>{t('mainMenu.cascade')}</span>
              <img alt="" aria-hidden="true" className="cascade-menu-graphic -rotate-12 scale-125" src={cascadeGraphic} />
            </Link>
          </Button>
          {/* <Button
            asChild
            className="cartoon-press menu-button w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            size="lg"
          >
            <Link to="/sandbox">Sandbox</Link>
          </Button> */}
          <Button
            asChild
            className="cartoon-press vs-menu-button w-full text-[18px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            size="lg"
          >
            <Link to="/vs" className='gap-10'>
              <span>{t('mainMenu.versus')}</span>
              <img alt="" aria-hidden="true" className="vs-menu-graphic -rotate-12 scale-125" src={vsGraphic} />
            </Link>
          </Button>
        </section>
      </div>
      <p aria-label={t('mainMenu.version', { version: APP_VERSION })} className="pointer-events-none absolute inset-x-0 bottom-2 z-10 text-center text-[10px] font-bold tracking-[0.12em] text-[var(--canvas-foreground)] opacity-35">
        v{APP_VERSION}
      </p>
    </main>
  )
}
