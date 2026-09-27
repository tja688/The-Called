import {
  canFight,
  monsterName,
  moveTargets,
  type MapNode,
  type MapSession,
} from '../../map'

/** 商店节点的固定说明。货架还没有真正出售。 */
export const SHOP_SHELF_COPY = '货架上只有巨大卡背，暂不出售。'

/** 击败呼唤者后留在地图上的通关文案。 */
export const ARRIVAL_COPY = '已抵达终点'

export interface MapPlaceView {
  id: string
  kind: MapNode['kind']
  /** 中心、商店，或怪物中文名。 */
  title: string
  /** 到中心的最短边数。 */
  distance: number
  role: 'here' | 'neighbor'
}

export type MapAction =
  | { type: 'idle' }
  | { type: 'shop', text: string }
  | { type: 'enter', monsterId: string, nodeId: string }
  | { type: 'locked', reason: string }

export interface MapViewModel {
  /** 当前节点在前，后面是已揭示邻居。未揭示的节点不在这里。 */
  places: MapPlaceView[]
  action: MapAction
  /** 击败呼唤者后才有。失败不会登记，这句话也就不出现。 */
  arrival: string | null
}

function findNode(session: MapSession, id: string): MapNode {
  const node = session.graph.nodes.find((item) => item.id === id)
  if (!node) throw new Error(`没有节点 ${id}`)
  return node
}

function toPlace(node: MapNode, role: MapPlaceView['role']): MapPlaceView {
  if (node.kind === 'combat') {
    if (!node.monsterId) throw new Error(`${node.id} 没有怪物`)
    return {
      id: node.id,
      kind: node.kind,
      title: monsterName(node.monsterId),
      distance: node.tier,
      role,
    }
  }
  return {
    id: node.id,
    kind: node.kind,
    title: node.kind === 'center' ? '中心' : '商店',
    distance: node.tier,
    role,
  }
}

function toAction(session: MapSession, node: MapNode): MapAction {
  if (node.kind === 'shop') return { type: 'shop', text: SHOP_SHELF_COPY }
  if (node.kind !== 'combat') return { type: 'idle' }
  const gate = canFight(session, node.id)
  if (!gate.ok) return { type: 'locked', reason: gate.reason }
  if (!node.monsterId) return { type: 'locked', reason: '这个节点不能开战' }
  return { type: 'enter', monsterId: node.monsterId, nodeId: node.id }
}

/**
 * 玩家眼前只有当前节点，以及从这里能走到的已揭示邻居。
 * 开战是否放行只看当前节点，锁定原因原样来自 canFight。
 */
export function toMapView(session: MapSession): MapViewModel {
  const here = findNode(session, session.currentNodeId)
  const neighbors = moveTargets(session).map((id) => toPlace(findNode(session, id), 'neighbor'))
  return {
    places: [toPlace(here, 'here'), ...neighbors],
    action: toAction(session, here),
    arrival: session.defeatedMonsterIds.includes('the-caller') ? ARRIVAL_COPY : null,
  }
}
