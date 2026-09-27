import { describe, expect, it } from 'vitest'
import { getCardByName, scienceStarter } from '../content'
import {
  COPY_LIMIT_MESSAGE,
  HUGE_CARD_BACK_NOTICE,
  addCardToBox,
  beginBattle,
  createCampaign,
  editDeck,
  finishBattle,
  includeRewardCard,
  setInBattleDeck,
} from './index'

function copies(cards: readonly string[], name: string): number {
  return cards.filter((card) => card === name).length
}

describe('v6 meta deck, box, rewards', () => {
  it('starts with 0 gold and 15 white science-starter cards in both deck and box', () => {
    const campaign = createCampaign()
    expect(campaign.gold).toBe(0)
    expect(campaign.deck).toEqual([...scienceStarter])
    expect(campaign.box).toEqual([...scienceStarter])
    expect(campaign.deck).toHaveLength(15)
    expect(campaign.box).toHaveLength(15)
    expect(campaign.inBattle).toBe(false)
    for (const name of campaign.deck) {
      expect(getCardByName(name)?.rarity).toBe('white')
    }
  })

  it('rejects a 14-card deck and a 16-card deck', () => {
    const campaign = createCampaign()
    const short = editDeck(campaign, scienceStarter.slice(0, 14))
    const long = editDeck(campaign, [...scienceStarter, '斥候'])
    expect(short.ok).toBe(false)
    expect(long.ok).toBe(false)
    if (short.ok || long.ok) return
    expect(short.message).toBe('牌组必须正好 15 张')
    expect(long.message).toBe('牌组必须正好 15 张')
    expect(short.state.deck).toEqual(campaign.deck)
    expect(long.state.deck).toEqual(campaign.deck)
    expect(short.state.gold).toBe(0)
    expect(long.state.box).toEqual(campaign.box)

    const reordered = editDeck(campaign, [...scienceStarter].reverse())
    expect(reordered.ok).toBe(true)
    if (!reordered.ok) return
    expect(reordered.state.deck).toHaveLength(15)
  })

  it('refuses deck edits during battle', () => {
    const campaign = createCampaign()
    const battle = beginBattle(campaign)
    const edited = editDeck(battle, [...battle.deck])
    expect(battle.inBattle).toBe(true)
    expect(edited.ok).toBe(false)
    if (edited.ok) return
    expect(edited.message).toBe('战斗中不能编辑牌组')
    expect(edited.state.deck).toEqual(campaign.deck)
    expect(edited.state.box).toEqual(campaign.box)
  })

  it('restores the deck after beating the runaway machine, pays 50 gold, and boxes the listed cards but not the marked striker', () => {
    const started = createCampaign()
    const battle = setInBattleDeck(beginBattle(started), [])
    const won = finishBattle(battle, 'runaway-machine', true)

    expect(won.state.inBattle).toBe(false)
    expect(won.state.deck).toEqual(started.deck)
    expect(won.state.deck).toHaveLength(15)
    expect(won.state.deck).not.toContain('显微镜')
    expect(won.state.gold).toBe(50)
    expect(copies(won.state.box, '显微镜')).toBe(copies(started.box, '显微镜') + 1)
    expect(copies(won.state.box, '攻击炮台')).toBe(copies(started.box, '攻击炮台') + 1)
    expect(won.state.box).toContain('弱点采样机')
    expect(copies(won.state.box, '弱点采样机')).toBe(3)
    expect(won.messages).toContain(COPY_LIMIT_MESSAGE)
    expect(won.state.gold).toBe(50)
    expect(won.state.box).not.toContain('弱点攻击器')
    expect(won.addedCardNames).toEqual(['显微镜', '攻击炮台'])
  })

  it('leaves gold and the box unchanged after a loss, and still restores the deck', () => {
    const started = createCampaign()
    const battle = setInBattleDeck(beginBattle(started), ['碎掉'])
    const lost = finishBattle(battle, 'runaway-machine', false)

    expect(lost.state.deck).toEqual(started.deck)
    expect(lost.state.gold).toBe(started.gold)
    expect(lost.state.box).toEqual(started.box)
    expect(lost.addedCardNames).toEqual([])
    expect(lost.messages).toEqual([])
    expect(lost.state.notices).toEqual([])
  })

  it('refuses the 4th white, the 3rd blue, and the 2nd gold copy without paying salvage gold', () => {
    let state = createCampaign()
    const gold = state.gold
    for (let i = 0; i < 3; i += 1) {
      const added = addCardToBox(state, '校准仪')
      expect(added.ok).toBe(true)
      if (!added.ok) return
      state = added.state
    }
    const fourthWhite = addCardToBox(state, '校准仪')
    expect(fourthWhite.ok).toBe(false)
    if (fourthWhite.ok) return
    expect(fourthWhite.message).toBe(COPY_LIMIT_MESSAGE)
    expect(copies(fourthWhite.state.box, '校准仪')).toBe(3)
    expect(fourthWhite.state.gold).toBe(gold)

    for (let i = 0; i < 2; i += 1) {
      const added = addCardToBox(state, '连锁引爆')
      expect(added.ok).toBe(true)
      if (!added.ok) return
      state = added.state
    }
    const thirdBlue = addCardToBox(state, '连锁引爆')
    expect(thirdBlue.ok).toBe(false)
    if (thirdBlue.ok) return
    expect(thirdBlue.message).toBe(COPY_LIMIT_MESSAGE)
    expect(copies(thirdBlue.state.box, '连锁引爆')).toBe(2)
    expect(thirdBlue.state.gold).toBe(gold)

    const firstGold = addCardToBox(state, '勇士')
    expect(firstGold.ok).toBe(true)
    if (!firstGold.ok) return
    const secondGold = addCardToBox(firstGold.state, '勇士')
    expect(secondGold.ok).toBe(false)
    if (secondGold.ok) return
    expect(secondGold.message).toBe(COPY_LIMIT_MESSAGE)
    expect(copies(secondGold.state.box, '勇士')).toBe(1)
    expect(secondGold.state.gold).toBe(gold)
  })

  it('keeps 15 cards when a new reward replaces one, and leaves the deck unchanged when skipped', () => {
    const started = createCampaign()
    const won = finishBattle(beginBattle(started), 'runaway-machine', true)
    expect(won.state.deck).toEqual(started.deck)

    const skipped = includeRewardCard(won.state, '显微镜', null)
    expect(skipped.ok).toBe(true)
    if (!skipped.ok) return
    expect(skipped.state.deck).toEqual(won.state.deck)
    expect(skipped.state.deck).toHaveLength(15)
    expect(copies(skipped.state.box, '显微镜')).toBe(1)

    const replaced = includeRewardCard(won.state, '显微镜', 0)
    expect(replaced.ok).toBe(true)
    if (!replaced.ok) return
    expect(replaced.state.deck).toHaveLength(15)
    expect(replaced.state.deck[0]).toBe('显微镜')
    expect(replaced.state.deck.filter((name) => name === started.deck[0])).toHaveLength(
      copies(started.deck, started.deck[0]) - 1,
    )
    expect(copies(replaced.state.box, started.deck[0]!)).toBe(copies(won.state.box, started.deck[0]!))
    expect(replaced.state.box).toEqual(won.state.box)
  })

  it('records only the huge-card-back sentence for the bell warden and the caller', () => {
    const bell = finishBattle(beginBattle(createCampaign()), 'bell-warden', true)
    expect(bell.messages).toEqual([HUGE_CARD_BACK_NOTICE])
    expect(bell.state.notices).toEqual([HUGE_CARD_BACK_NOTICE])
    expect(bell.state.gold).toBe(150)
    expect(bell.state.box).toHaveLength(19)
    expect(bell.state.deck).toHaveLength(15)
    expect(bell.state.deck).not.toContain('圣杯')

    const caller = finishBattle(beginBattle(createCampaign()), 'the-caller', true)
    expect(caller.messages).toEqual([HUGE_CARD_BACK_NOTICE])
    expect(caller.state.gold).toBe(200)
    expect(caller.state.box).toHaveLength(19)
    expect(caller.state.deck).not.toContain('圣女')
  })

  it('pays a full reward again on a repeated victory', () => {
    const first = finishBattle(beginBattle(createCampaign()), 'runaway-machine', true)
    const second = finishBattle(beginBattle(first.state), 'runaway-machine', true)
    expect(second.state.gold).toBe(100)
    expect(copies(second.state.box, '攻击炮台')).toBe(3)
    expect(copies(second.state.box, '显微镜')).toBe(1)
    expect(second.messages).toContain(COPY_LIMIT_MESSAGE)
    expect(second.state.box).not.toContain('弱点攻击器')
  })

  it('keeps the sage out of the box and the deck', () => {
    const campaign = createCampaign()
    const boxed = addCardToBox(campaign, '智者')
    expect(boxed.ok).toBe(false)
    if (boxed.ok) return
    expect(boxed.state.box).not.toContain('智者')
    expect(boxed.message).toBe('智者不能进入卡盒')

    const deck = [...scienceStarter]
    deck[0] = '智者'
    const edited = editDeck(campaign, deck)
    expect(edited.ok).toBe(false)
    if (edited.ok) return
    expect(edited.message).toBe('智者不能进入牌组')
    expect(edited.state.deck).toEqual(campaign.deck)
  })

  it('refuses a deck that the box cannot pay for', () => {
    const campaign = createCampaign()
    const unpaid = editDeck(campaign, Array.from({ length: 15 }, () => '斥候'))
    expect(unpaid.ok).toBe(false)
    if (unpaid.ok) return
    expect(unpaid.message).toBe('卡盒里没有足够的副本支付这张牌')
    expect(unpaid.state.deck).toEqual(campaign.deck)
  })
})
