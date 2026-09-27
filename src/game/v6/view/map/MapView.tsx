import { useState, type KeyboardEvent } from 'react'
import { createSession, DEFAULT_MAP_SEED, generateMap, moveTo, type MapSession } from '../../map'
import { toMapView, type MapPlaceView } from './viewModel'
import './map.css'

const CENTER_X = 380
const CENTER_Y = 270
const ORBIT_X = 230
const ORBIT_Y = 180

export interface MapViewProps {
  /** 点「进入战斗」时交给外面。本组件不自己换页。 */
  onEnterBattle: (monsterId: string, nodeId: string) => void
  /**
   * 父组件接手会话时传入。战斗回来后仍是同一个会话，迷雾和所在节点都留着。
   * 不传时，组件自己持有一份开局会话。
   */
  session?: MapSession
  onSessionChange?: (session: MapSession) => void
}

function neighborPoint(index: number, count: number): { x: number, y: number } {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count
  return {
    x: CENTER_X + Math.cos(angle) * ORBIT_X,
    y: CENTER_Y + Math.sin(angle) * ORBIT_Y,
  }
}

function distanceLine(place: MapPlaceView): string | null {
  if (place.kind === 'center') return null
  return `距离 ${place.distance}`
}

export function MapView({ onEnterBattle, session: controlledSession, onSessionChange }: MapViewProps) {
  const [ownedSession, setOwnedSession] = useState<MapSession>(() => createSession(generateMap(DEFAULT_MAP_SEED)))
  const session = controlledSession ?? ownedSession
  const view = toMapView(session)
  const here = view.places.find((place) => place.role === 'here')
  const neighbors = view.places.filter((place) => place.role === 'neighbor')
  const fight = view.action.type === 'enter' ? view.action : null

  const move = (nodeId: string) => {
    if (controlledSession === undefined) {
      setOwnedSession((current) => moveTo(current, nodeId))
      return
    }
    onSessionChange?.(moveTo(controlledSession, nodeId))
  }

  const onNeighborKey = (event: KeyboardEvent<SVGGElement>, nodeId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    move(nodeId)
  }

  return (
    <section className="v6-map" aria-label="大地图">
      <header className="v6-map__header">
        <p className="v6-map__kicker">当前所在</p>
        <h1 className="v6-map__heading">{here?.title ?? '地图'}</h1>
        {here && distanceLine(here) ? <p className="v6-map__here-distance">{distanceLine(here)}</p> : null}
        {view.arrival ? <p className="v6-map__arrival" role="status">{view.arrival}</p> : null}
      </header>

      <svg className="v6-map__graph" viewBox="0 0 760 540" role="group" aria-label="已揭示的相邻节点">
        {neighbors.map((place, index) => {
          const point = neighborPoint(index, neighbors.length)
          return (
            <line
              key={`link-${place.id}`}
              className="v6-map__link"
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={point.x}
              y2={point.y}
            />
          )
        })}

        {here ? <PlaceNode place={here} x={CENTER_X} y={CENTER_Y} /> : null}

        {neighbors.map((place, index) => {
          const point = neighborPoint(index, neighbors.length)
          const detail = distanceLine(place)
          const label = detail ? `走到${place.title}，${detail}` : `走到${place.title}`
          return (
            <PlaceNode
              key={place.id}
              place={place}
              x={point.x}
              y={point.y}
              label={label}
              onMove={move}
              onKeyDown={onNeighborKey}
            />
          )
        })}
      </svg>

      <div className="v6-map__action">
        {fight ? (
          <FightButton
            monsterId={fight.monsterId}
            nodeId={fight.nodeId}
            onEnterBattle={onEnterBattle}
          />
        ) : null}
        {view.action.type === 'locked' ? (
          <p className="v6-map__lock" role="status">{view.action.reason}</p>
        ) : null}
        {view.action.type === 'shop' ? (
          <p className="v6-map__shop">{view.action.text}</p>
        ) : null}
      </div>
    </section>
  )
}

function FightButton({
  monsterId,
  nodeId,
  onEnterBattle,
}: {
  monsterId: string
  nodeId: string
  onEnterBattle: (monsterId: string, nodeId: string) => void
}) {
  return (
    <button type="button" className="v6-map__fight" onClick={() => onEnterBattle(monsterId, nodeId)}>
      进入战斗
    </button>
  )
}

function PlaceNode({
  place,
  x,
  y,
  label,
  onMove,
  onKeyDown,
}: {
  place: MapPlaceView
  x: number
  y: number
  label?: string
  onMove?: (nodeId: string) => void
  onKeyDown?: (event: KeyboardEvent<SVGGElement>, nodeId: string) => void
}) {
  const detail = distanceLine(place)
  const movable = place.role === 'neighbor'
  return (
    <g
      className={`v6-map__node v6-map__node--${place.kind}${movable ? '' : ' v6-map__node--here'}`}
      transform={`translate(${x} ${y})`}
      data-node-id={place.id}
      aria-current={movable ? undefined : 'true'}
      role={movable ? 'button' : undefined}
      tabIndex={movable ? 0 : undefined}
      aria-label={label}
      onClick={movable && onMove ? () => onMove(place.id) : undefined}
      onKeyDown={movable && onKeyDown ? (event) => onKeyDown(event, place.id) : undefined}
    >
      <rect x={-58} y={-32} width={116} height={64} rx={8} />
      <text className="v6-map__title" textAnchor="middle" dominantBaseline="middle" y={detail ? -8 : 0}>
        {place.title}
      </text>
      {detail ? (
        <text className="v6-map__distance" textAnchor="middle" dominantBaseline="middle" y={14}>
          {detail}
        </text>
      ) : null}
    </g>
  )
}
