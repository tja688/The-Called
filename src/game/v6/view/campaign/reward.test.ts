import { describe, expect, it } from 'vitest'
import {
  COPY_LIMIT_MESSAGE,
  HUGE_CARD_BACK_NOTICE,
  beginBattle,
  createCampaign,
  finishBattle,
} from '../../meta'
import { includeReward, rewardView } from './reward'

describe('v6 reward view', () => {
  it('shows 50 gold, the microscope and the turret after beating the runaway machine, and rejects the sampler', () => {
    const started = createCampaign()
    const won = finishBattle(beginBattle(started), 'runaway-machine', true)
    const view = rewardView(won, 'runaway-machine', started.gold)

    expect(view.goldGained).toBe(50)
    expect(view.goldText).toBe('获得 50 金币')
    expect(view.includable).toEqual(['显微镜', '攻击炮台'])
    expect(view.includable).not.toContain('弱点采样机')
    expect(view.rejected).toEqual([
      {
        name: '弱点采样机',
        reason: COPY_LIMIT_MESSAGE,
        text: `弱点采样机：${COPY_LIMIT_MESSAGE}`,
      },
    ])
    expect(view.hugeCardBackNotice).toBeNull()
  })

  it('keeps the deck at 15 and includes the microscope when it replaces a card', () => {
    const started = createCampaign()
    const won = finishBattle(beginBattle(started), 'runaway-machine', true)
    const replaced = includeReward(won.state, '显微镜', 0)

    expect(replaced.ok).toBe(true)
    if (!replaced.ok) return
    expect(replaced.state.deck).toHaveLength(15)
    expect(replaced.state.deck).toContain('显微镜')
    expect(replaced.state.deck[0]).toBe('显微镜')
  })

  it('leaves the microscope out of the deck when the reward is skipped', () => {
    const started = createCampaign()
    const won = finishBattle(beginBattle(started), 'runaway-machine', true)
    const skipped = includeReward(won.state, '显微镜', null)

    expect(skipped.ok).toBe(true)
    if (!skipped.ok) return
    expect(skipped.state.deck).toEqual(won.state.deck)
    expect(skipped.state.deck).toHaveLength(15)
    expect(skipped.state.deck).not.toContain('显微镜')
  })

  it('shows the huge card back sentence without changing its wording', () => {
    const started = createCampaign()
    const won = finishBattle(beginBattle(started), 'bell-warden', true)
    const view = rewardView(won, 'bell-warden', started.gold)

    expect(view.hugeCardBackNotice).toBe(HUGE_CARD_BACK_NOTICE)
    expect(view.goldGained).toBe(150)
  })
})
