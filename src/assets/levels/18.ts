import type { CareerLevel } from "@/features/play/careerLevels"
import { LOCKED_CELL_COLOR_HEX } from "@/rendering/colors"

export const level18: CareerLevel = {
  bgColor: LOCKED_CELL_COLOR_HEX[4],
  origin: 'relative',
  x: -80,
  y: -80,
  from: 'top',
  to: 'bottom'
}
