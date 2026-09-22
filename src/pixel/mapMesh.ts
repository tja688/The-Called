/**
 * 地图的画面坐标。规则仍是正交格子；这里把格子放松成自由网格，
 * 边可以斜、可以弯。同一局种子只排一次，后加的节点（下层出口）贴在邻居上，不挪已有的点。
 */

export interface MeshPoint {
  x: number
  y: number
}

export interface MeshNode {
  id: string
  x: number
  y: number
}

export interface Mesh {
  at(id: string): MeshPoint
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

interface Solved {
  pos: Map<string, MeshPoint>
  ang: number
}

const cache = new Map<number, Solved>()

function unit(seed: number, x: number, y: number, salt: number): number {
  let h = Math.imul(seed ^ Math.imul(x + 23, 0x9e3779b1) ^ Math.imul(y - 11, 0x85ebca6b) ^ Math.imul(salt, 0x27d4eb2d), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return ((h ^ (h >>> 16)) >>> 0 & 0xffff) / 0xffff
}

function rot(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a), s = Math.sin(a)
  return [x * c - y * s, x * s + y * c]
}

function homeOf(n: MeshNode): MeshPoint {
  return { x: n.x * 64 + n.y * 22, y: n.y * 56 - n.x * 14 }
}

function solve(nodes: MeshNode[], seed: number): Solved {
  const pos = new Map<string, MeshPoint>()
  const home = new Map<string, MeshPoint>()
  for (const n of nodes) {
    const h = homeOf(n)
    pos.set(n.id, {
      x: h.x + (unit(seed, n.x, n.y, 1) - 0.5) * 48,
      y: h.y + (unit(seed, n.x, n.y, 2) - 0.5) * 42,
    })
    home.set(n.id, h)
  }
  const edges: [string, string][] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) edges.push([a.id, b.id])
    }
  }
  for (let iter = 0; iter < 72; iter++) {
    const force = new Map<string, MeshPoint>()
    for (const n of nodes) force.set(n.id, { x: 0, y: 0 })
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = pos.get(nodes[i].id)!
        const B = pos.get(nodes[j].id)!
        let dx = A.x - B.x, dy = A.y - B.y
        let d = Math.hypot(dx, dy)
        if (d < 0.5) { dx = 1; dy = 0; d = 1 }
        if (d >= 120) continue
        const push = (120 - d) * 0.07
        const ux = dx / d, uy = dy / d
        const fa = force.get(nodes[i].id)!, fb = force.get(nodes[j].id)!
        fa.x += ux * push; fa.y += uy * push
        fb.x -= ux * push; fb.y -= uy * push
      }
    }
    for (const [ia, ib] of edges) {
      const a = nodes.find((n) => n.id === ia)!
      const b = nodes.find((n) => n.id === ib)!
      const A = pos.get(ia)!, B = pos.get(ib)!
      const dx = B.x - A.x, dy = B.y - A.y
      const d = Math.hypot(dx, dy) || 1
      const rest = 58 + unit(seed, a.x * 3 + b.x, a.y * 5 + b.y, 8) * 34
      const pull = (d - rest) * 0.18
      const ux = dx / d, uy = dy / d
      const fa = force.get(ia)!, fb = force.get(ib)!
      fa.x += ux * pull; fa.y += uy * pull
      fb.x -= ux * pull; fb.y -= uy * pull
    }
    for (const n of nodes) {
      const p = pos.get(n.id)!, h = home.get(n.id)!, f = force.get(n.id)!
      f.x += (h.x - p.x) * 0.012
      f.y += (h.y - p.y) * 0.012
      const mag = Math.hypot(f.x, f.y)
      if (mag > 9) { f.x = (f.x / mag) * 9; f.y = (f.y / mag) * 9 }
      p.x += f.x
      p.y += f.y
    }
  }
  let cx = 0, cy = 0
  for (const n of nodes) { const p = pos.get(n.id)!; cx += p.x; cy += p.y }
  cx /= nodes.length
  cy /= nodes.length
  const ang = (unit(seed, 3, 5, 9) - 0.5) * 0.55
  for (const n of nodes) {
    const p = pos.get(n.id)!
    const [rx, ry] = rot(p.x - cx, p.y - cy, ang)
    p.x = cx + rx + (unit(seed, n.x, n.y, 5) - 0.5) * 32
    p.y = cy + ry + (unit(seed, n.x, n.y, 6) - 0.5) * 32
  }
  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = pos.get(nodes[i].id)!
        const B = pos.get(nodes[j].id)!
        let dx = A.x - B.x, dy = A.y - B.y
        let d = Math.hypot(dx, dy)
        if (d >= 50 || d < 0.1) continue
        const push = (50 - d) / d * 0.5
        A.x += dx * push
        A.y += dy * push
        B.x -= dx * push
        B.y -= dy * push
      }
    }
  }
  return { pos, ang }
}

function placeNew(solved: Solved, n: MeshNode, all: MeshNode[], seed: number): void {
  const parent = all.find((p) => solved.pos.has(p.id) && Math.abs(p.x - n.x) + Math.abs(p.y - n.y) === 1)
  const base = solved.pos.get(parent?.id ?? 'hub') ?? { x: 0, y: 0 }
  const px = parent?.x ?? 0
  const py = parent?.y ?? 0
  const dx = n.x - px
  const dy = n.y - py
  const vx = dx * 68 + dy * 16 + (unit(seed, n.x, n.y, 3) - 0.5) * 14
  const vy = dy * 58 - dx * 12 + (unit(seed, n.x, n.y, 4) - 0.5) * 12
  const [rx, ry] = rot(vx, vy, solved.ang)
  const np = { x: base.x + rx, y: base.y + ry }
  for (const p of solved.pos.values()) {
    let ddx = np.x - p.x, ddy = np.y - p.y
    let d = Math.hypot(ddx, ddy)
    if (d >= 50 || d < 0.1) continue
    const push = (50 - d) / d
    np.x += ddx * push
    np.y += ddy * push
    ddx = np.x - p.x
    ddy = np.y - p.y
    d = Math.hypot(ddx, ddy)
  }
  solved.pos.set(n.id, np)
}

export function resetMeshCache(): void {
  cache.clear()
}

export function layoutMesh(nodes: MeshNode[], seed: number): Mesh {
  let solved = cache.get(seed)
  if (!solved) {
    solved = solve([{ id: 'hub', x: 0, y: 0 }, ...nodes], seed)
    cache.set(seed, solved)
  } else {
    for (const n of nodes) if (!solved.pos.has(n.id)) placeNew(solved, n, nodes, seed)
  }
  const ids = ['hub', ...nodes.map((n) => n.id)]
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const id of ids) {
    const p = solved.pos.get(id)
    if (!p) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0 }
  return {
    at(id: string): MeshPoint {
      const p = solved!.pos.get(id) ?? { x: 0, y: 0 }
      return { x: p.x, y: p.y }
    },
    bounds: { minX, minY, maxX, maxY },
  }
}

/** 走廊中点的侧向弯度。同一条边每次一样。 */
export function edgeBow(seed: number, a: string, b: string): number {
  const lo = a < b ? a : b
  const hi = a < b ? b : a
  let h = 2166136261
  const s = `${seed}:${lo}:${hi}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (((h >>> 0) % 1000) / 999 - 0.5) * 28
}
