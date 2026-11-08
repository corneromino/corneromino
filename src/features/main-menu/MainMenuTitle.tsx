import { useTranslation } from 'react-i18next'

/** Poster-style application wordmark for the main menu. */
export function MainMenuTitle() {
  const { t } = useTranslation()
  const title = t('mainMenu.title')

  return (
    <h1 className="poster-title main-menu-title relative isolate mt-1 inline-block max-w-full -rotate-2 px-3 py-2 leading-none font-black tracking-[-0.06em] text-[var(--canvas-foreground)] [-webkit-text-stroke:5px_var(--paper)] [paint-order:stroke_fill]">
      <span aria-hidden="true" className="absolute inset-x-3 top-2 -z-10 translate-y-[5px] text-[#b95c2e] [-webkit-text-stroke:5px_#713324] [paint-order:stroke_fill]">{title}</span>
      <span className="relative">{title}</span>
      <span aria-hidden="true" className="absolute -top-1 -left-1 size-3 -rotate-12 border-2 border-[var(--outline-color)] bg-[var(--sky)]" />
      <span aria-hidden="true" className="absolute -right-1 -bottom-1 size-3 rotate-12 border-2 border-[var(--outline-color)] bg-[var(--coral)]" />
    </h1>
  )
}
