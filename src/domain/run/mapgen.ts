import { nextInt, pick, shuffle, type RngState } from '../../core/Rng'
import type { Coord, NodeType } from '../types'
import { ORTHO, coordKey, manhattan } from '../types'

export interface MapNode {
  id: string
  type: NodeType
  x: number
  y: number
  visited: boolean
  completed: boolean
  lost: boolean
  revealed: boolean
  monsterId?: string
  eventId?: string
  shop?: ShopStock
}

export interface ShopOffer {
  defId: string
  price: number
}

export interface ShopStock {
  offers: ShopOffer[]
  relicId?: string
  relicPrice?: number
  relicSold?: boolean
}

const REST_TYPES: NodeType[] = ['shop', 'elite', 'chest', 'rest', 'forge']

export function generateFloor(rng: RngState): { nodes: MapNode[]; origin: Coord } {
  const origin: Coord = { x: 0, y: 0 }
  const taken = new Set<string>([coordKey(origin)])
  const coords: Coord[] = []

  const emptyAround = (c: Coord): Coord[] =>
    ORTHO.map((d) => ({ x: c.x + d.x, y: c.y + d.y })).filter((p) => !taken.has(coordKey(p)))

  const place = (c: Coord): void => {
    taken.add(coordKey(c))
    coords.push(c)
  }

  const firstNeighbors = shuffle(rng, emptyAround(origin))
  const firstN = 3 + nextInt(rng, 2)
  for (let i = 0; i < firstN && i < firstNeighbors.length; i++) place(firstNeighbors[i])

  let guard = 0
  while (coords.length < 18 && guard++ < 400) {
    const expandable = coords.filter((c) => emptyAround(c).length)
    if (!expandable.length) break
    const from = pick(rng, expandable)
    const empties = shuffle(rng, emptyAround(from))
    const add = Math.min(empties.length, 1 + nextInt(rng, 3), 18 - coords.length)
    for (let i = 0; i < add; i++) place(empties[i])
  }

  if (coords.length < 18) {
    const q = [...coords]
    while (coords.length < 18 && q.length) {
      const cur = q.shift()!
      for (const n of shuffle(rng, emptyAround(cur))) {
        place(n)
        q.push(n)
        if (coords.length >= 18) break
      }
    }
  }

  const types = assignTypes(rng, coords, firstN)
  const nodes: MapNode[] = coords.map((c, i) => ({
    id: `n${i}`,
    type: types[i],
    x: c.x,
    y: c.y,
    visited: false,
    completed: false,
    lost: false,
    revealed: manhattan(c, origin) === 1,
  }))
  return { nodes, origin }
}

function assignTypes(rng: RngState, coords: Coord[], firstN: number): NodeType[] {
  const types: NodeType[] = Array(coords.length)
  const origin: Coord = { x: 0, y: 0 }
  const dist = coords.map((c) => manhattan(c, origin))
  const max = Math.max(...dist)
  const farthest = coords.map((_, i) => i).filter((i) => dist[i] === max)
  const bossAt = pick(rng, farthest)
  types[bossAt] = 'boss'

  const firstIdx = coords.map((_, i) => i).slice(0, firstN).filter((i) => i !== bossAt)
  const firstTypes: NodeType[] = ['normal', 'normal']
  while (firstTypes.length < firstIdx.length) firstTypes.push('event')
  shuffle(rng, firstTypes)
  firstIdx.forEach((i, k) => { types[i] = firstTypes[k] ?? 'event' })

  const used = {
    normal: types.filter((t) => t === 'normal').length,
    event: types.filter((t) => t === 'event').length,
  }
  const bag: NodeType[] = [
    ...Array(Math.max(0, 5 - used.normal)).fill('normal'),
    ...Array(Math.max(0, 7 - used.event)).fill('event'),
    ...REST_TYPES,
  ]
  shuffle(rng, bag)
  let b = 0
  for (let i = 0; i < types.length; i++) {
    if (!types[i]) types[i] = bag[b++] ?? 'event'
  }
  return types
}

export function adjacentNodes(nodes: MapNode[], pos: Coord): MapNode[] {
  return nodes.filter((n) => manhattan({ x: n.x, y: n.y }, pos) === 1)
}

export function revealAround(nodes: MapNode[], pos: Coord): void {
  for (const n of adjacentNodes(nodes, pos)) n.revealed = true
}
