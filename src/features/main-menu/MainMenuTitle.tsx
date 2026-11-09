import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

/** Poster-style application wordmark for the main menu. */
export function MainMenuTitle() {
  const { t } = useTranslation()
  const title = t('mainMenu.title')

  function preventContextMenu(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  return (
    <h1 className="poster-title main-menu-title mt-1 max-w-full leading-none">
      <button aria-label={title} className="relative isolate inline-block max-w-full -rotate-2 cursor-pointer touch-manipulation select-none border-0 bg-transparent px-3 py-2 font-inherit leading-[inherit] font-black tracking-[0.04em] uppercase text-[var(--canvas-foreground)] transition-transform duration-150 ease-out active:scale-90 active:rotate-2 motion-reduce:transition-none [-webkit-touch-callout:none] [-webkit-text-stroke:5px_var(--paper)] [paint-order:stroke_fill]" onContextMenu={preventContextMenu} type="button">
        <span aria-hidden="true" className="absolute inset-x-3 top-2 -z-10 translate-y-[5px] text-[#b95c2e] [-webkit-text-stroke:5px_#713324] [paint-order:stroke_fill]">{title}</span>
        <span className="relative">{title}</span>
        <span aria-hidden="true" className="absolute -top-1 -left-1 size-3 -rotate-12 border-2 border-[var(--outline-color)] bg-[var(--sky)]" />
        <span aria-hidden="true" className="absolute -right-1 -bottom-1 size-3 rotate-12 border-2 border-[var(--outline-color)] bg-[var(--coral)]" />
      </button>
    </h1>
  )
}
