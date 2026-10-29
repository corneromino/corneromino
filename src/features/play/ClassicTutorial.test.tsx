// @vitest-environment jsdom
import { StrictMode, type ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameGridCanvas } from './GameGridCanvas'
import { ClassicTutorial } from './ClassicTutorial'

const canvasMock = vi.hoisted(() => ({ props: undefined as ComponentProps<typeof GameGridCanvas> | undefined }))

vi.mock('@/lib/db', () => ({ loadGameSelection: vi.fn(), saveGameSelection: vi.fn(), clearGameSelection: vi.fn() }))
vi.mock('react-i18next', () => {
  const t = (key: string) => key
  return { useTranslation: () => ({ t }) }
})
vi.mock('driver.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('driver.js')>()
  return { ...actual, driver: (options: Parameters<typeof actual.driver>[0]) => actual.driver({ ...options, animate: false }) }
})
// Keep the real tutorial, driver, and GameGrid logic; replace only Pixi rendering.
vi.mock('./GameGridCanvas', () => ({
  GameGridCanvas: (props: ComponentProps<typeof GameGridCanvas>) => {
    canvasMock.props = props
    return <div>
      {props.pieces.map((piece) => (
        <div data-testid={`piece-${piece.id}`} key={piece.id}>
          {piece.cells.map(({ x, y }) => (
            <button key={`${x},${y}`} onClick={() => props.onToggle(`${x},${y}`, performance.now())}>{`Cell ${x},${y}`}</button>
          ))}
        </div>
      ))}
      <output data-testid="lock-count">{props.lockedCellGroups.length}</output>
    </div>
  },
}))

afterEach(cleanup)

function nextButton() {
  return document.querySelector<HTMLButtonElement>('.driver-popover-next-btn')!
}

async function expectBubble(step: string, target = 'classic-tutorial-board') {
  await waitFor(() => {
    expect(document.querySelector('.driver-popover-description')?.textContent).toBe(`tutorial.classicSteps.${step}`)
    expect(document.querySelector('.driver-active-element')?.id).toBe(target)
  })
}

async function openShapeExample() {
  render(<StrictMode><MemoryRouter><ClassicTutorial /></MemoryRouter></StrictMode>)
  const introSteps = [
    ['corners', 'corners'], ['topRight', 'top-right'], ['bottomRight', 'bottom-right'],
    ['bottomLeft', 'bottom-left'], ['topLeft', 'top-left'],
  ]
  for (const [step, target] of introSteps) {
    await expectBubble(step, `classic-tutorial-${target}`)
    fireEvent.click(nextButton())
  }
  await expectBubble('shapeExample', 'classic-tutorial-shape-example')
}

function solvePiece(id: number) {
  for (const button of within(screen.getByTestId(`piece-${id}`)).getAllByRole('button', { hidden: true })) fireEvent.click(button)
  const { verificationWave, onVerificationComplete } = canvasMock.props!
  if (verificationWave) act(() => onVerificationComplete?.(verificationWave.id))
}

describe('Automatic Classic tutorial', () => {
  it('keeps each exercise bubble on the grid until the whole solution automatically verifies', async () => {
    await openShapeExample()
    expect(screen.queryByRole('button', { name: 'Lock four selected cells' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'classic.verify' })).toBeNull()
    expect(nextButton().disabled).toBe(true)
    fireEvent.click(nextButton())
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    await expectBubble('shapeExample', 'classic-tutorial-shape-example')

    solvePiece(1)
    await expectBubble('shapeExampleCompleted', 'classic-tutorial-shape-example')
    fireEvent.click(nextButton())
    await expectBubble('tRotations')
    expect(screen.getByTestId('lock-count').textContent).toBe('0')
    const tBubble = document.querySelector('.driver-popover')
    for (let id = 1; id < 4; id++) {
      solvePiece(id)
      await expectBubble('tRotations')
      expect(document.querySelector('.driver-popover')).toBe(tBubble)
      expect(screen.getByTestId('lock-count').textContent).toBe(String(id))
      expect(nextButton().disabled).toBe(true)
    }
    solvePiece(4)
    await expectBubble('tRotationsCompleted')
    fireEvent.click(nextButton())
    await expectBubble('allCornerominos')
    expect(screen.getByTestId('lock-count').textContent).toBe('0')
    const allBubble = document.querySelector('.driver-popover')
    for (let id = 1; id < 8; id++) {
      solvePiece(id)
      await expectBubble('allCornerominos')
      expect(document.querySelector('.driver-popover')).toBe(allBubble)
      expect(screen.getByTestId('lock-count').textContent).toBe(String(id))
      expect(nextButton().disabled).toBe(true)
    }
    solvePiece(8)
    await expectBubble('completed')
    expect(screen.getByTestId('lock-count').textContent).toBe('8')
  }, 15000)

  it('resets the previous exercise and advances again only after solving it', async () => {
    await openShapeExample()
    solvePiece(1)
    await expectBubble('shapeExampleCompleted', 'classic-tutorial-shape-example')
    fireEvent.click(nextButton())
    await expectBubble('tRotations')
    solvePiece(1)
    expect(screen.getByTestId('lock-count').textContent).toBe('1')

    fireEvent.click(document.querySelector<HTMLButtonElement>('.driver-popover-prev-btn')!)
    await expectBubble('shapeExampleCompleted', 'classic-tutorial-shape-example')
    fireEvent.click(document.querySelector<HTMLButtonElement>('.driver-popover-prev-btn')!)
    await expectBubble('shapeExample', 'classic-tutorial-shape-example')
    expect(screen.getByTestId('lock-count').textContent).toBe('0')
    expect(nextButton().disabled).toBe(true)
    solvePiece(1)
    await expectBubble('shapeExampleCompleted', 'classic-tutorial-shape-example')
    fireEvent.click(nextButton())
    await expectBubble('tRotations')
    expect(screen.getByTestId('lock-count').textContent).toBe('0')
  })
})
