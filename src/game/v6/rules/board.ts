import type { CellId } from './types';

export const CELL_IDS: readonly CellId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const HAND_LIMIT = 10;

/**
 * TODO 【建议默认】同一因果链深度上限 32。到达后停止并记一条错误，避免组合卡死。
 */
export const CHAIN_DEPTH_LIMIT = 32;

const MIRROR: Record<CellId, CellId | null> = {
  1: 9,
  2: 8,
  3: 7,
  4: 6,
  5: null,
  6: 4,
  7: 3,
  8: 2,
  9: 1,
};

export function isCellId(value: number): value is CellId {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

/** Orthogonal neighbors only. Diagonals are not adjacent. */
export function orthogonalNeighbors(cell: CellId): CellId[] {
  const row = Math.floor((cell - 1) / 3);
  const col = (cell - 1) % 3;
  const found: CellId[] = [];
  const push = (nextRow: number, nextCol: number) => {
    if (nextRow < 0 || nextRow > 2 || nextCol < 0 || nextCol > 2) return;
    found.push((nextRow * 3 + nextCol + 1) as CellId);
  };
  push(row - 1, col);
  push(row + 1, col);
  push(row, col - 1);
  push(row, col + 1);
  return found.sort((left, right) => left - right);
}

/** 1↔9, 2↔8, 3↔7, 4↔6. Cell 5 has no mirror. */
export function mirrorCell(cell: CellId): CellId | null {
  return MIRROR[cell];
}

export function emptyCells(): Record<CellId, string | null> {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
  };
}
