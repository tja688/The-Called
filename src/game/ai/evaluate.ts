import { getCardDefinition } from '../../config/cardCatalog'
import { getBoardPower } from '../core/matchEngine'
import type { CardEffect, MatchState } from '../types'
import type { OpponentBelief } from './belief'

const WIN = 1_000_000_000_000

function controlledCells(state: MatchState, owner: 'player' | 'monster') {
  return state.board.reduce((total, cell) => total + (cell.card?.owner === owner ? 1 : 0), 0)
}

/** Upper bound on the Power a card can reach while covering. Conditions are assumed met. */
function coverReach(effect: CardEffect, power: number): number {
  if (effect.type === 'self_power_on_cover' || effect.type === 'self_power_if_position' || effect.type === 'self_power_if_count') {
    return power + effect.amount
  }
  if (effect.type === 'mirror' && effect.affect === 'self') return power + effect.amount
  return power
}

function stability(state: MatchState, belief: OpponentBelief): number {
  const monsters = state.board.filter((cell) => cell.card?.owner === 'monster')
  if (monsters.length === 0 || belief.worlds.length === 0) return 50
  let safe = 0
  for (const cell of monsters) {
    const power = cell.card?.currentPower ?? 0
    let mass = 0
    for (const world of belief.worlds) {
      const threatened = world.hand.some((cardId) => {
        const definition = getCardDefinition(cardId)
        return coverReach(definition.effect, definition.power) > power
      })
      if (!threatened) mass += world.weight
    }
    safe += mass
  }
  return Math.round((safe / monsters.length) * 100)
}

/**
 * Monster-positive value. A finished result outranks every heuristic.
 * Inside a live position the bands are ordered: Power, then cells, then how
 * likely the opponent is to cover our cards, then the cards still in hand.
 * A lower band cannot outweigh a higher one.
 */
export function evaluateForMonster(state: MatchState, belief: OpponentBelief): number {
  if (state.status === 'finished') {
    const winner = state.result?.winner
    const margin = (state.result?.monsterPower ?? 0) - (state.result?.playerPower ?? 0)
    if (winner === 'monster') return WIN + margin
    if (winner === 'player') return -WIN + margin
    return margin
  }

  const margin = getBoardPower(state, 'monster') - getBoardPower(state, 'player')
  const cells = controlledCells(state, 'monster') - controlledCells(state, 'player')
  const hand = state.monster.hand.reduce((total, card) => total + card.currentPower, 0)
  return (margin + 80) * 100_000_000 + (cells + 9) * 100_000 + stability(state, belief) * 100 + hand
}
