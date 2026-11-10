import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level15: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[1],
  origin: 'relative',
  x: 200,
  y: 200,
  from: 'top',
  to: 'bottom'
}
