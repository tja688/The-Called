import { describe, expect, it } from 'vitest'
import { beginBattle, createCampaign } from '../../meta'
import { SCIENCE_DECK_NOTICE, commitDeckEdit, viewDeckEditor } from './deck'

describe('v6 deck editor view', () => {
  it('shows the box, the 15-card deck, gold, and the science-only notice without load', () => {
    const campaign = createCampaign()
    const view = viewDeckEditor(campaign)

    expect(view.gold).toBe(0)
    expect(view.box).toHaveLength(15)
    expect(view.deck).toHaveLength(15)
    expect(view.deck.map((card) => card.name)).toEqual(campaign.deck)
    expect(view.scienceNotice).toBe('目前只能从科学牌组出发。')
    expect(view.scienceNotice).toBe(SCIENCE_DECK_NOTICE)
    expect(view.editable).toBe(true)
    expect(view.battleLock).toBeNull()
    expect(JSON.stringify(view)).not.toContain('负荷')
    expect(Object.keys(view.deck[0] ?? {})).not.toContain('load')
  })

  it('says the deck cannot be edited while a battle is open', () => {
    const view = viewDeckEditor(beginBattle(createCampaign()))

    expect(view.editable).toBe(false)
    expect(view.battleLock).toBe('战斗中不能编辑牌组')
    expect(view.scienceNotice).toBe(SCIENCE_DECK_NOTICE)
    expect(view.deck).toHaveLength(15)
  })

  it('refuses to save a 14-card deck', () => {
    const campaign = createCampaign()
    const saved = commitDeckEdit(campaign, campaign.deck.slice(0, 14))

    expect(saved.ok).toBe(false)
    if (saved.ok) return
    expect(saved.message).toBe('牌组必须正好 15 张')
    expect(saved.state.deck).toEqual(campaign.deck)
    expect(saved.state.deck).toHaveLength(15)
  })
})
