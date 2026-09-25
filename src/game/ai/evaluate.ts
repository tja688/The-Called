import { getCardDefinition } from '../../config/cardCatalog'
import { getBoardPower } from '../core/matchEngine'
import type { MatchState } from '../types'
import type { OpponentBelief } from './belief'

const WIN = 1_000_000
const HEURISTIC_CAP = 100_000

function controlledCells(state: MatchState, owner: 'player' | 'monster') {
  return state.board.reduce((total, cell) => total + (cell.card?.owner === owner ? 1 : 0), 0)
}

function terminalScore(state: MatchState): number {
  const winner = state.result?.winner
  const margin = (state.result?.monsterPower ?? 0) - (state.result?.playerPower ?? 0)
  if (winner === 'monster') return WIN + margin
  if (winner === 'player') return -WIN + margin
  return margin
}

function maxSurvivorPower(belief: OpponentBelief): number {
  let max = 0
  for (const cardId of belief.survivors) max = Math.max(max, getCardDefinition(cardId).power)
  return max
}

/**
 * Monster-positive static value of a position that is not a forced win yet.
 * One point of board Power is worth more than every cell on the board, because
 * Power decides the final battle before cell count does. Cell count is the
 * tiebreak, so it only takes over when Power is level.
 */
export function evaluateForMonster(state: MatchState, belief: OpponentBelief): number {
  if (state.status === 'finished') return terminalScore(state)

  const monsterPower = getBoardPower(state, 'monster')
  const playerPower = getBoardPower(state, 'player')
  const monsterCells = controlledCells(state, 'monster')
  const playerCells = controlledCells(state, 'player')
  const empty = state.board.length - monsterCells - playerCells
  const threat = maxSurvivorPower(belief)

  let score = (monsterPower - playerPower) * 1000
  score += (monsterCells - playerCells) * 120
  if (monsterPower === playerPower) score += (monsterCells - playerCells) * 300

  for (const cell of state.board) {
    const card = cell.card
    if (card?.owner !== 'monster') continue
    if (threat <= 0 || card.currentPower >= threat) score += 140
    else score -= card.currentPower <= 2 ? 480 : 90
  }

  let bestHand = 0
  for (const card of state.monster.hand) bestHand = Math.max(bestHand, card.currentPower)
  score += bestHand * 25

  if (state.finalBattle) {
    if (monsterPower > playerPower) score += 8_000
    else if (monsterPower < playerPower) score -= 8_000
  } else if (empty <= 2) {
    if (monsterPower > playerPower) score += 2_000
    else if (monsterPower < playerPower) score -= 2_000
  }

  return Math.max(-HEURISTIC_CAP, Math.min(HEURISTIC_CAP, score))
}
