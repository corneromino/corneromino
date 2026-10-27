import { GAME_COLORS } from '@/rendering/colors'

export const VS_CHECKERBOARD_CELL_COLOR = 0xE6BC7C

/** The darker squares are the odd parity cells in the fixed board coordinates. */
export function isVsCheckerboardCell(column: number, row: number): boolean {
  return (column + row) % 2 !== 0
}

export function getVsBaseCellColor(column: number, row: number): number {
  return isVsCheckerboardCell(column, row) ? VS_CHECKERBOARD_CELL_COLOR : GAME_COLORS.cellFill
}
