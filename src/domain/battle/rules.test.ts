import { describe, expect, it } from 'vitest'
import { currentPoints, avatarCostOf } from './points'
import { avatar, boardByDef, fat, handByDef, playDef, startBattle, startRun } from '../../test/helpers'

describe('开局与化身', () => {
  it('PC.A00 在手牌，未入场不能打其他牌也不能结束回合', () => {
    const { aggregate: b } = startBattle('MON.N01')
    expect(b.state.hand).toHaveLength(5)
    expect(avatar(b).zone).toBe('hand')
    expect(b.mustPlaceAvatar()).toBe(true)
    expect(b.canEndTurn()).toBe(false)
    expect(b.legalPlays().every((p) => b.state.cards[p.card].isAvatar)).toBe(true)
  })

  it('开战先结算回合开始，占领费用从 0 起，化身入场立刻 +1', () => {
    const { aggregate: b, events } = startBattle('MON.N01')
    expect(b.state.occupy).toBe(0)
    expect(events.some((e) => e.type === 'battle.turnStarted' && e.opening)).toBe(true)
    playDef(b, 'PC.A00', 7)
    expect(avatar(b).zone).toBe('board')
    expect(b.state.occupy).toBe(1)
  })
})

describe('覆盖', () => {
  it('平点覆盖：双方进各自弃牌堆，格变空', () => {
    const { aggregate: b } = startBattle('MON.E01')
    playDef(b, 'PC.A00', 1)
    expect(b.state.board[1]).toBeNull()
    expect(b.state.enemyDiscard.length).toBe(1)
    expect(b.state.discard.some((id) => b.state.cards[id].isAvatar)).toBe(true)
    expect(b.state.result).toMatchObject({ outcome: 'lose', reason: 'avatarGone', avatarCost: 10 })
  })

  it('必须自己当前点更大才能盖', () => {
    const { aggregate: b } = startBattle('MON.N01')
    playDef(b, 'PC.A00', 7)
    expect(() => playDef(b, 'PC.A00', 3)).toThrow()
    const a01 = handByDef(b, 'PC.A01')
    if (a01) expect(() => playDef(b, 'PC.A01', 3)).toThrow()
  })

  it('化身可以被效果指定', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.N03', 'PC.N03', 'PC.N03', 'PC.N03']))
    playDef(b, 'PC.A00', 7)
    const n03 = handByDef(b, 'PC.N03')!
    const legal = b.legalPlays().find((p) => p.card === n03.id)
    expect(legal?.targets).toContain(avatar(b).id)
  })
})

describe('SYS.A 基础与胜负', () => {
  it('A01 回合结束给相邻敌方 MK.A，A02 对标记改为 -4', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.A01', 'PC.A02', 'PC.A02', 'PC.A02'])
    playDef(b, 'PC.A00', 6)
    playDef(b, 'PC.A01', 2)
    b.playerEndTurn()
    const ec = boardByDef(b, 'EC.01')!
    expect(ec.statuses.includes('marked')).toBe(true)
    const before = currentPoints(b.state, ec)
    playDef(b, 'PC.A02', undefined, 'EC.01')
    expect(currentPoints(b.state, ec)).toBe(before - 4)
    expect(ec.statuses.includes('marked')).toBe(false)
  })

  it('场上没有敌方卡立刻胜', () => {
    const { aggregate: b } = startBattle('MON.N02', fat(['PC.N01', 'PC.N01', 'PC.N01', 'PC.N01']))
    playDef(b, 'PC.A00', 5)
    const bait = boardByDef(b, 'EC.08')!
    const n01 = handByDef(b, 'PC.N01')!
    n01.basePoints = currentPoints(b.state, bait) + 1
    playDef(b, 'PC.N01', bait.cell)
    expect(b.state.result).toBeUndefined()
    b.playerEndTurn()
    const row = boardByDef(b, 'EC.07')!
    const n2 = handByDef(b, 'PC.N01')!
    n2.basePoints = currentPoints(b.state, row) + 1
    playDef(b, 'PC.N01', row.cell)
    expect(b.state.result).toMatchObject({ outcome: 'win', reason: 'clear' })
  })

  it('没有可打出的手牌只看牌组空且费用不够；满场不是失败', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.A03', 'PC.A03', 'PC.A03', 'PC.A03']))
    playDef(b, 'PC.A00', 7)
    expect(b.state.deck.length).toBeGreaterThan(0)
    b.playerEndTurn()
    expect(b.state.result?.reason).not.toBe('noPlay')
  })

  it('回合开始玩家总点数更大则胜', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.A02']))
    playDef(b, 'PC.A00', 7)
    const ec = boardByDef(b, 'EC.01')!
    ec.permanent = -28
    b.playerEndTurn()
    expect(b.state.result).toMatchObject({ outcome: 'win', reason: 'lead' })
  })

  it('0 点敌卡不自动离场', () => {
    const { aggregate: b } = startBattle('MON.N02', ['PC.A02', 'PC.A02', 'PC.A02', 'PC.A02'])
    playDef(b, 'PC.A00', 5)
    const bait = boardByDef(b, 'EC.08')!
    bait.permanent = -99
    expect(currentPoints(b.state, bait)).toBe(0)
    expect(bait.zone).toBe('board')
    expect(b.state.board[bait.cell!]).toBe(bait.id)
  })

  it('化身未入场时代价按初始化身点数计', () => {
    const { aggregate: b } = startBattle('MON.N01')
    expect(avatarCostOf(b.state)).toBe(10)
    playDef(b, 'PC.A00', 7)
    expect(avatarCostOf(b.state)).toBe(0)
  })

  it('EC.02 回合结束生成 EC.03', () => {
    const { aggregate: b } = startBattle('MON.E01', fat(['PC.A02']))
    playDef(b, 'PC.A00', 7)
    b.playerEndTurn()
    expect(boardByDef(b, 'EC.03')).toBeTruthy()
  })

  it('ME.01 相邻己方各 +1', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.N01']), { mapEffect: 'ME.01' })
    playDef(b, 'PC.A00', 7)
    playDef(b, 'PC.N01', 8)
    expect(currentPoints(b.state, avatar(b))).toBe(11)
    expect(currentPoints(b.state, boardByDef(b, 'PC.N01')!)).toBe(6)
  })
})

describe('GameService SYS.A 外部行为', () => {
  it('开局可选 DK.A，化身不进卡盒', async () => {
    const game = await startRun('DK.A', 2)
    const run = game.ask({ type: 'run.view' })!
    expect(run.deckId).toBe('DK.A')
    expect(run.avatarDefId).toBe('PC.A00')
    expect(run.box).not.toContain('PC.A00')
    expect(run.box).toHaveLength(10)
    expect(run.deck).toHaveLength(10)
    expect(run.nodes).toHaveLength(18)
  })
})
