import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level9: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[6],
  origin: 'relative',
  x: 0,
  y: 80,
  from: 'left',
  to: 'right'
}
