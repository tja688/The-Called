import { describe, expect, it } from 'vitest'
import { fictionText } from './fiction'

describe('fictionText', () => {
  it('把规则 Key 换成玩家可见名', () => {
    expect(fictionText('消耗 1 点 RES.A，使一张卡牌获得保护。')).toBe('消耗 1 点 圣油，使一张卡牌获得保护。')
    expect(fictionText('为一张相邻敌方卡牌添加 MK.A。')).toBe('为一张相邻敌方卡牌添加 猎印。')
  })
})
