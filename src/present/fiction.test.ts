import { describe, expect, it } from 'vitest'
import { emphasizeKeywords, fictionText, keywordTips } from './fiction'

describe('fictionText', () => {
  it('把规则 Key 换成玩家可见名', () => {
    expect(fictionText('消耗 1 点 RES.A，使一张卡牌获得保护。')).toBe('消耗 1 点 法力，使一张卡牌获得保护。')
    expect(fictionText('为一张相邻敌方卡牌添加 MK.A。')).toBe('为一张相邻敌方卡牌添加 印记。')
  })

  it('词条加粗，长词不会拆出短词', () => {
    const marked = emphasizeKeywords('消耗 1 点 RES.A，使一张卡牌获得保护。')
    expect(marked).toContain('**法力**')
    expect(marked).toContain('**保护**')
    const mirror = keywordTips('在镜像格生成一张复制')
    expect(mirror.map((t) => t.name)).toContain('镜像格')
    expect(mirror.map((t) => t.name)).not.toContain('镜像')
    const oil = keywordTips('驻场每回合结束时，获得 1 点 RES.A。', ['保护'])
    expect(oil.map((t) => t.name)).toEqual(expect.arrayContaining(['驻场', '法力', '保护']))
  })
})
