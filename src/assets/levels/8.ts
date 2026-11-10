import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level8: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[5],
  origin: 'relative',
  x: 80,
  y: 0,
  from: 'top',
  to: 'bottom'
}
