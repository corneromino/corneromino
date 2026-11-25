/** Offset the canvas using the board's final position within its moving page. */
export function getExpandedCanvasOffset(
  board: { left: number; top: number },
  entranceTranslation: { x: number; y: number },
  page: { left: number; top: number } = { left: 0, top: 0 },
) {
  return { left: page.left + entranceTranslation.x - board.left, top: page.top + entranceTranslation.y - board.top }
}
