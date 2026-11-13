import { useTranslation } from 'react-i18next'
import { DepthButton, DepthSurface } from '@/components/ui/depth-surface'

interface PlayerCountControllerProps {
  onPlayerCountChange: (playerCount: number) => void
  playerCount: number
}

export function PlayerCountController(props: PlayerCountControllerProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3">
      <DepthButton
        aria-label={t('miniGames.decreasePlayers')}
        className="size-12 text-[40px] leading-none font-normal text-[var(--canvas-foreground)]"
        disabled={props.playerCount === 1}
        onClick={() => props.onPlayerCountChange(Math.max(1, props.playerCount - 1))}
        radius={14}
        yPadding={0}
      >
        −
      </DepthButton>
      <DepthSurface
        aria-live="polite"
        className="h-12 min-w-0 flex-1 text-[20px] leading-none font-black text-[var(--canvas-foreground)]"
        radius={14}
        yPadding={0}
      >
        {t('miniGames.players', { count: props.playerCount })}
      </DepthSurface>
      <DepthButton
        aria-label={t('miniGames.increasePlayers')}
        className="size-12 text-[40px] leading-none font-black text-[var(--canvas-foreground)]"
        onClick={() => props.onPlayerCountChange(props.playerCount + 1)}
        radius={14}
        yPadding={0}
      >
        +
      </DepthButton>
    </div>
  )
}
