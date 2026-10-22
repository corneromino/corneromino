import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TetrominoBackground } from './TetrominoBackground'
import { TitleTetromino } from './TitleTetrominoCell'

export function MainMenu() {
  const menuRef = useRef<HTMLElement>(null)

  return (
    <main className="poster-page app-page relative overflow-hidden px-5 text-[var(--canvas-foreground)]" ref={menuRef}>
      <TetrominoBackground />
      <div className="menu-scroll">
        <section className="menu-content mx-auto flex w-full max-w-[430px] flex-col items-center text-center">
          <TitleTetromino pointerAreaRef={menuRef} />
          <h1 className="poster-title main-menu-title max-w-full leading-none">
            Corneromino
          </h1>
          <Button
            asChild
            className="cartoon-press menu-button w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            size="lg"
          >
            <Link to="/play">Play</Link>
          </Button>
          <Button
            asChild
            className="cartoon-press menu-button w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            size="lg"
          >
            <Link to="/cascade">Cascade</Link>
          </Button>
          <Button
            asChild
            className="cartoon-press menu-button w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            size="lg"
          >
            <Link to="/sandbox">Sandbox</Link>
          </Button>
          <Button
            asChild
            className="cartoon-press menu-button w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
            size="lg"
          >
            <Link to="/vs">VS</Link>
          </Button>
        </section>
      </div>
    </main>
  )
}
