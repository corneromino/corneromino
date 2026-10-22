import { ArrowLeft, Users, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TetrominoBackground } from '@/features/main-menu/TetrominoBackground'

export function VsMenu() {
  return (
    <main className="poster-page app-page relative flex flex-col overflow-hidden px-5 py-5 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <header className="relative z-10 mx-auto flex w-full max-w-[550px] shrink-0 items-start justify-between gap-3 pb-10">
        <div>
          <p className="poster-kicker text-[11px] text-[var(--muted-text-color)]">Corneromino</p>
          <h1 className="poster-title mt-2 text-[40px] leading-none">VS</h1>
        </div>
        <Button asChild className="cartoon-press size-[42px] shrink-0 text-[var(--canvas-foreground)]" size="icon" title="Back to main menu">
          <Link aria-label="Back to main menu" to="/"><ArrowLeft aria-hidden="true" /></Link>
        </Button>
      </header>
      <section aria-label="VS game type" className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-1 pb-1">
        <Button asChild className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase" size="lg">
          <Link state={{ startNew: true }} to="/vs/local"><Users aria-hidden="true" /> Local</Link>
        </Button>
        <Button className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase" disabled size="lg" type="button">
          <Wifi aria-hidden="true" /> Online
        </Button>
      </section>
    </main>
  )
}
