import { describe, expect, it } from 'vitest'
import { startRun } from '../../test/helpers'
import { generateFloor } from './mapgen'
import { RunAggregate } from './RunAggregate'
import { seedRng } from '../../core/Rng'
import { ANCHORS } from '../../content/anchors'

describe('第 1 层大地图', () => {
  it('18 个节点，构成符合设计，BOSS 最远', () => {
    const { nodes, origin } = generateFloor(seedRng(7))
    expect(nodes).toHaveLength(18)
    const count = (t: string) => nodes.filter((n) => n.type === t).length
    expect(count('shop')).toBe(1)
    expect(count('boss')).toBe(1)
    expect(count('elite')).toBe(1)
    expect(count('chest')).toBe(1)
    expect(count('rest')).toBe(1)
    expect(count('forge')).toBe(1)
    expect(count('event')).toBe(7)
    expect(count('normal')).toBe(5)
    const boss = nodes.find((n) => n.type === 'boss')!
    const max = Math.max(...nodes.map((n) => Math.abs(n.x - origin.x) + Math.abs(n.y - origin.y)))
    expect(Math.abs(boss.x) + Math.abs(boss.y)).toBe(max)
  })

  it('只能走正交相邻；未互动强制触发；可走回已完成格', async () => {
    const game = await startRun('DK.A', 11)
    const run = game.ask({ type: 'run.view' })!
    expect(run.availableNodes.length).toBeGreaterThan(0)
    const far = run.nodes.find((n) => !n.adjacent)
    if (far) {
      await expect(game.dispatch({ type: 'run.enterNode', node: far.id })).rejects.toThrow()
    }
    const first = run.availableNodes[0]
    await game.dispatch({ type: 'run.enterNode', node: first })
    const after = game.ask({ type: 'run.view' })!
    expect(['battle', 'event', 'shop', 'rest', 'forge', 'chest']).toContain(after.screen)
  })

  it('离开入口后，站在相邻格可以走回入口', () => {
    const { aggregate: r } = RunAggregate.start(11, 'DK.A')
    expect(r.state.player).toEqual({ x: 0, y: 0 })
    expect(r.availableNodes()).not.toContain('hub')
    const near = r.state.nodes.find((n) => Math.abs(n.x) + Math.abs(n.y) === 1)!
    r.state.player = { x: near.x, y: near.y }
    expect(r.availableNodes()).toContain('hub')
    expect(r.enterNode('hub')).toEqual([])
    expect(r.state.player).toEqual({ x: 0, y: 0 })
    expect(r.state.screen).toBe('map')
    expect(() => r.enterNode('hub')).toThrow()
    const far = r.state.nodes.find((n) => Math.abs(n.x) + Math.abs(n.y) > 1)!
    r.state.player = { x: far.x, y: far.y }
    expect(r.availableNodes()).not.toContain('hub')
  })

  it('仅大地图可编组，下限 10，化身不在卡盒', async () => {
    const game = await startRun('DK.A', 4)
    const run = game.ask({ type: 'run.view' })!
    expect(run.deck.length).toBeGreaterThanOrEqual(ANCHORS.deckMin)
    expect(run.boxCards.every((c) => c.defId !== run.avatarDefId)).toBe(true)
    await expect(game.dispatch({ type: 'run.setDeck', deck: run.deck.slice(0, 3) })).rejects.toThrow()
  })

  it('负面卡不能从牌组拿掉', async () => {
    const { RunAggregate } = await import('./RunAggregate')
    const { aggregate: r } = RunAggregate.start(1, 'DK.A')
    r.state.box.push({ uid: 'bx', defId: 'PC.X01', baseBonus: 0 })
    r.state.deck.push('bx')
    expect(() => r.setDeck(r.state.deck.filter((id) => id !== 'bx'))).toThrow()
  })
})
