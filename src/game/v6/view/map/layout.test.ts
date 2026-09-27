import { describe, expect, it } from 'vitest'
import { DEFAULT_MAP_SEED, generateMap } from '../../map'
import {
  fitMapFrame,
  layoutMap,
  MAP_CENTER,
  MAP_SCREEN_INSET,
  MAP_SIZE,
  projectPlot,
  TIER_RADIUS,
} from './layout'

function closest(plots: ReturnType<typeof layoutMap>, sameTier: boolean) {
  let best = { d: Infinity, a: '', b: '' }
  for (let i = 0; i < plots.length; i += 1) {
    for (let j = i + 1; j < plots.length; j += 1) {
      const left = plots[i]
      const right = plots[j]
      if (!left || !right) continue
      if (sameTier && (left.tier !== right.tier || left.tier === 0)) continue
      const d = Math.hypot(left.x - right.x, left.y - right.y)
      if (d < best.d) best = { d, a: left.id, b: right.id }
    }
  }
  return best
}

describe('地图布局', () => {
  it('整张图落在一屏里，同一档互不叠在一起', () => {
    for (const seed of [DEFAULT_MAP_SEED, 1, 7, 99]) {
      const graph = generateMap(seed)
      const plots = layoutMap(graph)
      expect(plots.map((plot) => plot.id).sort()).toEqual(graph.nodes.map((node) => node.id).sort())

      const center = plots.find((plot) => plot.id === 'center')
      expect(center).toMatchObject({ x: MAP_CENTER, y: MAP_CENTER, tier: 0 })

      for (const plot of plots) {
        expect(plot.x).toBeGreaterThan(36)
        expect(plot.y).toBeGreaterThan(36)
        expect(plot.x).toBeLessThan(MAP_SIZE - 36)
        expect(plot.y).toBeLessThan(MAP_SIZE - 36)
        const radius = TIER_RADIUS[plot.tier]
        expect(radius).toBeTypeOf('number')
        expect(Math.hypot(plot.x - MAP_CENTER, plot.y - MAP_CENTER)).toBeCloseTo(radius ?? -1, 4)
      }

      const same = closest(plots, true)
      const any = closest(plots, false)
      expect(same.d, `${seed} 同档 ${same.a} 与 ${same.b}`).toBeGreaterThan(70)
      expect(any.d, `${seed} 最近 ${any.a} 与 ${any.b}`).toBeGreaterThan(60)
    }
  })

  it('同一张图排两次，位置不变', () => {
    const graph = generateMap(DEFAULT_MAP_SEED)
    expect(layoutMap(graph)).toEqual(layoutMap(graph))
  })

  it('外圈贴着画面四边，中心留在留白后的正中', () => {
    const frame = fitMapFrame(1600, 900)
    const outer = TIER_RADIUS[TIER_RADIUS.length - 1] ?? 0
    const right = projectPlot(MAP_CENTER + outer, MAP_CENTER, frame)
    const left = projectPlot(MAP_CENTER - outer, MAP_CENTER, frame)
    const top = projectPlot(MAP_CENTER, MAP_CENTER - outer, frame)
    const bottom = projectPlot(MAP_CENTER, MAP_CENTER + outer, frame)
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
