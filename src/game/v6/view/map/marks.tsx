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

function body(mark: MapMarkId): ReactNode {
  switch (mark) {
    case 'start':
      return (
        <>
          {ring(13)}
          {ring(4)}
          {spokes(4, 16, 21)}
        </>
      )
    case 'monster.001':
      return (
        <>
          {ring(12)}
          {spokes(8, 7, 14, -Math.PI / 2, 2)}
        </>
      )
    case 'monster.002':
      return (
        <>
          {ring(12)}
          <line x1={-12} y1={0} x2={12} y2={0} />
          <line x1={0} y1={-12} x2={0} y2={12} />
        </>
      )
    case 'monster.003':
      return (
        <>
          {ngon(4, 14, Math.PI / 4)}
          {ngon(4, 6, Math.PI / 4)}
        </>
      )
    default: {
      const unreachable: never = mark
      return unreachable
    }
  }
}

/** 和主菜单同一套多边形笔画。起点一个，每只怪物一个。 */
export function MapMark({ mark }: { mark: MapMarkId }) {
  return (
    <g className="v6-map__mark" transform="scale(1.8)">
      {body(mark)}
    </g>
  )
}
