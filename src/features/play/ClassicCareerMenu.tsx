import { CareerChapterCarousel } from './CareerChapterCarousel'
import { chapters } from './careerChapters'
import { ClassicMenuLayout } from './ClassicMenuLayout'

export function ClassicCareerMenu() {
  return <ClassicMenuLayout menu="career"><CareerChapterCarousel chapters={chapters} /></ClassicMenuLayout>
}
