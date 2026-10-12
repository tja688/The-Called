import {
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react'
import { playBrainClick } from '../../../../audio/gameAudio'
import { canMoveTo, createSession, type MapSession } from '../../map'
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

export interface MapViewProps {
    onEnterBattle: (monsterId: string, nodeId: string) => void
    session?: MapSession
    onSessionChange?: (session: MapSession) => void
}

type Point = Pick<MapPlot, 'x' | 'y'>
const ROOM_INSET = { top: 104, right: 74, bottom: 132, left: 74 }
interface Trip {
    nodeId: string
    title: string
    from: Point
    to: Point
    dur: number
    session: MapSession
}

/** The avatar follows the same orthogonal corridor that is drawn on the map. */
function alongPassage(from: Point, to: Point, progress: number): Point {
    const midY = (from.y + to.y) / 2
    const leading = Math.abs(midY - from.y)
    const across = Math.abs(to.x - from.x)
    const trailing = Math.abs(to.y - midY)
    const travelled = (leading + across + trailing) * progress
    if (leading > 0 && travelled < leading)
        return { x: from.x, y: from.y + Math.sign(midY - from.y) * travelled }
    if (across > 0 && travelled < leading + across)
        return {
            x: from.x + Math.sign(to.x - from.x) * (travelled - leading),
            y: midY,
        }
    return {
        x: to.x,
        y: midY + Math.sign(to.y - midY) * (travelled - leading - across),
    }
}

function chamberPath(width: number, height: number): string {
    const x = width / 2
    const y = height / 2
    return `M ${-x + 8} ${-y} H ${x} V ${y - 8} L ${x - 8} ${y} H ${-x} V ${-y + 8} Z`
}

export function MapView({
    onEnterBattle,
    session: controlledSession,
    onSessionChange,
}: MapViewProps) {
    const [ownedSession, setOwnedSession] = useState<MapSession>(() =>
        createSession(),
    )
    const session = controlledSession ?? ownedSession
    const [trip, setTrip] = useState<Trip | null>(null)
    const [live, setLive] = useState<Point | null>(null)
    const [hint, setHint] = useState<string | null>(null)
    const [frame, setFrame] = useState<MapFrame>(() =>
        fitMapFrame(1600, 900, ROOM_INSET),
    )
    const graphRef = useRef<SVGSVGElement>(null)
    const patternId = useId().replace(/:/g, '')
    const callbacks = useRef({
        onEnterBattle,
        onSessionChange,
        controlled: controlledSession !== undefined,
    })
    callbacks.current = {
        onEnterBattle,
        onSessionChange,
        controlled: controlledSession !== undefined,
    }

    useLayoutEffect(() => {
        const el = graphRef.current
        if (!el) return
        const apply = () => {
            const rect = el.getBoundingClientRect()
            if (rect.width < 2 || rect.height < 2) return
            setFrame((prev) => {
                if (
                    Math.abs(prev.width - rect.width) < 0.5 &&
                    Math.abs(prev.height - rect.height) < 0.5
                )
                    return prev
                return fitMapFrame(rect.width, rect.height, ROOM_INSET)
            })
        }
        apply()
        const observer = new ResizeObserver(apply)
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const view = toMapView(session)
    const plots = useMemo(() => layoutMap(session.graph), [session.graph])
    const plotById = useMemo(
        () => new Map(plots.map((plot) => [plot.id, plot])),
        [plots],
    )

    useEffect(() => {
        if (!trip) return
        let cancelled = false
        let request = 0
        const dur = window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 0
            : trip.dur
        const started = performance.now()
        const step = (now: number) => {
            if (cancelled) return
            const progress = dur === 0 ? 1 : Math.min(1, (now - started) / dur)
            const eased = -(Math.cos(Math.PI * progress) - 1) / 2
            setLive(alongPassage(trip.from, trip.to, eased))
            if (progress < 1) {
                request = requestAnimationFrame(step)
                return
            }
            cancelled = true
            const result = arriveAt(trip.session, trip.nodeId)
            if (callbacks.current.controlled)
                callbacks.current.onSessionChange?.(result.session)
            else setOwnedSession(result.session)
            setTrip(null)
            setLive(null)
            if (result.type === 'enter')
                callbacks.current.onEnterBattle(result.monsterId, result.nodeId)
        }
        request = requestAnimationFrame(step)
        return () => {
            cancelled = true
            cancelAnimationFrame(request)
        }
    }, [trip])

    const here = view.places.find((place) => place.sight === 'here')
    const herePlot = plotById.get(session.currentNodeId)
    const blip = projectPlot(
        live?.x ?? herePlot?.x ?? MAP_CENTER,
        live?.y ?? herePlot?.y ?? MAP_CENTER,
        frame,
    )
    const roomWidth = Math.min(
        194,
        Math.max(96, Math.floor((frame.width * 0.16) / 2) * 2),
    )
    const roomHeight = Math.min(
        150,
        Math.max(100, Math.floor((frame.height * 0.21) / 2) * 2),
    )
    const status = trip
        ? `前往${trip.title}…`
        : (hint ?? view.arrival ?? '选择相邻房间，进入对局。')

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
        setHint(null)
        setTrip({
            nodeId: place.id,
            title: place.title,
            from,
            to,
            dur: 780,
            session,
        })
    }

    const onKey = (event: KeyboardEvent<SVGGElement>, place: MapPlaceView) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        startTrip(place)
    }

    return (
        <section
            className={trip ? 'v6-map v6-map--moving' : 'v6-map'}
            aria-label="遗迹地图"
        >
            <div className="v6-map__readout">
                <p className="v6-map__eyebrow">CURRENT LOCATION</p>
                <p className="v6-map__where">{here?.title ?? '遗迹入口'}</p>
                <p className="v6-map__status" role="status">
                    {status}
                </p>
            </div>
            <div className="v6-map__coordinates" aria-hidden="true">
                <span>RUINS / SECTOR 01</span>
                <span>DEPTH 000</span>
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
                    <pattern
                        id={`${patternId}-floor`}
                        width="24"
                        height="24"
                        patternUnits="userSpaceOnUse"
                    >
                        <rect width="24" height="24" fill="#17171b" />
                        <path
                            d="M 0 0 H 24 M 0 0 V 24"
                            stroke="#222227"
                            strokeWidth="2"
                        />
                        <rect x="6" y="6" width="2" height="2" fill="#29292e" />
                        <rect
                            x="19"
                            y="17"
                            width="2"
                            height="2"
                            fill="#101013"
                        />
                    </pattern>
                    <pattern
                        id={`${patternId}-dust`}
                        width="32"
                        height="32"
                        patternUnits="userSpaceOnUse"
                    >
                        <rect x="0" y="0" width="2" height="2" fill="#29292e" />
                        <rect
                            x="16"
                            y="18"
                            width="2"
                            height="2"
                            fill="#1c1c20"
                        />
                    </pattern>
                </defs>
                <rect
                    width={frame.width}
                    height={frame.height}
                    fill={`url(#${patternId}-dust)`}
                    opacity=".5"
                />

                {session.graph.edges.map(([leftId, rightId]) => {
                    const left = plotById.get(leftId)
                    const right = plotById.get(rightId)
                    if (!left || !right) return null
                    const from = projectPlot(left.x, left.y, frame)
                    const to = projectPlot(right.x, right.y, frame)
                    const midY = Math.round((from.y + to.y) / 2)
                    const path = `M ${from.x} ${from.y} V ${midY} H ${to.x} V ${to.y}`
                    const walked =
                        session.visited.includes(leftId) &&
                        session.visited.includes(rightId)
                    const liveEdge =
                        trip !== null &&
                        ((leftId === session.currentNodeId &&
                            rightId === trip.nodeId) ||
                            (rightId === session.currentNodeId &&
                                leftId === trip.nodeId))
                    const available =
                        leftId === session.currentNodeId ||
                        rightId === session.currentNodeId
                    const tone = liveEdge
                        ? 'live'
                        : walked
                          ? 'walked'
                          : available
                            ? 'open'
                            : 'known'
                    return (
                        <g
                            key={`${leftId}|${rightId}`}
                            className={`v6-map__passage v6-map__passage--${tone}`}
                        >
                            <path className="v6-map__corridor-wall" d={path} />
                            <path
                                className="v6-map__corridor-floor"
                                d={path}
                                stroke={`url(#${patternId}-floor)`}
                            />
                            <path
                                className={`v6-map__edge v6-map__edge--${tone}`}
                                d={path}
                            />
                        </g>
                    )
                })}

                {view.places.map((place, index) => {
                    const plot = plotById.get(place.id)
                    if (!plot) return null
                    const spot = projectPlot(plot.x, plot.y, frame)
                    const retry =
                        place.sight === 'here' && view.action.type === 'enter'
                    const clickable = !trip && (place.sight === 'open' || retry)
                    const label =
                        place.sight === 'open'
                            ? `走到${place.title}`
                            : retry
                              ? `与${place.title}交战`
                              : undefined
                    return (
                        <g
                            key={place.id}
                            className={`v6-map__node v6-map__node--${place.sight} v6-map__node--${place.kind}${clickable ? ' v6-map__node--hot' : ''}`}
                            transform={`translate(${Math.round(spot.x)} ${Math.round(spot.y)})`}
                            data-node-id={place.id}
                            data-sight={place.sight}
                            data-mark={place.mark}
                            aria-current={
                                place.sight === 'here' ? 'true' : undefined
                            }
                            role={clickable ? 'button' : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            aria-label={label}
                            onClick={
                                clickable ? () => startTrip(place) : undefined
                            }
                            onKeyDown={
                                clickable
                                    ? (event) => onKey(event, place)
                                    : undefined
                            }
                            onMouseEnter={() =>
                                setHint(
                                    clickable
                                        ? `${place.title} · ${retry ? '再次挑战' : '点击进入'}`
                                        : place.title,
                                )
                            }
                            onMouseLeave={() => setHint(null)}
                            onFocus={() =>
                                setHint(
                                    clickable
                                        ? `${place.title} · 按回车进入`
                                        : place.title,
                                )
                            }
                            onBlur={() => setHint(null)}
                        >
                            <path
                                className="v6-map__room-shadow"
                                d={chamberPath(roomWidth + 10, roomHeight + 10)}
                                transform="translate(0 6)"
                            />
                            <path
                                className="v6-map__room-wall"
                                d={chamberPath(roomWidth, roomHeight)}
                            />
                            <path
                                className="v6-map__room-floor"
                                d={chamberPath(roomWidth - 14, roomHeight - 14)}
                                fill={`url(#${patternId}-floor)`}
                            />
                            <path
                                className="v6-map__wall-light"
                                d={`M ${-roomWidth / 2 + 10} ${-roomHeight / 2 + 2} H ${roomWidth / 2 - 2}`}
                            />
                            <path
                                className="v6-map__wall-depth"
                                d={`M ${-roomWidth / 2 + 2} ${roomHeight / 2 - 2} H ${roomWidth / 2 - 10}`}
                            />
                            {Array.from({ length: 12 }, (_, speck) => (
                                <rect
                                    key={speck}
                                    className="v6-map__rubble"
                                    x={
                                        ((speck * 31 + index * 17) %
                                            (roomWidth - 30)) -
                                        roomWidth / 2 +
                                        15
                                    }
                                    y={
                                        ((speck * 19 + index * 23) %
                                            (roomHeight - 34)) -
                                        roomHeight / 2 +
                                        17
                                    }
                                    width={speck % 3 === 0 ? 4 : 2}
                                    height="2"
                                />
                            ))}
                            <text
                                className="v6-map__room-code"
                                x={-roomWidth / 2 + 16}
                                y={-roomHeight / 2 + 23}
                            >
                                {place.kind === 'start'
                                    ? 'ENTRY / 00'
                                    : `MATCH / 0${index}`}
                            </text>
                            <g className="v6-map__figure">
                                <MapMark mark={place.mark} />
                            </g>
                            {clickable ? (
                                <path
                                    className="v6-map__choice"
                                    d={`M ${-roomWidth / 2 - 4} ${-roomHeight / 2 + 10} V ${-roomHeight / 2 - 4} H ${-roomWidth / 2 + 10} M ${roomWidth / 2 + 4} ${roomHeight / 2 - 10} V ${roomHeight / 2 + 4} H ${roomWidth / 2 - 10}`}
                                />
                            ) : null}
                            <text
                                className="v6-map__node-title"
                                textAnchor="middle"
                                y={roomHeight / 2 + 24}
                            >
                                {place.title}
                            </text>
                            <text
                                className="v6-map__node-state"
                                textAnchor="middle"
                                y={roomHeight / 2 + 42}
                            >
                                {place.sight === 'here'
                                    ? '当前位置'
                                    : trip?.nodeId === place.id
                                      ? '前往中'
                                      : place.sight === 'open'
                                        ? '可进入'
                                        : '经由起点前往'}
                            </text>
                            {clickable ? (
                                <path
                                    className="v6-map__hit"
                                    d={chamberPath(
                                        roomWidth + 18,
                                        roomHeight + 18,
                                    )}
                                />
                            ) : null}
                        </g>
                    )
                })}

                <g
                    className="v6-map__blip"
                    transform={`translate(${Math.round(blip.x / 2) * 2} ${Math.round(blip.y / 2) * 2 + (trip ? 0 : 30)})`}
                    aria-hidden="true"
                >
                    <path
                        className="v6-map__player-shadow"
                        d="M -10 10 H 10 V 14 H -10 Z"
                    />
                    <path
                        className="v6-map__player"
                        d="M -4 -8 H 4 V 0 H 8 V 8 H 4 V 12 H 0 V 8 H -4 V 12 H -8 V 0 H -4 Z"
                    />
                    <rect
                        className="v6-map__player-eye"
                        x="-2"
                        y="-4"
                        width="4"
                        height="2"
                    />
                    <path
                        className="v6-map__player-cursor"
                        d="M -5 -16 H 5 L 0 -11 Z"
                    />
                    {!trip ? (
                        <text className="v6-map__you" x="16" y="5">
                            YOU
                        </text>
                    ) : null}
                </g>
            </svg>

            <footer className="v6-map__legend">
                <span>
                    <i className="v6-map__legend-player" /> 当前位置
                </span>
                <span>
                    <i className="v6-map__legend-match" /> 可进入对局
                </span>
                <span>
                    <i className="v6-map__legend-route" /> 已探索路线
                </span>
            </footer>
            <p className="v6-map__hint">
                点击房间探索 <kbd>ENTER</kbd> 确认
            </p>
        </section>
    )
}
