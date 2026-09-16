/** 九宫格几何。格位 1~9，行优先。词条「相邻」= 正交。 */

export const CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export type Cell = (typeof CELLS)[number]

export const ADJACENT: Record<Cell, Cell[]> = {
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

export const DIAG_ADJ: Record<Cell, Cell[]> = {
  1: [5],
  2: [4, 6],
  3: [5],
  4: [2, 8],
  5: [1, 3, 7, 9],
  6: [2, 8],
  7: [5],
  8: [4, 6],
  9: [5],
}

export const MIRROR: Record<Cell, Cell | null> = {
  1: 9,
  2: 8,
  3: 7,
  4: 6,
  5: null,
  6: 4,
  7: 3,
  8: 2,
  9: 1,
}

export const CORNERS: Cell[] = [1, 3, 7, 9]
export const EDGES: Cell[] = [2, 4, 6, 8]
export const CENTER: Cell = 5
export const MIRROR_PAIRS: [Cell, Cell][] = [[1, 9], [2, 8], [3, 7], [4, 6]]
export const ROWS: Cell[][] = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
export const COLS: Cell[][] = [[1, 4, 7], [2, 5, 8], [3, 6, 9]]

export const isCell = (n: number): n is Cell => n >= 1 && n <= 9 && Number.isInteger(n)
export const isCorner = (c: number): boolean => CORNERS.includes(c as Cell)
export const isEdge = (c: number): boolean => EDGES.includes(c as Cell)
export const isAdjacent = (a: number, b: number): boolean => (ADJACENT[a as Cell] ?? []).includes(b as Cell)
export const isDiagAdjacent = (a: number, b: number): boolean => (DIAG_ADJ[a as Cell] ?? []).includes(b as Cell)
export const mirrorOf = (c: Cell): Cell | null => MIRROR[c]
export const cellRow = (c: number): number => Math.floor((c - 1) / 3)
export const cellCol = (c: number): number => (c - 1) % 3
