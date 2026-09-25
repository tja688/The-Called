import { describe, expect, it } from 'vitest'
import { beginnerPlayerDeck } from './decks'
import {
  BATTLE_DECK_LIMIT,
  createDefaultLoadout,
  grantToLibrary,
  isBattleDeckComplete,
  placeFromLibrary,
  removeFromDeck,
  toBattleDeck,
} from './deckLoadout'

describe('deck loadout', () => {
  it('starts with the owned deck filled and one spare of each kind', () => {
    const loadout = createDefaultLoadout()
    const owned = beginnerPlayerDeck.cards.reduce((sum, entry) => sum + entry.count, 0)
    expect(owned).toBe(BATTLE_DECK_LIMIT)
    expect(isBattleDeckComplete(loadout)).toBe(true)
    expect(toBattleDeck(loadout)?.cards).toEqual(beginnerPlayerDeck.cards)
    expect(loadout.library).toEqual(beginnerPlayerDeck.cards.map((entry) => ({ cardId: entry.cardId, count: 1 })))
  })

  it('returns a deck card to the library and opens that slot', () => {
    const removed = removeFromDeck(createDefaultLoadout(), 0)
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    expect(removed.loadout.slots[0]).toBeNull()
    expect(removed.loadout.library[0]).toEqual({ cardId: 'player_reference_point', count: 2 })
    expect(toBattleDeck(removed.loadout)).toBeNull()
  })

  it('refuses to place a library card until a slot is open', () => {
    const full = placeFromLibrary(createDefaultLoadout(), 'player_falsification')
    expect(full).toEqual({ ok: false, reason: 'deck-full' })

    const removed = removeFromDeck(createDefaultLoadout(), 5)
    if (!removed.ok) throw new Error('expected an open slot')
    const placed = placeFromLibrary(removed.loadout, 'player_falsification', 5)
    expect(placed.ok).toBe(true)
    if (!placed.ok) return
    expect(placed.loadout.slots[5]).toBe('player_falsification')
    expect(placed.loadout.library.find((entry) => entry.cardId === 'player_falsification')).toBeUndefined()
    expect(isBattleDeckComplete(placed.loadout)).toBe(true)
  })

  it('adds external cards to the library only', () => {
    const granted = grantToLibrary(createDefaultLoadout(), 'player_calibration', 2)
    expect(granted.ok).toBe(true)
    if (!granted.ok) return
    expect(granted.loadout.slots).toEqual(createDefaultLoadout().slots)
    expect(granted.loadout.library.find((entry) => entry.cardId === 'player_calibration')?.count).toBe(3)
    expect(grantToLibrary(createDefaultLoadout(), 'missing_card')).toEqual({ ok: false, reason: 'unknown-card' })
    expect(grantToLibrary(createDefaultLoadout(), 'player_calibration', 0)).toEqual({ ok: false, reason: 'invalid-count' })
  })
})
