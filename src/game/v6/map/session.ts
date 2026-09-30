import { forkGraph, neighborsOf, type MapGraph } from './fork'

export interface MapSession {
  graph: MapGraph
  currentNodeId: string
  visited: readonly string[]
}

export type FightGate = { ok: true } | { ok: false; reason: string }

function sortedUnique(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort(compareText)
}

function compareText(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function createSession(graph: MapGraph = forkGraph()): MapSession {
  const start = graph.nodes.find((node) => node.kind === 'start')
  if (!start) throw new Error('地图没有起点')
  return {
    graph,
    currentNodeId: start.id,
    visited: [start.id],
  }
}

export function canMoveTo(session: MapSession, nodeId: string): boolean {
  if (nodeId === session.currentNodeId) return false
  return neighborsOf(session.graph, session.currentNodeId).includes(nodeId)
}

export function moveTargets(session: MapSession): string[] {
  return neighborsOf(session.graph, session.currentNodeId)
}

export function moveTo(session: MapSession, nodeId: string): MapSession {
  if (!canMoveTo(session, nodeId)) {
    throw new Error(`不能走到 ${nodeId}：只能进入相邻节点`)
  }
  return {
    ...session,
    currentNodeId: nodeId,
    visited: sortedUnique([...session.visited, nodeId]),
  }
}

/** 战斗节点随时可打，打过也能再打。起点不能开战。 */
export function canFight(session: MapSession, nodeId: string): FightGate {
  const node = session.graph.nodes.find((item) => item.id === nodeId)
  if (!node) return { ok: false, reason: '没有这个节点' }
  if (node.kind !== 'combat' || !node.monsterId) return { ok: false, reason: '起点不能开战' }
  return { ok: true }
}
