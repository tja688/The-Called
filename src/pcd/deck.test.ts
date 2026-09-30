import { describe, expect, it } from 'vitest'
import { clearSlot, filled, parseBuild, placeCard, setBack, starterBuild, DECK_SIZE } from './deck'
import type { PcdCatalog } from './types'

const catalog = {
  decks: [{ id: 'deck.science', name: '科学', cards: Array.from({ length: 15 }, (_, index) => `card.c00${(index % 3) + 1}`), load: 40 }],
} as PcdCatalog

describe('本机构筑', () => {
  it('预设牌组占满 15 张，空卡背', () => {
    const build = starterBuild(catalog)
    expect(build.slots).toHaveLength(DECK_SIZE)
    expect(build.slots.every((slot) => slot?.backId === '')).toBe(true)
    expect(filled(build).cards).toHaveLength(15)
  })

  it('空位才能放入，卡背跟在这一张上', () => {
    const build = clearSlot(starterBuild(catalog), 3)
    expect(filled(build).cards).toHaveLength(14)
    const placed = placeCard(build, 'card.c004')
    expect(placed.slots[3]).toEqual({ cardId: 'card.c004', backId: '' })
    const backed = setBack(placed, 3, 'back.002')
    expect(filled(backed).backs[3]).toBe('back.002')
    expect(placeCard(backed, 'card.c009')).toBe(backed)
  })

  it('只接受 15 个槽位的存档', () => {
    const build = setBack(starterBuild(catalog), 0, 'back.002')
    expect(parseBuild(JSON.stringify(build))).toEqual(build)
    expect(parseBuild(JSON.stringify({ slots: [] }))).toBeNull()
    expect(parseBuild('nope')).toBeNull()
  })
})
