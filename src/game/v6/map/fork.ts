/** 固定的四节点：起点连出三场战斗，三路从开局都能走。 */

export const FORK_MONSTERS = [
  { nodeId: 'battle:monster.001', monsterId: 'monster.001', title: '失控机械' },
  { nodeId: 'battle:monster.002', monsterId: 'monster.002', title: '活数据库' },
  { nodeId: 'battle:monster.003', monsterId: 'monster.003', title: '废燃泰坦' },
] as const

export type ForkMonsterId = (typeof FORK_MONSTERS)[number]['monsterId']

export type MapNodeKind = 'start' | 'combat'

export interface MapNode {
  id: string
  kind: MapNodeKind
  tier: number
  title: string
  monsterId?: ForkMonsterId
}

export interface MapGraph {
  nodes: MapNode[]
  edges: Array<[string, string]>
}

export function forkGraph(titles?: Readonly<Record<string, string>>): MapGraph {
  return {
    nodes: [
      { id: 'start', kind: 'start', tier: 0, title: '起点' },
      ...FORK_MONSTERS.map((monster) => ({
        id: monster.nodeId,
        kind: 'combat' as const,
        tier: 1,
        title: titles?.[monster.monsterId] ?? monster.title,
        monsterId: monster.monsterId,
      })),
    ],
    edges: FORK_MONSTERS.map((monster) => ['start', monster.nodeId] as [string, string]),
  }
}

export function neighborsOf(graph: MapGraph, nodeId: string): string[] {
  const found: string[] = []
  for (const [left, right] of graph.edges) {
    if (left === nodeId) found.push(right)
    else if (right === nodeId) found.push(left)
  }
  return found.sort(compareText)
}

function compareText(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
