import { useTranslation } from 'react-i18next'
import { ClassicMenuLayout } from './ClassicMenuLayout'
import { CareerMapCanvas } from './career/CareerMapCanvas'

/** Placeholder for the forthcoming progression and level selection experience. */
export function ClassicCareerMenu() {
  const { t } = useTranslation()
  return <ClassicMenuLayout flushBottom menu="career"><section aria-label={t('classic.career')} className="relative z-10 -mx-5 min-h-0 w-[calc(100%+2.5rem)] flex-1 overflow-hidden"><CareerMapCanvas /></section></ClassicMenuLayout>
}
