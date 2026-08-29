export type MatchRules = {
  boardSize: number
  handLimit: number
  openingHandSize: number
  playerStarts: boolean
  drawOnFirstTurn: boolean
  minimumPower: number
  equalPowerCanCover: boolean
  fullBoardEndsMatch: boolean
  fullHandDraw: 'skip' | 'discard'
  tieResult: 'draw' | 'player' | 'monster'
}

/** Rules are separate from card content so a future mode can swap them. */
export const beginnerMatchRules: MatchRules = {
  boardSize: 3,
  handLimit: 5,
  openingHandSize: 5,
  playerStarts: true,
  drawOnFirstTurn: false,
  minimumPower: 0,
  equalPowerCanCover: false,
  fullBoardEndsMatch: true,
  fullHandDraw: 'skip',
  tieResult: 'draw',
}
