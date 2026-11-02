import { describe, expect, it } from 'vitest'
import type { PlacedTetromino } from '@/game/gameConfig'
import { collectExitedInfiniteCells, pruneReportedInfiniteCells } from './classicInfiniteCellExit'

const nokomino: PlacedTetromino = {
  id: 42,
  kind: 'I',
  cells: [
    { cellId: 'a', corner: 'top-left', x: 3, y: 8 },
    { cellId: 'b', corner: 'top-right', x: 3, y: 9 },
    { cellId: 'c', corner: 'bottom-right', x: 3, y: 10 },
    { cellId: 'd', corner: 'bottom-left', x: 3, y: 11 },
  ],
}

describe('Classic Infinite cell exits', () => {
  it('reports individual cells with their current state and owning Nokomino', () => {
    const reportedCellKeys = new Set<string>()
    const common = {
      lockedCellGroups: [{ id: 'locked-shape', color: '#000000', cellKeys: ['3,10'] }],
      pieces: [nokomino],
      reportedCellKeys,
      selectedCellKeys: new Set(['3,11']),
      selectedLockedGroupId: 'locked-shape',
      visibleRows: 10,
    }

    const firstExits = collectExitedInfiniteCells({ ...common, offsetRows: 0 })
    expect(firstExits.map((event) => event.cellKey)).toEqual(['3,10', '3,11'])
    expect(firstExits[0]).toMatchObject({
      cell: nokomino.cells[2],
      nokomino,
      nokominoCellKeys: ['3,8', '3,9', '3,10', '3,11'],
      nokominoId: 42,
      nokominoKind: 'I',
      locked: true,
      lockedGroupId: 'locked-shape',
      selected: true,
    })
    expect(firstExits[1]).toMatchObject({ locked: false, lockedGroupId: null, selected: true })

    expect(collectExitedInfiniteCells({ ...common, offsetRows: 0 })).toEqual([])
    const nextExit = collectExitedInfiniteCells({ ...common, offsetRows: 1 })
    expect(nextExit).toHaveLength(1)
    expect(nextExit[0]).toMatchObject({ cellKey: '3,9', locked: false, selected: false })
    expect(collectExitedInfiniteCells({ ...common, offsetRows: 2 }).map((event) => event.cellKey)).toEqual(['3,8'])
  })

  it('does not report cells above the viewport and bounds once-only tracking to active pieces', () => {
    const reportedCellKeys = new Set(['3,8', '3,9', '3,10', '3,11', 'old-cell'])
    expect(collectExitedInfiniteCells({
      lockedCellGroups: [],
      offsetRows: -20,
      pieces: [nokomino],
      reportedCellKeys: new Set<string>(),
      selectedCellKeys: new Set<string>(),
      selectedLockedGroupId: null,
      visibleRows: 10,
    })).toEqual([])

    pruneReportedInfiniteCells(reportedCellKeys, [nokomino])
    expect(reportedCellKeys).toEqual(new Set(['3,8', '3,9', '3,10', '3,11']))
    pruneReportedInfiniteCells(reportedCellKeys, [])
    expect(reportedCellKeys.size).toBe(0)
  })
})
