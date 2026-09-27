import { neighborsOf, generateMap, type MapGraph } from './generateMap'
import { ELITE_MONSTER_IDS, isMonsterId, monsterName, type MonsterId } from './monsters'

/**
 * 迷雾按第 8.2 节。
 * 开局站在中心，中心已访问，并揭示中心自己和它的相邻。
 * 走进已揭示的相邻节点后，该点变为已访问，并揭示它的相邻。
 * 可以回头。未揭示的节点不能作为移动目标。
 */
export interface MapSession {
  graph: MapGraph
  currentNodeId: string
  visited: readonly string[]
  revealed: readonly string[]
  /** 已击败的怪物种类。同种两个节点，记一次这个种类。 */
  defeatedMonsterIds: readonly MonsterId[]
}

export type FightGate = { ok: true } | { ok: false, reason: string }

function sortedUnique(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort(compareText)
}

function compareText(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function createSession(graph: MapGraph = generateMap()): MapSession {
  const center = graph.nodes.find((node) => node.kind === 'center')
  if (!center) throw new Error('地图没有中心')
  return {
    graph,
    currentNodeId: center.id,
    visited: [center.id],
    revealed: sortedUnique([center.id, ...neighborsOf(graph, center.id)]),
    defeatedMonsterIds: [],
  }
}

export function canMoveTo(session: MapSession, nodeId: string): boolean {
  if (nodeId === session.currentNodeId) return false
  if (!session.revealed.includes(nodeId)) return false
  return neighborsOf(session.graph, session.currentNodeId).includes(nodeId)
}

export function moveTargets(session: MapSession): string[] {
  return neighborsOf(session.graph, session.currentNodeId)
    .filter((id) => session.revealed.includes(id))
    .sort(compareText)
}

export function moveTo(session: MapSession, nodeId: string): MapSession {
  if (!canMoveTo(session, nodeId)) {
    throw new Error(`不能走到 ${nodeId}：只能进入已经揭示的相邻节点`)
  }
  return {
    ...session,
    currentNodeId: nodeId,
    visited: sortedUnique([...session.visited, nodeId]),
    revealed: sortedUnique([
      ...session.revealed,
      nodeId,
      ...neighborsOf(session.graph, nodeId),
    ]),
  }
}

/**
 * 按怪物种类登记。传入种类 id，不是节点 id。
 * 同一种有两个节点时，打赢其中一个就算该种类已击败。
 * 另一个同种节点仍然可以开战。
 */
export function recordVictory(session: MapSession, monsterId: string): MapSession {
  if (!isMonsterId(monsterId)) throw new Error(`未知怪物：${monsterId}`)
  if (session.defeatedMonsterIds.includes(monsterId)) return session
  return {
    ...session,
    defeatedMonsterIds: [...session.defeatedMonsterIds, monsterId].sort(compareText),
  }
}

/**
 * 空间邻接是生成约束，这里不检查玩家站在哪。
 * 商店和中心不能开战。钟楼、呼唤者按第 6.5 节锁，并写出缺什么。
 */
export function canFight(session: MapSession, nodeId: string): FightGate {
  const node = session.graph.nodes.find((item) => item.id === nodeId)
  if (!node) return { ok: false, reason: '没有这个节点' }
  if (node.kind === 'center') return { ok: false, reason: '中心不能开战' }
  if (node.kind === 'shop') return { ok: false, reason: '商店不能开战' }
  if (!node.monsterId) return { ok: false, reason: '这个节点不能开战' }

  const defeated = new Set(session.defeatedMonsterIds)
  if (node.monsterId === 'bell-warden') return bellGate(defeated)
  if (node.monsterId === 'the-caller') return callerGate(defeated)
  return { ok: true }
}

function bellGate(defeated: ReadonlySet<MonsterId>): FightGate {
  const missing = ELITE_MONSTER_IDS.filter((id) => !defeated.has(id))
  const have = ELITE_MONSTER_IDS.length - missing.length
  if (have >= 2) return { ok: true }
  const names = missing.map((id) => monsterName(id)).join('、')
  return {
    ok: false,
    reason: `钟楼守望者还不能开战，精英种类还缺 ${2 - have} 种，尚未击败：${names}`,
  }
}

function callerGate(defeated: ReadonlySet<MonsterId>): FightGate {
  const missing: string[] = []
  if (!defeated.has('bell-warden')) missing.push(monsterName('bell-warden'))
  for (const elite of ELITE_MONSTER_IDS) {
    if (!defeated.has(elite)) missing.push(monsterName(elite))
  }
  if (missing.length === 0) return { ok: true }
  return { ok: false, reason: `呼唤者还不能开战，缺少${missing.join('、')}` }
}
