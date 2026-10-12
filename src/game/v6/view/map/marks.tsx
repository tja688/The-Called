import type { ReactNode } from 'react'
import type { MapMarkId } from './viewModel'

function body(mark: MapMarkId): ReactNode {
    switch (mark) {
        case 'start':
            return (
                <>
                    <path d="M -16 -17 H 16 V 17 H 10 V -11 H -10 V 17 H -16 Z" />
                    <path
                        className="v6-map__sprite-dim"
                        d="M -18 17 H 18 V 21 H -18 Z M -10 -11 H 10 V -7 H -10 Z"
                    />
                    <path
                        className="v6-map__sprite-accent"
                        d="M -2 -4 H 2 V 4 H -2 Z M -6 0 H 6 V 2 H -6 Z"
                    />
                </>
            )
        case 'monster.001':
            return (
                <>
                    <path d="M -12 -16 H 12 V -10 H 18 V -4 H 14 V 10 H 8 V 18 H 2 V 12 H -2 V 18 H -8 V 10 H -14 V -4 H -18 V -10 H -12 Z" />
                    <path
                        className="v6-map__sprite-dim"
                        d="M -22 -4 H -16 V 6 H -22 Z M 16 -4 H 22 V 6 H 16 Z M -8 2 H 8 V 6 H -8 Z"
                    />
                    <path
                        className="v6-map__sprite-ink"
                        d="M -8 -10 H -2 V -4 H -8 Z M 2 -10 H 8 V -4 H 2 Z"
                    />
                    <rect
                        className="v6-map__sprite-accent"
                        x="-3"
                        y="3"
                        width="6"
                        height="2"
                    />
                </>
            )
        case 'monster.002':
            return (
                <>
                    <path d="M -12 -18 H 12 V -14 H 18 V -6 H 14 V -2 H 18 V 6 H 14 V 10 H 18 V 18 H -18 V 10 H -14 V 6 H -18 V -2 H -14 V -6 H -18 V -14 H -12 Z" />
                    <path
                        className="v6-map__sprite-ink"
                        d="M -14 -6 H 14 V -2 H -14 Z M -14 6 H 14 V 10 H -14 Z"
                    />
                    <path
                        className="v6-map__sprite-dim"
                        d="M -10 -14 H 10 V -10 H -10 Z M -10 14 H 6 V 16 H -10 Z"
                    />
                    <path
                        className="v6-map__sprite-accent"
                        d="M 7 -14 H 11 V -10 H 7 Z M 7 -2 H 11 V 2 H 7 Z M 7 10 H 11 V 14 H 7 Z"
                    />
                </>
            )
        case 'monster.003':
            return (
                <>
                    <path d="M -20 -20 H -14 V -12 H -8 V -16 H 8 V -12 H 14 V -20 H 20 V -6 H 14 V 0 H 22 V 16 H 14 V 10 H 8 V 22 H 2 V 14 H -2 V 22 H -8 V 10 H -14 V 16 H -22 V 0 H -14 V -6 H -20 Z" />
                    <path
                        className="v6-map__sprite-ink"
                        d="M -8 -8 H -2 V -4 H -8 Z M 2 -8 H 8 V -4 H 2 Z M -6 0 H 6 V 8 H -6 Z"
                    />
                    <path
                        className="v6-map__sprite-dim"
                        d="M -18 4 H -14 V 12 H -18 Z M 14 4 H 18 V 12 H 14 Z"
                    />
                    <rect
                        className="v6-map__sprite-accent"
                        x="-2"
                        y="2"
                        width="4"
                        height="4"
                    />
                </>
            )
        default: {
            const unreachable: never = mark
            return unreachable
        }
    }
}

export function MapMark({ mark }: { mark: MapMarkId }) {
    return (
        <g
            className="v6-map__mark"
            transform="scale(1.35)"
            shapeRendering="crispEdges"
            aria-hidden="true"
        >
            {body(mark)}
        </g>
    )
}
