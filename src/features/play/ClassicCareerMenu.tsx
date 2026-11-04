import { useTranslation } from 'react-i18next'
import { ClassicMenuLayout } from './ClassicMenuLayout'

/** Placeholder for the forthcoming progression and level selection experience. */
export function ClassicCareerMenu() {
  const { t } = useTranslation()
  return <ClassicMenuLayout menu="career"><section aria-label={t('classic.career')} className="relative z-10 mx-auto flex min-h-0 w-full max-w-[550px] flex-1" /></ClassicMenuLayout>
}
