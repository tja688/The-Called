import { describe, expect, it } from 'vitest'
import { approachPose, polygonPath, poseAt, regularPolygonRadius } from './glyphPose'

describe('home glyph morph', () => {
  it('keeps polygon vertices on the requested radius', () => {
    expect(regularPolygonRadius(0, 4, 0)).toBeCloseTo(1, 5)
    expect(regularPolygonRadius(Math.PI / 4, 4, 0)).toBeCloseTo(Math.SQRT1_2, 5)
  })

  it('builds a closed path and eases one pose into another', () => {
    const path = polygonPath(3, -Math.PI / 2, 0.9)
    expect(path.startsWith('M ')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)

    const from = poseAt('play', 0)
    const toward = poseAt('rules', 0)
    const mid = approachPose(from, toward, 0.2)
    expect(mid.outerSides).toBeGreaterThan(from.outerSides)
    expect(mid.outerSides).toBeLessThan(toward.outerSides)
    expect(Number.isFinite(mid.innerRotation)).toBe(true)
    expect(polygonPath(mid.outerSides, mid.outerRotation, mid.outerRadius)).not.toContain('NaN')
  })
})
