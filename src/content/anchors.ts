/** 数值锚点。调参先改这里。见 docs/4-数据汇总/数值锚点.md */

export const ANCHORS = {
  hpMax: 30,
  hpStart: 30,
  handCap: 10,
  openingDraw: 4,
  turnDraw: 1,
  avatarBase: 10,
  loseHp: 10,
  bandage: 8,
  shadowCorner: 1,
  openingFinal: {
    yuZhuang: 17,
    boShou: 17,
    shouMen: 22,
  } as const,
} as const

export type AnchorId = keyof typeof ANCHORS
