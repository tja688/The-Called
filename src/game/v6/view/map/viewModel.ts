import {
  canFight,
  canMoveTo,
  moveTo,
  type ForkMonsterId,
  type MapNode,
  type MapSession,
} from '../../map'

export type MapSight = 'here' | 'open' | 'seen'

export type MapMarkId = 'start' | ForkMonsterId

export interface MapPlaceView {
  id: string
  kind: MapNode['kind']
  title: string
  distance: number
  sight: MapSight
  mark: MapMarkId
}

export type MapAction =
  | { type: 'idle' }
  | { type: 'enter'; monsterId: string; nodeId: string }

export interface MapViewModel {
  places: MapPlaceView[]
  action: MapAction
  arrival: string | null
}

export type MapArrival =
  | { type: 'idle'; session: MapSession }
  | { type: 'enter'; session: MapSession; monsterId: string; nodeId: string }

function findNode(session: MapSession, id: string): MapNode {
  const node = session.graph.nodes.find((item) => item.id === id)
  if (!node) throw new Error(`没有节点 ${id}`)
  return node
}

function sightOf(session: MapSession, node: MapNode): MapSight {
  if (node.id === session.currentNodeId) return 'here'
  if (canMoveTo(session, node.id)) return 'open'
  return 'seen'
}

function markOf(node: MapNode): MapMarkId {
  if (node.kind === 'start') return 'start'
  if (node.monsterId) return node.monsterId
  throw new Error(`节点 ${node.id} 没有标记`)
}

function toPlace(session: MapSession, node: MapNode): MapPlaceView {
  return {
    id: node.id,
    kind: node.kind,
    title: node.title,
    distance: node.tier,
    sight: sightOf(session, node),
    mark: markOf(node),
  }
}

function toAction(session: MapSession, node: MapNode): MapAction {
  if (node.kind !== 'combat') return { type: 'idle' }
  const gate = canFight(session, node.id)
  if (!gate.ok || !node.monsterId) return { type: 'idle' }
  return { type: 'enter', monsterId: node.monsterId, nodeId: node.id }
}

/** 四节点都露在外面。能走的只有相邻节点，打过的战斗还能再进。 */
export function toMapView(session: MapSession): MapViewModel {
  const here = findNode(session, session.currentNodeId)
  return {
    places: session.graph.nodes.map((node) => toPlace(session, node)),
    action: toAction(session, here),
    arrival: null,
  }
}

/** 走到相邻节点。战斗在到达时开始，不另放一个按钮。 */
export function arriveAt(session: MapSession, nodeId: string): MapArrival {
  const next = moveTo(session, nodeId)
  const action = toMapView(next).action
  if (action.type === 'enter') {
    return { type: 'enter', session: next, monsterId: action.monsterId, nodeId: action.nodeId }
  }
  return { type: 'idle', session: next }
}
