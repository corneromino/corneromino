import { useId, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { getCareerChapterLayout, type CareerChapter as Chapter } from './careerChapters'

interface CareerChapterProps {
  chapter: Chapter
  number: number
  startLevel: number
}

export function CareerChapter({ chapter, number, startLevel }: CareerChapterProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const layout = getCareerChapterLayout(chapter, startLevel)
  const shapeStyle = {
    '--card-gap': 'clamp(6px, 2cqw, 12px)',
    '--card-size': 'min(128px, calc((100cqw - (var(--chapter-columns) - 1) * var(--card-gap)) / var(--chapter-columns)), calc((100cqh - (var(--chapter-rows) - 1) * var(--card-gap)) / var(--chapter-rows)))',
    '--chapter-columns': layout.columns,
    '--chapter-rows': layout.rows,
  } as CSSProperties

  return (
    <article aria-labelledby={headingId} className="flex h-full min-h-0 flex-col px-3 pt-3 pb-6 text-center max-h-[500px]:pt-0 max-h-[500px]:pb-2">
      <h2 className="mb-[clamp(12px,3vh,24px)] flex shrink-0 flex-col items-center gap-2 text-[var(--canvas-foreground)] leading-[1.15] font-black max-h-[500px]:mb-2 max-h-[500px]:gap-1" id={headingId}>
        <span className="text-[clamp(15px,4vw,20px)] tracking-[0.12em] uppercase max-h-[500px]:text-[13px]">{t('career.chapter', { number })}</span>{' '}
        <span className="text-[clamp(20px,5vw,28px)] max-h-[500px]:text-[18px]">{t(`career.chapters.${chapter.id}`, { defaultValue: chapter.title })}</span>
      </h2>
      <div className="min-h-0 flex-1 [container-type:size]">
        <ol
          aria-label={t('career.levels')}
          className="mx-auto grid w-max list-none grid-cols-[repeat(var(--chapter-columns),var(--card-size))] grid-rows-[repeat(var(--chapter-rows),var(--card-size))] gap-[var(--card-gap)] p-0"
          style={shapeStyle}
        >
          {layout.cells.map((cell) => (
            <li
              aria-label={t('career.level', { number: cell.level })}
              className="ios-surface grid place-items-center border-2 border-[var(--outline-color)] bg-[var(--level-color,var(--paper))] text-[clamp(22px,8cqw,42px)] leading-none font-black text-[var(--canvas-foreground)] shadow-[inset_0_-6px_0_color-mix(in_srgb,var(--level-color,var(--paper))_65%,var(--outline-color)),0_0_0_1px_rgb(21_16_14_/_8%)]"
              key={cell.id}
              style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1, '--level-color': cell.color } as CSSProperties}
            >{cell.level}</li>
          ))}
        </ol>
      </div>
    </article>
  )
}
