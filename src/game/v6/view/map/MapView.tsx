import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { playBrainClick } from '../../../../audio/gameAudio'
import { polygonPath } from '../../../../scene/home/glyphPose'
import {
  canMoveTo,
  createSession,
  type MapSession,
} from '../../map'
import {
  fitMapFrame,
  layoutMap,
  MAP_CENTER,
  projectPlot,
  type MapFrame,
  type MapPlot,
} from './layout'
import { MapMark } from './marks'
import { arriveAt, toMapView, type MapPlaceView } from './viewModel'
import './map.css'

const CHOICE_RING = polygonPath(64, 0, 30, 64)

export interface MapViewProps {
  /** 走到可战斗的节点时交给外面。本组件不自己换页。 */
  onEnterBattle: (monsterId: string, nodeId: string) => void
  /**
   * 父组件接手会话时传入。战斗回来后仍是同一个会话，所在节点留着。
   * 不传时，组件自己持有一份开局会话。
   */
  session?: MapSession
  onSessionChange?: (session: MapSession) => void
}

interface Trip {
  nodeId: string
  title: string
  from: { x: number, y: number }
  to: { x: number, y: number }
  dur: number
  session: MapSession
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2
}

function trim(from: MapPlot, to: MapPlot, pad: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length <= pad * 2) return null
  const ux = dx / length
  const uy = dy / length
  return {
    x1: from.x + ux * pad,
    y1: from.y + uy * pad,
    x2: to.x - ux * pad,
    y2: to.y - uy * pad,
  }
}

export function MapView({ onEnterBattle, session: controlledSession, onSessionChange }: MapViewProps) {
  const [ownedSession, setOwnedSession] = useState<MapSession>(() => createSession())
  const session = controlledSession ?? ownedSession
  const [trip, setTrip] = useState<Trip | null>(null)
  const [live, setLive] = useState<{ x: number, y: number } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [frame, setFrame] = useState<MapFrame>(() => fitMapFrame(1600, 900))
  const graphRef = useRef<SVGSVGElement>(null)
  const glowId = useId().replace(/:/g, '')
  const callbacks = useRef({ onEnterBattle, onSessionChange, controlled: controlledSession !== undefined })
  callbacks.current = { onEnterBattle, onSessionChange, controlled: controlledSession !== undefined }

  useLayoutEffect(() => {
    const el = graphRef.current
    if (!el) return
    const apply = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return
      setFrame((prev) => {
        if (Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5) return prev
        return fitMapFrame(rect.width, rect.height)
      })
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const view = toMapView(session)
  const plots = useMemo(() => layoutMap(session.graph), [session.graph])
  const plotById = useMemo(() => new Map(plots.map((plot) => [plot.id, plot])), [plots])

  useEffect(() => {
    if (!trip) return
    let cancelled = false
    let frame = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dur = reduced ? 0 : trip.dur
    const started = performance.now()

    const step = (now: number) => {
      if (cancelled) return
      const k = dur === 0 ? 1 : Math.min(1, (now - started) / dur)
      const eased = easeInOutSine(k)
      setLive({
        x: trip.from.x + (trip.to.x - trip.from.x) * eased,
        y: trip.from.y + (trip.to.y - trip.from.y) * eased,
      })
      if (k < 1) {
        frame = requestAnimationFrame(step)
        return
      }
      cancelled = true
      const result = arriveAt(trip.session, trip.nodeId)
      if (callbacks.current.controlled) callbacks.current.onSessionChange?.(result.session)
      else setOwnedSession(result.session)
      setTrip(null)
      setLive(null)
      if (result.type === 'enter') callbacks.current.onEnterBattle(result.monsterId, result.nodeId)
    }

    frame = requestAnimationFrame(step)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [trip])

  const here = view.places.find((place) => place.sight === 'here')
  const herePlot = plotById.get(session.currentNodeId)
  const blip = projectPlot(
    live?.x ?? herePlot?.x ?? MAP_CENTER,
    live?.y ?? herePlot?.y ?? MAP_CENTER,
    frame,
  )
  const status = trip ? `前往${trip.title}` : (hint ?? view.arrival)

  const startTrip = (place: MapPlaceView) => {
    if (trip) return
    if (place.sight === 'here') {
      if (view.action.type !== 'enter') return
      playBrainClick()
      onEnterBattle(view.action.monsterId, view.action.nodeId)
      return
    }
    if (place.sight !== 'open' || !canMoveTo(session, place.id)) return
    const from = plotById.get(session.currentNodeId)
    const to = plotById.get(place.id)
    if (!from || !to) return
    playBrainClick()
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    setHint(null)
    setTrip({
      nodeId: place.id,
      title: place.title,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      dur: Math.min(720, 340 + dist * 0.45),
      session,
    })
  }

  const onKey = (event: KeyboardEvent<SVGGElement>, place: MapPlaceView) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    startTrip(place)
  }

  return (
    <section className={trip ? 'v6-map v6-map--moving' : 'v6-map'} aria-label="大地图">
      <div className="v6-map__readout">
        <p className="v6-map__where">{here?.title ?? '地图'}</p>
        <p
          className="v6-map__status"
          role="status"
        >
          {status ?? ''}
        </p>
      </div>

      <svg
        ref={graphRef}
        className="v6-map__graph"
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="节点地图"
      >
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffef6" stopOpacity="0.55" />
            <stop offset="18%" stopColor="#f2fcbb" stopOpacity="0.22" />
            <stop offset="46%" stopColor="#f2fcbb" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#f2fcbb" stopOpacity="0" />
          </radialGradient>
        </defs>
        {session.graph.edges.map(([leftId, rightId]) => {
          const left = plotById.get(leftId)
          const right = plotById.get(rightId)
          const leftPlace = view.places.find((place) => place.id === leftId)
          const rightPlace = view.places.find((place) => place.id === rightId)
          if (!left || !right || !leftPlace || !rightPlace) return null
          const line = trim(left, right, 28)
          if (!line) return null
          const from = projectPlot(line.x1, line.y1, frame)
          const to = projectPlot(line.x2, line.y2, frame)
          const walked = session.visited.includes(leftId) && session.visited.includes(rightId)
          const liveEdge = trip !== null && (
            (leftId === session.currentNodeId && rightId === trip.nodeId)
            || (rightId === session.currentNodeId && leftId === trip.nodeId)
          )
          const tone = liveEdge ? 'live' : walked ? 'walked' : 'known'
          return (
            <line
              key={`${leftId}|${rightId}`}
              className={`v6-map__edge v6-map__edge--${tone}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
          )
        })}

        {view.places.map((place) => {
          const plot = plotById.get(place.id)
          if (!plot) return null
          const spot = projectPlot(plot.x, plot.y, frame)
          const retry = place.sight === 'here' && view.action.type === 'enter'
          const clickable = !trip && (place.sight === 'open' || retry)
          const label = place.sight === 'open'
            ? `走到${place.title}`
            : retry
              ? `与${place.title}交战`
              : undefined
          return (
            <g
              key={place.id}
              className={`v6-map__node v6-map__node--${place.sight} v6-map__node--${place.kind}${clickable ? ' v6-map__node--hot' : ''}`}
              transform={`translate(${spot.x} ${spot.y})`}
              data-node-id={place.id}
              data-sight={place.sight}
              data-mark={place.mark}
              aria-current={place.sight === 'here' ? 'true' : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={label}
              onClick={clickable ? () => startTrip(place) : undefined}
              onKeyDown={clickable ? (event) => onKey(event, place) : undefined}
              onMouseEnter={() => {
                setHint(place.sight === 'open' ? `走到${place.title}` : place.title)
              }}
              onMouseLeave={() => setHint((current) => (
                current === place.title || current === `走到${place.title}` ? null : current
              ))}
            >
              {clickable ? <path className="v6-map__choice" d={CHOICE_RING} /> : null}
              <MapMark mark={place.mark} />
              {clickable ? <circle className="v6-map__hit" r={34} /> : null}
            </g>
          )
        })}

        <g className="v6-map__blip" transform={`translate(${blip.x} ${blip.y})`} aria-hidden="true">
          <circle className="v6-map__halo" r={52} fill={`url(#${glowId})`} />
          <circle className="v6-map__ping" r={22} />
          <circle className="v6-map__ping v6-map__ping--late" r={22} />
          <g className="v6-map__beacon">
            <circle className="v6-map__iris" r={10} />
            <circle className="v6-map__core" r={5.2} />
            <circle className="v6-map__hot" r={2.1} />
          </g>
        </g>
      </svg>
    </section>
  )
}
