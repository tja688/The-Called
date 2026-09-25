import type { DeckConfig } from '../../config/decks'
import { getCardDefinition } from '../../config/cardCatalog'
import type { CardInstance, MatchState, Side } from '../types'

export type BeliefWorld = {
  hand: readonly string[]
  deck: readonly string[]
  weight: number
}

/** What the monster is allowed to know. Deck order and the player's cards are absent. */
export type MonsterObservation = {
  levelId: string
  monsterId: string
  turn: MatchState['turn']
  round: number
  status: MatchState['status']
  finalBattle: boolean
  openingTurn: boolean
  board: MatchState['board']
  ownHand: CardInstance[]
  ownDeckCounts: ReadonlyArray<{ cardId: string; count: number }>
  opponentHandCount: number
  opponentDeckCount: number
  playerTurnsTaken: number
  monsterTurnsTaken: number
  graveyard: CardInstance[]
  result: MatchState['result']
  message: string
}

function countsOf(cards: readonly CardInstance[]): { cardId: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const card of cards) counts.set(card.cardId, (counts.get(card.cardId) ?? 0) + 1)
  return [...counts.entries()]
    .map(([cardId, count]) => ({ cardId, count }))
    .sort((left, right) => left.cardId.localeCompare(right.cardId))
}

export function observeMonster(state: MatchState): MonsterObservation {
  return {
    levelId: state.levelId,
    monsterId: state.monsterId,
    turn: state.turn,
    round: state.round,
    status: state.status,
    finalBattle: state.finalBattle,
    openingTurn: state.openingTurn,
    board: state.board.map((cell) => ({
      ...cell,
      card: cell.card ? { ...cell.card } : null,
      coveredCards: cell.coveredCards.map((card) => ({ ...card })),
    })),
    ownHand: state.monster.hand.map((card) => ({ ...card })),
    ownDeckCounts: countsOf(state.monster.deck),
    opponentHandCount: state.player.hand.length,
    opponentDeckCount: state.player.deck.length,
    playerTurnsTaken: state.player.turnsTaken,
    monsterTurnsTaken: state.monster.turnsTaken,
    graveyard: (state.graveyard ?? []).map((card) => ({ ...card })),
    result: state.result ? { ...state.result } : null,
    message: state.message,
  }
}

function pile(cardIds: readonly string[], owner: Side, prefix: string): CardInstance[] {
  return cardIds.map((cardId, index) => ({
    instanceId: `${prefix}-${cardId}-${index}`,
    cardId,
    owner,
    currentPower: getCardDefinition(cardId).power,
  }))
}

function canonicalIds(counts: ReadonlyArray<{ cardId: string; count: number }>): string[] {
  const ids: string[] = []
  for (const entry of counts) {
    for (let copy = 0; copy < entry.count; copy += 1) ids.push(entry.cardId)
  }
  return ids
}

/**
 * A rules-engine state for one possible world.
 * The player's cards come from the belief world. The monster's deck is rebuilt
 * from counts, so the true shuffle never enters the search.
 */
export function hypotheticalState(observation: MonsterObservation, world: BeliefWorld): MatchState {
  return {
    levelId: observation.levelId,
    monsterId: observation.monsterId,
    turn: observation.turn,
    round: observation.round,
    status: observation.status,
    finalBattle: observation.finalBattle,
    openingTurn: observation.openingTurn,
    board: observation.board.map((cell) => ({
      ...cell,
      card: cell.card ? { ...cell.card } : null,
      coveredCards: cell.coveredCards.map((card) => ({ ...card })),
    })),
    player: {
      hand: pile(world.hand, 'player', 'belief-hand'),
      deck: pile(world.deck, 'player', 'belief-deck'),
      turnsTaken: observation.playerTurnsTaken,
    },
    monster: {
      hand: observation.ownHand.map((card) => ({ ...card })),
      deck: pile(canonicalIds(observation.ownDeckCounts), 'monster', 'own-deck'),
      turnsTaken: observation.monsterTurnsTaken,
    },
    result: observation.result ? { ...observation.result } : null,
    message: observation.message,
    graveyard: observation.graveyard.map((card) => ({ ...card })),
  }
}

export function hiddenCounts(observation: MonsterObservation, deck: DeckConfig): Map<string, number> {
  const remaining = new Map<string, number>()
  for (const entry of deck.cards) remaining.set(entry.cardId, entry.count)
  const spend = (card: CardInstance | null | undefined) => {
    if (card?.owner !== 'player') return
    remaining.set(card.cardId, Math.max(0, (remaining.get(card.cardId) ?? 0) - 1))
  }
  for (const cell of observation.board) {
    spend(cell.card)
    for (const covered of cell.coveredCards) spend(covered)
  }
  for (const card of observation.graveyard) spend(card)
  return remaining
}
