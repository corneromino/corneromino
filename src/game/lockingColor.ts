import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'

export interface ColoredCellGroup {
  cellKeys: readonly string[]
  color: string
}

/** Uses the Classic locking rule: avoid colors on all edge- and corner-adjacent groups. */
export function chooseLockColor(cellKeys: readonly string[], groups: readonly ColoredCellGroup[]): string {
  const groupByCell = new Map(groups.flatMap((group) => group.cellKeys.map((cellKey) => [cellKey, group])))
  const neighboringColors = new Set<string>()

  for (const cellKey of cellKeys) {
    const [x, y] = cellKey.split(',').map(Number)
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) continue
        const neighboringGroup = groupByCell.get(`${x + offsetX},${y + offsetY}`)
        if (neighboringGroup) neighboringColors.add(neighboringGroup.color.toLowerCase())
      }
    }
  }

  const availableColors = LOCKED_CELL_COLOR_HEX.filter((color) => !neighboringColors.has(color))
  const colorPool = availableColors.length > 0 ? availableColors : LOCKED_CELL_COLOR_HEX
  return colorPool[Math.floor(Math.random() * colorPool.length)]!
}
