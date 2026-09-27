import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAP_SEED,
  canFight,
  canMoveTo,
  createSession,
  generateMap,
  moveTargets,
  moveTo,
  neighborsOf,
  recordVictory,
  type MapGraph,
  type MapNode,
} from './index'

const EXPECTED_COMBAT: Record<string, { tier: number, count: number }> = {
  'runaway-machine': { tier: 1, count: 1 },
  'patrol-swarm': { tier: 2, count: 2 },
  'preaching-band': { tier: 2, count: 2 },
  'mirror-person': { tier: 2, count: 2 },
  'rust-colossus': { tier: 3, count: 2 },
  'carrion-crows': { tier: 3, count: 2 },
  'anatomist': { tier: 4, count: 1 },
  'silent-order': { tier: 4, count: 1 },
  'mirror-witch': { tier: 4, count: 1 },
  'bell-warden': { tier: 5, count: 1 },
  'the-caller': { tier: 6, count: 1 },
}

function nodeById(graph: MapGraph, id: string): MapNode {
  const node = graph.nodes.find((item) => item.id === id)
  if (!node) throw new Error(`没有节点 ${id}`)
  return node
}

function nodesOf(graph: MapGraph, monsterId: string): MapNode[] {
  return graph.nodes.filter((node) => node.monsterId === monsterId)
}

function neighborIds(graph: MapGraph, id: string): string[] {
  const found: string[] = []
  for (const [left, right] of graph.edges) {
    if (left === id) found.push(right)
    if (right === id) found.push(left)
  }
  return found
}

function distancesFromCenter(graph: MapGraph): Map<string, number> {
  const center = graph.nodes.find((node) => node.kind === 'center')
  if (!center) throw new Error('没有中心')
  const adjacent = new Map<string, string[]>()
  for (const node of graph.nodes) adjacent.set(node.id, [])
  for (const [left, right] of graph.edges) {
    adjacent.get(left)?.push(right)
    adjacent.get(right)?.push(left)
  }
  const distance = new Map<string, number>([[center.id, 0]])
  const queue = [center.id]
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]
    if (current === undefined) break
    const steps = distance.get(current)
    if (steps === undefined) break
    for (const next of adjacent.get(current) ?? []) {
      if (distance.has(next)) continue
      distance.set(next, steps + 1)
      queue.push(next)
    }
  }
  return distance
}

function neighborMonsters(graph: MapGraph, id: string): (string | null)[] {
  return neighborIds(graph, id).map((neighborId) => nodeById(graph, neighborId).monsterId)
}

function expectMapRules(graph: MapGraph): Map<string, number> {
  expect(graph.nodes).toHaveLength(21)
  expect(graph.nodes.filter((node) => node.kind === 'combat')).toHaveLength(16)
  expect(graph.nodes.filter((node) => node.kind === 'shop')).toHaveLength(4)
  expect(graph.nodes.filter((node) => node.kind === 'center')).toHaveLength(1)

  const center = graph.nodes.find((node) => node.kind === 'center')
  expect(center).toMatchObject({ id: 'center', kind: 'center', tier: 0, monsterId: null })

  const seen = new Set<string>()
  for (const [left, right] of graph.edges) {
    expect(left < right).toBe(true)
    expect(seen.has(`${left}|${right}`)).toBe(false)
    seen.add(`${left}|${right}`)
    expect(Math.abs(nodeById(graph, left).tier - nodeById(graph, right).tier)).toBeLessThanOrEqual(1)
  }

  const distance = distancesFromCenter(graph)
  expect(distance.size).toBe(21)

  for (const node of graph.nodes) {
    expect(distance.get(node.id)).toBe(node.tier)
    expect(neighborsOf(graph, node.id)).toEqual([...neighborIds(graph, node.id)].sort())
  }

  for (const [monsterId, expected] of Object.entries(EXPECTED_COMBAT)) {
    const found = nodesOf(graph, monsterId)
    expect(found).toHaveLength(expected.count)
    for (const node of found) {
      expect(node.kind).toBe('combat')
      expect(node.tier).toBe(expected.tier)
      expect(distance.get(node.id)).toBe(expected.tier)
    }
  }

  for (const tier of [1, 2, 3, 4]) {
    const shops = graph.nodes.filter((node) => node.kind === 'shop' && distance.get(node.id) === tier)
    expect(shops).toHaveLength(1)
  }
  expect(graph.nodes.filter((node) => node.kind === 'shop' && (node.tier === 5 || node.tier === 6))).toHaveLength(0)

  if (!center) throw new Error('没有中心')
  const centerCombat = neighborIds(graph, center.id)
    .map((id) => nodeById(graph, id))
    .filter((node) => node.kind === 'combat')
  expect(centerCombat.map((node) => node.monsterId)).toEqual(['runaway-machine'])

  const caller = nodesOf(graph, 'the-caller')[0]
  if (!caller) throw new Error('没有呼唤者')
  expect(distance.get(caller.id)).not.toBe(1)
  expect(distance.get(caller.id)).toBe(6)
  expect(neighborMonsters(graph, caller.id)).toEqual(['bell-warden'])

  for (const rust of nodesOf(graph, 'rust-colossus')) {
    const monsters = neighborMonsters(graph, rust.id)
    expect(monsters.some((id) => id === 'patrol-swarm' || id === 'preaching-band')).toBe(true)
    expect(monsters).not.toContain('mirror-person')
    expect(monsters).not.toContain('carrion-crows')
  }
  for (const crow of nodesOf(graph, 'carrion-crows')) {
    expect(neighborMonsters(graph, crow.id)).toContain('mirror-person')
  }
  for (const elite of ['anatomist', 'silent-order']) {
    const node = nodesOf(graph, elite)[0]
    if (!node) throw new Error(`没有 ${elite}`)
    expect(neighborMonsters(graph, node.id)).toContain('rust-colossus')
  }
  const witch = nodesOf(graph, 'mirror-witch')[0]
  if (!witch) throw new Error('没有镜渊魔女')
  expect(neighborMonsters(graph, witch.id)).toContain('carrion-crows')

  const bell = nodesOf(graph, 'bell-warden')[0]
  if (!bell) throw new Error('没有钟楼')
  const eliteKinds = new Set(
    neighborMonsters(graph, bell.id).filter((id) =>
      id === 'anatomist' || id === 'silent-order' || id === 'mirror-witch'),
  )
  expect(eliteKinds.size).toBeGreaterThanOrEqual(2)

  return distance
}

describe('地图生成', () => {
  it('种子 20260926：21 个节点且连通，战斗节点最短路等于档位', () => {
    const graph = generateMap()
    expect(graph.seed).toBe(20260926)
    expect(DEFAULT_MAP_SEED).toBe(20260926)
    expectMapRules(graph)
  })

  it('同一种子两次结构相同，种子会改变边', () => {
    expect(generateMap(20260926)).toEqual(generateMap())
    expect(generateMap(1).nodes).toEqual(generateMap(20260926).nodes)
    expect(generateMap(1).edges).not.toEqual(generateMap(20260926).edges)
  })

  it('其他种子也满足同一套档位和解锁边', () => {
    for (const seed of [1, 7, 99, 20260927]) expectMapRules(generateMap(seed))
  })
})

describe('迷雾与开战', () => {
  it('开局可见战斗只有失控机械，走进后揭示邻居并能回到中心', () => {
    const graph = generateMap(20260926)
    const session = createSession(graph)
    const center = nodeById(graph, 'center')
    const runaway = nodesOf(graph, 'runaway-machine')[0]
    const caller = nodesOf(graph, 'the-caller')[0]
    const rust = nodesOf(graph, 'rust-colossus')[0]
    if (!runaway || !caller || !rust) throw new Error('节点不齐')

    expect(session.currentNodeId).toBe(center.id)
    expect(session.visited).toEqual([center.id])
    const visibleCombat = session.revealed
      .map((id) => nodeById(graph, id))
      .filter((node) => node.kind === 'combat')
    expect(visibleCombat.map((node) => node.monsterId)).toEqual(['runaway-machine'])
    expect(session.revealed).not.toContain(caller.id)
    expect(canMoveTo(session, caller.id)).toBe(false)
    expect(moveTargets(session)).not.toContain(caller.id)
    expect(canMoveTo(session, runaway.id)).toBe(true)

    const there = moveTo(session, runaway.id)
    expect(session.currentNodeId).toBe(center.id)
    expect(there.currentNodeId).toBe(runaway.id)
    expect(there.visited).toContain(runaway.id)
    for (const neighborId of neighborIds(graph, runaway.id)) {
      expect(there.revealed).toContain(neighborId)
    }
    expect(there.revealed).not.toContain(rust.id)
    expect(canMoveTo(there, rust.id)).toBe(false)
    expect(canMoveTo(there, center.id)).toBe(true)
    expect(moveTargets(there)).toContain(center.id)
    expect(moveTo(there, center.id).currentNodeId).toBe(center.id)

    const patrol = nodesOf(graph, 'patrol-swarm')[0]
    if (!patrol) throw new Error('没有巡检蜂群')
    expect(canFight(session, patrol.id).ok).toBe(true)
    expect(canMoveTo(session, patrol.id)).toBe(false)
  })

  it('未击败两种精英时钟楼不能开战，击败两种后可以；呼唤者条件不齐时不能开战', () => {
    const graph = generateMap(20260926)
    const bell = nodesOf(graph, 'bell-warden')[0]
    const caller = nodesOf(graph, 'the-caller')[0]
    if (!bell || !caller) throw new Error('节点不齐')

    let session = createSession(graph)
    for (const node of graph.nodes) {
      if (node.kind === 'center' || node.kind === 'shop') {
        const gate = canFight(session, node.id)
        expect(gate.ok).toBe(false)
        if (!gate.ok) expect(gate.reason.length).toBeGreaterThan(0)
      }
    }

    const locked = canFight(session, bell.id)
    expect(locked.ok).toBe(false)
    if (!locked.ok) {
      expect(locked.reason).toContain('还缺 2 种')
      expect(locked.reason).toContain('解剖学家')
      expect(locked.reason).toContain('缄默修会')
      expect(locked.reason).toContain('镜渊魔女')
    }

    session = recordVictory(session, 'anatomist')
    const oneElite = canFight(session, bell.id)
    expect(oneElite.ok).toBe(false)
    if (!oneElite.ok) {
      expect(oneElite.reason).toContain('还缺 1 种')
      expect(oneElite.reason).toContain('缄默修会')
      expect(oneElite.reason).not.toContain('解剖学家')
    }

    session = recordVictory(session, 'mirror-witch')
    expect(canFight(session, bell.id)).toEqual({ ok: true })

    const callerLocked = canFight(session, caller.id)
    expect(callerLocked.ok).toBe(false)
    if (!callerLocked.ok) {
      expect(callerLocked.reason).toContain('钟楼守望者')
      expect(callerLocked.reason).toContain('缄默修会')
      expect(callerLocked.reason).not.toContain('解剖学家')
      expect(callerLocked.reason).not.toContain('镜渊魔女')
    }

    session = recordVictory(session, 'bell-warden')
    const missingElite = canFight(session, caller.id)
    expect(missingElite.ok).toBe(false)
    if (!missingElite.ok) {
      expect(missingElite.reason).toContain('缄默修会')
      expect(missingElite.reason).not.toContain('钟楼守望者')
    }

    session = recordVictory(session, 'silent-order')
    expect(canFight(session, caller.id)).toEqual({ ok: true })

    const patrols = nodesOf(graph, 'patrol-swarm')
    expect(patrols).toHaveLength(2)
    const once = recordVictory(recordVictory(createSession(graph), 'patrol-swarm'), 'patrol-swarm')
    expect(once.defeatedMonsterIds).toEqual(['patrol-swarm'])
    for (const patrol of patrols) expect(canFight(once, patrol.id).ok).toBe(true)
  })
})
