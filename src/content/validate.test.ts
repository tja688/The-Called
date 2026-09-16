import { describe, expect, it } from 'vitest'
import { content, validateContent } from './index'
import { ENCOUNTERS } from './encounters'
import { ANCHORS } from './anchors'

describe('内容表', () => {
  it('启动校验通过，开局点数对得上锚点', () => {
    expect(() => validateContent()).not.toThrow()
    expect(ENCOUNTERS.yuZhuang.openingFinal).toBe(ANCHORS.openingFinal.yuZhuang)
    expect(ENCOUNTERS.boShou.openingFinal).toBe(ANCHORS.openingFinal.boShou)
    expect(ENCOUNTERS.shouMen.openingFinal).toBe(ANCHORS.openingFinal.shouMen)
    expect(content().echoDeck.length).toBe(10)
  })
})
