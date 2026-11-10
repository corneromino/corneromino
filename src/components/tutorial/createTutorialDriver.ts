import { driver, type Driver, type DriveStep, type HookOpts, type PopoverDOM } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tutorialPopover.css'

interface TutorialDriverOptions {
  labels?: TutorialDriverLabels
  onClose?: () => void
}

interface TutorialDriverLabels {
  close: string
  next: string
  previous: string
}

export interface TutorialStep extends DriveStep {
  /** Keep Next disabled until the lesson advances programmatically. */
  nextLocked?: boolean
}

const DEFAULT_LABELS: TutorialDriverLabels = {
  close: 'Close',
  next: 'Next',
  previous: 'Previous',
}

function styleButton(button: HTMLButtonElement, label: string, disabled: boolean) {
  const content = document.createElement('span')
  content.className = 'tutorial-depth-button-content'
  content.textContent = label

  button.replaceChildren(content)
  button.classList.add('tutorial-depth-button')
  button.classList.toggle('driver-popover-btn-disabled', disabled)
  button.style.removeProperty('display')
  button.disabled = disabled
}

function renderTutorialPopover(popover: PopoverDOM, options: HookOpts, labels: TutorialDriverLabels) {
  // Keep Driver's own buttons and handlers, but put Close in the footer.
  popover.footerButtons.prepend(popover.closeButton)
  styleButton(popover.closeButton, labels.close, false)
  styleButton(popover.previousButton, labels.previous, !options.driver.hasPreviousStep())
  const activeStep = options.driver.getActiveStep() as TutorialStep | undefined
  // An unlocked final step uses Next as its completion action.
  styleButton(popover.nextButton, labels.next, activeStep?.nextLocked === true)
}

export function createTutorialDriver(steps: TutorialStep[], tutorialOptions: TutorialDriverOptions = {}): Driver {
  const labels = tutorialOptions.labels ?? DEFAULT_LABELS
  return driver({
    allowClose: true,
    animate: true,
    overlayColor: '#15100e',
    overlayOpacity: 0.5,
    overlayClickBehavior: 'none',
    popoverClass: 'game-tutorial',
    showButtons: ['close', 'previous', 'next'],
    nextBtnText: 'Next',
    doneBtnText: 'Next',
    onPopoverRender: (popover, hookOptions) => renderTutorialPopover(popover, hookOptions, labels),
    onDestroyStarted: (_element, _step, context) => {
      // Handle dismissal even during the opening animation. Imperative cleanup
      // bypasses this hook, so route changes and StrictMode never trigger navigation.
      context.driver.destroy()
      if (context.reason === 'close' || context.reason === 'escape') tutorialOptions.onClose?.()
    },
    // Keep keyboard navigation consistent with the visible Next button.
    onNextClick: (_element, step, options) => {
      if ((step as TutorialStep).nextLocked) return
      if (options.driver.hasNextStep()) {
        options.driver.moveNext()
        return
      }
      options.driver.destroy()
      tutorialOptions.onClose?.()
    },
    onPrevClick: (_element, _step, options) => {
      if (options.driver.hasPreviousStep()) options.driver.movePrevious()
    },
    steps,
  })
}
