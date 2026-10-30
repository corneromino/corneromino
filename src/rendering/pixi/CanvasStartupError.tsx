import { useTranslation } from 'react-i18next'

export function CanvasStartupError() {
  const { t } = useTranslation()
  return <p className="bg-[var(--paper)] p-4 text-center text-[13px] text-[var(--coral)]" role="alert">{t('common.canvasStartupFailed')}</p>
}
