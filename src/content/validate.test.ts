import { describe, expect, it } from 'vitest'
import { validateContent } from './index'
import { playerCardIds, isRewardable, CARDS } from './cards'
import { poolFor } from './encounters'
import { STARTING_DECKS } from './decks'

describe('内容表', () => {
  it('启动校验通过，58 张玩家卡，奖励池不含基础与负面', () => {
    expect(() => validateContent()).not.toThrow()
    expect(playerCardIds()).toHaveLength(58)
    expect(STARTING_DECKS['DK.A'].cards).toHaveLength(10)
    expect(STARTING_DECKS['DK.A'].avatar).toBe('PC.A00')
    expect(poolFor('normal', 1).map((e) => e.id).sort()).toEqual(['MON.N01', 'MON.N02', 'MON.N03'])
    for (const c of Object.values(CARDS)) {
      if (c.rarity === 'basic' || c.extra === 'negative' || c.id.startsWith('EC.')) {
        expect(isRewardable(c.id)).toBe(false)
      }
    }
  })
})
