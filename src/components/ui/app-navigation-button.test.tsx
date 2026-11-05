// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppNavigationButton } from './app-navigation-button'

function CurrentPath() {
  const location = useLocation()
  return <output>{location.pathname}</output>
}

describe('AppNavigationButton', () => {
  it('renders a native button and navigates without an anchor', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppNavigationButton to="/play">Play</AppNavigationButton>
        <CurrentPath />
      </MemoryRouter>,
    )

    const button = screen.getByRole('button', { name: 'Play' })
    expect(button.tagName).toBe('BUTTON')
    expect(container.querySelector('a')).toBeNull()

    fireEvent.click(button)
    expect(screen.getByText('/play')).toBeTruthy()
  })

  it('navigates from a touch pointer release when Chrome suppresses its click', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppNavigationButton to="/play">Play</AppNavigationButton>
        <CurrentPath />
      </MemoryRouter>,
    )

    fireEvent.pointerUp(container.querySelector('button')!, { pointerType: 'touch' })

    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('output')?.textContent).toBe('/play')
  })
})
