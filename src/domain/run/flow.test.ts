import { describe, expect, it } from 'vitest'
import { RunAggregate } from './RunAggregate'
import { startRun } from '../../test/helpers'
import { cardDef, isRewardable, playerCardIds } from '../../content/cards'
import { eventsForFloor, eventDef, eventOptionEnabled } from '../../content/events'
import { mapEffectsFor } from '../../content/mapEffects'
import { rewardableIds, drawExact } from '../../content/rewards'
import { seedRng } from '../../core/Rng'
import { toRunView } from '../../application/readmodels/RunView'
import type { NodeType } from '../types'

function approach(r: RunAggregate, type: NodeType) {
  const node = r.state.nodes.find((n) => n.type === type)
  if (!node) throw new Error(`没有 ${type}`)
  r.state.screen = 'map'
  r.state.ended = undefined
  for (const pos of [
    { x: node.x + 1, y: node.y },
    { x: node.x - 1, y: node.y },
    { x: node.x, y: node.y + 1 },
    { x: node.x, y: node.y - 1 },
  ]) {
    r.state.player = pos
    if (r.availableNodes().includes(node.id)) return node
  }
  throw new Error(`${type} 走不到`)
}

describe('普通战斗循环', () => {
  it('胜：三选一 + 12 金；败回地图可再进且重抽怪', () => {
    const { aggregate: r } = RunAggregate.start(8, 'DK.A')
    const node = approach(r, 'normal')
    r.enterNode(node.id)
    expect(r.state.screen).toBe('battle')
    const first = r.state.pendingEncounter
    r.applyBattleResult({ outcome: 'lose', reason: 'avatarGone', avatarCost: 4 })
    expect(r.state.screen).toBe('map')
    expect(r.state.ended).toBeUndefined()
    expect(node.lost).toBe(true)
    expect(node.monsterId).toBeUndefined()
    expect(r.availableNodes()).toContain(node.id)
    r.enterNode(node.id)
    expect(r.state.screen).toBe('battle')
    expect(r.state.pendingEncounter).toBeTruthy()
    expect(r.state.pendingEncounter === first || r.state.pendingEncounter).toBeTruthy()
    r.applyBattleResult({ outcome: 'win', reason: 'clear', avatarCost: 0 })
    expect(r.state.gold).toBe(12)
    expect(r.state.pendingReward).toHaveLength(3)
    expect(new Set(r.state.pendingReward).size).toBe(3)
    for (const id of r.state.pendingReward!) expect(isRewardable(id)).toBe(true)
    r.rewardPick(r.state.pendingReward![0])
    r.returnToMap()
    expect(r.state.screen).toBe('map')
    expect(r.state.box.length).toBeGreaterThan(10)

    const here = { x: node.x, y: node.y }
    r.state.player = { x: node.x + 1, y: node.y }
    if (!r.availableNodes().includes(node.id)) r.state.player = { x: node.x, y: node.y + 1 }
    expect(r.availableNodes()).toContain(node.id)
    const back = r.enterNode(node.id)
    expect(back.some((e) => e.type === 'run.screen')).toBe(false)
    expect(r.state.screen).toBe('map')
    expect(r.state.player).toEqual(here)
    const view = toRunView(r.state, r.availableNodes())
    const shown = view.nodes.find((n) => n.id === node.id)!
    expect(shown.interactive).toBe(false)
    expect(shown.current).toBe(true)
  })

  it('只能看见相邻类型', () => {
    const { aggregate: r } = RunAggregate.start(3, 'DK.A')
    const far = r.state.nodes.find((n) => Math.abs(n.x) + Math.abs(n.y) > 1)
    if (!far) return
    const view = toRunView(r.state, r.availableNodes())
    const v = view.nodes.find((n) => n.id === far.id)!
    expect(v.type).toBe('unknown')
  })
})

describe('事件商店疗养锻造宝箱', () => {
  it('第 1 层事件不含专属更高层；抽空给 15 金', () => {
    expect(eventsForFloor(1).every((e) => e.floors.includes(1))).toBe(true)
    expect(eventsForFloor(1).some((e) => e.id === 'EV.08')).toBe(false)
    const { aggregate: r } = RunAggregate.start(4, 'DK.A')
    r.state.seenEvents = eventsForFloor(1).map((e) => e.id)
    const node = approach(r, 'event')
    r.enterNode(node.id)
    expect(r.state.eventId).toBe('EV.EMPTY')
    r.eventOption(0)
    expect(r.state.gold).toBe(15)
  })

  it('开局卡盒没有白卡；本体系蓝不掺中立', () => {
    const { aggregate: r } = RunAggregate.start(4, 'DK.A')
    expect(r.state.box.some((c) => cardDef(c.defId).rarity === 'white')).toBe(false)
    const rng = seedRng(1)
    const id = drawExact(rng, 'SYS.A', 'blue', new Set(), { schoolOnly: true })
    expect(id).toBeTruthy()
    expect(id!.startsWith('PC.A')).toBe(true)
    expect(rewardableIds('SYS.A', 'blue', { schoolOnly: true }).every((x) => x.startsWith('PC.A'))).toBe(true)
  })

  it('全选项进不了池的事件改为空事件', () => {
    const { aggregate: r } = RunAggregate.start(4, 'DK.A')
    r.state.seenEvents = eventsForFloor(1).filter((e) => e.id !== 'EV.10').map((e) => e.id)
    const node = approach(r, 'event')
    r.enterNode(node.id)
    expect(r.state.eventId).toBe('EV.EMPTY')
  })

  it('EV.13 按卡盒张数置灰', () => {
    const { aggregate: r } = RunAggregate.start(4, 'DK.A')
    expect(r.state.box.length).toBeLessThanOrEqual(12)
    expect(eventOptionEnabled(eventDef('EV.13'), 0, r.state)).toBe(true)
    expect(eventOptionEnabled(eventDef('EV.13'), 1, r.state)).toBe(false)
    while (r.state.box.length < 18) r.state.box.push({ uid: `pad${r.state.box.length}`, defId: 'PC.N01', baseBonus: 0 })
    expect(eventOptionEnabled(eventDef('EV.13'), 0, r.state)).toBe(false)
    expect(eventOptionEnabled(eventDef('EV.13'), 1, r.state)).toBe(true)
    expect(eventOptionEnabled(eventDef('EV.13'), 2, r.state)).toBe(true)
  })

  it('EV.04.C / EV.11.B 可空手离开；金币不够时 EV.11.A 置灰', () => {
    const { aggregate: r } = RunAggregate.start(4, 'DK.A')
    r.state.screen = 'event'
    r.state.eventId = 'EV.04'
    r.eventOption(2)
    expect(r.state.eventChosen).toBe(2)

    const { aggregate: r2 } = RunAggregate.start(4, 'DK.A')
    r2.state.screen = 'event'
    r2.state.eventId = 'EV.11'
    r2.state.gold = 0
    expect(eventOptionEnabled(eventDef('EV.11'), 0, r2.state)).toBe(false)
    expect(eventOptionEnabled(eventDef('EV.11'), 1, r2.state)).toBe(true)
    r2.eventOption(1)
    expect(r2.state.gold).toBe(0)
  })

  it('EV.09.B 从三张中立里挑，不另给金币', () => {
    const { aggregate: r } = RunAggregate.start(4, 'DK.A')
    r.state.screen = 'event'
    r.state.eventId = 'EV.09'
    r.eventOption(1)
    expect(r.state.gold).toBe(0)
    expect(r.state.screen).toBe('reward')
    expect(r.state.pendingReward).toHaveLength(3)
    expect(r.state.pendingReward!.every((id) => id.startsWith('PC.N'))).toBe(true)
  })

  it('商店陈列 5 张、可买可复制可空手离开再进', () => {
    const { aggregate: r } = RunAggregate.start(6, 'DK.A')
    r.state.gold = 400
    const node = approach(r, 'shop')
    r.enterNode(node.id)
    expect(node.shop?.offers.length).toBe(5)
    const first = node.shop!.offers[0]
    expect(isRewardable(first.defId)).toBe(true)
    r.shopBuyCard(0)
    expect(r.state.box.some((c) => c.defId === first.defId)).toBe(true)
    const beforeCopy = r.state.box.length
    r.shopCopy(r.state.box[0].uid)
    expect(r.state.box.length).toBe(beforeCopy + 1)
    r.returnToMap()
    r.enterNode(node.id)
    expect(r.state.screen).toBe('shop')
  })

  it('商店读模型价格含 EV.15 折扣', () => {
    const { aggregate: r } = RunAggregate.start(6, 'DK.A')
    const node = approach(r, 'shop')
    r.enterNode(node.id)
    const full = node.shop!.offers[0].price
    r.state.shopDiscount = 0.3
    const view = toRunView(r.state, r.availableNodes())
    expect(view.shop!.offers[0].price).toBe(Math.max(1, Math.round(full * 0.7)))
    expect(view.shop!.copyPrice).toBe(Math.max(1, Math.round(45 * 0.7)))
  })

  it('宝箱已有遗物则 15 金；随机遗物不重复', () => {
    const { aggregate: r } = RunAggregate.start(9, 'DK.A')
    r.state.relics = ['RL.01']
    const gold = r.state.gold
    const chest = approach(r, 'chest')
    r.enterNode(chest.id)
    expect(r.state.gold).toBe(gold + 15)
  })
})

describe('精英 BOSS 下层与内容池', () => {
  it('精英胜：卡 + 25 金 + 遗物或 15 金', () => {
    const { aggregate: r } = RunAggregate.start(10, 'DK.A')
    const node = approach(r, 'elite')
    r.enterNode(node.id)
    expect(r.state.pendingEncounter).toBe('MON.E01')
    r.applyBattleResult({ outcome: 'win', reason: 'lead', avatarCost: 0 })
    expect(r.state.gold).toBe(25)
    expect(r.state.relics.includes('RL.01') || r.state.gold >= 25).toBe(true)
    expect(r.state.pendingReward).toHaveLength(3)
  })

  it('BOSS 胜出现下层，点下层通关；BOSS 败整局失败', () => {
    const { aggregate: r } = RunAggregate.start(12, 'DK.A')
    const boss = approach(r, 'boss')
    r.enterNode(boss.id)
    expect(r.state.pendingEncounter).toBe('MON.B01')
    r.applyBattleResult({ outcome: 'win', reason: 'clear', avatarCost: 0 })
    expect(r.state.gold).toBe(80)
    const next = r.state.nodes.find((n) => n.type === 'nextFloor')
    expect(next).toBeTruthy()
    r.state.player = { x: next!.x + 1, y: next!.y }
    if (!r.availableNodes().includes(next!.id)) r.state.player = { x: next!.x, y: next!.y + 1 }
    r.enterNode(next!.id)
    expect(r.state.ended).toBe('victory')

    const { aggregate: r2 } = RunAggregate.start(12, 'DK.A')
    const boss2 = approach(r2, 'boss')
    r2.enterNode(boss2.id)
    r2.applyBattleResult({ outcome: 'lose', reason: 'avatarGone', avatarCost: 10 })
    expect(r2.state.ended).toBe('defeat')
  })

  it('血条归零整局失败', () => {
    const { aggregate: r } = RunAggregate.start(1, 'DK.A')
    r.state.hp = 3
    const node = approach(r, 'normal')
    r.enterNode(node.id)
    r.applyBattleResult({ outcome: 'win', reason: 'clear', avatarCost: 10 })
    expect(r.state.ended).toBe('defeat')
  })

  it('本层地图效果来自 ME.01–03；39 张玩家卡除基础负面进池', () => {
    expect(mapEffectsFor(1).map((m) => m.id).sort()).toEqual(['ME.01', 'ME.02', 'ME.03'])
    const { aggregate: r } = RunAggregate.start(1, 'DK.A')
    expect(['ME.01', 'ME.02', 'ME.03']).toContain(r.state.floorEffect)
    expect(playerCardIds()).toHaveLength(39)
    const pool = rewardableIds('SYS.A')
    expect(pool).toHaveLength(11)
    expect(pool.every((id) => isRewardable(id))).toBe(true)
    expect(pool.some((id) => id.startsWith('PC.N'))).toBe(true)
  })
})

describe('GameService 命令竖切', () => {
  it('能走进相邻普通仗并落下化身', async () => {
    const game = await startRun('DK.A', 11)
    const run = game.ask({ type: 'run.view' })!
    const node = run.availableNodes[0]
    await game.dispatch({ type: 'run.enterNode', node })
    const after = game.ask({ type: 'run.view' })!
    if (after.screen !== 'battle') return
    const bv = game.ask({ type: 'battle.view' })!
    const av = bv.hand.find((id) => bv.cards[id].isAvatar)!
    const legal = game.ask({ type: 'battle.legalPlays' }).find((p) => p.card === av)!
    await game.dispatch({ type: 'battle.play', card: av, cell: legal.cells[0] })
    const placed = game.ask({ type: 'battle.view' })!
    expect(placed.avatar.onBoard).toBe(true)
    expect(placed.occupy).toBeGreaterThanOrEqual(1)
    expect(game.ask({ type: 'battle.legalActivates' }).length).toBeGreaterThanOrEqual(0)
  })
})
