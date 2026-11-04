import { useId, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { getCareerChapterLayout, type CareerChapter as Chapter } from './careerChapters'

interface CareerChapterProps {
  chapter: Chapter
  number: number
}

export function CareerChapter({ chapter, number }: CareerChapterProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const layout = getCareerChapterLayout(chapter)

  return (
    <article aria-labelledby={headingId} className="career-chapter">
      <h2 className="career-chapter-heading" id={headingId}>
        <span className="career-chapter-number">{t('career.chapter', { number })}</span>{' '}
        <span className="career-chapter-title">{t(`career.chapters.${chapter.id}`, { defaultValue: chapter.title })}</span>
      </h2>
      <div className="career-shape-area">
        <ol
          aria-label={t('career.levels')}
          className="career-shape"
          style={{ '--chapter-columns': layout.columns, '--chapter-rows': layout.rows } as CSSProperties}
        >
          {layout.cells.map((cell) => (
            <li
              aria-label={t('career.level', { number: cell.level })}
              className="ios-surface career-level-card"
              key={cell.id}
              style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1, '--level-color': cell.color } as CSSProperties}
            />
          ))}
        </ol>
      </div>
    </article>
  )
}
