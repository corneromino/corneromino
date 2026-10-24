import { describe, expect, it } from 'vitest'
import { VS_LOCAL_CONFIG, type VsLocalConfig } from './vsLocalConfig'
import { createVsLocalGame, finishVsTurn, getVsHistoryPosition, goToVsHistory, resumeVsLocalGame, selectVsCell } from './vsLocalGame'

const OLD_CONFIG: VsLocalConfig = {
  allowHistoryRewrite: !VS_LOCAL_CONFIG.allowHistoryRewrite,
  allowOverlappingCombinationWin: !VS_LOCAL_CONFIG.allowOverlappingCombinationWin,
  combinationWinCount: VS_LOCAL_CONFIG.combinationWinCount + 1,
  consecutiveTurnWinCount: VS_LOCAL_CONFIG.consecutiveTurnWinCount + 1,
  trapResolution: VS_LOCAL_CONFIG.trapResolution === 'points' ? 'draw' : 'points',
}

describe('Local VS match configuration', () => {
  it('uses current code settings when no saved match exists', () => {
    expect(resumeVsLocalGame(null)).toMatchObject({ ...VS_LOCAL_CONFIG, placedCornerominoes: [], result: null })
  })

  it('refreshes the reported empty save without changing its starting player or mutating it', () => {
    const saved = createVsLocalGame(() => 1, OLD_CONFIG)
    const original = structuredClone(saved)
    const resumed = resumeVsLocalGame(saved)
    expect(resumed).toEqual({ ...saved, ...VS_LOCAL_CONFIG })
    expect(resumed.activePlayer).toBe(1)
    expect(saved).toEqual(original)
  })

  it('keeps the chosen rules once a placement is pending', () => {
    const draft = selectVsCell(createVsLocalGame(() => 0, OLD_CONFIG), 4, 4)
    expect(resumeVsLocalGame(draft)).toBe(draft)
  })

  it('keeps started match rules even when browsing back to the empty board', () => {
    const played = finishVsTurn(selectVsCell(createVsLocalGame(() => 0, OLD_CONFIG), 4, 4))
    expect(resumeVsLocalGame(played)).toBe(played)
    const past = goToVsHistory(played, 0)
    expect(past.placedCornerominoes).toEqual([])
    expect(resumeVsLocalGame(past)).toBe(past)
  })

  it('keeps started match rules in migrated saves with only a populated baseline', () => {
    const played = finishVsTurn(selectVsCell(createVsLocalGame(() => 0, OLD_CONFIG), 4, 4))
    const legacy = { ...played, history: { positions: [getVsHistoryPosition(played)], index: 0 } }
    expect(resumeVsLocalGame(legacy)).toBe(legacy)
  })
})
