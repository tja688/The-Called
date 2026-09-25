import { getCardDefinition } from '../../config/cardCatalog'
import type { DeckConfig } from '../../config/decks'
import type { CardEffect, CardInstance, MatchState } from '../types'
import { hiddenCounts, observeMonster, type BeliefWorld } from './observation'

export type { BeliefWorld }

export type OpponentBelief = {
  /**
   * Copies the opponent may still hold or draw.
   * Cards on the board or in the public graveyard are excluded. Copies that
   * vanished with no public record are treated as the weakest ones.
   */
  survivors: readonly string[]
  /** Possible hands, weighted by the shuffle. The true hand is not one of these. */
  worlds: readonly BeliefWorld[]
}

const SEARCH_WORLDS = 4

function effectThreat(effect: CardEffect): number {
  if (effect.type === 'adjacent_power_change') return Math.abs(effect.amount) * 4
  if (effect.type === 'self_power_on_cover') return effect.amount * 3
  if (effect.type === 'self_power_if_position') return effect.amount * 2
  if (effect.type === 'mirror') return Math.abs(effect.amount) * 3
  if (effect.type === 'line') return Math.abs(effect.amount) * 4
  if (effect.type === 'edge_tax') return Math.abs(effect.amount) * 5
  if (effect.type === 'self_power_if_count') return effect.amount * 2
  return 0
}

/** Higher means the card is more dangerous to leave in the opponent's pool. */
export function cardThreat(cardId: string): number {
  const definition = getCardDefinition(cardId)
  return definition.power * 10 + effectThreat(definition.effect)
}

export function hiddenPileSize(state: MatchState): number {
  return state.player.hand.length + state.player.deck.length
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let value = 1
  for (let step = 1; step <= k; step += 1) value = (value * (n - k + step)) / step
  return value
}

function expand(counts: Map<string, number>): string[] {
  const ids: string[] = []
  for (const [cardId, count] of [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    for (let copy = 0; copy < count; copy += 1) ids.push(cardId)
  }
  return ids
}

type CountedHand = { counts: Map<string, number>; weight: number }

function enumerateHands(hidden: Map<string, number>, handSize: number): CountedHand[] {
  const types = [...hidden.keys()].sort()
  const hands: CountedHand[] = []
  const total = [...hidden.values()].reduce((sum, count) => sum + count, 0)
  const denominator = combinations(total, handSize)

  const walk = (index: number, left: number, chosen: Map<string, number>, ways: number) => {
    if (index === types.length) {
      if (left === 0) hands.push({ counts: new Map(chosen), weight: denominator === 0 ? 1 : ways / denominator })
      return
    }
    const cardId = types[index]
    const available = hidden.get(cardId) ?? 0
    const max = Math.min(available, left)
    for (let take = 0; take <= max; take += 1) {
      if (take > 0) chosen.set(cardId, take)
      walk(index + 1, left - take, chosen, ways * combinations(available, take))
      chosen.delete(cardId)
    }
  }

  walk(0, handSize, new Map(), 1)
  return hands
}

function handThreat(counts: Map<string, number>): number {
  let threat = 0
  for (const [cardId, count] of counts) threat = Math.max(threat, count > 0 ? cardThreat(cardId) : 0)
  return threat
}

function toWorld(hand: CountedHand, hidden: Map<string, number>): BeliefWorld {
  const deckCounts = new Map(hidden)
  const handIds: string[] = []
  for (const [cardId, count] of hand.counts) {
    deckCounts.set(cardId, (deckCounts.get(cardId) ?? 0) - count)
    for (let copy = 0; copy < count; copy += 1) handIds.push(cardId)
  }
  return { hand: handIds, deck: expand(deckCounts), weight: hand.weight }
}

function compressWorlds(worlds: BeliefWorld[]): BeliefWorld[] {
  if (worlds.length <= SEARCH_WORLDS) return worlds
  const byWeight = [...worlds].sort((left, right) => right.weight - left.weight || left.hand.join().localeCompare(right.hand.join()))
  const kept = byWeight.slice(0, SEARCH_WORLDS)
  const worst = [...worlds].sort((left, right) => {
    const threat = (world: BeliefWorld) => world.hand.reduce((max, cardId) => Math.max(max, cardThreat(cardId)), 0)
    return threat(right) - threat(left) || right.weight - left.weight
  })[0]
  if (worst && !kept.includes(worst)) kept.push(worst)
  const mass = kept.reduce((sum, world) => sum + world.weight, 0)
  if (mass <= 0) return kept.map((world) => ({ ...world, weight: 1 / kept.length }))
  return kept.map((world) => ({ ...world, weight: world.weight / mass }))
}

export function createOpponentBelief(state: MatchState, deck: DeckConfig): OpponentBelief {
  const observation = observeMonster(state)
  const remaining = hiddenCounts(observation, deck)
  let unplaced = expand(remaining)
  const hidden = observation.opponentHandCount + observation.opponentDeckCount
  const destroyed = Math.max(0, unplaced.length - hidden)
  unplaced.sort((left, right) => cardThreat(left) - cardThreat(right) || left.localeCompare(right))
  const survivors = unplaced.slice(destroyed)

  const survivorCounts = new Map<string, number>()
  for (const cardId of survivors) survivorCounts.set(cardId, (survivorCounts.get(cardId) ?? 0) + 1)
  const handSize = Math.min(observation.opponentHandCount, survivors.length)
  const enumerated = enumerateHands(survivorCounts, handSize)
  const worlds = compressWorlds(enumerated.map((hand) => toWorld(hand, survivorCounts)))
  if (worlds.length === 0) worlds.push({ hand: [], deck: [], weight: 1 })
  return { survivors, worlds }
}

export function spendSurvivor(belief: OpponentBelief, cardId: string): OpponentBelief {
  const index = belief.survivors.indexOf(cardId)
  if (index < 0) return belief
  return { ...belief, survivors: belief.survivors.filter((_, survivorIndex) => survivorIndex !== index) }
}

export function syntheticOpponentCard(cardId: string): CardInstance {
  return {
    instanceId: `belief-${cardId}`,
    cardId,
    owner: 'player',
    currentPower: getCardDefinition(cardId).power,
  }
}

/** Blend the average world with the bad tail. `risk` 1 is the old worst case. */
export function mixRisk(scores: readonly number[], weights: readonly number[], risk: number): number {
  const lambda = Math.min(1, Math.max(0, risk))
  let mass = 0
  let expected = 0
  for (let index = 0; index < scores.length; index += 1) {
    const weight = weights[index] ?? 0
    mass += weight
    expected += scores[index] * weight
  }
  if (mass <= 0) return scores.length > 0 ? Math.min(...scores) : 0
  expected /= mass
  const order = scores
    .map((score, index) => ({ score, weight: weights[index] ?? 0 }))
    .sort((left, right) => left.score - right.score)
  let taken = 0
  let tail = 0
  const target = mass * 0.25
  for (const item of order) {
    const slice = Math.min(item.weight, target - taken)
    if (slice <= 0) break
    tail += item.score * slice
    taken += slice
  }
  const cautious = taken > 0 ? tail / taken : order[0]?.score ?? expected
  return (1 - lambda) * expected + lambda * cautious
}
