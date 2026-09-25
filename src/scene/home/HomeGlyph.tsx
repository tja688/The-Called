import { useEffect, useRef } from 'react'
import { approachPose, polygonPath, poseAt, type GlyphId, type GlyphPose } from './glyphPose'

const SCALE = 100

function paint(pose: GlyphPose, nodes: {
  outer: SVGPathElement
  shell: SVGPathElement
  inner: SVGPathElement
  core: SVGPathElement
  ring: SVGPathElement
  spokes: SVGLineElement[]
}) {
  const point = (radius: number, angle: number) => {
    const x = Math.cos(angle) * radius * SCALE
    const y = Math.sin(angle) * radius * SCALE
    return { x, y }
  }
  nodes.outer.setAttribute('d', polygonPath(pose.outerSides, pose.outerRotation, pose.outerRadius, 96, SCALE))
  nodes.shell.setAttribute('d', polygonPath(pose.outerSides, pose.outerRotation, pose.outerRadius * 0.9, 96, SCALE))
  nodes.inner.setAttribute('d', polygonPath(pose.innerSides, pose.innerRotation, pose.innerRadius, 96, SCALE))
  nodes.core.setAttribute('d', polygonPath(pose.coreSides, pose.coreRotation, pose.coreRadius, 48, SCALE))
  nodes.ring.setAttribute('d', polygonPath(64, 0, pose.ringRadius, 72, SCALE))
  nodes.ring.style.opacity = pose.ringRadius < 0.04 ? '0' : '0.55'
  pose.spokes.forEach((spoke, index) => {
    const line = nodes.spokes[index]
    const visible = spoke.outer - spoke.inner > 0.03
    const angle = pose.spokeRotation + (index / pose.spokes.length) * Math.PI * 2
    const start = point(spoke.inner, angle)
    const end = point(visible ? spoke.outer : spoke.inner, angle)
    line.setAttribute('x1', start.x.toFixed(2))
    line.setAttribute('y1', start.y.toFixed(2))
    line.setAttribute('x2', end.x.toFixed(2))
    line.setAttribute('y2', end.y.toFixed(2))
    line.style.opacity = visible ? '0.88' : '0'
    line.style.stroke = visible && spoke.inner < 0.22 && spoke.outer < 0.68 && spoke.outer - spoke.inner > 0.28 ? '#77fba6' : ''
  })
}

export function HomeGlyph({ motif }: { motif: GlyphId }) {
  const motifRef = useRef(motif)
  const outerRef = useRef<SVGPathElement>(null)
  const shellRef = useRef<SVGPathElement>(null)
  const innerRef = useRef<SVGPathElement>(null)
  const coreRef = useRef<SVGPathElement>(null)
  const ringRef = useRef<SVGPathElement>(null)
  const spokeRefs = useRef<Array<SVGLineElement | null>>([])
  motifRef.current = motif

  useEffect(() => {
    const nodes = {
      outer: outerRef.current,
      shell: shellRef.current,
      inner: innerRef.current,
      core: coreRef.current,
      ring: ringRef.current,
      spokes: spokeRefs.current.filter((line): line is SVGLineElement => Boolean(line)),
    }
    if (!nodes.outer || !nodes.shell || !nodes.inner || !nodes.core || !nodes.ring || nodes.spokes.length < 12) return
    const drawn = {
      outer: nodes.outer,
      shell: nodes.shell,
      inner: nodes.inner,
      core: nodes.core,
      ring: nodes.ring,
      spokes: nodes.spokes,
    }

    let pose = poseAt(motifRef.current, 0)
    let frame = 0
    let last = performance.now()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const goal = poseAt(motifRef.current, reduced ? 0 : now / 1000)
      pose = reduced ? goal : approachPose(pose, goal, dt)
      paint(pose, drawn)
      if (!reduced) frame = window.requestAnimationFrame(tick)
    }

    paint(pose, drawn)
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="home-glyph" aria-hidden="true">
      <svg viewBox="-110 -110 220 220">
        <circle className="home-glyph__guide" cx="0" cy="0" r="98" />
        <path ref={ringRef} className="home-glyph__ring" />
        <path ref={outerRef} className="home-glyph__outer" />
        <path ref={shellRef} className="home-glyph__shell" />
        <path ref={innerRef} className="home-glyph__inner" />
        <path ref={coreRef} className="home-glyph__core" />
        {Array.from({ length: 12 }, (_, index) => (
          <line key={index} ref={(node) => { spokeRefs.current[index] = node }} className="home-glyph__spoke" />
        ))}
      </svg>
    </div>
  )
}
