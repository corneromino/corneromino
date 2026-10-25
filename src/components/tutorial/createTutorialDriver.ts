import { driver, type Driver, type DriveStep, type HookOpts, type PopoverDOM } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tutorialPopover.css'

interface TutorialDriverOptions {
  onClose?: () => void
}

function styleButton(button: HTMLButtonElement, label: string, disabled: boolean) {
  const content = document.createElement('span')
  content.className = 'button-press-content'
  content.textContent = label

  button.replaceChildren(content)
  button.classList.add('cartoon-press')
  button.classList.toggle('driver-popover-btn-disabled', disabled)
  button.style.removeProperty('display')
  button.disabled = disabled
}

function renderTutorialPopover(popover: PopoverDOM, options: HookOpts) {
  // Keep Driver's own buttons and handlers, but put Close in the footer.
  popover.footerButtons.prepend(popover.closeButton)
  styleButton(popover.closeButton, 'Close', false)
  styleButton(popover.previousButton, 'Previous', !options.driver.hasPreviousStep())
  styleButton(popover.nextButton, 'Next', !options.driver.hasNextStep())
}

export function createTutorialDriver(steps: DriveStep[], options: TutorialDriverOptions = {}): Driver {
  return driver({
    allowClose: true,
    animate: true,
    overlayColor: '#15100e',
    overlayOpacity: 0.5,
    overlayClickBehavior: 'none',
    popoverClass: 'corneromino-tutorial',
    showButtons: ['close', 'previous', 'next'],
    nextBtnText: 'Next',
    doneBtnText: 'Next',
    onPopoverRender: renderTutorialPopover,
    onDestroyStarted: (_element, _step, context) => {
      // Handle dismissal even during the opening animation. Imperative cleanup
      // bypasses this hook, so route changes and StrictMode never trigger navigation.
      context.driver.destroy()
      if (context.reason === 'close' || context.reason === 'escape') options.onClose?.()
    },
    // Guard keyboard navigation too: reaching an end does not close the tour.
    onNextClick: (_element, _step, options) => {
      if (options.driver.hasNextStep()) options.driver.moveNext()
    },
    onPrevClick: (_element, _step, options) => {
      if (options.driver.hasPreviousStep()) options.driver.movePrevious()
    },
    steps,
  })
}
