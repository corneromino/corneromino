import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CellCorner, GameConfig, LockedCellGroup, PlacedTetromino } from '@/game/gameConfig'
import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'
import { TETROMINOES, TETROMINO_KINDS, type CellId, type TetrominoKind } from '@/game/tetrominoes'
import { GameGridCanvas } from './GameGridCanvas'

interface ClassicCornerominosDialogProps {
  onOpenChange: (open: boolean) => void
  open: boolean
}

const CORNEROMINO_GRID_CONFIG: GameConfig = {
  columns: 9,
  rows: 54,
  spread: 0,
  tetrominoCount: 1,
  lockingMode: 'manual',
  finalVerificationMode: 'manual',
  navigationEnabled: false,
}

const CORNERS_BY_CELL_ID: Record<CellId, CellCorner> = {
  a: 'top-left',
  b: 'top-right',
  c: 'bottom-right',
  d: 'bottom-left',
}
const UNIQUE_CORNERS: readonly CellCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']

interface CornerominoVariant {
  cells: readonly PlacedTetromino['cells'][number][]
  id: string
  kind: TetrominoKind
}

function createCornerominoVariant(kind: TetrominoKind, rotationIndex: number): CornerominoVariant {
  const rotation = TETROMINOES[kind].rotations[rotationIndex]!
  const minX = Math.min(...rotation.cells.map((cell) => cell.x))
  const maxX = Math.max(...rotation.cells.map((cell) => cell.x))
  const minY = Math.min(...rotation.cells.map((cell) => cell.y))
  const maxY = Math.max(...rotation.cells.map((cell) => cell.y))
  const offsetX = Math.floor((4 - (maxX - minX + 1)) / 2) - minX
  const offsetY = Math.floor((4 - (maxY - minY + 1)) / 2) - minY
  const id = `${kind}-${rotation.turns}`
  const cells = rotation.cells.map((cell) => ({
    cellId: cell.id,
    corner: CORNERS_BY_CELL_ID[cell.id],
    x: cell.x + offsetX,
    y: cell.y + offsetY,
  }))
  return {
    id,
    kind,
    cells,
  }
}

const CORNEROMINO_VARIANTS = TETROMINO_KINDS.flatMap((kind) =>
  TETROMINOES[kind].rotations.map((_, rotationIndex) => createCornerominoVariant(kind, rotationIndex)),
)

const CORNEROMINO_GALLERY = CORNEROMINO_VARIANTS.reduce<{ lockedCellGroups: LockedCellGroup[]; pieces: PlacedTetromino[] }>((gallery, variant, index) => {
  const originX = (index % 2) * 5
  const originY = Math.floor(index / 2) * 5
  const cells = variant.cells.map((cell) => ({ ...cell, x: cell.x + originX, y: cell.y + originY }))
  gallery.pieces.push({ id: index, kind: variant.kind, cells })
  gallery.lockedCellGroups.push({
    id: variant.id,
    cellKeys: cells.map(({ x, y }) => `${x},${y}`),
    color: LOCKED_CELL_COLOR_HEX[0],
  })
  return gallery
}, { lockedCellGroups: [], pieces: [] })

function createRandomLockedGroups(): LockedCellGroup[] {
  return CORNEROMINO_GALLERY.lockedCellGroups.map((group) => ({
    ...group,
    color: LOCKED_CELL_COLOR_HEX[Math.floor(Math.random() * LOCKED_CELL_COLOR_HEX.length)]!,
  }))
}

function shuffleCorners(): CellCorner[] {
  const corners = [...UNIQUE_CORNERS]
  for (let index = corners.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[corners[index], corners[swapIndex]] = [corners[swapIndex]!, corners[index]!]
  }
  return corners
}

function createRandomGalleryPieces(): PlacedTetromino[] {
  return CORNEROMINO_GALLERY.pieces.map((piece) => {
    const corners = shuffleCorners()
    return {
      ...piece,
      cells: piece.cells.map((cell, index) => ({ ...cell, corner: corners[index]! })),
    }
  })
}

export function ClassicCornerominosDialog(props: ClassicCornerominosDialogProps) {
  const { t } = useTranslation()
  const [lockedCellGroups, setLockedCellGroups] = useState(createRandomLockedGroups)
  const [pieces, setPieces] = useState(createRandomGalleryPieces)

  function handleOpenChange(open: boolean) {
    // Prepare the next palette as the current gallery closes, so every
    // subsequent opening receives fresh colors without changing mid-view.
    if (!open) {
      setLockedCellGroups(createRandomLockedGroups())
      setPieces(createRandomGalleryPieces())
    }
    props.onOpenChange(open)
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={props.open}>
      <DialogContent aria-describedby={undefined} className="flex max-h-[calc(var(--dialog-viewport-height,var(--app-height))-2.5rem)] max-w-[430px] flex-col overflow-hidden">
        <DialogHeader className="shrink-0"><DialogTitle>8 Cornerominos</DialogTitle></DialogHeader>
        <DialogDescription className="text-[15px]">
          {t('classic.cornerominosDescription')}
        </DialogDescription>
        <div aria-label="Locked Corneromino variants" className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1">
          <div className="w-full border-2 border-[#773526] bg-[#773526]" style={{ aspectRatio: `${CORNEROMINO_GRID_CONFIG.columns} / ${CORNEROMINO_GRID_CONFIG.rows}` }}>
            <GameGridCanvas
              config={CORNEROMINO_GRID_CONFIG}
              interactive={false}
              lockedCellGroups={lockedCellGroups}
              markers={new Map()}
              onToggle={() => undefined}
              pieces={pieces}
              selectedCellKeys={new Set()}
              selectedLockedGroupId={null}
              showCellIds={false}
            />
          </div>
        </div>
        <DialogFooter className="shrink-0 grid-cols-1">
          <DialogClose asChild>
            <Button className="cartoon-press h-[42px] text-[11px] font-black tracking-[0.1em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">
              {t('common.close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
