import type { BoardCell, CellId } from '../types'

export const BOARD_SIZE = 3
export const cellId = (row: number, col: number): CellId => `cell-${row}-${col}`

export const createBoard = (): BoardCell[] =>
  Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / BOARD_SIZE)
    const col = index % BOARD_SIZE
    return { id: cellId(row, col), row, col, card: null, coveredCards: [] }
  })

export const getCell = (id: CellId) => {
  const [, row, col] = id.split('-')
  return { row: Number(row), col: Number(col) }
}

export const isInsideBoard = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE

export const getOrthogonalNeighbors = (id: CellId): CellId[] => {
  const { row, col } = getCell(id)
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter(([r, c]) => isInsideBoard(r, c)).map(([r, c]) => cellId(r, c))
}

export const getDiagonalNeighbors = (id: CellId): CellId[] => {
  const { row, col } = getCell(id)
  return [
    [row - 1, col - 1],
    [row - 1, col + 1],
    [row + 1, col - 1],
    [row + 1, col + 1],
  ].filter(([r, c]) => isInsideBoard(r, c)).map(([r, c]) => cellId(r, c))
}

export const getMirrorCell = (id: CellId): CellId => {
  const { row, col } = getCell(id)
  return cellId(BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col)
}

export const cellWorldPosition = (row: number, col: number, columnGap = 2.1, rowGap = 2.1 * (500 / 360)) =>
  [(col - 1) * columnGap, 0, (row - 1) * rowGap] as const
