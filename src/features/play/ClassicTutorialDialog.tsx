import { useState, type ComponentType } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CellCorner, GameConfig, LockedCellGroup, PlacedTetromino } from '@/game/gameConfig'
import { LOCKED_CELL_COLOR_HEX } from '@/rendering/colors'
import { TETROMINOES, TETROMINO_KINDS, type CellId, type TetrominoKind } from '@/game/tetrominoes'
import { GameGridCanvas } from './GameGridCanvas'

const TUTORIAL_CORNERS: ReadonlyArray<{ corner: CellCorner, label: string }> = [
  { corner: 'top-left', label: 'Top-left' },
  { corner: 'top-right', label: 'Top-right' },
  { corner: 'bottom-right', label: 'Bottom-right' },
  { corner: 'bottom-left', label: 'Bottom-left' },
]

const TUTORIAL_CORNER_GRID_CONFIG: GameConfig = { columns: 1, rows: 1, spread: 0, tetrominoCount: 1, lockingMode: 'manual' }

const TUTORIAL_GRID_CONFIG: GameConfig = {
  lockingMode: 'manual',
  columns: 5,
  rows: 5,
  spread: 0,
  tetrominoCount: 1,
}

const TUTORIAL_L_PIECE: readonly PlacedTetromino[] = [{
  id: 1,
  kind: 'L',
  cells: [
    { cellId: 'a', corner: 'top-left', x: 1, y: 1 },
    { cellId: 'b', corner: 'top-right', x: 1, y: 2 },
    { cellId: 'c', corner: 'bottom-left', x: 1, y: 3 },
    { cellId: 'd', corner: 'bottom-right', x: 2, y: 3 },
  ],
}]

const TUTORIAL_SHAPE_OFFSETS: Record<TetrominoKind, { x: number, y: number }> = {
  I: { x: 0, y: 2 },
  J: { x: 1, y: 1 },
  L: { x: 1, y: 1 },
  O: { x: 1, y: 1 },
  S: { x: 1, y: 1 },
  T: { x: 1, y: 1 },
  Z: { x: 1, y: 1 },
  diagonal: { x: 0, y: 0 },
}

const TUTORIAL_CORNERS_BY_CELL_ID: Record<CellId, CellCorner> = {
  a: 'top-left',
  b: 'top-right',
  c: 'bottom-right',
  d: 'bottom-left',
}

const TUTORIAL_SHAPES: readonly TetrominoKind[] = TETROMINO_KINDS

function createTutorialCornerPiece(corner: CellCorner): readonly PlacedTetromino[] {
  return [{ id: 1, kind: 'O', cells: [{ cellId: 'a', corner, x: 0, y: 0 }] }]
}

function createTutorialShapePiece(kind: TetrominoKind): readonly PlacedTetromino[] {
  const offset = TUTORIAL_SHAPE_OFFSETS[kind]
  const cells = TETROMINOES[kind].rotations[0].cells.map((cell) => ({
    cellId: cell.id,
    corner: TUTORIAL_CORNERS_BY_CELL_ID[cell.id],
    x: cell.x + offset.x,
    y: cell.y + offset.y,
  }))
  return [{ id: 1, kind, cells }]
}

interface ClassicTutorialDialogProps {
  onOpenChange: (open: boolean) => void
  open: boolean
}

interface TutorialPage {
  Component: ComponentType
  id: string
}

interface TutorialPieceExampleProps {
  ariaLabel: string
  gridClassName: string
  lockId: string
  lockInstruction?: string
  pieces: readonly PlacedTetromino[]
}

function CornerMarkersTutorialPage() {
  return (
    <>
      <p>A Corneromino is a shape made of four connected cells. Each cell has a different corner marker:</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="list">
        {TUTORIAL_CORNERS.map(({ corner, label }) => (
          <div className="flex items-center gap-2" key={label} role="listitem">
            <span aria-hidden="true" className="pointer-events-none size-9 border-2 border-[#773526] bg-[#773526]">
              <GameGridCanvas
                config={TUTORIAL_CORNER_GRID_CONFIG}
                lockedCellGroups={[]}
                markers={new Map()}
                onToggle={() => undefined}
                pieces={createTutorialCornerPiece(corner)}
                selectedCellKeys={new Set()}
                selectedLockedGroupId={null}
                showCellIds={false}
              />
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function TutorialPieceExample(props: TutorialPieceExampleProps) {
  const { ariaLabel, gridClassName, lockId, lockInstruction, pieces } = props
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(() => new Set())
  const [lockedCellGroups, setLockedCellGroups] = useState<LockedCellGroup[]>([])
  const pieceCellKeys = new Set(pieces.flatMap((piece) => piece.cells.map((cell) => `${cell.x},${cell.y}`)))
  const canLockSelection = selectedCellKeys.size === pieceCellKeys.size && lockedCellGroups.length === 0

  function toggleCell(cellKey: string) {
    if (!pieceCellKeys.has(cellKey) || lockedCellGroups.length > 0) return

    setSelectedCellKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys)
      if (nextKeys.has(cellKey)) {
        nextKeys.delete(cellKey)
      } else {
        nextKeys.add(cellKey)
      }
      return nextKeys
    })
  }

  function lockSelection() {
    if (!canLockSelection) return

    setLockedCellGroups([{
      cellKeys: [...selectedCellKeys],
      color: LOCKED_CELL_COLOR_HEX[0],
      id: lockId,
    }])
    setSelectedCellKeys(new Set())
  }

  function unlockSelection() {
    const lockedGroup = lockedCellGroups[0]
    if (!lockedGroup) return

    setLockedCellGroups([])
    setSelectedCellKeys(new Set(lockedGroup.cellKeys))
  }

  return (
    <>
      <div aria-label={ariaLabel} className={`mx-auto aspect-square w-full border-2 border-[#773526] bg-[#773526] ${gridClassName}`} role="group">
        <GameGridCanvas
          config={TUTORIAL_GRID_CONFIG}
          lockedCellGroups={lockedCellGroups}
          markers={new Map()}
          onToggle={toggleCell}
          pieces={pieces}
          selectedCellKeys={selectedCellKeys}
          selectedLockedGroupId={null}
          showCellIds={false}
        />
      </div>
      {lockInstruction && <p className="mt-3">{lockInstruction}</p>}
      <div className="mx-auto mt-3 flex w-fit gap-2">
        <Button aria-label="Lock four selected cells" className="cartoon-press size-[44px] text-[var(--mint)]" disabled={!canLockSelection} onClick={lockSelection} size="icon" title="Lock four selected cells" type="button">
          <Lock aria-hidden="true" />
        </Button>
        <Button aria-label="Unlock selected cells" className="cartoon-press size-[44px] [--element-color:var(--paper-muted)] text-[var(--canvas-foreground)]" disabled={lockedCellGroups.length === 0} onClick={unlockSelection} size="icon" title="Unlock selected cells" type="button">
          <Unlock aria-hidden="true" />
        </Button>
      </div>
    </>
  )
}

function LShapeTutorialPage() {
  return (
    <>
      <p>Find the shape by selecting each of its cells:</p>
      <TutorialPieceExample ariaLabel="A 5 by 5 grid showing an L-shaped Corneromino. Select its cells." gridClassName="max-w-[180px]" lockId="tutorial-l-shape" lockInstruction="Once you have found and selected the four cells, lock it:" pieces={TUTORIAL_L_PIECE} />
    </>
  )
}

function ShapesTutorialPage() {
  return (
    <>
      <p>There are {TUTORIAL_SHAPES.length} possible Corneromino shapes. Each has four different rotations.</p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        {TUTORIAL_SHAPES.map((kind) => (
          <section className="text-center" key={kind}>
            <p className="mb-1 font-black text-[var(--canvas-foreground)]">{kind}</p>
            <TutorialPieceExample ariaLabel={`${kind} Corneromino shape`} gridClassName="max-w-[110px]" lockId={`tutorial-shape-${kind}`} pieces={createTutorialShapePiece(kind)} />
          </section>
        ))}
      </div>
    </>
  )
}

const TUTORIAL_PAGES: readonly TutorialPage[] = [
  { Component: CornerMarkersTutorialPage, id: 'corner-markers' },
  { Component: LShapeTutorialPage, id: 'l-shape' },
  { Component: ShapesTutorialPage, id: 'shapes' },
]

export function ClassicTutorialDialog(props: ClassicTutorialDialogProps) {
  const { onOpenChange, open } = props
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState<TutorialPage>(TUTORIAL_PAGES[0])
  const currentPageIndex = TUTORIAL_PAGES.indexOf(currentPage)
  const previousPage = TUTORIAL_PAGES[currentPageIndex - 1]
  const nextPage = TUTORIAL_PAGES[currentPageIndex + 1]
  const CurrentPage = currentPage.Component

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setCurrentPage(TUTORIAL_PAGES[0])
    onOpenChange(nextOpen)
  }

  function showPage(page: TutorialPage | undefined) {
    if (page) setCurrentPage(page)
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('tutorial.title')}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3 text-left text-[15px] leading-relaxed text-[var(--muted-text-color)]">
          <CurrentPage />
        </div>
        <DialogFooter className="grid-cols-3">
          <DialogClose asChild>
            <Button className="cartoon-press h-[42px] w-full text-[10px] font-black tracking-[0.08em] text-[var(--canvas-foreground)] uppercase" size="lg" type="button">Skip</Button>
          </DialogClose>
          <Button className="cartoon-press h-[42px] w-full text-[10px] font-black tracking-[0.08em] text-[var(--canvas-foreground)] uppercase" disabled={!previousPage} onClick={() => showPage(previousPage)} size="lg" type="button">Previous</Button>
          <Button className="cartoon-press h-[42px] w-full text-[10px] font-black tracking-[0.08em] text-[var(--canvas-foreground)] uppercase" disabled={!nextPage} onClick={() => showPage(nextPage)} size="lg" type="button">Next</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
