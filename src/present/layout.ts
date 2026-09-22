/** 全部布局常量（640×360 基准）。 */
export const W = 640
export const H = 360
export const TOPBAR_H = 26

export const BATTLE = {
  tableY: 66,
  tableH: 210,
  cell: 60,
  gap: 4,
  gridSize: 60 * 3 + 4 * 2,
  gridX: Math.round((640 - 188) / 2),
  gridY: 78,
  handY: 280,
  handH: 80,
  cardW: 48,
  cardH: 68,
  handLeft: 88,
  handRight: 552,
  boardCard: 48,
}

/** 战斗里的牌组、己方弃牌堆、敌方弃牌堆。 */
export const PILES = {
  draw: { x: 8, y: 286, w: 46, h: 54 },
  discard: { x: 586, y: 286, w: 46, h: 54 },
  enemy: { x: 468, y: 88, w: 46, h: 50 },
}

export const MAP = {
  padX: 48,
  padY: 44,
  width: 544,
  height: 236,
}

export const PANEL = {
  x: 40, y: 36, w: 560, h: 288,
}

/** 战斗左侧卡牌检视，避开九宫格与手牌。 */
export const INSPECT = {
  x: 8, y: 54, w: 200, h: 208,
}
