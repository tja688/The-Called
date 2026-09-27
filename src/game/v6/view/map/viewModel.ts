import {
  canFight,
  canMoveTo,
  monsterName,
  moveTo,
  type MapNode,
  type MapSession,
  type MonsterId,
} from '../../map'

/** 商店节点的固定说明。货架还没有真正出售。 */
export const SHOP_SHELF_COPY = '货架上只有巨大卡背，暂不出售。'

/** 击败呼唤者后留在地图上的通关文案。 */
export const ARRIVAL_COPY = '已抵达终点'

/** 迷雾里的节点不暴露名字，图案也统一。 */
export const FOG_TITLE = '未探明'

export type MapSight = 'here' | 'open' | 'seen' | 'fog'

/** 揭开之后用这个图案。迷雾一律是 fog，不按怪物种类区分。 */
export type MapMarkId = 'fog' | 'center' | 'shop' | MonsterId

export interface MapPlaceView {
  id: string
  kind: MapNode['kind']
  /** 迷雾中固定为「未探明」，避免名字先泄漏。 */
  title: string
  /** 到中心的最短边数。 */
  distance: number
  sight: MapSight
  mark: MapMarkId
}

export type MapAction =
  | { type: 'idle' }
  | { type: 'shop', text: string }
  | { type: 'enter', monsterId: string, nodeId: string }
  | { type: 'locked', reason: string }

export interface MapViewModel {
  /** 整张图都在。迷雾节点也占位，只是身份收起来。 */
  places: MapPlaceView[]
  action: MapAction
  /** 击败呼唤者后才有。失败不会登记，这句话也就不出现。 */
  arrival: string | null
}

export type MapArrival =
  | { type: 'idle', session: MapSession }
  | { type: 'shop', session: MapSession, text: string }
  | { type: 'enter', session: MapSession, monsterId: string, nodeId: string }
  | { type: 'locked', session: MapSession, reason: string }

function findNode(session: MapSession, id: string): MapNode {
  const node = session.graph.nodes.find((item) => item.id === id)
  if (!node) throw new Error(`没有节点 ${id}`)
  return node
}

function sightOf(session: MapSession, node: MapNode): MapSight {
  if (node.id === session.currentNodeId) return 'here'
  if (!session.revealed.includes(node.id)) return 'fog'
  if (canMoveTo(session, node.id)) return 'open'
  return 'seen'
}

function markOf(node: MapNode, sight: MapSight): MapMarkId {
  if (sight === 'fog') return 'fog'
  if (node.kind === 'center') return 'center'
  if (node.kind === 'shop') return 'shop'
  if (!node.monsterId) return 'fog'
  return node.monsterId
}

function titleOf(node: MapNode, sight: MapSight): string {
  if (sight === 'fog') return FOG_TITLE
  if (node.kind === 'center') return '中心'
  if (node.kind === 'shop') return '商店'
  if (!node.monsterId) return FOG_TITLE
  return monsterName(node.monsterId)
}

function toPlace(session: MapSession, node: MapNode): MapPlaceView {
  const sight = sightOf(session, node)
  return {
    id: node.id,
    kind: node.kind,
    title: titleOf(node, sight),
    distance: node.tier,
    sight,
    mark: markOf(node, sight),
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
 * 全图都列出来。能走的只有已揭示的相邻节点。
 * 更早揭开、现在够不着的节点留着真图案，但不能直接点过去。
 * 开战是否放行只看当前节点，锁定原因原样来自 canFight。
 */
export function toMapView(session: MapSession): MapViewModel {
  const here = findNode(session, session.currentNodeId)
  return {
    places: session.graph.nodes.map((node) => toPlace(session, node)),
    action: toAction(session, here),
    arrival: session.defeatedMonsterIds.includes('the-caller') ? ARRIVAL_COPY : null,
  }
}

/**
 * 走到一个已揭示的相邻节点，并带上到达后要发生的事。
 * 战斗在到达时开始，不另放一个按钮。锁定和商店只留下说明。
 */
export function arriveAt(session: MapSession, nodeId: string): MapArrival {
  const next = moveTo(session, nodeId)
  const action = toMapView(next).action
  if (action.type === 'enter') {
    return { type: 'enter', session: next, monsterId: action.monsterId, nodeId: action.nodeId }
  }
  if (action.type === 'shop') return { type: 'shop', session: next, text: action.text }
  if (action.type === 'locked') return { type: 'locked', session: next, reason: action.reason }
  return { type: 'idle', session: next }
}
