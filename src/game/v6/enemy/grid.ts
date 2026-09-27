import { emptyCell, type CellIndex, type IntentBoard, type IntentCell } from './types'

export const CELL_INDEXES: readonly CellIndex[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/** 正交相邻。格 5 没有斜向。 */
const ORTHOGONAL: Record<CellIndex, readonly CellIndex[]> = {
  1: [2, 4],
  2: [1, 3, 5],
  3: [2, 6],
  4: [1, 5, 7],
  5: [2, 4, 6, 8],
  6: [3, 5, 9],
  7: [4, 8],
  8: [5, 7, 9],
  9: [6, 8],
}

/** 以格 5 为中心。格 5 没有镜像。 */
const MIRROR: Partial<Record<CellIndex, CellIndex>> = {
  1: 9,
  2: 8,
  3: 7,
  4: 6,
  6: 4,
  7: 3,
  8: 2,
  9: 1,
}

export function readBoard(board: IntentBoard): Map<CellIndex, IntentCell> {
  const map = new Map<CellIndex, IntentCell>()
  for (const index of CELL_INDEXES) map.set(index, emptyCell(index))
  for (const cell of board.cells) {
    if (!CELL_INDEXES.includes(cell.index)) continue
    map.set(cell.index, cell)
  }
  return map
}

export function cellAt(map: Map<CellIndex, IntentCell>, index: CellIndex): IntentCell {
  return map.get(index) ?? emptyCell(index)
}

export function isEmpty(cell: IntentCell): boolean {
  return cell.owner === 'empty' || cell.cardName === null
}

export function isSide(cell: IntentCell, side: 'player' | 'enemy'): boolean {
  return cell.owner === side && cell.cardName !== null
}

export function orthogonal(index: CellIndex): readonly CellIndex[] {
  return ORTHOGONAL[index]
}

export function mirrorOf(index: CellIndex): CellIndex | undefined {
  return MIRROR[index]
}

export function adjacentPlayerCount(map: Map<CellIndex, IntentCell>, index: CellIndex): number {
  let count = 0
  for (const neighbor of ORTHOGONAL[index]) {
    if (isSide(cellAt(map, neighbor), 'player')) count += 1
  }
  return count
}

/** 并列取格号最小：扫描已经按格号从小到大。 */
export function minIndex(indexes: readonly CellIndex[]): CellIndex | undefined {
  let best: CellIndex | undefined
  for (const index of indexes) {
    if (best === undefined || index < best) best = index
  }
  return best
}
