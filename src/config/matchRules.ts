export type MatchRules = {
  boardSize: number
  handLimit: number
  openingHandSize: number
  playerStarts: boolean
  drawOnFirstTurn: boolean
  minimumPower: number
  equalPowerCanCover: boolean
  /** Filling the last empty cell starts final battle instead of scoring immediately. */
  fullBoardStartsFinalBattle: boolean
  fullHandDraw: 'skip' | 'discard'
  tieResult: 'draw' | 'player' | 'monster'
}

/**
 * Encounter decks are finite: they are dealt once and never reshuffled.
 * A tied final battle goes to whoever holds more cells. If the cells are
 * tied as well, `tieResult` decides. The same comparison ends a match whose
 * board still has empty cells once neither side can play or draw. An
 * announced monster card that can no longer be placed is a pass, not a
 * chance to play a different card.
 */

/** Rules are separate from card content so a future mode can swap them. */
export const beginnerMatchRules: MatchRules = {
  boardSize: 3,
  handLimit: 5,
  openingHandSize: 5,
  playerStarts: true,
  drawOnFirstTurn: false,
  minimumPower: 0,
  equalPowerCanCover: false,
  fullBoardStartsFinalBattle: true,
  fullHandDraw: 'skip',
  tieResult: 'draw',
}
