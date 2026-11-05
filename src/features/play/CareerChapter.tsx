import { useId, useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { DepthSurface } from '@/components/ui/depth-surface'
import { getCareerChapterLayout, type CareerChapter as Chapter } from './careerChapters'

interface CareerChapterProps {
  chapter: Chapter
  number: number
  startLevel: number
}

export function CareerChapter({ chapter, number, startLevel }: CareerChapterProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const layout = useMemo(() => getCareerChapterLayout(chapter, startLevel), [chapter, startLevel])
  const shapeStyle: CSSProperties = {
    '--card-gap': 'clamp(6px, 2cqw, 12px)',
    '--card-size': 'min(128px, calc((100cqw - (var(--chapter-columns) - 1) * var(--card-gap)) / var(--chapter-columns)), calc((100cqh - (var(--chapter-rows) - 1) * var(--card-gap)) / var(--chapter-rows)))',
    '--chapter-columns': layout.columns,
    '--chapter-rows': layout.rows,
  } as CSSProperties

  return (
    <article
      aria-labelledby={headingId}
      className="relative flex h-full min-h-0 flex-col px-3 pt-3 pb-6 text-center max-h-[500px]:pt-0 max-h-[500px]:pb-2"
    >
      {/* <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[var(--chapter-background)] opacity-20" style={{ '--chapter-background': chapter.backgroundColor } as CSSProperties} /> */}
      <h2 className="relative z-10 mb-[clamp(12px,3vh,24px)] flex shrink-0 flex-col items-center gap-2 text-[var(--canvas-foreground)] leading-[1.15] font-black max-h-[500px]:mb-2 max-h-[500px]:gap-1" id={headingId}>
        <span className="text-[18px] tracking-[0.12em] uppercase max-h-[500px]:text-[13px]">{t('career.chapter', { number })}</span>{' '}
        <span className="text-[30px] max-h-[500px]:text-[18px]">{t(`career.chapters.${chapter.id}`, { defaultValue: chapter.title })}</span>
      </h2>
      <div className="relative z-10 grid min-h-0 flex-1 place-items-center [container-type:size]">
        <ol
          aria-label={t('career.levels')}
          className="relative mx-auto grid w-max list-none grid-cols-[repeat(var(--chapter-columns),var(--card-size))] grid-rows-[repeat(var(--chapter-rows),var(--card-size))] gap-[var(--card-gap)] p-0"
          style={shapeStyle}
        >
          {layout.cells.map((cell) => (
            <DepthSurface
              aria-label={t('career.level', { number: cell.level })}
              as="li"
              className="relative z-10 grid place-items-center text-[40px] leading-none font-black text-[var(--canvas-foreground)]"
              color={cell.color}
              key={cell.id}
              style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1 }}
              depth={5}
            >{cell.level}</DepthSurface>
          ))}
        </ol>
      </div>
    </article>
  )
}
