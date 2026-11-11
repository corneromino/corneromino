import { useEffect, useState } from 'react'

interface AnimatedScoreProps {
  step: number
  targetScore: number
}

/** Counts toward a score target with the shared pixel-score shake. */
export function AnimatedScore(props: AnimatedScoreProps) {
  const [displayedScore, setDisplayedScore] = useState(props.targetScore)

  useEffect(() => {
    if (displayedScore === props.targetScore) return
    const step = Math.max(1, props.step)
    const timer = window.setInterval(() => {
      setDisplayedScore((currentScore) => {
        const difference = props.targetScore - currentScore
        if (difference === 0) {
          window.clearInterval(timer)
          return currentScore
        }

        const nextScore = currentScore + Math.sign(difference) * Math.min(step, Math.abs(difference))
        if (nextScore === props.targetScore) window.clearInterval(timer)
        return nextScore
      })
    }, 4)

    return () => window.clearInterval(timer)
  }, [props.step, props.targetScore])

  return <span className={displayedScore < props.targetScore ? 'animated-score-shake inline-block' : 'inline-block'}>{displayedScore}</span>
}
