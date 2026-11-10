/** Actions that can automatically advance an authored Career tutorial step. */
export type CareerTutorialAction = 'complete' | 'lock' | 'reset' | 'select' | 'unlock'

/** Named controls available as Career tutorial targets. */
export type CareerTutorialControlArea = 'clear' | 'lock' | 'notes' | 'reset' | 'unlock' | 'verify'

interface CareerTutorialStepBase {
  content: string
  /** Automatically proceed after one of these successful gameplay actions. */
  advanceOn?: readonly CareerTutorialAction[]
  /** Allows direct cell interaction while this step is active. Defaults to true. */
  boardInteractive?: boolean
  /** Hides the header and control bar while retaining the board target. Defaults to true. */
  showUI?: boolean
}

export interface CareerTutorialBoardStep extends CareerTutorialStepBase {
  area: 'board'
  /** Zero-based board column. */
  x: number
  /** Zero-based board row. */
  y: number
  columns: number
  rows: number
}

export interface CareerTutorialControlStep extends CareerTutorialStepBase {
  area: CareerTutorialControlArea
}

export type CareerTutorialStep = CareerTutorialBoardStep | CareerTutorialControlStep

export interface CareerTutorial {
  steps: readonly CareerTutorialStep[]
}

export function getCareerTutorialTargetId(area: CareerTutorialStep['area'], stepIndex?: number) {
  return area === 'board'
    ? `career-tutorial-board-${stepIndex}`
    : `career-tutorial-${area}`
}
