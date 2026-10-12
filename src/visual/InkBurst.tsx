import type { CSSProperties } from 'react'

export function InkBurst({ tone = 'player' }: { tone?: string }) {
    return (
        <span className={`ink-burst ink-burst--${tone}`} aria-hidden="true">
            {Array.from({ length: 16 }, (_, index) => {
                const angle = index * 2.39996,
                    distance = 20 + (index % 5) * 11
                const style: CSSProperties & {
                    '--dx': string
                    '--dy': string
                } = {
                    '--dx': `${Math.round(Math.cos(angle) * distance)}px`,
                    '--dy': `${Math.round(Math.sin(angle) * distance)}px`,
                    width: index % 3 === 0 ? 5 : 3,
                    height: index % 4 === 0 ? 5 : 3,
                    animationDelay: `${(index % 3) * 15}ms`,
                }
                return <i key={index} style={style} />
            })}
        </span>
    )
}
