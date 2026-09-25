export type GlyphId = 'play' | 'settings' | 'rules'

export type Spoke = { inner: number; outer: number }

export type GlyphPose = {
  outerSides: number
  outerRotation: number
  outerRadius: number
  innerSides: number
  innerRotation: number
  innerRadius: number
  coreSides: number
  coreRotation: number
  coreRadius: number
  ringRadius: number
  spokeRotation: number
  spokes: Spoke[]
}

const SPOKE_COUNT = 12
const TAU = Math.PI * 2

const silent = (inner = 0, outer = 0): Spoke => ({ inner, outer })

function spokes(values: Spoke[]): Spoke[] {
  return Array.from({ length: SPOKE_COUNT }, (_, index) => values[index] ?? silent())
}

export const glyphPoses: Record<GlyphId, GlyphPose> = {
  play: {
    outerSides: 3,
    outerRotation: -Math.PI / 2,
    outerRadius: 0.9,
    innerSides: 3,
    innerRotation: Math.PI / 2,
    innerRadius: 0.46,
    coreSides: 32,
    coreRotation: 0,
    coreRadius: 0.07,
    ringRadius: 0.22,
    spokeRotation: -Math.PI / 2,
    spokes: spokes([
      { inner: 0.1, outer: 0.9 },
      silent(),
      silent(),
      silent(),
      { inner: 0.1, outer: 0.9 },
      silent(),
      silent(),
      silent(),
      { inner: 0.1, outer: 0.9 },
    ]),
  },
  settings: {
    outerSides: 48,
    outerRotation: 0,
    outerRadius: 0.9,
    innerSides: 48,
    innerRotation: 0,
    innerRadius: 0.62,
    coreSides: 6,
    coreRotation: Math.PI / 6,
    coreRadius: 0.12,
    ringRadius: 0.34,
    spokeRotation: 0,
    spokes: spokes(Array.from({ length: SPOKE_COUNT }, (_, index) => (
      index === 0
        ? { inner: 0.16, outer: 0.58 }
        : { inner: 0.66, outer: index % 2 === 0 ? 0.9 : 0.8 }
    ))),
  },
  rules: {
    outerSides: 4,
    outerRotation: Math.PI / 4,
    outerRadius: 0.86,
    innerSides: 4,
    innerRotation: 0,
    innerRadius: 0.5,
    coreSides: 4,
    coreRotation: Math.PI / 4,
    coreRadius: 0.16,
    ringRadius: 0,
    spokeRotation: Math.PI / 4,
    spokes: spokes([
      { inner: 0.16, outer: 0.86 },
      { inner: 0.28, outer: 0.5 },
      silent(),
      { inner: 0.16, outer: 0.86 },
      { inner: 0.28, outer: 0.5 },
      silent(),
      { inner: 0.16, outer: 0.86 },
      { inner: 0.28, outer: 0.5 },
      silent(),
      { inner: 0.16, outer: 0.86 },
      { inner: 0.28, outer: 0.5 },
    ]),
  },
}

export function regularPolygonRadius(theta: number, sides: number, rotation: number) {
  const n = Math.max(sides, 2.01)
  const sector = TAU / n
  let phi = (theta - rotation) % sector
  if (phi < 0) phi += sector
  const denom = Math.cos(phi - sector / 2)
  if (denom < 0.08) return 1
  return Math.cos(Math.PI / n) / denom
}

export function polygonPoints(sides: number, rotation: number, radius: number, samples = 96) {
  return Array.from({ length: samples }, (_, index) => {
    const theta = (index / samples) * TAU
    const r = radius * regularPolygonRadius(theta, sides, rotation)
    return [Math.cos(theta) * r, Math.sin(theta) * r] as const
  })
}

export function polygonPath(sides: number, rotation: number, radius: number, samples = 96, scale = 1) {
  if (radius < 0.02) return ''
  const points = polygonPoints(sides, rotation, radius * scale, samples)
  return `M ${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L ')} Z`
}

function wrapAngle(delta: number) {
  return ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI
}

function damp(current: number, target: number, amount: number) {
  return current + (target - current) * amount
}

function dampAngle(current: number, target: number, amount: number) {
  return current + wrapAngle(target - current) * amount
}

export function approachPose(current: GlyphPose, target: GlyphPose, deltaSeconds: number, lambda = 5.4): GlyphPose {
  const amount = 1 - Math.exp(-lambda * deltaSeconds)
  return {
    outerSides: damp(current.outerSides, target.outerSides, amount),
    outerRotation: dampAngle(current.outerRotation, target.outerRotation, amount),
    outerRadius: damp(current.outerRadius, target.outerRadius, amount),
    innerSides: damp(current.innerSides, target.innerSides, amount),
    innerRotation: dampAngle(current.innerRotation, target.innerRotation, amount),
    innerRadius: damp(current.innerRadius, target.innerRadius, amount),
    coreSides: damp(current.coreSides, target.coreSides, amount),
    coreRotation: dampAngle(current.coreRotation, target.coreRotation, amount),
    coreRadius: damp(current.coreRadius, target.coreRadius, amount),
    ringRadius: damp(current.ringRadius, target.ringRadius, amount),
    spokeRotation: dampAngle(current.spokeRotation, target.spokeRotation, amount),
    spokes: current.spokes.map((spoke, index) => ({
      inner: damp(spoke.inner, target.spokes[index]?.inner ?? 0, amount),
      outer: damp(spoke.outer, target.spokes[index]?.outer ?? 0, amount),
    })),
  }
}

export function poseAt(id: GlyphId, time: number): GlyphPose {
  const pose = structuredClone(glyphPoses[id])
  const breath = Math.sin(time * 1.35)
  const slow = Math.sin(time * 0.72)
  if (id === 'play') {
    pose.outerRadius *= 1 + breath * 0.032
    pose.innerRadius *= 1 + Math.sin(time * 1.1) * 0.055
    pose.innerRotation += time * 0.28
    pose.coreRadius *= 1 + slow * 0.18
    pose.ringRadius *= 1 + breath * 0.08
  } else if (id === 'settings') {
    pose.outerRadius *= 1 + breath * 0.018
    pose.innerRadius *= 1 + Math.sin(time * 1.6) * 0.03
    pose.spokeRotation += time * 0.22
    pose.coreRotation += time * -0.35
    pose.ringRadius *= 1 + slow * 0.06
    pose.spokes[0].outer *= 1 + breath * 0.06
  } else {
    pose.outerRadius *= 1 + breath * 0.02
    pose.innerRotation += slow * 0.08
    pose.coreRotation += time * 0.18
    pose.coreRadius *= 1 + Math.sin(time * 1.5) * 0.08
    pose.innerRadius *= 1 + slow * 0.04
  }
  return pose
}
