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
import { ARRIVAL_COPY, FOG_TITLE, SHOP_SHELF_COPY, arriveAt, toMapView } from './viewModel'

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
  it('开局整张图都在，迷雾不暴露身份，能走的战斗只有失控机械', () => {
    const session = createSession(generateMap(SEED))
    const view = toMapView(session)
    const known = view.places.filter((place) => place.sight !== 'fog')
    const expectedIds = [session.currentNodeId, ...moveTargets(session)].sort()

    expect(session.graph.seed).toBe(SEED)
    expect(view.places).toHaveLength(session.graph.nodes.length)
    expect(known.map((place) => place.id).sort()).toEqual(expectedIds)
    expect(view.places.filter((place) => place.sight === 'here')).toEqual([
      expect.objectContaining({ id: 'center', kind: 'center', title: '中心', distance: 0, mark: 'center' }),
    ])
    expect(view.places.filter((place) => place.kind === 'combat' && place.sight === 'open')).toEqual([
      expect.objectContaining({ title: '失控机械', distance: 1, sight: 'open', mark: 'runaway-machine' }),
    ])
    expect(view.action).toEqual({ type: 'idle' })

    for (const place of view.places) {
      if (place.sight !== 'fog') continue
      expect(place.title).toBe(FOG_TITLE)
      expect(place.mark).toBe('fog')
    }
  })

  it('走到失控机械后可以进入战斗，并看见新邻居', () => {
    const session = createSession(generateMap(SEED))
    const runaway = session.graph.nodes.find((node) => node.monsterId === 'runaway-machine')
    if (!runaway) throw new Error('没有失控机械')

    const beforeFog = new Set(
      toMapView(session).places.filter((place) => place.sight === 'fog').map((place) => place.id),
    )
    const moved = moveTo(session, runaway.id)
    const view = toMapView(moved)
    const fresh = view.places.filter((place) => beforeFog.has(place.id) && place.sight !== 'fog')

    expect(view.places.find((place) => place.sight === 'here')).toEqual(
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
    expect(fresh.every((place) => place.sight === 'open')).toBe(true)
    expect(view.places).toContainEqual(expect.objectContaining({
      id: 'center',
      title: '中心',
      sight: 'open',
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
    expect(view.places.find((place) => place.sight === 'here')).toEqual(
      expect.objectContaining({ id: bell.id, title: '钟楼守望者', kind: 'combat', distance: 5, mark: 'bell-warden' }),
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

  it('走到战斗节点就开战，回头走到中心则不再开战', () => {
    const session = createSession(generateMap(SEED))
    const runaway = session.graph.nodes.find((node) => node.monsterId === 'runaway-machine')
    if (!runaway) throw new Error('没有失控机械')

    const entered = arriveAt(session, runaway.id)
    expect(entered.type).toBe('enter')
    if (entered.type !== 'enter') return
    expect(entered.monsterId).toBe('runaway-machine')
    expect(entered.session.currentNodeId).toBe(runaway.id)

    const back = arriveAt(entered.session, 'center')
    expect(back.type).toBe('idle')
    expect(back.session.currentNodeId).toBe('center')
    expect(back.session.revealed.length).toBeGreaterThan(session.revealed.length)
  })

  it('从已揭开的节点走开以后，它还留在图上，但不能隔空点过去', () => {
    let session = createSession(generateMap(SEED))
    const runaway = session.graph.nodes.find((node) => node.monsterId === 'runaway-machine')
    if (!runaway) throw new Error('没有失控机械')
    session = moveTo(session, runaway.id)
    const further = moveTargets(session).find((id) => id !== 'center')
    if (!further) throw new Error('没有更远的邻居')
    expect(neighborsOf(session.graph, further)).not.toContain('center')
    session = moveTo(session, further)

    const center = toMapView(session).places.find((place) => place.id === 'center')
    expect(center).toEqual(expect.objectContaining({
      title: '中心',
      mark: 'center',
      sight: 'seen',
    }))
  })

  it('只有击败呼唤者后，回到地图才显示已抵达终点', () => {
    const session = createSession(generateMap(SEED))
    expect(toMapView(session).arrival).toBeNull()
    expect(toMapView(recordVictory(session, 'bell-warden')).arrival).toBeNull()
    expect(toMapView(recordVictory(session, 'the-caller')).arrival).toBe(ARRIVAL_COPY)
    expect(toMapView(recordVictory(session, 'the-caller')).arrival).toBe('已抵达终点')
  })
})
