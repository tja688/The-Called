import { describe, expect, it } from 'vitest'
import { currentPoints, woundEstimate } from './points'
import { BattleAggregate } from './BattleAggregate'
import { avatar, boardByDef, playDef, startBattle } from '../../test/helpers'

describe('覆盖', () => {
  it('相等不能盖', () => {
    const { aggregate: b } = startBattle('yuZhuang', ['P02', 'P04', 'P05', 'P01'])
    playDef(b, 'AVATAR', 7)
    const yu = boardByDef(b, 'E1A')!
    expect(currentPoints(b.state, yu)).toBe(5)
    expect(() => playDef(b, 'P02', yu.cell)).toThrow()
  })

  it('化身盖重心后当前 3，伤口预估 7', () => {
    const { aggregate: b } = startBattle('yuZhuang')
    playDef(b, 'AVATAR', 5)
    expect(currentPoints(b.state, avatar(b))).toBe(3)
    expect(woundEstimate(b.state)).toBe(7)
  })
})

describe('封印与领先', () => {
  it('领先检查在封印解除之前，封口可以过检', () => {
    const { aggregate: b } = startBattle('yuZhuang', ['P01', 'P01', 'P07', 'P06', 'P02', 'P03'])
    playDef(b, 'AVATAR', 7)
    playDef(b, 'P01', 4)
    playDef(b, 'P01', 8)
    b.playerEndTurn()
    playDef(b, 'P07', undefined, 'E1B')
    expect(b.state.leading || b.viewPoints().player > b.viewPoints().enemy).toBe(true)
    b.playerEndTurn()
    expect(b.state.result).toMatchObject({ outcome: 'win', reason: 'lead' })
  })
})

describe('压迫', () => {
  it('盯人：相邻且化身 ≤5 则驱离', () => {
    const { aggregate: b } = startBattle('boShou')
    playDef(b, 'AVATAR', 2)
    avatar(b).permanent = -6
    b.playerEndTurn()
    expect(b.state.result).toMatchObject({ outcome: 'lose', reason: 'avatarGone' })
  })

  it('守门人：结算前化身 ≤3 则驱离', () => {
    const { aggregate: b } = startBattle('shouMen')
    playDef(b, 'AVATAR', 7)
    avatar(b).permanent = -8
    expect(currentPoints(b.state, avatar(b))).toBe(3)
    b.playerEndTurn()
    expect(b.state.result).toMatchObject({ outcome: 'lose', reason: 'avatarGone' })
  })
})

describe('夹层抽牌', () => {
  it('handDelta=1 时开战手牌为化身 +5', () => {
    const { aggregate: b } = startBattle('boShou', undefined, 1)
    expect(b.state.hand.length).toBe(6)
    expect(b.state.hand.filter((id) => b.state.cards[id].isAvatar).length).toBe(1)
  })
})

describe('预览', () => {
  it('previewPlay 不改写模型', () => {
    const { aggregate: b } = startBattle('yuZhuang')
    const av = avatar(b)
    const before = structuredClone(b.state)
    const preview = b.previewPlay(av.id, 7)
    expect(preview?.avatar).toBe(11)
    expect(b.state).toEqual(before)
  })
})

describe('clone', () => {
  it('fromState 可继续打', () => {
    const { aggregate: b } = startBattle('yuZhuang')
    playDef(b, 'AVATAR', 7)
    const copy = BattleAggregate.fromState(b.state)
    expect(copy.canEndTurn()).toBe(true)
  })
})
