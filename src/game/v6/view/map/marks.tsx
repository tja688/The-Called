import type { ReactNode } from 'react'
import { polygonPath } from '../../../../scene/home/glyphPose'
import type { MapMarkId } from './viewModel'

function ring(radius: number, samples = 56) {
  return <path d={polygonPath(samples, 0, radius, samples)} />
}

function ngon(sides: number, radius: number, rotation: number) {
  return <path d={polygonPath(sides, rotation, radius, Math.max(sides * 8, 24))} />
}

function spokes(count: number, inner: number, outer: number, rotation = -Math.PI / 2, skip = -1) {
  return Array.from({ length: count }, (_, index) => {
    if (index === skip) return null
    const angle = rotation + (Math.PI * 2 * index) / count
    return (
      <line
        key={index}
        x1={Math.cos(angle) * inner}
        y1={Math.sin(angle) * inner}
        x2={Math.cos(angle) * outer}
        y2={Math.sin(angle) * outer}
      />
    )
  })
}

function orbitMarks(count: number, distance: number, radius: number, sides: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance
    return (
      <path
        key={index}
        d={polygonPath(sides, angle, radius, 24)}
        transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
      />
    )
  })
}

function body(mark: MapMarkId): ReactNode {
  switch (mark) {
    case 'fog':
      return ngon(4, 8, 0)
    case 'center':
      return (
        <>
          {ring(13)}
          {ring(4)}
          {spokes(4, 16, 21)}
        </>
      )
    case 'shop':
      return (
        <>
          {ngon(6, 13, Math.PI / 6)}
          <line x1={-7} y1={1.5} x2={7} y2={1.5} />
        </>
      )
    case 'runaway-machine':
      return (
        <>
          {ring(12)}
          {spokes(8, 7, 14, -Math.PI / 2, 2)}
        </>
      )
    case 'patrol-swarm':
      return orbitMarks(3, 8, 4.2, 3)
    case 'preaching-band':
      return (
        <>
          {ngon(3, 14, -Math.PI / 2)}
          {ngon(3, 6, Math.PI / 2)}
        </>
      )
    case 'mirror-person':
      return (
        <>
          {ring(12)}
          <line x1={0} y1={-12} x2={0} y2={12} />
        </>
      )
    case 'rust-colossus':
      return (
        <>
          {ngon(4, 14, Math.PI / 4)}
          {ngon(4, 6, Math.PI / 4)}
        </>
      )
    case 'carrion-crows':
      return (
        <>
          <path d="M -8 -8 L 0 -3 L 8 -8" />
          <path d="M -8 -1 L 0 4 L 8 -1" />
          <path d="M -8 6 L 0 11 L 8 6" />
        </>
      )
    case 'anatomist':
      return (
        <>
          {ring(12)}
          <line x1={-12} y1={0} x2={12} y2={0} />
          <line x1={5} y1={-5} x2={5} y2={5} />
        </>
      )
    case 'silent-order':
      return (
        <>
          {ring(13)}
          <line x1={-5} y1={0} x2={5} y2={0} />
        </>
      )
    case 'mirror-witch':
      return (
        <>
          {ngon(6, 13, Math.PI / 6)}
          {ngon(3, 6, Math.PI / 2)}
        </>
      )
    case 'bell-warden':
      return (
        <>
          <path d="M -11 -10 H 11 L 6 8 H -6 Z" />
          {ngon(4, 2.4, 0)}
        </>
      )
    case 'the-caller':
      return (
        <>
          {ring(13)}
          {spokes(8, 2, 13)}
        </>
      )
    default: {
      const unreachable: never = mark
      return unreachable
    }
  }
}

/** 和主菜单同一套多边形笔画。每种节点一个轮廓，迷雾共用菱形。 */
export function MapMark({ mark }: { mark: MapMarkId }) {
  return (
    <g className="v6-map__mark" transform="scale(1.8)">
      {body(mark)}
    </g>
  )
}
