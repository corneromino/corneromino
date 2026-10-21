import { describe, expect, it } from 'vitest'
import { canPlayVsTurn, createVsLocalGame, finishVsTurn, getVsAllowedCells, getVsHistoryPosition, getVsPlayerScores, goToVsHistory, selectVsCell, toggleVsMoveDirection, type VsCorner, type VsLocalGameState, type VsMoveDirection } from './vsLocalGame'

function play(game: VsLocalGameState, column: number, row: number, corner: VsCorner = 1, direction: VsMoveDirection = 'orthogonal') {
  let draft = selectVsCell(game, column, row)
  expect(draft.pendingPlacement).not.toBeNull()
  for (let turn = 0; turn < (corner + 3) % 4; turn += 1) draft = selectVsCell(draft, column, row)
  if (direction !== draft.pendingMoveDirection) draft = toggleVsMoveDirection(draft)
  return finishVsTurn(draft)
}

function squareGame(allowHistoryRewrite = true) {
  let game = createVsLocalGame(() => 0, { allowHistoryRewrite })
  game = play(game, 0, 0, 0)
  game = play(game, 1, 0, 1)
  game = play(game, 1, 1, 2)
  return play(game, 0, 1, 3, 'diagonal')
}

describe('Local VS move history', () => {
  it.each([0, 1] as const)('records the empty starting position for player %s and only adds confirmed turns', (player) => {
    const initial = createVsLocalGame(() => player)
    expect(initial.allowHistoryRewrite).toBe(true)
    expect(initial.history).toEqual({ positions: [getVsHistoryPosition(initial)], index: 0 })
    expect(finishVsTurn(initial)).toBe(initial)
    const selected = selectVsCell(initial, 4, 4)
    const rotated = selectVsCell(selected, 4, 4)
    const moved = selectVsCell(rotated, 3, 3)
    const draft = toggleVsMoveDirection(moved)
    expect(draft.history).toBe(initial.history)
    const confirmed = finishVsTurn(draft)
    expect(confirmed.history.positions).toHaveLength(2)
    expect(confirmed.history.index).toBe(1)
    expect(confirmed.history.positions[1].placedCornerominoes).toEqual([{ column: 3, row: 3, corner: 1, player }])
    expect(confirmed.history.positions[1]).not.toHaveProperty('pendingPlacement')
    expect(confirmed.history.positions[1]).not.toHaveProperty('history')
  })

  it('restores both move directions, their legal targets, and the correct player', () => {
    const initial = createVsLocalGame(() => 0)
    const first = play(initial, 4, 4, 2, 'diagonal')
    const second = play(first, 5, 5, 0)
    const third = play(second, 5, 8, 3)
    for (const [index, expected] of [initial, first, second, third].entries()) {
      const restored = goToVsHistory(third, index)
      expect(getVsHistoryPosition(restored)).toEqual(getVsHistoryPosition(expected))
      expect(getVsAllowedCells(restored)).toEqual(getVsAllowedCells(expected))
      expect(restored.history.positions).toBe(third.history.positions)
    }
  })

  it('undoes and restores captures, points, and streaks without mutating previous positions', () => {
    const latest = squareGame()
    const saved = structuredClone(latest)
    expect(getVsPlayerScores(latest.placedCornerominoes)).toEqual([0, 4])
    expect(latest.captureStreak).toEqual({ player: 1, turnCount: 1 })
    const beforeCapture = goToVsHistory(latest, 3)
    expect(beforeCapture.lockedCornerominoes).toEqual([])
    expect(beforeCapture.captureStreak).toBeNull()
    expect(getVsPlayerScores(beforeCapture.placedCornerominoes)).toEqual([0, 0])
    expect(goToVsHistory(beforeCapture, 4)).toEqual(latest)
    expect(latest).toEqual(saved)
  })

  it('discards drafts on navigation and keeps future moves until a replacement is confirmed', () => {
    const latest = squareGame()
    const past = goToVsHistory(latest, 2)
    let draft = selectVsCell(past, 1, 4)
    draft = selectVsCell(draft, 1, 4)
    draft = toggleVsMoveDirection(draft)
    expect(draft.history).toBe(past.history)
    const forward = goToVsHistory(draft, 3)
    expect(forward.pendingPlacement).toBeNull()
    expect(forward.pendingMoveDirection).toBe('orthogonal')
    expect(goToVsHistory(forward, 4)).toEqual(latest)
    const latestDraft = selectVsCell(latest, 2, 3)
    expect(goToVsHistory(goToVsHistory(latestDraft, 3), 4)).toEqual(latest)
  })

  it('replaces the future only on confirmation and continues recording the new branch', () => {
    const latest = squareGame()
    const original = structuredClone(latest)
    const past = goToVsHistory(latest, 2)
    const branch = play(past, 1, 4, 0, 'diagonal')
    expect(branch.history.index).toBe(3)
    expect(branch.history.positions).toHaveLength(4)
    expect(branch.history.positions.slice(0, 2)).toEqual(latest.history.positions.slice(0, 2))
    expect(branch.placedCornerominoes).toHaveLength(3)
    expect(branch.placedCornerominoes.at(-1)).toMatchObject({ column: 1, row: 4, corner: 0 })
    expect(branch.lockedCornerominoes).toEqual([])
    expect(branch.captureStreak).toBeNull()
    expect(goToVsHistory(branch, 4)).toBe(branch)
    const continued = play(branch, 2, 5)
    expect(continued.history.index).toBe(4)
    expect(continued.history.positions).toHaveLength(5)
    expect(goToVsHistory(goToVsHistory(continued, 0), 4)).toEqual(continued)
    expect(latest).toEqual(original)
  })

  it('can replace the first move from the initial position', () => {
    const latest = squareGame()
    const branch = play(goToVsHistory(latest, 0), 9, 9)
    expect(branch.history.positions).toHaveLength(2)
    expect(branch.activePlayer).toBe(1)
    expect(branch.placedCornerominoes).toEqual([{ column: 9, row: 9, corner: 1, player: 0 }])
  })

  it('keeps earlier positions view-only when rewriting is disabled, including stale confirmation attempts', () => {
    const latest = squareGame(false)
    const past = goToVsHistory(latest, 2)
    expect(canPlayVsTurn(past)).toBe(false)
    expect(selectVsCell(past, 1, 4)).toBe(past)
    expect(finishVsTurn(past)).toBe(past)
    const staleDraft = { ...past, pendingPlacement: { column: 1, row: 4, corner: 1 as const } }
    expect(selectVsCell(staleDraft, 1, 4)).toBe(staleDraft)
    expect(toggleVsMoveDirection(staleDraft)).toBe(staleDraft)
    expect(finishVsTurn(staleDraft)).toBe(staleDraft)
    const restored = goToVsHistory(past, 4)
    expect(canPlayVsTurn(restored)).toBe(true)
    expect(play(restored, 2, 3).history.positions).toHaveLength(6)
  })

  it.each([-1, 0, 5, 1.5, NaN, Infinity])('ignores unavailable, unchanged, or invalid history index %s', (index) => {
    const game = goToVsHistory(squareGame(), 0)
    expect(goToVsHistory(game, index)).toBe(game)
  })

  it.each(['combination', 'consecutive-turns', 'trap', 'no-legal-moves'] as const)('can review and rewrite a finished %s match', (reason) => {
    let before = createVsLocalGame(() => 0)
    if (reason === 'combination') {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        for (const corner of [1, 2, 3] as const) before.placedCornerominoes.push({ column: corner * dx, row: corner * dy, corner, player: 1 })
      }
    } else if (reason === 'consecutive-turns') {
      for (const row of [1, 4]) {
        for (const corner of [1, 2, 3] as const) before.placedCornerominoes.push({ column: corner, row, corner, player: 1 })
      }
      before = play(before, 4, 1, 0)
      before = play(before, 4, 2)
    } else {
      for (let index = 1; index < 10; index += 1) {
        const corner = reason === 'trap' && index < 3 ? index as VsCorner : 3
        before.placedCornerominoes.push({ column: index, row: index, corner, player: 1 })
      }
    }
    const finished = reason === 'consecutive-turns' ? play(before, 4, 4, 0)
      : play(before, 0, 0, 0, reason === 'combination' ? 'orthogonal' : 'diagonal')
    expect(finished.result?.reason).toBe(reason)
    expect(canPlayVsTurn(finished)).toBe(false)
    const past = goToVsHistory(finished, finished.history.index - 1)
    expect(past.result).toBeNull()
    expect(getVsHistoryPosition(past)).toEqual(getVsHistoryPosition(before))
    expect(goToVsHistory(past, finished.history.index)).toEqual(finished)
    const branch = reason === 'consecutive-turns' ? play(past, 4, 8) : play(past, 9, 0)
    expect(branch.result).toBeNull()
    expect(branch.history.positions.at(-1)?.result).toBeNull()
  })

  it('starts rematches with fresh history while retaining the rewriting rule', () => {
    const latest = squareGame(false)
    const rematch = createVsLocalGame(() => 1, latest)
    expect(rematch.allowHistoryRewrite).toBe(false)
    expect(rematch.history.index).toBe(0)
    expect(rematch.history.positions).toEqual([getVsHistoryPosition(rematch)])
    expect(rematch.activePlayer).toBe(1)
    expect(rematch.placedCornerominoes).toEqual([])
  })
})
