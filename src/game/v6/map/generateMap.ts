import {
  ELITE_MONSTER_IDS,
  MONSTER_COUNT,
  MONSTER_IDS,
  MONSTER_TIER,
  type MonsterId,
} from './monsters'
import { createRng, pick, shuffle } from './rng'

/** TODO 文档未定：第 8.2 节建议默认种子。 */
export const DEFAULT_MAP_SEED = 20260926

/** TODO 文档未定：第 8.2 节建议默认，中心 1、战斗 16、商店 4，一共 21。 */
const COMBAT_COUNT = 16
const SHOP_COUNT = 4
const NODE_COUNT = 1 + COMBAT_COUNT + SHOP_COUNT

/** TODO 文档未定：商店放在距离 1 到 4。距离 5、6 没有商店。 */
const SHOP_TIERS = [1, 2, 3, 4] as const

/**
 * 同层环只串同一条战斗线。
 * 锈蚀线：巡检蜂群、布道团、锈蚀巨像、解剖学家、缄默修会。
 * 食腐线：镜中人、食腐鸦群、镜渊魔女。
 * 呼唤者不进环，钟楼不进环。
 */
const SAME_TIER_GROUPS: readonly (readonly MonsterId[])[] = [
  ['patrol-swarm', 'preaching-band'],
  ['mirror-person'],
  ['rust-colossus'],
  ['carrion-crows'],
  ['anatomist', 'silent-order'],
]

const RUST_BRANCH = new Set<MonsterId>([
  'patrol-swarm',
  'preaching-band',
  'rust-colossus',
  'anatomist',
  'silent-order',
])

const MIRROR_BRANCH = new Set<MonsterId>([
  'mirror-person',
  'carrion-crows',
  'mirror-witch',
])

export type MapNodeKind = 'center' | 'combat' | 'shop'

export interface MapNode {
  id: string
  kind: MapNodeKind
  /** 指定距离档。最短边数必须等于它。 */
  tier: number
  monsterId: MonsterId | null
}

export interface MapGraph {
  seed: number
  nodes: readonly MapNode[]
  /** 无向边。两端按字典序，列表同样排好。 */
  edges: readonly (readonly [string, string])[]
}

class EdgeSet {
  private readonly keys = new Set<string>()

  add(a: string, b: string): void {
    if (a === b) throw new Error(`不能连自身：${a}`)
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    this.keys.add(key)
  }

  neighbors(id: string): string[] {
    const found: string[] = []
    for (const key of this.keys) {
      const cut = key.indexOf('|')
      const left = key.slice(0, cut)
      const right = key.slice(cut + 1)
      if (left === id) found.push(right)
      else if (right === id) found.push(left)
    }
    return found.sort(compareText)
  }

  list(): [string, string][] {
    return [...this.keys].sort(compareText).map((key) => {
      const cut = key.indexOf('|')
      return [key.slice(0, cut), key.slice(cut + 1)]
    })
  }
}

function compareText(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function compareNode(a: MapNode, b: MapNode): number {
  return a.tier - b.tier || compareText(a.id, b.id)
}

function idsOf(nodes: readonly MapNode[], monsterId: MonsterId): string[] {
  return nodes.filter((node) => node.monsterId === monsterId).map((node) => node.id).sort(compareText)
}

function placeNodes(): MapNode[] {
  const nodes: MapNode[] = [
    { id: 'center', kind: 'center', tier: 0, monsterId: null },
  ]

  for (const tier of SHOP_TIERS) {
    nodes.push({ id: `shop:${tier}`, kind: 'shop', tier, monsterId: null })
  }

  for (const monsterId of MONSTER_IDS) {
    const count = MONSTER_COUNT[monsterId]
    for (let index = 0; index < count; index += 1) {
      nodes.push({
        id: count === 1 ? monsterId : `${monsterId}:${index + 1}`,
        kind: 'combat',
        tier: MONSTER_TIER[monsterId],
        monsterId,
      })
    }
  }

  nodes.sort(compareNode)
  return nodes
}

function assertRoster(nodes: readonly MapNode[]): void {
  if (nodes.length !== NODE_COUNT) throw new Error(`节点数是 ${nodes.length}，期望 ${NODE_COUNT}`)
  const combat = nodes.filter((node) => node.kind === 'combat')
  const shops = nodes.filter((node) => node.kind === 'shop')
  const centers = nodes.filter((node) => node.kind === 'center')
  if (combat.length !== COMBAT_COUNT) throw new Error('战斗节点数量不对')
  if (shops.length !== SHOP_COUNT) throw new Error('商店数量不对')
  if (centers.length !== 1 || centers[0]?.tier !== 0) throw new Error('中心应当有且只有一个')

  for (const monsterId of MONSTER_IDS) {
    const found = combat.filter((node) => node.monsterId === monsterId)
    if (found.length !== MONSTER_COUNT[monsterId]) throw new Error(`${monsterId} 数量不对`)
    for (const node of found) {
      if (node.tier !== MONSTER_TIER[monsterId]) throw new Error(`${monsterId} 档位不对`)
    }
  }
}

/**
 * 上一层的合法父节点。调用方从这里面直接取，不存在「抽到不合法再重来」。
 * 锈蚀巨像只从巡检蜂群、布道团里选，不选镜中人。
 * 食腐鸦群只从镜中人里选。
 */
function legalParentIds(node: MapNode, nodes: readonly MapNode[]): string[] {
  if (node.kind === 'shop') {
    if (node.tier === 1) return ['center']
    // TODO 文档未定：商店该挂哪条战斗线。这里串在中心外侧，避免把两条线并起来。
    return [`shop:${node.tier - 1}`]
  }
  if (node.monsterId === 'runaway-machine') return ['center']
  // 三条一阶都挂在失控机械上，对应「击败失控机械，同时解锁」。
  if (node.tier === 2 && node.kind === 'combat') return idsOf(nodes, 'runaway-machine')
  if (node.monsterId === 'rust-colossus') {
    return [...idsOf(nodes, 'patrol-swarm'), ...idsOf(nodes, 'preaching-band')].sort(compareText)
  }
  if (node.monsterId === 'carrion-crows') return idsOf(nodes, 'mirror-person')
  if (node.monsterId === 'anatomist' || node.monsterId === 'silent-order') {
    return idsOf(nodes, 'rust-colossus')
  }
  if (node.monsterId === 'mirror-witch') return idsOf(nodes, 'carrion-crows')
  throw new Error(`没有父节点规则：${node.id}`)
}

function monsterIdsInGroup(nodes: readonly MapNode[], monsterIds: readonly MonsterId[]): string[] {
  return nodes
    .filter((node) => node.monsterId !== null && monsterIds.includes(node.monsterId))
    .map((node) => node.id)
    .sort(compareText)
}

function assertBuilt(nodes: readonly MapNode[], edges: EdgeSet, byId: ReadonlyMap<string, MapNode>): void {
  const tierOf = new Map(nodes.map((node) => [node.id, node.tier]))
  for (const node of nodes) {
    if (node.tier === 0) continue
    const hasLower = edges.neighbors(node.id).some((id) => tierOf.get(id) === node.tier - 1)
    if (!hasLower) throw new Error(`${node.id} 没有连到上一层`)
  }

  const caller = nodes.find((node) => node.monsterId === 'the-caller')
  const bell = nodes.find((node) => node.monsterId === 'bell-warden')
  if (!caller || !bell) throw new Error('缺少钟楼或呼唤者')
  const callerNeighbors = edges.neighbors(caller.id)
  if (callerNeighbors.length !== 1 || callerNeighbors[0] !== bell.id) {
    throw new Error('呼唤者只能连钟楼守望者')
  }

  const eliteKinds = new Set(
    edges.neighbors(bell.id)
      .map((id) => byId.get(id)?.monsterId)
      .filter((id): id is MonsterId => id !== null && id !== undefined && ELITE_MONSTER_IDS.includes(id)),
  )
  if (eliteKinds.size < 2) throw new Error('钟楼没有连上两种精英')

  for (const shop of nodes) {
    if (shop.kind !== 'shop') continue
    const kinds = edges.neighbors(shop.id).map((id) => byId.get(id)?.monsterId ?? null)
    const touchesRust = kinds.some((id) => id !== null && RUST_BRANCH.has(id))
    const touchesMirror = kinds.some((id) => id !== null && MIRROR_BRANCH.has(id))
    if (touchesRust && touchesMirror) throw new Error(`${shop.id} 把两条战斗线并在一起`)
  }
}

/**
 * 按层放节点，再逐层连到上一层的合法父节点，最后同层成环。
 * 档差大于 1 的边直接抛错，不重新抽一张图。
 */
export function generateMap(seed: number = DEFAULT_MAP_SEED): MapGraph {
  const rng = createRng(seed)
  const nodes = placeNodes()
  assertRoster(nodes)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges = new EdgeSet()

  const link = (a: string, b: string) => {
    const left = byId.get(a)
    const right = byId.get(b)
    if (!left || !right) throw new Error(`边端点不存在：${a}—${b}`)
    if (Math.abs(left.tier - right.tier) > 1) throw new Error(`跨档捷径：${a}—${b}`)
    if (left.monsterId === 'the-caller' && right.monsterId !== 'bell-warden') {
      throw new Error('呼唤者只能连钟楼守望者')
    }
    if (right.monsterId === 'the-caller' && left.monsterId !== 'bell-warden') {
      throw new Error('呼唤者只能连钟楼守望者')
    }
    const pair = [left.monsterId, right.monsterId]
    const crosses = pair.includes('rust-colossus') && pair.some((id) => id !== null && MIRROR_BRANCH.has(id))
    if (crosses) throw new Error(`锈蚀巨像不能直接连上食腐线：${a}—${b}`)
    edges.add(a, b)
  }

  for (const node of nodes) {
    if (node.kind === 'center') continue
    if (node.monsterId === 'bell-warden' || node.monsterId === 'the-caller') continue
    const parents = legalParentIds(node, nodes)
    if (parents.length === 0) throw new Error(`${node.id} 没有合法的上一层`)
    const parentId = parents.length === 1 ? parents[0] : pick(parents, rng)
    if (parentId === undefined) throw new Error(`${node.id} 没有合法的上一层`)
    link(node.id, parentId)
  }

  // 取舍：钟楼与三种精英都相邻，强于「至少两种」，两条线都能走到钟楼。种子不改这条。
  const bell = nodes.find((node) => node.monsterId === 'bell-warden')
  const caller = nodes.find((node) => node.monsterId === 'the-caller')
  if (!bell || !caller) throw new Error('缺少钟楼或呼唤者')
  for (const elite of ELITE_MONSTER_IDS) {
    for (const eliteId of idsOf(nodes, elite)) link(bell.id, eliteId)
  }
  link(caller.id, bell.id)

  for (const group of SAME_TIER_GROUPS) {
    const ids = monsterIdsInGroup(nodes, group)
    const tiers = new Set(ids.map((id) => byId.get(id)?.tier))
    if (tiers.size !== 1) throw new Error('同层环跨了档')
    const order = shuffle(ids, rng)
    if (order.length < 2) continue
    for (let index = 0; index < order.length; index += 1) {
      const current = order[index]
      const next = order[(index + 1) % order.length]
      if (current === undefined || next === undefined) throw new Error('同层环下标越界')
      link(current, next)
    }
  }

  assertBuilt(nodes, edges, byId)
  return { seed, nodes, edges: edges.list() }
}

export function neighborsOf(graph: MapGraph, nodeId: string): string[] {
  const found: string[] = []
  for (const [left, right] of graph.edges) {
    if (left === nodeId) found.push(right)
    else if (right === nodeId) found.push(left)
  }
  return found.sort(compareText)
}
