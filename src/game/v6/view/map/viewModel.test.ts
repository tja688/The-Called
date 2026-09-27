import { describe, expect, it } from 'vitest'
import {
  canFight,
  createSession,
  generateMap,
  moveTargets,
  moveTo,
  neighborsOf,
  recordVictory,
  type MapSession,
} from '../../map'
import { ARRIVAL_COPY, SHOP_SHELF_COPY, toMapView } from './viewModel'

const SEED = 20260926

function openAt(session: MapSession, nodeId: string): MapSession {
  return {
    ...session,
    currentNodeId: nodeId,
    revealed: [...new Set([
      ...session.revealed,
      nodeId,
      ...neighborsOf(session.graph, nodeId),
    ])].sort(),
    defeatedMonsterIds: [],
  }
}

describe('地图视图', () => {
  it('开局只看见中心和它的邻居，战斗只有失控机械', () => {
    const session = createSession(generateMap(SEED))
    const view = toMapView(session)
    const expectedIds = [session.currentNodeId, ...moveTargets(session)].sort()

    expect(session.graph.seed).toBe(SEED)
    expect(view.places.map((place) => place.id).sort()).toEqual(expectedIds)
    expect(view.places.filter((place) => place.role === 'here')).toEqual([
      expect.objectContaining({ id: 'center', kind: 'center', title: '中心', distance: 0 }),
    ])
    expect(view.places.filter((place) => place.kind === 'combat')).toEqual([
      expect.objectContaining({ title: '失控机械', distance: 1, role: 'neighbor' }),
    ])
    expect(view.action).toEqual({ type: 'idle' })

    for (const node of session.graph.nodes) {
      if (session.revealed.includes(node.id)) continue
      expect(view.places.some((place) => place.id === node.id)).toBe(false)
    }
  })

  it('走到失控机械后可以进入战斗，并看见新邻居', () => {
    const session = createSession(generateMap(SEED))
    const runaway = session.graph.nodes.find((node) => node.monsterId === 'runaway-machine')
    if (!runaway) throw new Error('没有失控机械')

    const before = new Set(toMapView(session).places.map((place) => place.id))
    const moved = moveTo(session, runaway.id)
    const view = toMapView(moved)
    const fresh = view.places.filter((place) => !before.has(place.id))

    expect(view.places.find((place) => place.role === 'here')).toEqual(
      expect.objectContaining({
        id: runaway.id,
        kind: 'combat',
        title: '失控机械',
        distance: 1,
      }),
    )
    expect(view.action).toEqual({
      type: 'enter',
      monsterId: 'runaway-machine',
      nodeId: runaway.id,
    })
    expect(fresh.length).toBeGreaterThan(0)
    expect(fresh.every((place) => place.role === 'neighbor')).toBe(true)
    expect(view.places).toContainEqual(expect.objectContaining({
      id: 'center',
      title: '中心',
      role: 'neighbor',
    }))
  })

  it('没有击败记录时，展开到钟楼会显示锁定文案', () => {
    const session = createSession(generateMap(SEED))
    const bell = session.graph.nodes.find((node) => node.monsterId === 'bell-warden')
    if (!bell) throw new Error('没有钟楼')

    const forced = openAt(session, bell.id)
    const gate = canFight(forced, bell.id)
    const view = toMapView(forced)

    expect(forced.defeatedMonsterIds).toEqual([])
    expect(gate.ok).toBe(false)
    if (gate.ok) throw new Error('钟楼不该放行')
    expect(view.places.find((place) => place.role === 'here')).toEqual(
      expect.objectContaining({ id: bell.id, title: '钟楼守望者', kind: 'combat', distance: 5 }),
    )
    expect(view.action).toEqual({ type: 'locked', reason: gate.reason })
    expect(gate.reason).toContain('钟楼守望者')
    expect(gate.reason).toContain('还不能开战')
  })

  it('走到商店只看到货架说明', () => {
    const session = createSession(generateMap(SEED))
    const shop = session.graph.nodes.find((node) => node.kind === 'shop' && moveTargets(session).includes(node.id))
    if (!shop) throw new Error('开局没有商店邻居')

    expect(toMapView(moveTo(session, shop.id)).action).toEqual({
      type: 'shop',
      text: SHOP_SHELF_COPY,
    })
    expect(SHOP_SHELF_COPY).toBe('货架上只有巨大卡背，暂不出售。')
  })

  it('只有击败呼唤者后，回到地图才显示已抵达终点', () => {
    const session = createSession(generateMap(SEED))
    expect(toMapView(session).arrival).toBeNull()
    expect(toMapView(recordVictory(session, 'bell-warden')).arrival).toBeNull()
    expect(toMapView(recordVictory(session, 'the-caller')).arrival).toBe(ARRIVAL_COPY)
    expect(toMapView(recordVictory(session, 'the-caller')).arrival).toBe('已抵达终点')
  })
})
