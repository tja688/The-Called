import { getCardDefinition } from '../../config/cardCatalog'
import type { DeckConfig } from '../../config/decks'
import type { CardEffect, CardInstance, MatchState } from '../types'

export type OpponentBelief = {
  /**
   * Copies the opponent may still hold or draw.
   * Cards already on the board are excluded. When some copies were destroyed
   * and left no record, the weakest copies are treated as the ones that died.
   */
  survivors: readonly string[]
}

function effectThreat(effect: CardEffect): number {
  if (effect.type === 'adjacent_power_change') return Math.abs(effect.amount) * 4
  if (effect.type === 'self_power_on_cover') return effect.amount * 3
  if (effect.type === 'self_power_if_position') return effect.amount * 2
  return 0
}

/** Higher means the card is more dangerous to leave in the opponent's pool. */
export function cardThreat(cardId: string): number {
  const definition = getCardDefinition(cardId)
  return definition.power * 10 + effectThreat(definition.effect)
}

function countPlayerCards(state: MatchState): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (card: CardInstance | null | undefined) => {
    if (card?.owner !== 'player') return
    counts.set(card.cardId, (counts.get(card.cardId) ?? 0) + 1)
  }
  for (const cell of state.board) {
    add(cell.card)
    for (const covered of cell.coveredCards) add(covered)
  }
  return counts
}

export function hiddenPileSize(state: MatchState): number {
  return state.player.hand.length + state.player.deck.length
}

export function createOpponentBelief(state: MatchState, deck: DeckConfig): OpponentBelief {
  const remaining = new Map<string, number>()
  for (const entry of deck.cards) remaining.set(entry.cardId, entry.count)
  for (const [cardId, visible] of countPlayerCards(state)) {
    remaining.set(cardId, Math.max(0, (remaining.get(cardId) ?? 0) - visible))
  }

  const unplaced: string[] = []
  for (const [cardId, count] of remaining) {
    for (let copy = 0; copy < count; copy += 1) unplaced.push(cardId)
  }
  const destroyed = Math.max(0, unplaced.length - hiddenPileSize(state))
  unplaced.sort((left, right) => cardThreat(left) - cardThreat(right) || left.localeCompare(right))
  return { survivors: unplaced.slice(destroyed) }
}

export function spendSurvivor(belief: OpponentBelief, cardId: string): OpponentBelief {
  const index = belief.survivors.indexOf(cardId)
  if (index < 0) return belief
  return { survivors: belief.survivors.filter((_, survivorIndex) => survivorIndex !== index) }
}

export function syntheticOpponentCard(cardId: string): CardInstance {
  return {
    instanceId: `belief-${cardId}`,
    cardId,
    owner: 'player',
    currentPower: getCardDefinition(cardId).power,
  }
}
