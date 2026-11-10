import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level17: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[3],
  origin: 'relative',
  x: 0,
  y: 80,
  from: 'bottom',
  to: 'right'
}
