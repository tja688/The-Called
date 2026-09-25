import { describe, expect, it } from 'vitest'
import { getCardDefinition } from './cardCatalog'
import {
  beginnerMonsterDeck,
  monsterDeckForLevel,
  moonDeck,
  rahuKetuDeck,
  svarbhanuBeginnerDeck,
} from './decks'

function copies(deck: { cards: readonly { cardId: string; count: number }[] }) {
  return deck.cards.reduce((sum, entry) => sum + entry.count, 0)
}

function basePower(deck: { cards: readonly { cardId: string; count: number }[] }) {
  return deck.cards.reduce((sum, entry) => sum + getCardDefinition(entry.cardId).power * entry.count, 0)
}

function signature(cardId: string) {
  const card = getCardDefinition(cardId)
  return `${card.power}:${JSON.stringify(card.effect)}`
}

describe('level monster decks', () => {
  it('keeps the first encounter deck and maps each level', () => {
    expect(svarbhanuBeginnerDeck).toBe(beginnerMonsterDeck)
    expect(beginnerMonsterDeck.id).toBe('monster-beginner')
    expect(copies(beginnerMonsterDeck)).toBe(12)
    expect(monsterDeckForLevel('level-01')).toBe(beginnerMonsterDeck)
    expect(monsterDeckForLevel('level-02')).toBe(rahuKetuDeck)
    expect(monsterDeckForLevel('level-03')).toBe(moonDeck)
    expect(() => monsterDeckForLevel('level-09')).toThrow(/Unknown level/)
  })

  it('gives Rahu & Ketu and Moon twelve cards of seven kinds', () => {
    for (const deck of [rahuKetuDeck, moonDeck]) {
      expect(copies(deck)).toBe(12)
      expect(deck.cards).toHaveLength(7)
    }
    expect(basePower(rahuKetuDeck)).toBe(45)
    expect(basePower(moonDeck)).toBe(46)
    expect(rahuKetuDeck.id).toBe('rahu-ketu')
    expect(moonDeck.id).toBe('moon')
  })

  it('keeps enemy power-and-effect pairs unique, and new player cards distinct from them', () => {
    const enemyIds = [beginnerMonsterDeck, rahuKetuDeck, moonDeck].flatMap((deck) => deck.cards.map((entry) => entry.cardId))
    expect(new Set(enemyIds.map(signature)).size).toBe(enemyIds.length)
    const fresh = ['player_antipode', 'player_meridian', 'player_center_condition', 'player_syzygy']
    for (const cardId of fresh) expect(enemyIds.map(signature)).not.toContain(signature(cardId))
  })
})
