import type { CardDefinition } from '../game/types'

const presented = new Map<string, CardDefinition>()

/** Faces for the battle currently on the table. Later calls overwrite by id. */
export function presentCards(cards: readonly CardDefinition[]) {
  for (const card of cards) presented.set(card.id, card)
}

export function clearPresentedCards() {
  presented.clear()
}

export function getCardDefinition(cardId: string): CardDefinition {
  const card = presented.get(cardId)
  if (!card) throw new Error(`Unknown card: ${cardId}`)
  return card
}
