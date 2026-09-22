import { describe, expect, it } from 'vitest'
import { currentPoints, avatarCostOf, finalPoints, markedMoveBlocked } from './points'
import { avatar, boardByDef, fat, handByDef, playDef, startBattle, startRun } from '../../test/helpers'
import { nextInt } from '../../core/Rng'

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

  it('开战先减计时', () => {
    const { aggregate: b } = startBattle('MON.B01', fat(['PC.A02']))
    expect(boardByDef(b, 'EC.04')!.timer).toBe(2)
  })
})

describe('覆盖', () => {
  it('打出覆盖必须自己当前点更大，平点格不可打出', () => {
    const { aggregate: b } = startBattle('MON.E01')
    const av = b.legalPlays().find((p) => b.state.cards[p.card].isAvatar)!
    expect(av.cells.includes(1)).toBe(false)
    expect(av.cells.includes(4)).toBe(true)
    playDef(b, 'PC.A00', 7)
    const a01 = handByDef(b, 'PC.A01')
    if (a01) expect(b.legalPlays().find((p) => p.card === a01.id)?.cells.includes(3)).toBeFalsy()
  })

  it('点数相同的移动覆盖：双方进各自弃牌堆，格变空', () => {
    const { aggregate: b } = startBattle('MON.B01', fat(['PC.A02']))
    for (const c of Object.values(b.state.cards)) {
      if (c.owner === 'enemy' && !(c.defId === 'EC.05' && c.cell === 4)) {
        if (c.cell && b.state.board[c.cell] === c.id) b.state.board[c.cell] = null
        c.zone = 'gone'
        c.cell = undefined
      }
    }
    const mover = boardByDef(b, 'EC.05')!
    const peek = { s: b.state.rng.s }
    const dest = nextInt(peek, 2) === 0 ? 1 : 7
    playDef(b, 'PC.A00', dest as 1 | 7)
    const av = avatar(b)
    av.permanent += currentPoints(b.state, mover) - currentPoints(b.state, av)
    expect(currentPoints(b.state, av)).toBe(currentPoints(b.state, mover))
    b.playerEndTurn()
    expect(b.state.board[dest as 1 | 7]).toBeNull()
    expect(av.zone).not.toBe('board')
    expect(mover.zone).not.toBe('board')
    expect(b.state.result).toMatchObject({ outcome: 'lose', reason: 'avatarGone' })
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
    const acid = boardByDef(b, 'EC.06')!
    const n01 = handByDef(b, 'PC.N01')!
    n01.basePoints = currentPoints(b.state, acid) + 1
    playDef(b, 'PC.N01', acid.cell)
    expect(b.state.result).toBeUndefined()
    b.playerEndTurn()
    const col = boardByDef(b, 'EC.07')!
    const n2 = handByDef(b, 'PC.N01')!
    n2.basePoints = currentPoints(b.state, col) + 1
    playDef(b, 'PC.N01', col.cell)
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
    const bait = boardByDef(b, 'EC.06')!
    bait.permanent = -99
    expect(currentPoints(b.state, bait)).toBe(0)
    expect(bait.zone).toBe('board')
    expect(b.state.board[bait.cell!]).toBe(bait.id)
  })

  it('封印仍提供占领费用，总点数计 0', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.N01']))
    const statue = boardByDef(b, 'EC.01')!
    statue.defId = 'EC.17'
    if (statue.cell && b.state.board[statue.cell] === statue.id) b.state.board[statue.cell] = null
    statue.cell = 5
    b.state.board[5] = statue.id
    playDef(b, 'PC.A00', 2)
    b.playerEndTurn()
    const av = avatar(b)
    expect(av.statuses.includes('sealed')).toBe(true)
    expect(b.state.occupyCap).toBe(1)
    expect(finalPoints(b.state, 'player')).toBe(0)
    expect(currentPoints(b.state, av)).toBeGreaterThan(0)
  })

  it('PC.X01 抽到时化身 -2，然后进弃牌堆', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.X01', 'PC.A02', 'PC.A02', 'PC.A02', 'PC.A02'])
    expect(b.state.hand.some((id) => b.state.cards[id].defId === 'PC.X01')).toBe(false)
    const curse = Object.values(b.state.cards).find((c) => c.defId === 'PC.X01')
    expect(curse?.zone).toBe('discard')
    expect(currentPoints(b.state, avatar(b))).toBe(8)
    expect(b.legalPlays().some((p) => b.state.cards[p.card].defId === 'PC.X01')).toBe(false)
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
    const events = b.playerEndTurn()
    expect(events.some((e) => e.type === 'battle.cardEntered' && b.state.cards[e.card].defId === 'EC.03')).toBe(true)
  })

  it('ME.01 相邻己方各 +1', () => {
    const { aggregate: b } = startBattle('MON.N01', fat(['PC.N01']), { mapEffect: 'ME.01' })
    playDef(b, 'PC.A00', 7)
    playDef(b, 'PC.N01', 8)
    expect(currentPoints(b.state, avatar(b))).toBe(11)
    expect(currentPoints(b.state, boardByDef(b, 'PC.N01')!)).toBe(6)
  })

  it('A09 驻场时被标记的敌卡不能移动', () => {
    const { aggregate: b } = startBattle('MON.N02', fat(['PC.A08', 'PC.A09', 'PC.A14', 'PC.A08']))
    playDef(b, 'PC.A00', 5)
    playDef(b, 'PC.A08', 4)
    b.playerEndTurn()
    playDef(b, 'PC.A08', 6)
    b.playerEndTurn()
    playDef(b, 'PC.A09', 8)
    playDef(b, 'PC.A14', undefined, 'EC.07')
    const row = boardByDef(b, 'EC.07')!
    expect(row.statuses.includes('marked')).toBe(true)
    expect(markedMoveBlocked(b.state, row)).toBe(true)
    const cell = row.cell
    b.playerEndTurn()
    expect(boardByDef(b, 'EC.07')!.cell).toBe(cell)
  })
})

describe('结算因果', () => {
  it('猎犬标记、食人魔减点与移动都带着施动者', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.A01', 'PC.A02', 'PC.A01', 'PC.A03'])
    playDef(b, 'PC.A00', 5)
    playDef(b, 'PC.A01', 6)
    const dog = boardByDef(b, 'PC.A01')!
    const events = b.playerEndTurn()
    const mark = events.find((e) => e.type === 'battle.statusAdded' && e.status === 'marked')
    expect(mark && mark.type === 'battle.statusAdded' ? mark.cause : undefined).toMatchObject({
      defId: 'PC.A01', timing: 'turnEnd', op: 'mark',
    })
    const dmg = events.find((e) => e.type === 'battle.pointsChanged' && e.card === dog.id && e.cause?.defId === 'EC.01')
    expect(dmg && dmg.type === 'battle.pointsChanged' ? dmg : undefined).toMatchObject({
      source: 'turnEnd',
      cause: { defId: 'EC.01', timing: 'turnEnd', op: 'damage' },
    })
    const markAt = events.indexOf(mark!)
    const dmgAt = events.indexOf(dmg!)
    expect(dmgAt).toBeGreaterThan(markAt)
    const moved = events.find((e) => e.type === 'battle.cardEntered' && e.cell === 2)
    expect(moved).toMatchObject({ motion: 'move', from: 3 })
    const hit = events.find((e) => e.type === 'battle.effectResolved' && e.defId === 'PC.A01')
    expect(hit && hit.type === 'battle.effectResolved' ? hit.hit : undefined).toBe(true)
  })

  it('邻格没有目标时 effectResolved.hit 为 false', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.A01', 'PC.A02', 'PC.A01', 'PC.A03'])
    playDef(b, 'PC.A00', 5)
    playDef(b, 'PC.A01', 7)
    const events = b.playerEndTurn()
    const fx = events.find((e) => e.type === 'battle.effectResolved' && e.defId === 'PC.A01')
    expect(fx && fx.type === 'battle.effectResolved' ? fx.hit : undefined).toBe(false)
    expect(events.some((e) => e.type === 'battle.statusAdded')).toBe(false)
  })

  it('化身入场加费带 enter，回合开始回满不带 cause', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.A01', 'PC.A02', 'PC.A01', 'PC.A03'])
    const played = playDef(b, 'PC.A00', 5)
    const fee = played.find((e) => e.type === 'battle.occupyChanged' && e.cause)
    expect(fee && fee.type === 'battle.occupyChanged' ? fee.cause : undefined).toMatchObject({
      defId: 'PC.A00', timing: 'enter',
    })
    const ended = b.playerEndTurn()
    const refill = ended.find((e) => e.type === 'battle.occupyChanged' && !e.cause)
    expect(refill).toBeTruthy()
  })

  it('引爆前能从 turnStarted.timers 看到 EC.04 剩余', () => {
    const { events } = startBattle('MON.B01')
    const turn = events.find((e) => e.type === 'battle.turnStarted' && e.opening)
    expect(turn && turn.type === 'battle.turnStarted' ? turn.timers : []).toEqual(
      expect.arrayContaining([expect.objectContaining({ defId: 'EC.04', left: 2 })]),
    )
  })

  it('横排与竖列驻场把减点记在 auras 上', () => {
    const { aggregate: b } = startBattle('MON.N02', fat(['PC.N01']))
    playDef(b, 'PC.A00', 5)
    playDef(b, 'PC.N01', 1)
    expect(currentPoints(b.state, boardByDef(b, 'PC.N01')!)).toBe(3)
    const events = b.playerEndTurn()
    const down = events.find((e) => e.type === 'battle.pointsChanged' && e.auras?.some((a) => a.defId === 'EC.07' && a.n === -2))
    expect(down).toBeTruthy()
  })

  it('易伤加成写在同一条 pointsChanged 上', () => {
    const { aggregate: b } = startBattle('MON.N01', ['PC.A01', 'PC.A02', 'PC.A01', 'PC.A03'])
    playDef(b, 'PC.A00', 5)
    playDef(b, 'PC.A01', 6)
    b.playerEndTurn()
    b.playerActivate(avatar(b).id, boardByDef(b, 'EC.01')!.id)
    const events = playDef(b, 'PC.A02', undefined, 'EC.01')
    const dmg = events.find((e) => e.type === 'battle.pointsChanged' && e.cause?.defId === 'PC.A02')
    expect(dmg && dmg.type === 'battle.pointsChanged' ? dmg.vulnerableBonus : undefined).toBe(1)
    expect(dmg && dmg.type === 'battle.pointsChanged' ? dmg.source : undefined).toBe('play')
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
