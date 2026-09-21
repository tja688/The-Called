import { describe, expect, it } from 'vitest'
import { startRun } from '../../test/helpers'
import { RunAggregate } from './RunAggregate'
import { relicPool } from '../../content/relics'

describe('节点与遗物', () => {
  it('疗养二选一：回血或化身基础 +2 且血上限 +2', () => {
    const { aggregate: r } = RunAggregate.start(1, 'DK.A')
    r.state.screen = 'rest'
    r.state.hp = 10
    r.restPick('heal')
    expect(r.state.hp).toBeGreaterThan(10)
    const { aggregate: r2 } = RunAggregate.start(1, 'DK.A')
    r2.state.screen = 'rest'
    const base = r2.state.avatarBase
    const max = r2.state.hpMax
    r2.restPick('grow')
    expect(r2.state.avatarBase).toBe(base + 2)
    expect(r2.state.hpMax).toBe(max + 2)
  })

  it('锻造 +2 或重铸；化身不在卡盒', () => {
    const { aggregate: r } = RunAggregate.start(1, 'DK.A')
    r.state.screen = 'forge'
    const uid = r.state.box[0].uid
    r.forgeBuff(uid)
    expect(r.state.box[0].baseBonus).toBe(2)
    r.state.flowChosen = false
    r.forgeBuff(uid)
    expect(r.state.box[0].baseBonus).toBe(4)
    r.state.box.push({ uid: 'bw', defId: 'PC.A04', baseBonus: 0 })
    r.state.flowChosen = false
    r.forgeRecast('bw')
    expect(r.state.box.find((c) => c.uid === 'bw')!.defId).not.toBe('PC.A04')
    expect(r.state.box.every((c) => c.defId !== r.state.avatarDefId)).toBe(true)
  })

  it('宝箱：已有 RL.01 则 15 金', () => {
    const { aggregate: r } = RunAggregate.start(5, 'DK.A')
    r.state.relics.push('RL.01')
    const gold = r.state.gold
    const chest = r.state.nodes.find((n) => n.type === 'chest')!
    r.state.player = { x: chest.x, y: chest.y }
    const neighbor = r.state.nodes.find((n) => Math.abs(n.x - chest.x) + Math.abs(n.y - chest.y) === 1)
    if (neighbor) r.state.player = { x: neighbor.x, y: neighbor.y }
    if (r.availableNodes().includes(chest.id)) {
      r.enterNode(chest.id)
      expect(r.state.gold).toBe(gold + 15)
    }
  })

  it('RL.01 第一张占场 +2，化身不触发', async () => {
    const { startBattle } = await import('../../test/helpers')
    const { currentPoints } = await import('../battle/points')
    const { playDef, avatar, boardByDef } = await import('../../test/helpers')
    const { aggregate: b } = startBattle('MON.N01', ['PC.N01', 'PC.N01', 'PC.N01', 'PC.N01'], { relic: true })
    playDef(b, 'PC.A00', 7)
    expect(currentPoints(b.state, avatar(b))).toBe(10)
    playDef(b, 'PC.N01', 8)
    expect(currentPoints(b.state, boardByDef(b, 'PC.N01')!)).toBe(7)
  })

  it('遗物池只有 RL.01', () => {
    expect(relicPool().map((r) => r.id)).toEqual(['RL.01'])
  })
})

describe('GameService 放弃', () => {
  it('可以放弃本局', async () => {
    const game = await startRun('DK.A', 1)
    await game.dispatch({ type: 'run.abandon' })
    expect(game.ask({ type: 'run.view' })!.ended).toBe('defeat')
  })
})
