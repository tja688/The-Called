/** 数值锚点。调参先改这里。 */

export const ANCHORS = {
  hpMax: 30,
  hpStart: 30,
  handCap: 10,
  openingDraw: 4,
  turnDraw: 1,
  avatarBase: 10,
  deckMin: 10,
  goldNormal: 12,
  goldElite: 25,
  goldBoss: 80,
  goldFallback: 15,
  restHealPct: 0.3,
  shopWhite: 30,
  shopBlue: 45,
  shopGold: 90,
  shopCopyFirst: 45,
  shopCopyStep: 15,
  rarityWhite: 60,
  rarityBlue: 30,
  rarityGold: 10,
} as const

export type AnchorId = keyof typeof ANCHORS
