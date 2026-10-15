import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TetrominoBackground } from './TetrominoBackground'
import { TitleTetromino } from './TitleTetrominoCell'

export function MainMenu() {
  return (
    <main className="poster-page relative grid min-h-dvh touch-none overscroll-none place-items-center overflow-hidden px-5 py-8 text-[var(--canvas-foreground)]">
      <TetrominoBackground />
      <section className="relative z-10 flex w-full max-w-[430px] flex-col items-center gap-5 text-center">
        <TitleTetromino />
        <h1 className="poster-title max-w-full text-[40px] leading-none min-[375px]:text-[50px] sm:text-[50px]">
          Corneromino
        </h1>
        <Button
          asChild
          className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          size="lg"
        >
          <Link to="/play">Play</Link>
        </Button>
        <Button
          asChild
          className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          size="lg"
        >
          <Link to="/cascade">Cascade</Link>
        </Button>
        <Button
          asChild
          className="cartoon-press h-[70px] w-full text-[14px] font-black tracking-[0.2em] text-[var(--canvas-foreground)] uppercase"
          size="lg"
        >
          <Link to="/sandbox">Sandbox</Link>
        </Button>
      </section>
    </main>
  )
}
