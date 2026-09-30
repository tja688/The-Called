import { describe, expect, it } from 'vitest'
import { FORK_MONSTERS, forkGraph } from '../../map'
import {
  fitMapFrame,
  layoutMap,
  MAP_CENTER,
  MAP_SCREEN_INSET,
  MAP_SIZE,
  FORK_REACH,
  projectPlot,
} from './layout'

describe('地图布局', () => {
  it('起点在下，三支在上，互不叠在一起', () => {
    const plots = layoutMap(forkGraph())
    expect(plots.map((plot) => plot.id).sort()).toEqual(['battle:monster.001', 'battle:monster.002', 'battle:monster.003', 'start'])

    const start = plots.find((plot) => plot.id === 'start')
    const left = plots.find((plot) => plot.id === FORK_MONSTERS[0].nodeId)
    const mid = plots.find((plot) => plot.id === FORK_MONSTERS[1].nodeId)
    const right = plots.find((plot) => plot.id === FORK_MONSTERS[2].nodeId)
    expect(start && left && mid && right).toBeTruthy()
    if (!start || !left || !mid || !right) return

    expect(start.y).toBeGreaterThan(left.y)
    expect(start.y).toBeGreaterThan(mid.y)
    expect(start.y).toBeGreaterThan(right.y)
    expect(left.x).toBeLessThan(mid.x)
    expect(right.x).toBeGreaterThan(mid.x)
    expect(mid.x).toBe(MAP_CENTER)

    for (const plot of plots) {
      expect(plot.x).toBeGreaterThan(36)
      expect(plot.y).toBeGreaterThan(36)
      expect(plot.x).toBeLessThan(MAP_SIZE - 36)
      expect(plot.y).toBeLessThan(MAP_SIZE - 36)
      expect(Math.hypot(plot.x - MAP_CENTER, plot.y - MAP_CENTER)).toBeLessThanOrEqual(FORK_REACH)
    }

    const pairs = [start, left, mid, right]
    for (let i = 0; i < pairs.length; i += 1) {
      for (let j = i + 1; j < pairs.length; j += 1) {
        const a = pairs[i]
        const b = pairs[j]
        if (!a || !b) continue
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(70)
      }
    }
  })

  it('同一张图排两次，位置不变', () => {
    const graph = forkGraph()
    expect(layoutMap(graph)).toEqual(layoutMap(graph))
  })

  it('外圈贴着画面四边，中心留在留白后的正中', () => {
    const frame = fitMapFrame(1600, 900)
    const right = projectPlot(MAP_CENTER + FORK_REACH, MAP_CENTER, frame)
    const left = projectPlot(MAP_CENTER - FORK_REACH, MAP_CENTER, frame)
    const top = projectPlot(MAP_CENTER, MAP_CENTER - FORK_REACH, frame)
    const bottom = projectPlot(MAP_CENTER, MAP_CENTER + FORK_REACH, frame)
    const center = projectPlot(MAP_CENTER, MAP_CENTER, frame)

    expect(right.x).toBeCloseTo(frame.width - MAP_SCREEN_INSET.right, 4)
    expect(left.x).toBeCloseTo(MAP_SCREEN_INSET.left, 4)
    expect(top.y).toBeCloseTo(MAP_SCREEN_INSET.top, 4)
    expect(bottom.y).toBeCloseTo(frame.height - MAP_SCREEN_INSET.bottom, 4)
    expect(center).toEqual({
      x: frame.originX,
      y: frame.originY,
    })
    expect(frame.scaleX).toBeGreaterThan(frame.scaleY)
  })

  it('接近正方形时横向和纵向拉开得差不多', () => {
    const frame = fitMapFrame(900, 900)
    expect(frame.scaleX / frame.scaleY).toBeGreaterThan(0.85)
    expect(frame.scaleX / frame.scaleY).toBeLessThan(1.15)
  })
})
