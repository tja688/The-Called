import { describe, expect, it } from 'vitest'
import { validateContent } from './index'
import { playerCardIds, isRewardable, CARDS } from './cards'
import { poolFor } from './encounters'
import { STARTING_DECKS } from './decks'

describe('内容表', () => {
  it('启动校验通过，39 张玩家卡，奖励池不含基础与负面', () => {
    expect(() => validateContent()).not.toThrow()
    expect(playerCardIds()).toHaveLength(39)
    expect(STARTING_DECKS['DK.A'].cards).toHaveLength(10)
    expect(STARTING_DECKS['DK.A'].avatar).toBe('PC.A00')
    const normals = ['MON.N01', 'MON.N02', 'MON.N04', 'MON.N05', 'MON.N06']
    for (const floor of [1, 2, 3] as const) {
      expect(poolFor('normal', floor).map((e) => e.id).sort()).toEqual(normals)
      expect(poolFor('elite', floor).map((e) => e.id)).toEqual(['MON.E01'])
      expect(poolFor('boss', floor).map((e) => e.id)).toEqual(['MON.B01'])
    }
    for (const c of Object.values(CARDS)) {
      if (c.rarity === 'basic' || c.extra === 'negative' || c.id.startsWith('EC.')) {
        expect(isRewardable(c.id)).toBe(false)
      }
    }
  })
})
