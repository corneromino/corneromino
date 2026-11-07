// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Button } from './button'
import { DEPTH_BUTTON_COLORS, DepthButton, DepthSurface, PAPER_DEPTH_SHADOW_COLOR } from './depth-surface'

const blueShadow = 'color-mix(in srgb, #73a9ee 65%, var(--outline-color))'
const blueActive = 'color-mix(in srgb, #73a9ee 90%, #000000)'
const blueHover = 'color-mix(in srgb, #73a9ee 82%, #ffffff)'

it('derives depth bands from the supplied color for surfaces and buttons', () => {
  render(<>
    <DepthSurface aria-label="surface" color="#73a9ee" />
    <DepthButton aria-label="button" color="#73a9ee">Button</DepthButton>
    <DepthButton {...DEPTH_BUTTON_COLORS.blue} aria-label="preset">Preset</DepthButton>
  </>)

  expect(screen.getByLabelText('surface').style.getPropertyValue('--depth-shadow-color')).toBe(blueShadow)
  expect(screen.getByLabelText('button').style.getPropertyValue('--depth-shadow-color')).toBe(blueShadow)
  expect(screen.getByLabelText('preset').style.getPropertyValue('--depth-shadow-color')).toBe(blueShadow)
  expect(screen.getByLabelText('button').style.getPropertyValue('--depth-hover-color')).toBe(blueHover)
  expect(screen.getByLabelText('button').style.getPropertyValue('--depth-active-color')).toBe(blueActive)
  expect(screen.getByLabelText('preset').style.getPropertyValue('--depth-hover-color')).toBe(blueHover)
  expect(screen.getByLabelText('preset').style.getPropertyValue('--depth-active-color')).toBe(blueActive)
})

it('keeps an explicitly requested depth band color', () => {
  render(<DepthButton activeColor="#654321" aria-label="custom" color="#73a9ee" hoverColor="#abcdef" shadowColor="#123456">Button</DepthButton>)
  expect(screen.getByLabelText('custom').style.getPropertyValue('--depth-shadow-color')).toBe('#123456')
  expect(screen.getByLabelText('custom').style.getPropertyValue('--depth-hover-color')).toBe('#abcdef')
  expect(screen.getByLabelText('custom').style.getPropertyValue('--depth-active-color')).toBe('#654321')
})

it('explicitly preserves the legacy band for paper-colored Button wrappers', () => {
  render(<Button aria-label="paper">Button</Button>)
  expect(screen.getByLabelText('paper').style.getPropertyValue('--depth-shadow-color')).toBe(PAPER_DEPTH_SHADOW_COLOR)
})

it('adds the depth band below an explicit equal vertical face padding', () => {
  render(<>
    <DepthSurface aria-label="padded surface" depth={8} yPadding={12} />
    <DepthButton aria-label="padded button" depth="0.5rem" yPadding="0.75rem">Button</DepthButton>
  </>)

  const surface = screen.getByLabelText('padded surface')
  expect(surface.style.paddingTop).toBe('12px')
  expect(surface.style.paddingBottom).toBe('calc(12px + var(--depth-size))')
  const button = screen.getByLabelText('padded button')
  expect(button.style.paddingTop).toBe('0.75rem')
  expect(button.style.paddingBottom).toBe('calc(0.75rem + var(--depth-size))')
})
