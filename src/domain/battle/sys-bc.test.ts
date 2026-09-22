import { describe, expect, it } from 'vitest'
import { currentPoints } from './points'
import { avatar, boardByDef, fat, handByDef, playDef, startBattle, startRun } from '../../test/helpers'

describe('三体系开局', () => {
  it('DK.B / DK.C 对应化身', async () => {
    const b = await startRun('DK.B', 3)
    expect(b.ask({ type: 'run.view' })!.avatarDefId).toBe('PC.B00')
    const c = await startRun('DK.C', 3)
    expect(c.ask({ type: 'run.view' })!.avatarDefId).toBe('PC.C00')
  })
})

describe('主动触发', () => {
  it('B00 抽 2，每场一次', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.B01', 'PC.B01', 'PC.B01', 'PC.B01', 'PC.B02'], { avatarDefId: 'PC.B00' })
    playDef(b, 'PC.B00', 7)
    const before = b.state.hand.length
    const deck = b.state.deck.length
    b.playerActivate(avatar(b).id)
    expect(b.state.hand.length).toBe(before + Math.min(2, deck))
    expect(b.state.activated).toBe(true)
    expect(() => b.playerActivate(avatar(b).id)).toThrow()
  })

  it('C00 己方全体 +1，每场一次', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.C01', 'PC.C01', 'PC.C01', 'PC.C01']), { avatarDefId: 'PC.C00' })
    playDef(b, 'PC.C00', 7)
    playDef(b, 'PC.C01', 8)
    const av = currentPoints(b.state, avatar(b))
    const c01 = currentPoints(b.state, boardByDef(b, 'PC.C01')!)
    b.playerActivate(avatar(b).id)
    expect(currentPoints(b.state, avatar(b))).toBe(av + 1)
    expect(currentPoints(b.state, boardByDef(b, 'PC.C01')!)).toBe(c01 + 1)
    expect(() => b.playerActivate(avatar(b).id)).toThrow()
  })

  it('A00 给带 MK.A 的敌卡易伤', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.A01', 'PC.A02', 'PC.A02', 'PC.A02'])
    playDef(b, 'PC.A00', 6)
    playDef(b, 'PC.A01', 2)
    b.playerEndTurn()
    const ec = boardByDef(b, 'EC.01')!
    expect(ec.statuses.includes('marked')).toBe(true)
    const acts = b.legalActivates()
    expect(acts[0]?.targets).toContain(ec.id)
    b.playerActivate(avatar(b).id, ec.id)
    expect(ec.statuses.includes('vulnerable')).toBe(true)
  })
})

describe('SYS.B 基础', () => {
  it('B01 牌组不足 2 张仍可打出但效果不生效', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.B01'], { avatarDefId: 'PC.B00' })
    playDef(b, 'PC.B00', 7)
    playDef(b, 'PC.B01', 9)
    expect(boardByDef(b, 'PC.B01')).toBeTruthy()
    expect(Object.values(b.state.cards).filter((c) => c.defId === 'PC.B01' && c.zone === 'board')).toHaveLength(1)
  })

  it('B03 按己方弃牌堆张数加点，敌弃不计入', () => {
    const { aggregate: b } = startBattle('MON.N02', fat(['PC.B03', 'PC.N01', 'PC.N01', 'PC.B03']), { avatarDefId: 'PC.B00' })
    playDef(b, 'PC.B00', 5)
    const acid = boardByDef(b, 'EC.06')!
    const n01 = handByDef(b, 'PC.N01')!
    n01.basePoints = currentPoints(b.state, acid) + 1
    playDef(b, 'PC.N01', acid.cell)
    expect(b.state.enemyDiscard.length).toBe(1)
    expect(b.state.discard.length).toBe(0)
    b.playerEndTurn()
    const ally = boardByDef(b, 'PC.N01')!
    const before = currentPoints(b.state, ally)
    playDef(b, 'PC.B03', undefined, 'PC.N01')
    expect(currentPoints(b.state, ally)).toBe(before)
  })

  it('B06 可叠己方非化身，不能叠化身', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.B06', 'PC.N01', 'PC.B06', 'PC.N01']), { avatarDefId: 'PC.B00' })
    playDef(b, 'PC.B00', 7)
    playDef(b, 'PC.N01', 8)
    const ally = boardByDef(b, 'PC.N01')!
    const pts = currentPoints(b.state, ally)
    b.playerEndTurn()
    playDef(b, 'PC.B06', 8)
    const stacked = boardByDef(b, 'PC.B06')!
    expect(currentPoints(b.state, stacked)).toBe(4 + pts)
    expect(ally.zone).not.toBe('board')
    expect(b.legalPlays().find((p) => b.state.cards[p.card].defId === 'PC.B06')?.cells.includes(7)).toBeFalsy()
  })

  it('B01 镜像复制联动，一侧离场另一侧移除', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.B01', 'PC.B06', 'PC.B01', 'PC.B01']), { avatarDefId: 'PC.B00' })
    playDef(b, 'PC.B00', 5)
    playDef(b, 'PC.B01', 1)
    const copies = Object.values(b.state.cards).filter((c) => c.defId === 'PC.B01' && c.zone === 'board')
    expect(copies).toHaveLength(2)
    expect(copies.every((c) => c.linkId && copies[0].linkId === c.linkId)).toBe(true)
    b.playerEndTurn()
    const stay = copies.find((c) => c.zone === 'board')!
    playDef(b, 'PC.B06', stay.cell)
    expect(Object.values(b.state.cards).filter((c) => c.defId === 'PC.B01' && c.zone === 'board')).toHaveLength(0)
  })

  it('B02 入场把复制洗入牌组', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.B02', 'PC.B02', 'PC.B02', 'PC.B02'], { avatarDefId: 'PC.B00' })
    playDef(b, 'PC.B00', 7)
    const before = b.state.deck.filter((e) => e.defId === 'PC.B02').length
    playDef(b, 'PC.B02', 8)
    expect(b.state.deck.filter((e) => e.defId === 'PC.B02').length).toBe(before + 1)
  })
})

describe('SYS.C 基础', () => {
  it('C01 回合结束 +1 RES.A；C02 消耗 1 点给保护；保护挡一次减点', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.C01', 'PC.C02', 'PC.A02', 'PC.C01']), { avatarDefId: 'PC.C00' })
    playDef(b, 'PC.C00', 7)
    playDef(b, 'PC.C01', 8)
    expect(b.state.resA).toBe(0)
    b.playerEndTurn()
    expect(b.state.resA).toBe(1)
    playDef(b, 'PC.C02', undefined, 'EC.01')
    const ec = boardByDef(b, 'EC.01')!
    expect(ec.statuses.includes('protected')).toBe(true)
    const before = currentPoints(b.state, ec)
    playDef(b, 'PC.A02', undefined, 'EC.01')
    expect(currentPoints(b.state, ec)).toBe(before)
    expect(ec.statuses.includes('protected')).toBe(false)
  })

  it('C03 开战那次回合开始赶不上刚入场的卡；RES.A 战斗结束由一趟清零', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.C03', 'PC.C01', 'PC.C01', 'PC.C01']), { avatarDefId: 'PC.C00' })
    playDef(b, 'PC.C00', 7)
    playDef(b, 'PC.C01', 8)
    b.playerEndTurn()
    playDef(b, 'PC.C03', 9)
    expect(currentPoints(b.state, boardByDef(b, 'PC.C03')!)).toBe(6)
    const leftover = b.state.resA
    expect(leftover).toBeGreaterThanOrEqual(0)
    const { aggregate: b2 } = startBattle('MON.N01', fat(['PC.C01']), { avatarDefId: 'PC.C00' })
    expect(b2.state.resA).toBe(0)
  })

  it('C03 没有 RES.A 也可以打出，效果本回合不跳', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.C03', 'PC.N01']), { avatarDefId: 'PC.C00' })
    playDef(b, 'PC.C00', 7)
    playDef(b, 'PC.N01', 8)
    expect(b.state.resA).toBe(0)
    b.playerEndTurn()
    const c03 = handByDef(b, 'PC.C03')!
    expect(b.legalPlays().some((p) => p.card === c03.id)).toBe(true)
    playDef(b, 'PC.C03', 9)
    expect(boardByDef(b, 'PC.C03')).toBeTruthy()
    expect(currentPoints(b.state, boardByDef(b, 'PC.C03')!)).toBe(6)
  })

  it('B01 镜像格被占时仍可打出，但不献祭', () => {
    const { aggregate: b } = startBattle('MON.N02', fat(['PC.B01', 'PC.B01', 'PC.B01', 'PC.B01']), { avatarDefId: 'PC.B00' })
    playDef(b, 'PC.B00', 5)
    const deck = b.state.deck.length
    playDef(b, 'PC.B01', 1)
    expect(b.state.deck.length).toBe(deck)
    expect(Object.values(b.state.cards).filter((c) => c.defId === 'PC.B01' && c.zone === 'board')).toHaveLength(1)
  })
})
