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

export const MAP = {
  nodes: {
    yuZhuang: { x: 96, y: 188 },
    drawer: { x: 236, y: 168 },
    boShou: { x: 376, y: 188 },
    shouMen: { x: 520, y: 158 },
  } as Record<string, { x: number; y: number }>,
}

export const PANEL = {
  x: 40, y: 36, w: 560, h: 288,
}
