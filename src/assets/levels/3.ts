import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level3: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[5],
  origin: 'relative',
  x: 0,
  y: 200,
  from: 'left',
  to: 'right'
}
