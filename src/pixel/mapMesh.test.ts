import { beforeEach, describe, expect, it } from 'vitest'
import { edgeBow, layoutMesh, resetMeshCache, type MeshNode } from './mapMesh'

const nodes: MeshNode[] = [
  { id: 'n0', x: 1, y: 0 },
  { id: 'n1', x: 0, y: 1 },
  { id: 'n2', x: -1, y: 0 },
  { id: 'n3', x: 2, y: 0 },
  { id: 'n4', x: 1, y: 1 },
  { id: 'n5', x: 2, y: 1 },
]

describe('layoutMesh', () => {
  beforeEach(() => resetMeshCache())

  it('同一种子排出来的点不变', () => {
    const a = layoutMesh(nodes, 7)
    resetMeshCache()
    const b = layoutMesh(nodes, 7)
    expect(b.at('n0')).toEqual(a.at('n0'))
    expect(b.at('hub')).toEqual(a.at('hub'))
  })

  it('后加的节点不挪动已经排好的点', () => {
    const a = layoutMesh(nodes, 7)
    const b = layoutMesh([...nodes, { id: 'next', x: 3, y: 1 }], 7)
    expect(b.at('n3')).toEqual(a.at('n3'))
    expect(b.at('hub')).toEqual(a.at('hub'))
    const next = b.at('next')
    const near = b.at('n5')
    expect(Math.hypot(next.x - near.x, next.y - near.y)).toBeGreaterThan(30)
  })

  it('正交邻居在画面上不再横平竖直，也不会叠在一起', () => {
    const m = layoutMesh(nodes, 11)
    const pairs: [string, string, number, number][] = [
      ['hub', 'n0', 1, 0],
      ['hub', 'n1', 0, 1],
      ['hub', 'n2', -1, 0],
      ['n0', 'n3', 1, 0],
      ['n0', 'n4', 0, 1],
    ]
    const slanted = pairs.filter(([a, b]) => {
      const A = m.at(a), B = m.at(b)
      return Math.min(Math.abs(A.x - B.x), Math.abs(A.y - B.y)) > 8
    })
    expect(slanted.length).toBeGreaterThanOrEqual(3)
    const ids = ['hub', ...nodes.map((n) => n.id)]
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = m.at(ids[i]), B = m.at(ids[j])
        expect(Math.hypot(A.x - B.x, A.y - B.y)).toBeGreaterThan(36)
      }
    }
  })

  it('走廊弯度稳定且不是零', () => {
    expect(edgeBow(3, 'a', 'b')).toBe(edgeBow(3, 'b', 'a'))
    expect(Math.abs(edgeBow(3, 'a', 'b'))).toBeGreaterThan(0.5)
  })
})
