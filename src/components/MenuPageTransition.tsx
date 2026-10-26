import type { ReactNode } from 'react'
import { AnimatePresence, domAnimation, LazyMotion, m, useIsPresent, useReducedMotion, type Variants } from 'motion/react'

const SLIDE_DURATION = 0.22
const PAGE_VARIANTS: Variants = {
  // Keep the outgoing menu underneath the incoming page until it covers it.
  covered: (duration: number) => ({ opacity: 1, transition: { duration } }),
}

interface MenuPageTransitionProps {
  children: ReactNode
  isMenu: boolean
  pageKey: string
}

function Page({ children, isMenu, reduceMotion }: Omit<MenuPageTransitionProps, 'pageKey'> & { reduceMotion: boolean }) {
  const isPresent = useIsPresent()

  // Gameplay and tutorial effects must stop as soon as their route is left.
  if (!isPresent && !isMenu) return null

  return (
    <m.div
      animate={{ x: 0 }}
      aria-hidden={!isPresent || undefined}
      className="absolute inset-0 min-h-0 min-w-0 bg-[var(--canvas)]"
      exit="covered"
      inert={!isPresent}
      initial={isMenu && !reduceMotion ? { x: '-100%' } : false}
      style={{ zIndex: isPresent ? 1 : 0 }}
      transition={{ duration: reduceMotion ? 0 : SLIDE_DURATION, ease: [0.16, 1, 0.3, 1] }}
      variants={PAGE_VARIANTS}
    >
      {children}
    </m.div>
  )
}

export function MenuPageTransition({ children, isMenu, pageKey }: MenuPageTransitionProps) {
  const reduceMotion = useReducedMotion() === true

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="relative isolate h-full min-h-0 min-w-0 overflow-hidden">
        <AnimatePresence custom={isMenu && !reduceMotion ? SLIDE_DURATION : 0} initial={false}>
          <Page isMenu={isMenu} key={pageKey} reduceMotion={reduceMotion}>
            {children}
          </Page>
        </AnimatePresence>
      </div>
    </LazyMotion>
  )
}
