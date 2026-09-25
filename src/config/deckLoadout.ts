import { cardCatalog, type CardId } from './cardCatalog'
import { beginnerPlayerDeck, type DeckConfig, type DeckEntry } from './decks'

/** Battle decks must be filled to this size before a level can start. */
export const BATTLE_DECK_LIMIT = 12

export type LibraryEntry = { cardId: string; count: number }

export type DeckLoadout = {
  /** Fixed battle slots. `null` is an open seat. */
  slots: readonly (string | null)[]
  library: readonly LibraryEntry[]
}

export type LoadoutResult =
  | { ok: true; loadout: DeckLoadout }
  | { ok: false; reason: 'empty-slot' | 'occupied' | 'deck-full' | 'not-in-library' | 'unknown-card' | 'invalid-count' }

function expand(deck: DeckConfig): string[] {
  return deck.cards.flatMap(({ cardId, count }) => Array.from({ length: count }, () => cardId))
}

function uniqueInOrder(cardIds: readonly string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const cardId of cardIds) {
    if (seen.has(cardId)) continue
    seen.add(cardId)
    unique.push(cardId)
  }
  return unique
}

export function createDefaultLoadout(source: DeckConfig = beginnerPlayerDeck): DeckLoadout {
  const owned = expand(source)
  const slots = owned.slice(0, BATTLE_DECK_LIMIT)
  while (slots.length < BATTLE_DECK_LIMIT) slots.push(null)
  return {
    slots,
    library: uniqueInOrder(owned).map((cardId) => ({ cardId, count: 1 })),
  }
}

export function filledSlotCount(loadout: DeckLoadout): number {
  return loadout.slots.filter((cardId) => cardId !== null).length
}

export function isBattleDeckComplete(loadout: DeckLoadout): boolean {
  return loadout.slots.length === BATTLE_DECK_LIMIT && loadout.slots.every((cardId) => cardId !== null)
}

export function toBattleDeck(loadout: DeckLoadout): DeckConfig | null {
  if (!isBattleDeckComplete(loadout)) return null
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const cardId of loadout.slots) {
    if (!cardId) return null
    if (!counts.has(cardId)) order.push(cardId)
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  }
  const cards: DeckEntry[] = order.map((cardId) => ({ cardId: cardId as CardId, count: counts.get(cardId) ?? 0 }))
  return { id: 'player-loadout', name: '出战牌组', cards }
}

function withLibraryCount(library: readonly LibraryEntry[], cardId: string, delta: number): LibraryEntry[] {
  const next = library.map((entry) => ({ ...entry }))
  const index = next.findIndex((entry) => entry.cardId === cardId)
  const count = (index >= 0 ? next[index].count : 0) + delta
  if (count <= 0) {
    if (index >= 0) next.splice(index, 1)
    return next
  }
  if (index >= 0) next[index] = { cardId, count }
  else next.push({ cardId, count })
  return next
}

export function removeFromDeck(loadout: DeckLoadout, slotIndex: number): LoadoutResult {
  const cardId = loadout.slots[slotIndex]
  if (!cardId) return { ok: false, reason: 'empty-slot' }
  const slots = loadout.slots.map((slot, index) => (index === slotIndex ? null : slot))
  return { ok: true, loadout: { slots, library: withLibraryCount(loadout.library, cardId, 1) } }
}

export function placeFromLibrary(loadout: DeckLoadout, cardId: string, slotIndex?: number): LoadoutResult {
  const entry = loadout.library.find((candidate) => candidate.cardId === cardId)
  if (!entry || entry.count <= 0) return { ok: false, reason: 'not-in-library' }
  const target = slotIndex ?? loadout.slots.findIndex((slot) => slot === null)
  if (target < 0 || target >= loadout.slots.length) return { ok: false, reason: 'deck-full' }
  if (loadout.slots[target] !== null) return { ok: false, reason: 'occupied' }
  const slots = loadout.slots.map((slot, index) => (index === target ? cardId : slot))
  return { ok: true, loadout: { slots, library: withLibraryCount(loadout.library, cardId, -1) } }
}

export function grantToLibrary(loadout: DeckLoadout, cardId: string, count = 1): LoadoutResult {
  if (!Number.isInteger(count) || count < 1) return { ok: false, reason: 'invalid-count' }
  if (!Object.prototype.hasOwnProperty.call(cardCatalog, cardId)) return { ok: false, reason: 'unknown-card' }
  return { ok: true, loadout: { slots: loadout.slots, library: withLibraryCount(loadout.library, cardId, count) } }
}
