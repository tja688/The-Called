import { describe, expect, it } from 'vitest'
import { FORK_MONSTERS, canFight, canMoveTo, createSession, forkGraph, moveTargets, moveTo } from './index'

describe('起点三分叉', () => {
  it('开局站在起点，三条路都能走，也能再打', () => {
    const session = createSession()
    expect(session.graph.nodes).toHaveLength(4)
    expect(session.currentNodeId).toBe('start')
    expect(moveTargets(session)).toEqual(FORK_MONSTERS.map((monster) => monster.nodeId))
    expect(canFight(session, 'start')).toEqual({ ok: false, reason: '起点不能开战' })

    let here = session
    for (const monster of FORK_MONSTERS) {
      expect(canMoveTo(here, monster.nodeId)).toBe(true)
      const arrived = moveTo(here, monster.nodeId)
      expect(canFight(arrived, monster.nodeId)).toEqual({ ok: true })
      const again = moveTo(moveTo(arrived, 'start'), monster.nodeId)
      expect(canFight(again, monster.nodeId)).toEqual({ ok: true })
      here = moveTo(arrived, 'start')
    }
  })

  it('支路之间不能直达', () => {
    const onFirst = moveTo(createSession(), FORK_MONSTERS[0].nodeId)
    expect(() => moveTo(onFirst, FORK_MONSTERS[1].nodeId)).toThrow(/不能走到/)
  })

  it('目录名字可以盖过默认称呼', () => {
    const graph = forkGraph({ 'monster.001': '改名机械' })
    expect(graph.nodes.find((node) => node.monsterId === 'monster.001')?.title).toBe('改名机械')
    expect(graph.nodes.find((node) => node.monsterId === 'monster.002')?.title).toBe('活数据库')
  })
})
