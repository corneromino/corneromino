import { useNavigate } from 'react-router-dom'
import { CareerChapterCarousel } from './CareerChapterCarousel'
import { chapters, getCareerLevelPath } from './careerChapters'
import { ClassicMenuLayout } from './ClassicMenuLayout'

export function ClassicCareerMenu() {
  const navigate = useNavigate()
  return (
    <ClassicMenuLayout menu="career">
      <CareerChapterCarousel
        chapters={chapters}
        onPlayLevel={(level) => navigate(getCareerLevelPath(level))}
      />
    </ClassicMenuLayout>
  )
}
