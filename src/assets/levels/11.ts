import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level11: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[8],
  origin: 'relative',
  x: -150,
  y: 0,
  from: 'top',
  to: 'bottom'
}
